import { Map } from "immutable";

import { zip } from "./util";

function assertUnreachable(x: never): never {
  throw new Error("Didn't expect to get here");
}

type TCommon = { frozen?: boolean };

// TODO: update types to use id's
export type TVar = TCommon & { tag: "TVar"; id: number; name: string };
export type TCon = TCommon & {
  tag: "TCon";
  id: number;
  name: string;
  params: readonly Type[];
};
export type TApp = TCommon & {
  tag: "TApp";
  args: readonly Type[];
  ret: Type;
  src?: "App" | "Fix" | "Lam";
};
export type TUnion = TCommon & { tag: "TUnion"; types: Type[] };

export type Type = TVar | TCon | TApp | TUnion;

export type Scheme = { tag: "Forall"; qualifiers: readonly TVar[]; type: Type };

export const tInt: TCon = { tag: "TCon", id: -1, name: "Int", params: [] };
export const tBool: TCon = { tag: "TCon", id: -1, name: "Bool", params: [] };

export function print(t: Type | Scheme): string {
  switch (t.tag) {
    case "TVar": {
      return t.name;
    }
    case "TCon": {
      const params = t.params.map(print).join(", ");
      return t.params.length > 0 ? `${t.name}<${params}>` : t.name;
    }
    case "TApp": {
      return `(${t.args.map(print).join(", ")}) => ${print(t.ret)}`;
    }
    case "TUnion": {
      return t.types.map(print).join(" | ");
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

export function equal(a: Type | Scheme, b: Type | Scheme): boolean {
  if (a.tag === "TVar" && b.tag === "TVar") {
    return a.id === b.id; // TODO: use IDs
  } else if (a.tag === "TCon" && b.tag === "TCon") {
    return (
      a.name === b.name &&
      a.params.length === b.params.length &&
      zip(a.params, b.params).every((pair) => equal(...pair))
    );
  } else if (a.tag === "TApp" && b.tag === "TApp") {
    return (
      a.args.length === b.args.length &&
      zip([...a.args, a.ret], [...b.args, b.ret]).every((pair) =>
        equal(...pair)
      )
    );
  } else if (a.tag === "Forall" && b.tag === "Forall") {
    throw new Error("TODO: implement equal for Schemes");
  }
  return false;
}

// NOTE: this function mutates its param
export function freeze(t: Type): void {
  t.frozen = true;
  switch (t.tag) {
    case "TApp": {
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
export const isTApp = (t: Type): t is TApp => t.tag === "TApp";
export const isTUnion = (t: Type): t is TUnion => t.tag === "TUnion";
export const isScheme = (t: any): t is Scheme => t.tag === "Forall";

// Env is a map of all the current schemes (qualified types) that
// are in scope.
export type Env = Map<string, Scheme>;

export type Constraint = readonly [Type, Type];
export type Unifier = readonly [Subst, readonly Constraint[]];

export type Subst = Map<number, Type>;
