import { Map } from "immutable";

import { zip } from "./util";

// TODO: update types to use id's
export type TVar = { tag: "TVar"; name: string };
// TODO: update type constructors to have type params so that we can
// support Array<T>, Promise<T>, etc. in the future.
export type TCon = { tag: "TCon"; name: string; params: Type[] };
export type TApp = { tag: "TApp"; args: Type[]; ret: Type, src?: "App" | "Fix" | "Lam" };

export type Type = TVar | TCon | TApp;

export type Scheme = { tag: "Forall"; qualifiers: TVar[]; type: Type };

export const tInt: TCon = { tag: "TCon", name: "Int", params: [] };
export const tBool: TCon = { tag: "TCon", name: "Bool", params: [] };

export function print(t: Type | Scheme): string {
  switch (t.tag) {
    case "TVar": {
      return t.name;
    }
    case "TCon": {
      return t.params.length > 0
        ? `${t.name}<${t.params.map((param) => print(param)).join(", ")}>`
        : t.name
    }
    case "TApp": {
      return `(${t.args
        .map((arg) => print(arg))
        .join(", ")}) => ${print(t.ret)}`;
    }
    case "Forall": {
      return t.qualifiers.length > 0
        ? `<${t.qualifiers.map((qual) => print(qual)).join(", ")}>${print(
            t.type,
          )}`
        : print(t.type);
    }
  }
}

export function equal(a: Type | Scheme, b: Type | Scheme): boolean {
  if (a.tag === "TVar" && b.tag === "TVar") {
    return a.name === b.name; // TODO: use IDs
  } else if (a.tag === "TCon" && b.tag === "TCon") {
    // TODO: add support for type params to TCon
    return a.name === b.name;
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

export type Constraint = [Type, Type];
export type Unifier = [Subst, Constraint[]];

export type Subst = Map<string, Type>;
