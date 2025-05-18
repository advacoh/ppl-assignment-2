import {
  Exp, CExp, Program, DefineExp, AppExp, IfExp, ProcExp, LetExp, LitExp, VarRef,
  isDefineExp, isAppExp, isIfExp, isProcExp, isLetExp, isLitExp, isAtomicExp,
  isDictExp, isNumExp, isBoolExp, isStrExp, isVarRef, isPrimOp,
  makeProgram, makeVarDecl, makeVarRef, makeAppExp,
  makeIfExp, makeProcExp, makeBoolExp, makeLitExp,
  Binding
} from "./L32/L32-ast";

import {
  SExpValue, makeSymbolSExp, makeCompoundSExp, makeEmptySExp
} from "./L32/L32-value";

import { map } from "ramda";
import { makePrimOp } from "./L3/L3-ast";

export const L32toL3 = (prog: Program): Program =>
  Dict2App(prog);

export const Dict2App = (exp: Program): Program =>
  makeProgram(map(rewriteExp, exp.exps));

const rewriteExp = (exp: Exp): Exp =>
  isDefineExp(exp) ? { ...exp, val: rewriteCExp(exp.val) } : rewriteCExp(exp);

const rewriteCExp = (exp: CExp): CExp => {
  if (isAtomicExp(exp) || isLitExp(exp)) return exp;
  if (isIfExp(exp)) return {
    ...exp,
    test: rewriteCExp(exp.test),
    then: rewriteCExp(exp.then),
    alt: rewriteCExp(exp.alt),
  };
  if (isProcExp(exp)) return { ...exp, body: exp.body.map(rewriteCExp) };
  if (isLetExp(exp)) return {
    ...exp,
    bindings: exp.bindings.map(b => ({ ...b, val: rewriteCExp(b.val) })),
    body: exp.body.map(rewriteCExp),
  };
  if (isAppExp(exp)) return {
    ...exp,
    rator: rewriteCExp(exp.rator),
    rands: exp.rands.map(rewriteCExp),
  };
  if (isDictExp(exp)) return rewriteDictExp(exp);
  return exp;
};

const quoteKeyIfNeeded = (key: VarRef): CExp =>
  makeLitExp(makeSymbolSExp(key.var));

const convertDictValue = (val: CExp): CExp => {
  if (isDictExp(val)) {
    const head = makeSymbolSExp("dict");
    const pairs: SExpValue[] = val.entries.map((b: Binding) =>
      listToCompoundSExp([
        cexpToSExpValue(makeVarRef(b.var.var)),
        cexpToSExpValue(rewriteCExp(b.val))
      ])
    );
    return makeLitExp(
      listToCompoundSExp([head, ...pairs])
    );
  }

  const rv = rewriteCExp(val);

  if (isPrimOp(rv)) {
    return makeLitExp(makeSymbolSExp(rv.op));
  }
  if (isVarRef(rv)) {
    return makeLitExp(makeSymbolSExp(rv.var));
  }
  if (isLitExp(rv) || isAtomicExp(rv)) {
    return rv;
  }
  return makeLitExp(cexpToSExpValue(rv));
};

const rewriteDictExp = (exp: any): CExp => {
  const keyParam = makeVarDecl("key");
  let body: CExp;

  if (exp.entries.length === 0) {
    body = makeBoolExp(false);
  } else {
    const last = exp.entries[exp.entries.length - 1];
    body = makeIfExp(
      makeAppExp(makePrimOp("eq?"), [makeVarRef("key"), quoteKeyIfNeeded(makeVarRef(last.var.var))]),
      convertDictValue(last.val),
      makeBoolExp(false)
    );

    for (let i = exp.entries.length - 2; i >= 0; i--) {
      const b = exp.entries[i];
      body = makeIfExp(
        makeAppExp(makePrimOp("eq?"), [makeVarRef("key"), quoteKeyIfNeeded(makeVarRef(b.var.var))]),
        convertDictValue(b.val),
        body
      );
    }
  }

  return makeProcExp([keyParam], [body]);
};

function cexpToSExpValue(exp: CExp): SExpValue {
  if (isNumExp(exp)) return exp.val;
  if (isBoolExp(exp)) return exp.val;
  if (isStrExp(exp)) return exp.val;
  if (isPrimOp(exp)) return makeSymbolSExp(exp.op);
  if (isVarRef(exp)) return makeSymbolSExp(exp.var);
  if (isLitExp(exp)) return exp.val;
  if (isAppExp(exp)) {
    const r = cexpToSExpValue(exp.rator);
    const rs = exp.rands.map(cexpToSExpValue);
    return listToCompoundSExp([r, ...rs]);
  }
  if (isIfExp(exp)) {
    return listToCompoundSExp([
      makeSymbolSExp("if"),
      cexpToSExpValue(exp.test),
      cexpToSExpValue(exp.then),
      cexpToSExpValue(exp.alt),
    ]);
  }
  if (isProcExp(exp)) {
    return listToCompoundSExp([
      makeSymbolSExp("lambda"),
      listToCompoundSExp(exp.args.map(a => makeSymbolSExp(a.var))),
      ...exp.body.map(cexpToSExpValue),
    ]);
  }
  if (isLetExp(exp)) {
    const bs = listToCompoundSExp(
      exp.bindings.map(b =>
        listToCompoundSExp([
          makeSymbolSExp(b.var.var),
          cexpToSExpValue(b.val),
        ])
      )
    );
    return listToCompoundSExp([
      makeSymbolSExp("let"),
      bs,
      ...exp.body.map(cexpToSExpValue),
    ]);
  }
  throw new Error(`Unknown CExp: ${JSON.stringify(exp)}`);
}

function listToCompoundSExp(sexps: SExpValue[]): SExpValue {
  if (sexps.length === 0) return makeEmptySExp();
  if (sexps.length === 1) return makeCompoundSExp(sexps[0], makeEmptySExp());
  return makeCompoundSExp(sexps[0], listToCompoundSExp(sexps.slice(1)));
}
