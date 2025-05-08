/********************************************************************
 * src/q24.ts  — Full standalone translator for Question 2.5
 * ------------------------------------------------------------------
 * 1.  Reads and parses the q23.l3 definitions (dict, dict?, get, …)
 *     using parseL3Program, and stores them in `preludeExps`.
 * 2.  Recursively traverses an L32 AST and rewrites every DictExp into:
 *         (dict '((k . V) …))
 *     where V is:
 *       • same literal   (num / bool / string)
 *       • symbol S‑exp   if original is VarRef      → 'y
 *       • quoted datum   for any other expression   → '(+ 1 1)
 * 3.  Prepends the parsed prelude to the rewritten user code so that
 *     the resulting L3 program evaluates correctly under the existing
 *     L3 evaluator and passes both Q24 and Q23 tests.
 ********************************************************************/

import fs from "fs";
import path from "path";
import {
  makeProgram, makeDefineExp, makeIfExp, makeProcExp, makeLetExp,
  makeAppExp, makeLitExp, makeVarRef,
  isProgram, isDefineExp, isAtomicExp, isIfExp, isProcExp,
  isLetExp, isAppExp, isDictExp, isVarRef, isLitExp,
  Program, Exp, CExp, Binding, DictExp, AppExp, LitExp,
  parseL32Program
} from "./L32/L32-ast";
import { map } from "ramda";
import {
  makeEmptySExp, makeSymbolSExp, makeCompoundSExp
} from "./L32/L32-value";
import { parseL3Program } from "./L3/L3-ast";

/* ------------------------------------------------------------------
 * Parse the q23.l3 file into L3 DefineExp ASTs and store in preludeExps
 * ------------------------------------------------------------------*/
const q23path = path.join(__dirname, "q23.l3");
const q23raw = fs.readFileSync(q23path, "utf-8");
const preludeExps: Exp[] = (() => {
    const res = parseL3Program(q23raw); // Parse the file contents directly
    if (res.tag === "Ok") return res.value.exps;
    const msg = res.tag === "Failure" ? res.message : JSON.stringify(res);
    throw new Error(`Failed to parse q23.l3: ${msg}`);
})();

/* ------------------------------------------------------------------
 * Helper constructors for S‑exp manipulation
 * ------------------------------------------------------------------*/
const dotted = (car: any, cdr: any) => makeCompoundSExp(car, cdr);
const properList = (xs: any[]) => xs.reduceRight((tail, h) => dotted(h, tail), makeEmptySExp());

/* ------------------------------------------------------------------
 * Convert an L32 CExp into a raw datum (lossy but sufficient)
 * ------------------------------------------------------------------*/
const cexpToDatum = (ce: CExp): any => {
  if ((ce as any).tag === "NumExp" || (ce as any).tag === "BoolExp" || (ce as any).tag === "StrExp")
    return (ce as any).val;
  if (isVarRef(ce))
    return makeSymbolSExp((ce as any).var);
  switch ((ce as any).tag) {
    case "PrimOp":
      return makeSymbolSExp((ce as any).op);
    case "AppExp": {
      const r = cexpToDatum((ce as any).rator);
      const rs = (ce as any).rands.map(cexpToDatum);
      return properList([r, ...rs]);
    }
    case "ProcExp": {
      const asyms = (ce as any).args.map((a: any) => makeSymbolSExp(a.var));
      const body0 = cexpToDatum((ce as any).body[0]);
      return properList([makeSymbolSExp("lambda"), properList(asyms), body0]);
    }
    case "DictExp": {
      const pairs = (ce as any).entries.map((b: Binding) =>
        properList([makeSymbolSExp(b.var.var), cexpToDatum(b.val)])
      );
      return properList([makeSymbolSExp("dict"), ...pairs]);
    }
    default:
      return makeSymbolSExp(((ce as any).tag as string).toLowerCase());
  }
};

/* ------------------------------------------------------------------
 * Convert a list of Bindings into a LitExp of a quoted dotted list
 * ------------------------------------------------------------------*/
const bindingsToLit = (bs: Binding[]): LitExp => {
  const dottedList = bs.reduceRight<any>((tail, b) => {
    const key = makeSymbolSExp(b.var.var);
    const val = isVarRef(b.val)
      ? makeSymbolSExp(b.val.var)
      : ((b.val as any).tag === "NumExp" || (b.val as any).tag === "BoolExp" || (b.val as any).tag === "StrExp")
        ? (b.val as any).val
        : properList([makeSymbolSExp("quote"), cexpToDatum(b.val)]);
    const pair = dotted(key, val);           // (k . V)
    return dotted(pair, tail);               // ( (k . V) . tail )
  }, makeEmptySExp());
  return makeLitExp(dottedList);
};

/* ------------------------------------------------------------------
 * Rewrite a DictExp into (dict <literal-of-bindings>)
 * ------------------------------------------------------------------*/
const rewriteDictExp = (d: DictExp): AppExp =>
  makeAppExp(makeVarRef("dict"), [bindingsToLit((d as any).entries)]);

/* ------------------------------------------------------------------
 * Recursive AST traversal: rewrite all DictExp nodes
 * ------------------------------------------------------------------*/
const rewriteBinding = (b: Binding): Binding => ({ ...b, val: rewriteCExp(b.val) });

const rewriteExp = (e: Exp): Exp =>
  isDefineExp(e)
    ? makeDefineExp(e.var, rewriteCExp(e.val))
    : rewriteCExp(e as CExp);

const rewriteCExp = (ce: CExp): CExp =>
  isDictExp(ce) ? rewriteDictExp(ce) :
  isAtomicExp(ce) ? ce :
  isIfExp(ce)    ? makeIfExp(rewriteCExp(ce.test), rewriteCExp(ce.then), rewriteCExp(ce.alt)) :
  isProcExp(ce)  ? makeProcExp(ce.args, map(rewriteCExp, ce.body)) :
  isLetExp(ce)   ? makeLetExp(map(rewriteBinding, ce.bindings), map(rewriteCExp, ce.body)) :
  isAppExp(ce)   ? makeAppExp(rewriteCExp(ce.rator), map(rewriteCExp, ce.rands)) :
  ce; // unreachable

/* ------------------------------------------------------------------
 * Public API: prepend prelude then rewritten user code
 * ------------------------------------------------------------------*/
export const Dict2App = (p: Program): Program =>
  isProgram(p)
    ? makeProgram((preludeExps as any[]).concat(map(rewriteExp, p.exps)))
    : p;

export const L32toL3 = Dict2App;






// q23.l3
// File
// import {
//     // constructors --------------------------------------------------
//     makeProgram, makeDefineExp, makeIfExp, makeProcExp,
//     makeLetExp, makeAppExp, makeLitExp, 
//     // type predicates ----------------------------------------------
//     isProgram, isDefineExp, isAtomicExp, isIfExp, isProcExp,
//     isLetExp, isAppExp, isDictExp, isVarRef,
//     // AST node types ------------------------------------------------
//     Program, Exp, CExp, Binding, DictExp,
//     AppExp,
//     makeVarRef,
//     CompoundExp,
//     LitExp,
// } from "./L32/L32-ast";

// import { map } from "ramda";
// import { CompoundSExp, isSymbolSExp, makeCompoundSExp, makeSymbolSExp } from "./L32/L32-value";

// /* ----------------------------------------------------- helpers --- */

// const rewriteBinding = (b: Binding): Binding => ({
//     ...b,
//     val: rewriteCExp(b.val)                        // recurse inside rhs
// });

// const rewriteExp = (exp: Exp): Exp =>
//     isDefineExp(exp) ?
//         makeDefineExp(exp.var, rewriteCExp(exp.val)) :
//         rewriteCExp(exp as CExp);

// const rewriteCExp = (ce: CExp): CExp =>
//     isAtomicExp(ce) ? ce :
//     isIfExp(ce)   ? makeIfExp( rewriteCExp(ce.test),
//                                rewriteCExp(ce.then),
//                                rewriteCExp(ce.alt) ) :
//     isProcExp(ce) ? makeProcExp( ce.args, map(rewriteCExp, ce.body) ) :
//     isLetExp(ce)  ? makeLetExp( map(rewriteBinding, ce.bindings),
//                                map(rewriteCExp, ce.body) ) :
//     isAppExp(ce)  ? makeAppExp( rewriteCExp(ce.rator),
//                                map(rewriteCExp, ce.rands) ) :
//     isDictExp(ce) ? Dict2App(ce) :
    
//     ce; // should be unreachable



   
//     const bindingsToPairListLitExp = (bindings: Binding[]): LitExp => {
//         // parseL3("'( (a . 1) (b .2) )"")

     

// export const tmpProgram: Program = {
    
// parse("(define dict
//     (lambda (pairs)         
//       pairs))
  
  
  
//   (define dict?
//     (lambda (d)
//       (if (eq? d '())
//           #t
//           (if (pair? d)
//               (if (pair? (car d))
//                   (if (symbol? (car (car d)))
//                       (if (not (number? (car (car d))))
//                           (dict? (cdr d))
//                           #f)
//                       #f)
//                   #f)
//               #f))))
  
//   (define make-error
//     (lambda (msg)           
//       (list 'error msg)))
  
//   (define get               
//     (lambda (d key)
//       (if (eq? d '())
//           (make-error "key not found!")
//           (if (eq? (car (car d)) key)        
//               (cdr (car d))
//               (get (cdr d) key)))))
    
    
//   (define is-error?
//     (lambda (x)
//       (if (pair? x)                  
//           (eq? (car x) 'error)
//           #f)))
    
//   (define bind              
//     (lambda (x f)
//       (if (is-error? x)
//           x
//           (f x))))
  
//   (define list?
//     (lambda (x)
//       (if (pair? x)
//           (list? (cdr x))
//           (eq? x '()))))")
  
  

// export const rewriteDictExp = (d: DictExp): AppExp =>
//     makeAppExp(makeVarRef("dict"), bindingsToPairListLitExp(d.entries));


// export const Dict2App = (p: Program): Program =>
//     makeProgram(tmpProgram.exps.concat(map(rewriteExp, p.exps)));

// export const L32toL3 = (p: Program): Program =>
//     makeProgram(map(rewriteExp, p.exps));