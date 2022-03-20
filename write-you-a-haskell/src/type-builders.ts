import { Map } from "immutable";

import { Literal } from "./syntax-types";
import { Context, newId } from "./context";
import * as t from "./type-types";

export const tvar = (name: string, ctx: Context): t.TVar => ({
  tag: "TVar",
  id: newId(ctx),
  name,
});

export const tcon = (
  name: string,
  params: readonly t.Type[],
  ctx: Context
): t.TCon => ({
  tag: "TCon",
  id: newId(ctx),
  name,
  params,
});

export const tfun = (
  args: readonly t.Type[],
  ret: t.Type,
  ctx: Context,
  src?: "App" | "Fix" | "Lam"
): t.TFun => ({
  tag: "TFun",
  id: newId(ctx),
  args,
  ret,
  src,
});

export const tunion = (types: readonly t.Type[], ctx: Context): t.TUnion => ({
  tag: "TUnion",
  id: newId(ctx),
  types,
});

export const ttuple = (types: readonly t.Type[], ctx: Context): t.TTuple => ({
  tag: "TTuple",
  id: newId(ctx),
  types,
});

export const trec = (properties: readonly t.TProp[], ctx: Context): t.TRec => ({
  tag: "TRec",
  id: newId(ctx),
  properties,
});

export const tprop = (name: string, type: t.Type): t.TProp => ({
  tag: "TProp",
  name,
  type,
});

export const tmem = (object: t.Type, property: string, ctx: Context): t.TMem => ({
  tag: "TMem",
  id: newId(ctx),
  object,
  property,
});

export const createCtx = (): Context => {
  const ctx: Context = {
    env: Map(),
    state: { count: 0 },
  };
  return ctx;
};

export const tprim = (name: t.PrimName, ctx: Context): t.TPrim => ({
  tag: "TPrim",
  id: newId(ctx),
  name,
});

export const tNum = (ctx: Context): t.TPrim => tprim("number", ctx);
export const tStr = (ctx: Context): t.TPrim => tprim("string", ctx);
export const tBool = (ctx: Context): t.TPrim => tprim("boolean", ctx);

export const tlit = (lit: Literal, ctx: Context): t.TLit => ({
  tag: "TLit",
  id: newId(ctx),
  value: lit,
});
