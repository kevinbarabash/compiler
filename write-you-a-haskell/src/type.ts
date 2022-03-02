import { Map } from "immutable";

import { zip } from "./util";

// TODO: update types to use id's
export type TVar = { tag: "TVar"; name: string };
// TODO: update type constructors to have type params so that we can
// support Array<T>, Promise<T>, etc. in the future.
export type TCon = { tag: "TCon"; name: string };
export type TApp = { tag: "TApp"; args: Type[]; ret: Type };

export type Type = TVar | TCon | TApp;

export type Scheme = { tag: "Forall"; qualifiers: TVar[]; type: Type };

export const tInt: TCon = { tag: "TCon", name: "Int" };
export const tBool: TCon = { tag: "TCon", name: "Bool" };

// TODO: add an option to control output style
export function print(t: Type | Scheme, nary = false): string {
  switch (t.tag) {
    case "TVar": {
      return t.name;
    }
    case "TCon": {
      return t.name;
    }
    case "TApp": {
      if (nary) {
        return `(${t.args
          .map((arg) => print(arg, nary))
          .join(", ")}) => ${print(t.ret, nary)}`;
      } else {
        // we assume that there's always a single arg when `nary` is false
        if (t.args[0].tag === "TApp") {
          return `(${print(t.args[0], nary)}) -> ${print(t.ret, nary)}`;
        } else {
          return `${print(t.args[0], nary)} -> ${print(t.ret, nary)}`;
        }
      }
    }
    case "Forall": {
      return t.qualifiers.length > 0
        ? `<${t.qualifiers.map((qual) => print(qual, nary)).join(", ")}>${print(
            t.type,
            nary
          )}`
        : print(t.type, nary);
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