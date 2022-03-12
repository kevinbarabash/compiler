import { Map } from "immutable";

import {
  Context,
  TVar,
  TCon,
  TFun,
  TUnion,
  TTuple,
  TRec,
  TProp,
  Type,
} from "./type-types";

export const tvar = (name: string, ctx: Context): TVar => ({
  tag: "TVar",
  id: ctx.state.count++,
  name,
});

export const tcon = (name: string, params: Type[], ctx: Context): TCon => ({
  tag: "TCon",
  id: ctx.state.count++,
  name,
  params,
});

export const tfun = (args: Type[], ret: Type, ctx: Context, src?: "App" | "Fix" | "Lam"): TFun => ({
  tag: "TFun",
  id: ctx.state.count++,
  args,
  ret,
  src,
});

export const tunion = (types: Type[], ctx: Context): TUnion => ({
  tag: "TUnion",
  id: ctx.state.count++,
  types,
});

export const ttuple = (types: Type[], ctx: Context): TTuple => ({
  tag: "TTuple",
  id: ctx.state.count++,
  types,
});

export const trec = (properties: TProp[], ctx: Context): TRec => ({
  tag: "TRec",
  id: ctx.state.count++,
  properties,
});

export const tprop = (name: string, type: Type): TProp => ({
  tag: "TProp",
  name,
  type,
});

export const createCtx = (): Context => {
  const ctx: Context = {
    env: Map(),
    state: { count: 0 },
  };
  return ctx;
};
