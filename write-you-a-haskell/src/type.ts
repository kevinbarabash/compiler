import { Map } from "immutable";

// TODO: update types to use id's
export type TVar = { tag: "TVar"; name: string };
// TODO: update type constructors to have type params so that we can 
// support Array<T>, Promise<T>, etc. in the future.
export type TCon = { tag: "TCon"; name: string };
// TODO: upgrade arg: Type to args: Type[]
export type TApp = { tag: "TApp"; arg: Type; ret: Type };

export type Type = TVar | TCon | TApp;

export type Scheme = { tag: "Forall"; qualifiers: TVar[]; type: Type };

export const tInt: TCon = { tag: "TCon", name: "Int" };
export const tBool: TCon = { tag: "TCon", name: "Bool" };

export function print(t: Type | Scheme): string {
  switch (t.tag) {
    case "TVar": {
      return t.name;
    }
    case "TCon": {
      return t.name;
    }
    case "TApp": {
      if (t.arg.tag === "TApp") {
        return `(${print(t.arg)}) -> ${print(t.ret)}`;
      } else {
        return `${print(t.arg)} -> ${print(t.ret)}`;
      }
    }
    case "Forall": {
      return t.qualifiers.length > 0
        ? `forall ${t.qualifiers.map(print).join(", ")} => ${print(t.type)}`
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
    // TODO: add supprt for n-ary application
    return equal(a.arg, b.arg) && equal(a.ret, b.ret);
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
