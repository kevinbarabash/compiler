import { Map } from "immutable";

import * as t from "./type-types";

export const tvar = (name: string, ctx: t.Context): t.TVar => ({
  tag: "TVar",
  id: ++ctx.state.count,
  name,
});

export const tcon = (name: string, params: t.Type[], ctx: t.Context): t.TCon => ({
  tag: "TCon",
  id: ++ctx.state.count,
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
  id: ++ctx.state.count,
  args,
  ret,
  src,
});

export const tunion = (types: readonly t.Type[], ctx: t.Context): t.TUnion => ({
  tag: "TUnion",
  id: ++ctx.state.count,
  types,
});

export const ttuple = (types: readonly t.Type[], ctx: t.Context): t.TTuple => ({
  tag: "TTuple",
  id: ++ctx.state.count,
  types,
});

export const trec = (properties: readonly t.TProp[], ctx: t.Context): t.TRec => ({
  tag: "TRec",
  id: ++ctx.state.count,
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
