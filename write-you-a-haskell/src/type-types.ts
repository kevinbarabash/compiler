import { Map } from "immutable";

import { Literal } from "./syntax-types";

function assertUnreachable(x: never): never {
  throw new Error("Didn't expect to get here");
}

type TCommon = { frozen?: boolean; id: number };

export type TVar = TCommon & { tag: "TVar"; name: string };
export type TCon = TCommon & {
  tag: "TCon";
  name: string;
  params: readonly Type[];
};
export type TFun = TCommon & {
  tag: "TFun";
  args: readonly Type[];
  ret: Type;
  src?: "App" | "Fix" | "Lam";
};
export type TUnion = TCommon & { tag: "TUnion"; types: readonly Type[] };
export type TRec = TCommon & { tag: "TRec"; properties: readonly TProp[] };
export type TTuple = TCommon & { tag: "TTuple"; types: readonly Type[] };
export type TLit = TCommon & { tag: "TLit"; value: Literal };

// TODO: add `optional: boolean` - equivalent to `T | undefined`
export type TProp = { tag: "TProp"; name: string; type: Type };

export type Type = TVar | TCon | TFun | TUnion | TTuple | TRec;

export type Scheme = { tag: "Forall"; qualifiers: readonly TVar[]; type: Type };

// TODO: provide a way to declare types as part of the syntax AST
// We'll need this eventually to support defining bindings to external libraries.
// It will also help simplify writing tests where we need to define the type of
// of something that we can't easily infer from an expression.
export const tInt: TCon = { tag: "TCon", id: -1, name: "Int", params: [] };
export const tBool: TCon = { tag: "TCon", id: -1, name: "Bool", params: [] };
export const tStr: TCon = { tag: "TCon", id: -1, name: "Str", params: [] };

export function print(t: Type | Scheme): string {
  switch (t.tag) {
    case "TVar": {
      return t.name;
    }
    case "TCon": {
      const params = t.params.map(print).join(", ");
      return t.params.length > 0 ? `${t.name}<${params}>` : t.name;
    }
    case "TFun": {
      return `(${t.args.map(print).join(", ")}) => ${print(t.ret)}`;
    }
    case "TUnion": {
      return t.types.map(print).join(" | ");
    }
    case "TRec": {
      return `{${t.properties
        .map((prop) => `${prop.name}: ${print(prop.type)}`)
        .join(", ")}}`;
    }
    case "TTuple": {
      return `[${t.types.map(print).join(", ")}]`;
    }
    case "Forall": {
      const quals = t.qualifiers.map((qual) => print(qual)).join(", ");
      const type = print(t.type);
      return t.qualifiers.length > 0 ? `<${quals}>${type}` : type;
    }
    default:
      assertUnreachable(t);
  }
}

// NOTE: this function mutates its param
export function freeze(t: Type): void {
  t.frozen = true;
  switch (t.tag) {
    case "TFun": {
      t.args.map(freeze);
      freeze(t.ret);
      break;
    }
    case "TCon": {
      t.params.map(freeze);
      break;
    }
    case "TVar": {
      break;
    }
    case "TUnion": {
      t.types.map(freeze);
      break;
    }
    case "TRec": {
      t.properties.map((prop) => freeze(prop.type));
      break;
    }
    case "TTuple": {
      t.types.map(freeze);
      break;
    }
    default:
      assertUnreachable(t);
  }
}

export const scheme = (qualifiers: readonly TVar[], type: Type): Scheme => {
  if (type === undefined) {
    throw new Error("scheme: type can't be undefined");
  }
  return {
    tag: "Forall",
    qualifiers,
    type,
  };
};

export const isTCon = (t: Type): t is TCon => t.tag === "TCon";
export const isTVar = (t: Type): t is TVar => t.tag === "TVar";
export const isTFun = (t: Type): t is TFun => t.tag === "TFun";
export const isTUnion = (t: Type): t is TUnion => t.tag === "TUnion";
export const isTRec = (t: Type): t is TRec => t.tag === "TRec";
export const isTTuple = (t: Type): t is TTuple => t.tag === "TTuple";
export const isScheme = (t: any): t is Scheme => t.tag === "Forall";

// Env is a map of all the current schemes (qualified types) that
// are in scope.
export type Env = Map<string, Scheme>;

export type Constraint = readonly [Type, Type];
export type Unifier = readonly [Subst, readonly Constraint[]];

export type Subst = Map<number, Type>;

export type State = {
  count: number;
};

export type Context = {
  env: Env;
  state: State;
  async?: boolean;
};
