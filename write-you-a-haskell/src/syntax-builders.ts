import { Pattern, PProp } from "./syntax-types";
import * as t from "./syntax-types";

export const app = (fn: t.Expr, args: readonly t.Expr[]): t.EApp => ({
  tag: "App",
  fn,
  args,
});
export const _if = (cond: t.Expr, th: t.Expr, el: t.Expr): t.EIf => ({
  tag: "If",
  cond,
  th,
  el,
});
export const fix = (expr: t.Expr): t.EFix => ({ tag: "Fix", expr });
export const lam = (
  args: readonly string[],
  body: t.Expr,
  async?: boolean
): t.ELam => ({
  tag: "Lam",
  args,
  body,
  async,
});
export const _let = (name: string, value: t.Expr, body: t.Expr): t.ELet => ({
  tag: "Let",
  pattern: pvar(name),
  value,
  body,
});
export const _var = (name: string): t.EVar => ({ tag: "Var", name });
export const _await = (expr: t.Expr): t.EAwait => ({ tag: "Await", expr });
export const tuple = (elements: readonly t.Expr[]): t.ETuple => ({
  tag: "Tuple",
  elements,
});
export const rec = (properties: readonly t.EProp[]): t.ERec => ({
  tag: "Rec",
  properties,
});
export const prop = (name: string, value: t.Expr): t.EProp => ({
  tag: "EProp",
  name,
  value,
});

export const num = (value: number): t.ELit => ({
  tag: "Lit",
  value: { tag: "LNum", value },
});
export const bool = (value: boolean): t.ELit => ({
  tag: "Lit",
  value: { tag: "LBool", value },
});
export const str = (value: string): t.ELit => ({
  tag: "Lit",
  value: { tag: "LStr", value },
});

export const add = (left: t.Expr, right: t.Expr): t.EOp => ({
  tag: "Op",
  op: "Add",
  left,
  right,
});
export const sub = (left: t.Expr, right: t.Expr): t.EOp => ({
  tag: "Op",
  op: "Sub",
  left,
  right,
});
export const mul = (left: t.Expr, right: t.Expr): t.EOp => ({
  tag: "Op",
  op: "Mul",
  left,
  right,
});
export const eql = (left: t.Expr, right: t.Expr): t.EOp => ({
  tag: "Op",
  op: "Eql",
  left,
  right,
});

export const pvar = (name: string): Pattern => ({
  tag: "PVar",
  name,
});

export const pwild = (): Pattern => ({ tag: "PWild" });

export const plit = (lit: t.Literal): Pattern => ({
  tag: "PLit",
  value: lit,
});

export const prec = (properties: readonly PProp[]): Pattern => ({
  tag: "PRec",
  properties,
});

export const ptuple = (patterns: readonly Pattern[]): Pattern => ({
  tag: "PTuple",
  patterns,
});

export const pprop = (name: string, pattern?: Pattern): PProp => ({
  tag: "PProp",
  name,
  pattern: pattern ?? pvar(name),
});
