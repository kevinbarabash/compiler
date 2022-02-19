import { Map } from "immutable";

import { Expr, Lit, Program } from "./syntax";

// TODO: we need a context similar to checker.ts' Context which contains
// a stack of scopes so that we can implement proper variable shadowing
// when programmatically evaluating things.
type Scope = Map<string, Value>;

type VNum = { tag: "VNum"; value: number };
type VBool = { tag: "VBool"; value: boolean };
type VStr = { tag: "VStr"; value: string };
type VArr = { tag: "VArr"; values: Value[] };
type VClosure = { tag: "VClosure"; params: readonly string[]; body: Expr; env: Scope };

type Value = VNum | VBool | VStr | VArr | VClosure;

export const print = (value: Value): string => {
  switch (value.tag) {
    case "VNum": return String(value.value);
    case "VBool": return String(value.value);
    case "VStr": return String(value.value);
    case "VArr": return `[${value.values.map(print).join(", ")}]`;
    case "VClosure": return "<<closure>>";
  }
}

const apply = (closure: VClosure, args: readonly Value[]): Value => {
  const { params, body, env } = closure;
  const newEnv = env.withMutations((env) => {
    params.forEach((param, index) => {
      env.set(param, args[index]);
    });
  });

  // Check if we should partially apply the lambda (closure).
  if (args.length < params.length) {
    // Return a new closure with the applied args now appearing
    // in newEnv instead of in the arg list.
    return {
      tag: "VClosure",
      params: params.slice(args.length), // remaining params
      body: body, // use the same function body
      env: newEnv,
    };
  }

  return evalExpr(newEnv, body);
};

export const empty = Map<string, Value>();

const numOfValue = (x: Value): number => {
  switch (x.tag) {
    case "VNum":
      return x.value;
    default:
      throw new Error("expected a number");
  }
};

const evalLit = (env: Scope, lit: Lit): Value => {
  switch (lit.tag) {
    case "LNum":
      return { tag: "VNum", value: lit.value };
    case "LBool":
      return { tag: "VBool", value: lit.value };
    case "LStr":
      return { tag: "VStr", value: lit.value };
    case "LArr":
      return { 
        tag: "VArr", 
        values: lit.values.map(elem => evalExpr(env, elem)),
      };
  }
};

const evalExpr = (env: Scope, expr: Expr): Value => {
  switch (expr.tag) {
    case "Lit":
      return evalLit(env, expr.value);
    case "Var": {
      const { name } = expr;
      const result = env.get(name);
      if (!result) {
        throw new Error(`Unknown variable ${name}`);
      }
      return result;
    }
    case "Lam": {
      const { params, body } = expr;
      return { tag: "VClosure", params: params.map(param => param.name), body, env };
    }
    case "App": {
      const { func, args } = expr;

      // Apply built-in function
      // TODO: support "-", "*", and "/"
      if (func.tag === "Var" && func.name === "+") {
        const evaledArgs = args.map((arg) => evalExpr(env, arg));
        if (evaledArgs[0].tag === "VNum" && evaledArgs[1].tag === "VNum") {
          return {
            tag: "VNum",
            value: evaledArgs[0].value + evaledArgs[1].value,
          };
        } else {
          throw new Error("both args must be numbers when adding");
        }
      }

      // Apply user defined function
      const evaledFunc = evalExpr(env, func);
      if (evaledFunc.tag !== "VClosure"){
        throw new Error("tried to apply a non-closure value");
      }
      const evaledArgs = args.map((arg) => evalExpr(env, arg));

      return apply(evaledFunc, evaledArgs);
    }
    case "Let": {
      // NOTE: when we implement destructuring we'll need to add
      // multiple entries to the newEnv scope
      const { name, value, body } = expr;
      let evaledValue = evalExpr(env, value);
      let newEnv = env.set(name, evaledValue);
      return evalExpr(newEnv, body);
    }
  }
};

export const evaluate = (expr: Program): Value | void => {
  let env = Map<string, Value>();
  let result = undefined;
  for (const child of expr.body) {
    switch (child.tag) {
      case "Decl": {
        const { name, value, } = child;
        let evaledValue = evalExpr(env, value);
        env = env.set(name, evaledValue);
        break;
      }
      default: {
        result = evalExpr(env, child);
      }
    }
  }
  return result;
};
