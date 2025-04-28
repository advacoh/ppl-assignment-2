import {
    Program, Exp, CExp, Binding, DictExp,
    makeProgram, makeVarRef, makeAppExp, makeLitExp,
    isDefineExp, isIfExp, isProcExp, isLetExp, isAppExp,
    isDictExp, isNumExp, isBoolExp, isStrExp, isVarRef
  } from "./L32/L32-ast";
  
  import {
    makeCompoundSExp, makeEmptySExp, makeSymbolSExp, SExpValue
  } from "./L32/L32-value";
  
  const cexpToSExp = (ce: CExp): SExpValue =>
    isNumExp(ce)  ? ce.val :
    isBoolExp(ce) ? ce.val :
    isStrExp(ce)  ? ce.val :
    isVarRef(ce)  ? makeSymbolSExp(ce.var) :
    makeSymbolSExp("?");
  
  const bindingToPair = (b: Binding): SExpValue =>
    makeCompoundSExp(makeSymbolSExp(b.var.var), cexpToSExp(b.val));
  
  const listOfPairs = (pairs: SExpValue[]): SExpValue =>
    pairs.reduceRight<SExpValue>((acc, p) => makeCompoundSExp(p, acc), makeEmptySExp());
  
  const rewriteDict = (de: DictExp): CExp =>
    makeAppExp(makeVarRef("dict"), [makeLitExp(listOfPairs(de.entries.map(bindingToPair)))]);
  
  const trC = (ce: CExp): CExp => {
    if (isDictExp(ce)) return rewriteDict(ce);
    if (isIfExp(ce))   return { ...ce, test: trC(ce.test), then: trC(ce.then), alt: trC(ce.alt) };
    if (isProcExp(ce)) return { ...ce, body: ce.body.map(trC) };
    if (isLetExp(ce))  return { ...ce, bindings: ce.bindings.map(b => ({ ...b, val: trC(b.val) })), body: ce.body.map(trC) };
    if (isAppExp(ce))  return { ...ce, rator: trC(ce.rator), rands: ce.rands.map(trC) };
    return ce;
  };
  
  const trE = (e: Exp): Exp =>
    isDefineExp(e) ? { ...e, val: trC((e as any).val) } : trC(e as CExp);
  
  export const Dict2App = (prog: Program): Program =>
    makeProgram(prog.exps.map(trE));
  

export const L32toL3 = (prog : Program): Program =>
    //@TODO
    makeProgram([]);