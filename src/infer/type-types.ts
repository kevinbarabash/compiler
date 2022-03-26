import { Map } from "immutable";

import { Literal } from "./syntax-types";

function assertUnreachable(x: never): never {
  throw new Error("Didn't expect to get here");
}

type Node<T extends string, P extends {}> = { __type: T } & P;

type TypeNode<T extends string, P extends {}> = Node<
  T,
  P & { frozen?: boolean; id: number }
>;

// What's the difference between `null` as a primtive type vs `null` as a type literal?
export type PrimName = "boolean" | "number" | "string" | "null" | "undefined";

export type TVar = TypeNode<"TVar", { name: string }>;
export type TGen = TypeNode<"TGen", { name: string; params: readonly Type[] }>;
export type TFun = TypeNode<"TFun", { args: readonly Type[]; ret: Type; variadic?: boolean }>; // prettier-ignore
export type TUnion = TypeNode<"TUnion", { types: readonly Type[] }>;
export type TRec = TypeNode<"TRec", { properties: readonly TProp[] }>;
// TODO: need a better way model the following:
// - a.b (equivalent to a['b'])
// - a[b] (right now we don't have a way to describe this)
// - a['b'] / a[1]
export type TMem = TypeNode<"TMem", { object: Type; property: string | number }>; // prettier-ignore
export type TTuple = TypeNode<"TTuple", { types: readonly Type[] }>;
export type TLit = TypeNode<"TLit", { value: Literal }>;
export type TPrim = TypeNode<"TPrim", { name: PrimName }>;
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
export type TProp = Node<"TProp", { name: string; type: Type }>;

export type Type =
  | TVar
  | TGen
  | TFun
  | TUnion
  | TTuple
  | TRec
  | TMem
  | TPrim
  | TLit;

export type Scheme = Node<"Forall", { qualifiers: readonly TVar[]; type: Type}>; // prettier-ignore

export function print(t: Type | Scheme): string {
  switch (t.__type) {
    case "TVar": {
      return t.name;
    }
    case "TGen": {
      const params = t.params.map(print).join(", ");
      return t.params.length > 0 ? `${t.name}<${params}>` : t.name;
    }
    case "TFun": {
      const { variadic } = t;
      const argCount = t.args.length;
      const args = t.args.map((arg, index) => {
        const isLast = index === argCount - 1;
        if (isLast && variadic) {
          return `...${print(arg)}`;
        }
        return print(arg);
      });
      return `(${args.join(", ")}) => ${print(t.ret)}`;
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
      switch (t.value.__type) {
        case "LStr":
          return `"${t.value.value}"`;
        case "LNum":
          return t.value.value.toString();
        case "LBool":
          return t.value.value.toString();
        case "LNull":
          return "null";
        case "LUndefined":
          return "undefined";
      }
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
  switch (t.__type) {
    case "TFun": {
      t.args.map(freeze);
      freeze(t.ret);
      break;
    }
    case "TGen": {
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
    __type: "Forall",
    qualifiers,
    type,
  };
};

export const isTGen = (t: Type): t is TGen => t.__type === "TGen";
export const isTVar = (t: Type): t is TVar => t.__type === "TVar";
export const isTFun = (t: Type): t is TFun => t.__type === "TFun";
export const isTUnion = (t: Type): t is TUnion => t.__type === "TUnion";
export const isTRec = (t: Type): t is TRec => t.__type === "TRec";
export const isTTuple = (t: Type): t is TTuple => t.__type === "TTuple";
export const isTPrim = (t: Type): t is TPrim => t.__type === "TPrim";
export const isTLit = (t: Type): t is TLit => t.__type === "TLit";
export const isTMem = (t: Type): t is TMem => t.__type === "TMem";
export const isScheme = (t: any): t is Scheme => t.__type === "Forall";

export type Constraint<T extends Type = Type> = {
  types: readonly [T, T];
  subtype: boolean; // indicates whether or not to allow types[0] to be a subtype of types[1]
};

export type Unifier = readonly [Subst, readonly Constraint[]];

export type Subst = Map<number, Type>;
