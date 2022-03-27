import { Pattern, PProp } from "./syntax-types";
import * as t from "./syntax-types";

export const app = (fn: t.Expr, args: readonly t.Expr[]): t.EApp => ({
  __type: "EApp",
  fn,
  args,
});
export const _if = (cond: t.Expr, th: t.Expr, el: t.Expr): t.EIf => ({
  __type: "EIf",
  cond,
  th,
  el,
});
export const fix = (expr: t.Expr): t.EFix => ({ __type: "EFix", expr });
export const lam = (
  args: readonly (t.EIdent | t.ERest)[],
  body: t.Expr,
  async?: boolean
): t.ELam => ({
  __type: "ELam",
  args,
  body,
  async,
});
export const _let = (name: string, value: t.Expr, body: t.Expr): t.ELet => ({
  __type: "ELet",
  pattern: pvar(name),
  value,
  body,
});
export const ident = (name: string): t.EIdent => ({ __type: "EIdent", name });
export const _await = (expr: t.Expr): t.EAwait => ({ __type: "EAwait", expr });
export const tuple = (elements: readonly t.Expr[]): t.ETuple => ({
  __type: "ETuple",
  elements,
});
export const rec = (properties: readonly t.EProp[]): t.ERec => ({
  __type: "ERec",
  properties,
});
export const prop = (name: string, value: t.Expr): t.EProp => ({
  __type: "EProp",
  name,
  value,
});
export const mem = (
  object: t.Expr,
  property: t.ELit<t.LStr> | t.ELit<t.LNum> | t.EIdent
): t.EMem => ({
  __type: "EMem",
  object,
  property,
});
export const rest = (name: string): t.ERest => ({
  __type: "ERest",
  identifier: ident(name),
});
export const taggedTemplate = (
  tag: t.EIdent,
  strings: readonly t.ELit<t.LStr>[],
  expressions: readonly t.Expr[]
): t.ETagTemp => ({
  __type: "ETagTemp",
  tag,
  strings,
  expressions,
});

export const num = (value: number): t.ELit<t.LNum> => ({
  __type: "ELit",
  value: { __type: "LNum", value },
});
export const bool = (value: boolean): t.ELit<t.LBool> => ({
  __type: "ELit",
  value: { __type: "LBool", value },
});
export const str = (value: string): t.ELit<t.LStr> => ({
  __type: "ELit",
  value: { __type: "LStr", value },
});

export const add = (left: t.Expr, right: t.Expr): t.EOp => ({
  __type: "EOp",
  op: "Add",
  left,
  right,
});
export const sub = (left: t.Expr, right: t.Expr): t.EOp => ({
  __type: "EOp",
  op: "Sub",
  left,
  right,
});
export const mul = (left: t.Expr, right: t.Expr): t.EOp => ({
  __type: "EOp",
  op: "Mul",
  left,
  right,
});
export const eql = (left: t.Expr, right: t.Expr): t.EOp => ({
  __type: "EOp",
  op: "Eql",
  left,
  right,
});

export const pvar = (name: string): Pattern => ({
  __type: "PVar",
  name,
});

export const pwild = (): Pattern => ({ __type: "PWild" });

export const plit = (lit: t.Literal): Pattern => ({
  __type: "PLit",
  value: lit,
});

export const prec = (properties: readonly PProp[]): Pattern => ({
  __type: "PRec",
  properties,
});

export const ptuple = (patterns: readonly Pattern[]): Pattern => ({
  __type: "PTuple",
  patterns,
});

export const pprop = (name: string, pattern?: Pattern): PProp => ({
  __type: "PProp",
  name,
  pattern: pattern ?? pvar(name),
});
