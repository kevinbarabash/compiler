import { Map } from "immutable";

import { Expr, Lit, Program } from "./syntax";

type Scope = Map<string, Value>;

type Value =
  | { tag: "VNum"; value: number }
  | { tag: "VBool"; value: boolean }
  | { tag: "VStr"; value: string }
  | { tag: "VArr"; value: Value[] }
  | { tag: "VClosure"; params: readonly string[]; body: Expr; env: Scope };

export const print = (value: Value): string => {
  switch (value.tag) {
    case "VNum": return String(value.value);
    case "VBool": return String(value.value);
    case "VStr": return String(value.value);
    case "VArr": return `[${value.value.map(print).join(", ")}]`;
    case "VClosure": return "<<closure>>";
  }
}

const apply = (x: Value, args: readonly Value[]): Value => {
  switch (x.tag) {
    case "VClosure": {
      const { params, body, env } = x;
      // TODO:
      // - assert that params.length >= args.length
      // - if params.length > args.length then we need to return an updated
      //   closure with params.length - args.length number of params
      const newEnv = env.withMutations((env) => {
        params.forEach((param, index) => {
          env.set(param, args[index]);
        });
      });
      return evalExpr(newEnv, body);
    }
    default:
      throw new Error("tried to apply a non-closure value");
  }
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
        value: lit.value.map(elem => evalExpr(env, elem)),
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
      const evaledArgs = args.map((arg) => evalExpr(env, arg));
      return apply(evalExpr(env, func), evaledArgs);
    }
    case "Prim": {
      const { op, args } = expr;
      let evaledArgs = args.map((arg) => evalExpr(env, arg));
      let x = numOfValue(evaledArgs[0]);
      let y = numOfValue(evaledArgs[1]);

      switch (op) {
        case "Add":
          return { tag: "VNum", value: x + y };
        case "Sub":
          return { tag: "VNum", value: x - y };
        case "Mul":
          return { tag: "VNum", value: x * y };
        case "Div":
          return { tag: "VNum", value: x / y };
      }
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
