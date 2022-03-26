import { Map } from "immutable";

import { Literal } from "./syntax-types";
import { Context, newId } from "./context";
import * as t from "./type-types";

export const tvar = (name: string, ctx: Context): t.TVar => ({
  __type: "TVar",
  id: newId(ctx),
  name,
});

export const tgen = (
  name: string,
  params: readonly t.Type[],
  ctx: Context
): t.TGen => ({
  __type: "TGen",
  id: newId(ctx),
  name,
  params,
});

export const tfun = (
  args: readonly t.Type[],
  ret: t.Type,
  ctx: Context,
  variadic: boolean = false,
): t.TFun => ({
  __type: "TFun",
  id: newId(ctx),
  args,
  ret,
  variadic,
});

export const tunion = (types: readonly t.Type[], ctx: Context): t.TUnion => ({
  __type: "TUnion",
  id: newId(ctx),
  types,
});

export const ttuple = (types: readonly t.Type[], ctx: Context): t.TTuple => ({
  __type: "TTuple",
  id: newId(ctx),
  types,
});

export const trec = (properties: readonly t.TProp[], ctx: Context): t.TRec => ({
  __type: "TRec",
  id: newId(ctx),
  properties,
});

export const tprop = (name: string, type: t.Type): t.TProp => ({
  __type: "TProp",
  name,
  type,
});

export const tmem = (
  object: t.Type,
  property: string | number,
  ctx: Context
): t.TMem => ({
  __type: "TMem",
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
  __type: "TPrim",
  id: newId(ctx),
  name,
});

export const tNum = (ctx: Context): t.TPrim => tprim("number", ctx);
export const tStr = (ctx: Context): t.TPrim => tprim("string", ctx);
export const tBool = (ctx: Context): t.TPrim => tprim("boolean", ctx);

export const tlit = (lit: Literal, ctx: Context): t.TLit => ({
  __type: "TLit",
  id: newId(ctx),
  value: lit,
});
