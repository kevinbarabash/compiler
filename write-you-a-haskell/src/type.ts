import { Map } from "immutable";

import { zip } from "./util";

function assertUnreachable(x: never): never {
  throw new Error("Didn't expect to get here");
}

// TODO: update types to use id's
export type TVar = { tag: "TVar"; name: string };
export type TCon = { tag: "TCon"; name: string; params: readonly Type[] };
export type TApp = {
  tag: "TApp";
  args: readonly Type[];
  ret: Type;
  src?: "App" | "Fix" | "Lam";
};
export type TUnion = { tag: "TUnion"; types: Type[] };

export type Type = TVar | TCon | TApp | TUnion;

export type Scheme = { tag: "Forall"; qualifiers: readonly TVar[]; type: Type };

export const tInt: TCon = { tag: "TCon", name: "Int", params: [] };
export const tBool: TCon = { tag: "TCon", name: "Bool", params: [] };

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
    return a.name === b.name; // TODO: use IDs
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

// Env is a map of all the current schemes (qualified types) that
// are in scope.
export type Env = Map<string, Scheme>;

export type Constraint = readonly [Type, Type];
export type Unifier = readonly [Subst, readonly Constraint[]];

export type Subst = Map<string, Type>;
