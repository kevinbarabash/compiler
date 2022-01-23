import { Map } from "immutable";

import { BinOp, Expr, Lit } from "./syntax";

type Scope = Map<string, Value>;

type Value =
  | { tag: "VNum"; value: number }
  | { tag: "VBool"; value: boolean }
  | { tag: "VClosure"; param: string; body: Expr; env: Scope };

const apply = (x: Value, arg: Value): Value => {
  switch (x.tag) {
    case "VClosure": {
      const { param, body, env } = x;
      return evalExpr(env.set(param, arg), body);
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

const evalLit = (lit: Lit): Value => {
  switch (lit.tag) {
    case "LNum":
      return { tag: "VNum", value: lit.value };
    case "LBool":
      return { tag: "VBool", value: lit.value };
  }
};

const evalExpr = (env: Scope, expr: Expr): Value => {
  switch (expr.tag) {
    case "Lit":
      return evalLit(expr.value);
    case "Var": {
      const { name } = expr;
      const result = env.get(name);
      if (!result) {
        throw new Error(`Unknown variable ${name}`);
      }
      return result;
    }
    case "Lam": {
      const { param, body } = expr;
      return { tag: "VClosure", param, body, env };
    }
    case "App": {
      const { func, arg } = expr;
      return apply(evalExpr(env, func), evalExpr(env, arg));
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
  }
};

export const evaluate = (expr: Expr): Value => evalExpr(empty, expr);
