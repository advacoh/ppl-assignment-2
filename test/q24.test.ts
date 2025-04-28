import { expect } from 'chai';
import { all, map } from "ramda";
import {  evalL32program } from '../src/L32/L32-eval';
import { Value } from "../src/L32/L32-value";
import { Result, bind, makeOk } from "../src/shared/result";
import { Binding, CExp, Exp, isAppExp, isAtomicExp, isDefineExp, isDictExp, isIfExp, isLetExp, isLitExp, isProcExp, isProgram, parseL32, Program } from "../src/L32/L32-ast";
import { L32toL3 } from "../src/q24";
import { format } from "../src/shared/format";
import { makeSymbolSExp } from '../src/L3/L3-value';


const noDictExp = (e : Program | Exp) : boolean =>
    isAtomicExp(e) ? true :
    isLitExp(e) ? true :
    isIfExp(e) ? noDictExp(e.test) && noDictExp(e.then) && noDictExp(e.alt) :
    isProcExp(e) ? all((b) => noDictExp(b), e.body) :
    isAppExp(e) ? noDictExp(e.rator) &&
              all((rand) => noDictExp(rand), e.rands) :
    isDefineExp(e) ? noDictExp(e.val) :
    isLetExp(e) ? all((val : CExp) => noDictExp(val), map((b : Binding) => b.val, e.bindings)) &&
                  all((b) => noDictExp(b), e.body) :
    isDictExp(e) ? true :
    isProgram(e) ? all((e) => noDictExp(e), e.exps) : 
    true;


const evalP = (x: string): Result<Value> => 
    bind(parseL32(x), (prog) => 
        evalL32program(L32toL3(prog)))

const noDict = (x: string): Result<boolean> => 
    bind(parseL32(x), (prog) => 
        makeOk(noDictExp(L32toL3(prog))))

describe('Q24 Tests', () => {


    it("Q24 test 1", () => {
        expect(noDict(`(L32 ((dict (a 1) (b 2)) 'a))`)).to.deep.equal(makeOk(true));
        expect(evalP(`(L32 ((dict (a 1) (b 2)) 'a))`)).to.deep.equal(makeOk(1));
    });
    
 it("Q23 tests 2", () => {
    expect(noDict(`(L32
                      (define x "a")
                      (define y "b")
                      ((dict (a x) (b y)) 'b))`)).to.deep.equal(makeOk(true));
        
        expect(evalP(`(L32
                      (define x "a")
                      (define y "b")
                      ((dict (a x) (b y)) 'b))`)).to.deep.equal(makeOk(makeSymbolSExp('y')))
    });
    
    it("Q24 test 3", () => {
        expect(noDict(`(L32 
            (define x 1)
            (
              (if (< x 0)
                (dict (a 1) (b 2))
                (dict (a 2) (b 1)))
            'a))`)).to.deep.equal(makeOk(true));
            
        expect(evalP(`(L32 
            (define x 1)
            (
              (if (< x 0)
                (dict (a 1) (b 2))
                (dict (a 2) (b 1)))
            'a))`)).to.deep.equal(makeOk(2));
    });
});