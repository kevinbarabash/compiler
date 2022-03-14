import { Map } from "immutable";

import { Literal } from "./syntax-types";
import * as t from "./type-types";

const newId = (ctx: t.Context): number => ++ctx.state.count;

export const tvar = (name: string, ctx: t.Context): t.TVar => ({
  tag: "TVar",
  id: newId(ctx),
  name,
});

export const tcon = (
  name: string,
  params: readonly t.Type[],
  ctx: t.Context
): t.TCon => ({
  tag: "TCon",
  id: newId(ctx),
  name,
  params,
});

export const tfun = (
  args: readonly t.Type[],
  ret: t.Type,
  ctx: t.Context,
  src?: "App" | "Fix" | "Lam"
): t.TFun => ({
  tag: "TFun",
  id: newId(ctx),
  args,
  ret,
  src,
});

export const tunion = (types: readonly t.Type[], ctx: t.Context): t.TUnion => ({
  tag: "TUnion",
  id: newId(ctx),
  types,
});

export const ttuple = (types: readonly t.Type[], ctx: t.Context): t.TTuple => ({
  tag: "TTuple",
  id: newId(ctx),
  types,
});

export const trec = (
  properties: readonly t.TProp[],
  ctx: t.Context
): t.TRec => ({
  tag: "TRec",
  id: newId(ctx),
  properties,
});

export const tprop = (name: string, type: t.Type): t.TProp => ({
  tag: "TProp",
  name,
  type,
});

export const createCtx = (): t.Context => {
  const ctx: t.Context = {
    env: Map(),
    state: { count: 0 },
  };
  return ctx;
};

export const tprim = (name: t.PrimName, ctx: t.Context): t.TPrim => ({
  tag: "TPrim",
  id: newId(ctx),
  name,
});

export const tNum = (ctx: t.Context): t.TPrim => tprim("number", ctx);
export const tStr = (ctx: t.Context): t.TPrim => tprim("string", ctx);
export const tBool = (ctx: t.Context): t.TPrim => tprim("boolean", ctx);

export const tlit = (lit: Literal, ctx: t.Context): t.TLit => ({
  tag: "TLit",
  id: newId(ctx),
  value: lit,
})
