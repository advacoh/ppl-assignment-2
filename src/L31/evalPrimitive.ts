import { is, reduce } from "ramda";
import { PrimOp } from "./L31-ast";
import { isCompoundSExp, isEmptySExp, isSymbolSExp, makeCompoundSExp, makeEmptySExp, CompoundSExp, EmptySExp, Value, DictVal } from "./L31-value";
import { List, allT, first, isNonEmptyList, rest } from '../shared/list';
import { isBoolean, isNumber, isString } from "../shared/type-predicates";
import { Result, makeOk, makeFailure } from "../shared/result";
import { format } from "../shared/format";
import { isDict , makeDictVal} from "./L31-value";

export const applyPrimitive = (proc: PrimOp, args: Value[]): Result<Value> =>
    proc.op === "+" ? (allT(isNumber, args) ? makeOk(reduce((x, y) => x + y, 0, args)) : 
                                              makeFailure(`+ expects numbers only: ${format(args)}`)) :
    proc.op === "-" ? minusPrim(args) :
    proc.op === "*" ? (allT(isNumber, args) ? makeOk(reduce((x, y) => x * y, 1, args)) : 
                                              makeFailure(`* expects numbers only: ${format(args)}`)) :
    proc.op === "/" ? divPrim(args) :
    proc.op === ">" ? makeOk(args[0] > args[1]) :
    proc.op === "<" ? makeOk(args[0] < args[1]) :
    proc.op === "=" ? makeOk(args[0] === args[1]) :
    proc.op === "not" ? makeOk(!args[0]) :
    proc.op === "and" ? isBoolean(args[0]) && isBoolean(args[1]) ? makeOk(args[0] && args[1]) : 
                                                                   makeFailure(`Arguments to "and" not booleans: ${format(args)}`) :
    proc.op === "or" ? isBoolean(args[0]) && isBoolean(args[1]) ? makeOk(args[0] || args[1]) : 
                                                                  makeFailure(`Arguments to "or" not booleans: ${format(args)}`) :
    proc.op === "eq?" ? makeOk(eqPrim(args)) :
    proc.op === "string=?" ? makeOk(args[0] === args[1]) :
    proc.op === "cons" ? makeOk(consPrim(args[0], args[1])) :
    proc.op === "car" ? carPrim(args[0]) :
    proc.op === "cdr" ? cdrPrim(args[0]) :
    proc.op === "list" ? makeOk(listPrim(args)) :
    proc.op === "pair?" ? makeOk(isPairPrim(args[0])) :
    proc.op === "number?" ? makeOk(typeof (args[0]) === 'number') :
    proc.op === "boolean?" ? makeOk(typeof (args[0]) === 'boolean') :
    proc.op === "symbol?" ? makeOk(isSymbolSExp(args[0])) :
    proc.op === "string?" ? makeOk(isString(args[0])) :
    proc.op === "dict?" ? makeOk(isDictionary(args[0])) :
    proc.op === "get" ? getValue(args[0], args[1]) :
    proc.op === "dict" ? parseDict(args[0]) :


    
    makeFailure(`Bad primitive op: ${format(proc.op)}`);
    
const getValue = (dict:Value,key: Value ): Result<Value> => {
    if (!isDict(dict)) {
        return makeFailure(`get: param is not dict ${format(dict)}`);
    }
    if (!isSymbolSExp(key)) {
        return makeFailure(`get: param is not symbol ${format(key)}`);
    }
    const entries = (dict as DictVal).entries;
    const found = entries.find(([k, v]) => k === key.val);
    if (found) {
        return makeOk(found[1]);
    } else {
        return makeFailure(`get: key not found ${format(key)}`);
    }
}

export const isDictionary = (sexp: Value): boolean => {
    if (isDict(sexp)) {
        return true;
    }
    
    const listResult = sexpToArray(sexp);
    if (listResult.tag === "Failure") return false;

    for (const pair of listResult.value) {
        if (!isCompoundSExp(pair)) return false;
        if (!isSymbolSExp(pair.val1)) return false;
    }

    return true;
};

const parseDict = (pairs: any): Result<Value> => {
    const pairListResult = sexpToArray(pairs);
    if (pairListResult.tag === "Failure") return pairListResult;

    const pairList = pairListResult.value;
    const entries: [string, Value][] = [];

    for (const pair of pairList) {
        if (!isCompoundSExp(pair)) {
            return makeFailure("dict: expected (key . val) pair");
        }

        const key = pair.val1;
        const val = pair.val2;

        if (!isSymbolSExp(key)) {
            return makeFailure("dict: expected key to be a symbol");
        }

        const valResult = sexpToValue(val);
        if (valResult.tag === "Failure") {
            return valResult;
        }

        entries.push([key.val, valResult.value]);
    }

    return makeOk(makeDictVal(entries));
};

const sexpToArray = (sexp: any): Result<any[]> => {
    if (isEmptySExp(sexp)) {
        return makeOk([]);
    }

    if (isCompoundSExp(sexp)) {
        const head = sexp.val1;
        const tailResult = sexpToArray(sexp.val2);

        return tailResult.tag === "Failure"
            ? tailResult
            : makeOk([head, ...tailResult.value]);
    }

    return makeFailure("parseDict: improper list structure");
};

export const sexpToValue = (sexp: any): Result<Value> => {
    if (typeof sexp === "number" || typeof sexp === "boolean" || typeof sexp === "string")
        return makeOk(sexp);

    if (isSymbolSExp(sexp)) {
        return makeOk(sexp);  // use directly as Value
    }

    if (isCompoundSExp(sexp)) {
        return makeFailure("Nested compound values not supported in dict yet");
    }

    return makeFailure("Unsupported S-expression value in dict");
};


const minusPrim = (args: Value[]): Result<number> => {
    // TODO complete
    const x = args[0], y = args[1];
    if (isNumber(x) && isNumber(y)) {
        return makeOk(x - y);
    }
    else {
        return makeFailure(`Type error: - expects numbers ${format(args)}`);
    }
};

const divPrim = (args: Value[]): Result<number> => {
    // TODO complete
    const x = args[0], y = args[1];
    if (isNumber(x) && isNumber(y)) {
        return makeOk(x / y);
    }
    else {
        return makeFailure(`Type error: / expects numbers ${format(args)}`);
    }
};

const eqPrim = (args: Value[]): boolean => {
    const x = args[0], y = args[1];
    if (isSymbolSExp(x) && isSymbolSExp(y)) {
        return x.val === y.val;
    }
    else if (isEmptySExp(x) && isEmptySExp(y)) {
        return true;
    }
    else if (isNumber(x) && isNumber(y)) {
        return x === y;
    }
    else if (isString(x) && isString(y)) {
        return x === y;
    }
    else if (isBoolean(x) && isBoolean(y)) {
        return x === y;
    }
    else {
        return false;
    }
};

const carPrim = (v: Value): Result<Value> => 
    isCompoundSExp(v) ? makeOk(v.val1) :
    makeFailure(`Car: param is not compound ${format(v)}`);

const cdrPrim = (v: Value): Result<Value> =>
    isCompoundSExp(v) ? makeOk(v.val2) :
    makeFailure(`Cdr: param is not compound ${format(v)}`);

const consPrim = (v1: Value, v2: Value): CompoundSExp =>
    makeCompoundSExp(v1, v2);

export const listPrim = (vals: List<Value>): EmptySExp | CompoundSExp =>
    isNonEmptyList<Value>(vals) ? makeCompoundSExp(first(vals), listPrim(rest(vals))) :
    makeEmptySExp();

const isPairPrim = (v: Value): boolean =>
    isCompoundSExp(v);


