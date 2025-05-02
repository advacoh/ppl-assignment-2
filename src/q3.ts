import { CExp, DefineExp, Exp, isAppExp, isBoolExp, isDefineExp, isIfExp, isLetExp, isLitExp, isNumExp, isPrimOp, isProgram, isStrExp, isVarRef, Program , Binding, isProcExp } from './L3/L3-ast';
import { DictExp, isDictExp } from './L32/L32-ast';
import { Result, bind, makeFailure, makeOk } from './shared/result';


type GenBinding = { var: { var: string }; val: L2CExp };
type L2CExp = CExp | DictExp;

/*
Purpose: Transform L2 AST to JavaScript program string
Signature: l2ToJS(l2AST)
Type: [EXP | Program] => Result<string>
*/
const bindingToJS   = (b: GenBinding) =>
    bind(cexpToJS(b.val), v => makeOk(`let ${b.var.var} = ${v}`));
const localMapResult = <T, U>(f: (t: T) => Result<U>, arr: T[]): Result<U[]> =>
    arr.length === 0
      ? makeOk([])
      : bind(f(arr[0]), (first) =>
          bind(localMapResult(f, arr.slice(1)), (rest) => makeOk([first, ...rest])));
      
const primToJS = (prim: string): string => prim

const isAtomic = (s: string): boolean => /^[A-Za-z0-9_]+$/.test(s);
    
const infixOf = (op: string): string =>
    ({ "+": "+", "-": "-", "*": "*", "/": "/", ">": ">", "<": "<",
       "=": "===" , "eq?": "===",
       "and": "&&", "or": "||" } as Record<string,string>)[op];

const cexpToJS = (exp: L2CExp): Result<string> => {
    if (isNumExp(exp)) {
        return makeOk(exp.val.toString());
    } else if (isBoolExp(exp)) {
        return makeOk(exp.val.toString());
    } else if (isStrExp(exp)) {
        return makeOk(`"${exp.val}"`);
    } else if (isPrimOp(exp)) {
        return makeOk(primToJS(exp.op));
    } else if (isVarRef(exp)) {
        return makeOk(exp.var);
    } else if (isLitExp(exp)) {
        return makeOk(JSON.stringify(exp.val));
    } else if (isIfExp(exp)) {
        const test = cexpToJS(exp.test);
        const then = cexpToJS(exp.then);
        const alt = cexpToJS(exp.alt);
        return bind(test, t => bind(then, th => bind(alt, al => makeOk(`(${t} ? ${th} : ${al})`))));
    } else if (isAppExp(exp) && isPrimOp(exp.rator)) {
        const op = exp.rator.op;
        if (op === "not")
           return bind(cexpToJS(exp.rands[0]), a => makeOk(`(!${a})`));
        return bind(localMapResult(cexpToJS, exp.rands),
                    as => makeOk(`(${as.join(` ${infixOf(op)} `)})`));
    
      
    } else if (isAppExp(exp)) {
        return bind(cexpToJS(exp.rator), r =>
               bind(localMapResult(cexpToJS, exp.rands),
                    args => makeOk(`${r}(${args.join(",")})`)));
    
    } else if (isProcExp(exp)) {
  const params = exp.args.map(a => a.var).join(",");
  return bind(localMapResult(cexpToJS, exp.body), bs => {
    const last = bs.slice(-1)[0];
    const body = bs.length === 1
        ? (isAtomic(last) ? last : `${last}`)
        : `(${last})`;
    return makeOk(`((${params}) => ${body})`);
  });

    } else if (isLetExp(exp)) {
        const bindings = localMapResult(b => cexpToJS(b.val), exp.bindings);
        const body = localMapResult(cexpToJS, exp.body);
        return bind(bindings, bs => bind(body, b => makeOk(`let ${bs.join(", ")} in ${b}`)));
    } else if (isDictExp(exp)) {
        const entries = localMapResult(dictEntryToJS, exp.entries as any);
        return bind(entries,
              kvs => makeOk(`({ ${kvs.join(", ")} })`));
    
    } else {
        return makeFailure("Unknown expression type");
    }
}


const dictEntryToJS = (b: GenBinding) =>
    bind(cexpToJS(b.val),
         v => makeOk(`${JSON.stringify(b.var.var)}: ${v}`));



export const l2ToJS = (e: Exp | Program): Result<string> => {

  if (isProgram(e)) {
    const prog = e as Program;
    return bind(localMapResult(l2ToJS, prog.exps), (lines) =>
      makeOk(lines.join(";\n")));
  }

  if (isDefineExp(e)) {
    const def = e as DefineExp;
    return bind(cexpToJS(def.val),
      (valJS) => makeOk(`const ${def.var.var} = ${valJS}`));
  }

  return cexpToJS(e as CExp);
};