import { Map } from "immutable";

import { Literal } from "./syntax-types";

function assertUnreachable(x: never): never {
  throw new Error("Didn't expect to get here");
}

type TCommon = { frozen?: boolean; id: number };

export type Src = "App" | "Fix" | "Lam";
export type PrimName = "boolean" | "number" | "string" | "null" | "undefined";

export type TVar = TCommon & { tag: "TVar"; name: string };
export type TCon = TCommon & { tag: "TCon"; name: string; params: readonly Type[] }; // prettier-ignore
export type TFun = TCommon & { tag: "TFun"; args: readonly Type[]; ret: Type; src?: Src }; // prettier-ignore
export type TUnion = TCommon & { tag: "TUnion"; types: readonly Type[] };
export type TRec = TCommon & { tag: "TRec"; properties: readonly TProp[] };
export type TMem = TCommon & { tag: "TMem"; object: Type; property: string };
export type TTuple = TCommon & { tag: "TTuple"; types: readonly Type[] };
export type TLit = TCommon & { tag: "TLit"; value: Literal };
export type TPrim = TCommon & { tag: "TPrim"; name: PrimName };
// Each TLit must belong to at least one TPrimitive type
// e.g. TLit(3) belongs to TPrim(number) (and also TPrim(bigint))
// It would be nice if we could model the difference between ints and floats.
// Right now TPrim(number) contains both ints and floats.  The following
// two hierarchies are more accurate.
// - TLit(3) < ?(int) < ?(float) < TPrim(number)
// - TLit(3) < ?(int) < TPrim(bigint)
// Tracking what numbers are integers are important for the type safety
// or certain APIs that require the use of integers (or even natural numbers)
// such as indexing into an array.

// TODO: add `optional: boolean` - equivalent to `T | undefined`
export type TProp = { tag: "TProp"; name: string; type: Type };

export type Type = TVar | TCon | TFun | TUnion | TTuple | TRec | TMem | TPrim | TLit;
export type Scheme = { tag: "Forall"; qualifiers: readonly TVar[]; type: Type };

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
    case "TPrim": {
      return t.name;
    }
    case "TLit": {
      return t.value.tag === "LStr"
        ? `"${t.value.value}"`
        : t.value.value.toString();
    }
    case "TMem": {
      return `${print(t.object)}['${t.property}']`;
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
    case "TPrim": {
      break;
    }
    case "TLit": {
      break;
    }
    case "TMem": {
      freeze(t.object);
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
export const isTPrim = (t: Type): t is TPrim => t.tag === "TPrim";
export const isTLit = (t: Type): t is TLit => t.tag === "TLit";
export const isTMem = (t: Type): t is TMem => t.tag === "TMem";
export const isScheme = (t: any): t is Scheme => t.tag === "Forall";

export type Constraint = readonly [Type, Type];
export type Unifier = readonly [Subst, readonly Constraint[]];

export type Subst = Map<number, Type>;
