import { Map } from "immutable";

import { apply, zip } from "./util";
import { UnboundVariable } from "./errors";
import { Scheme, Type, TVar } from "./type-types";

// Env is a map of all the current schemes (qualified types) that
// are in scope.
export type Env = Map<string, Scheme>;

export type State = {
  count: number;
};

export type Context = {
  env: Env;
  state: State;
  async?: boolean;
};

export const lookupEnv = (name: string, ctx: Context): Type => {
  const value = ctx.env.get(name);
  if (!value) {
    // TODO: keep track of all unbound variables in a decl
    // we can return `unknown` as the type so that unifcation
    // can continue.
    throw new UnboundVariable(name);
  }
  return instantiate(value, ctx);
};

const instantiate = (sc: Scheme, ctx: Context): Type => {
  const freshQualifiers = sc.qualifiers.map(() => fresh(ctx));
  const subs = Map(
    zip(
      sc.qualifiers.map((qual) => qual.id),
      freshQualifiers
    )
  );
  return apply(subs, sc.type);
};

export const fresh = (ctx: Context): TVar => {
  const id = newId(ctx);
  // ctx.state.count++;
  return {
    tag: "TVar",
    id: id,
    name: letterFromIndex(id),
  };
};

const letterFromIndex = (index: number): string =>
  String.fromCharCode(97 + index);

export const newId = (ctx: Context): number => {
  const id = ctx.state.count++;
  // console.log(`id = ${id}`);
  return id;
};
