
/*
Purpose: rewrite all occurrences of DictExp in a program to AppExp.
Signature: Dict2App (exp)
Type: Program -> Program
*/


import { CExp, isCExp, makeProgram, Program } from './L32/L32-ast';

export const Dict2App  = (exp: Program) : Program =>        
    
    //@TODO
    makeProgram([]);

export type AppExp = {tag: "AppExp"; rator: CExp; rands: CExp[]; }
export const makeAppExp = (rator: CExp, rands: CExp[]): AppExp =>
    ({tag: "AppExp", rator: rator, rands: rands});
/*
Purpose: Transform L32 program to L3
Signature: L32ToL3(prog)
Type: Program -> Program
*/
export const L32toL3 = (prog : Program): Program =>
    //@TODO
    makeProgram([]);
// 