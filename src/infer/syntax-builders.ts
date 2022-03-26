import { Pattern, PProp } from "./syntax-types";
import * as t from "./syntax-types";

export const app = (fn: t.Expr, args: readonly t.Expr[]): t.EApp => ({
  tag: "EApp",
  fn,
  args,
});
export const _if = (cond: t.Expr, th: t.Expr, el: t.Expr): t.EIf => ({
  tag: "EIf",
  cond,
  th,
  el,
});
export const fix = (expr: t.Expr): t.EFix => ({ tag: "EFix", expr });
export const lam = (
  args: readonly (t.EIdent | t.ERest)[],
  body: t.Expr,
  async?: boolean
): t.ELam => ({
  tag: "ELam",
  args,
  body,
  async,
});
export const _let = (name: string, value: t.Expr, body: t.Expr): t.ELet => ({
  tag: "ELet",
  pattern: pvar(name),
  value,
  body,
});
export const ident = (name: string): t.EIdent => ({ tag: "EIdent", name });
export const _await = (expr: t.Expr): t.EAwait => ({ tag: "EAwait", expr });
export const tuple = (elements: readonly t.Expr[]): t.ETuple => ({
  tag: "ETuple",
  elements,
});
export const rec = (properties: readonly t.EProp[]): t.ERec => ({
  tag: "ERec",
  properties,
});
export const prop = (name: string, value: t.Expr): t.EProp => ({
  tag: "EProp",
  name,
  value,
});
export const mem = (
  object: t.Expr,
  property: t.ELit<t.LStr> | t.ELit<t.LNum> | t.EIdent
): t.EMem => ({
  tag: "EMem",
  object,
  property,
});
export const rest = (name: string): t.ERest => ({
  tag: "ERest",
  identifier: ident(name),
});

export const num = (value: number): t.ELit<t.LNum> => ({
  tag: "ELit",
  value: { tag: "LNum", value },
});
export const bool = (value: boolean): t.ELit<t.LBool> => ({
  tag: "ELit",
  value: { tag: "LBool", value },
});
export const str = (value: string): t.ELit<t.LStr> => ({
  tag: "ELit",
  value: { tag: "LStr", value },
});

export const add = (left: t.Expr, right: t.Expr): t.EOp => ({
  tag: "EOp",
  op: "Add",
  left,
  right,
});
export const sub = (left: t.Expr, right: t.Expr): t.EOp => ({
  tag: "EOp",
  op: "Sub",
  left,
  right,
});
export const mul = (left: t.Expr, right: t.Expr): t.EOp => ({
  tag: "EOp",
  op: "Mul",
  left,
  right,
});
export const eql = (left: t.Expr, right: t.Expr): t.EOp => ({
  tag: "EOp",
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
