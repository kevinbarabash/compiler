import { Expr } from "./syntax-types";

export const app = (fn: Expr, args: Expr[]): Expr => ({ tag: "App", fn, args });
export const _if = (cond: Expr, th: Expr, el: Expr): Expr => ({
  tag: "If",
  cond,
  th,
  el,
});
export const fix = (expr: Expr): Expr => ({ tag: "Fix", expr });
export const lam = (args: string[], body: Expr, async?: boolean): Expr => ({
  tag: "Lam",
  args,
  body,
  async,
});
export const _let = (name: string, value: Expr, body: Expr): Expr => ({
  tag: "Let",
  name,
  value,
  body,
});
export const _var = (name: string): Expr => ({ tag: "Var", name });
export const _await = (expr: Expr): Expr => ({ tag: "Await", expr });

export const int = (value: number): Expr => ({
  tag: "Lit",
  value: { tag: "LInt", value },
});
export const bool = (value: boolean): Expr => ({
  tag: "Lit",
  value: { tag: "LBool", value },
});
export const str = (value: string): Expr => ({
  tag: "Lit",
  value: { tag: "LStr", value },
})

export const add = (left: Expr, right: Expr): Expr => ({
  tag: "Op",
  op: "Add",
  left,
  right,
});
export const sub = (left: Expr, right: Expr): Expr => ({
  tag: "Op",
  op: "Sub",
  left,
  right,
});
export const mul = (left: Expr, right: Expr): Expr => ({
  tag: "Op",
  op: "Mul",
  left,
  right,
});
export const eql = (left: Expr, right: Expr): Expr => ({
  tag: "Op",
  op: "Eql",
  left,
  right,
});
