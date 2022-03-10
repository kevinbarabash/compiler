// Types:
// - type literal, e.g. `5`, `"hello"`, `true`
// - type variable, e.g. `a`
// - type constructor, e.g. `Array<a>`, `Promise<a>`, `Tuple<a, b, c>`
// - type function (specialized type constructor)
//   - zero or more param types + one return type
// - type record (specialzed type constructor)
//   - contains multiple type properties (key + type)

// Related concepts:
// - type class, one or more functions and/or values that conform to
//   certain laws.  If these functions and/or values are defined for
//   a particular type, then that type is said to be an "instance" of
//   the given type class.  Type classes can be extended, e.g. Monoid
//   extends Semigroup.  An example of a type class that containining
//   a value is Monoid which adds the `mempty` value to Semigroup.
// - type constraint, e.g. describes what type class a type variable
//   must be an instance of a given type class.

export type LBool = {
  t: "LBool";
  value: boolean;
};

export type LNum = {
  t: "LNum";
  value: number;
};

export type LStr = {
  t: "LStr";
  value: string;
};

export type Literal = LBool | LNum | LStr;

type TCommon = {
  id: number;
  frozen?: boolean; // if true, can unify with non-frozen sub-types
};

export type TLiteral = TCommon & {
  t: "TLit";
  // should we share types for literals with the syntax tree?
  literal: Literal;
};

// TODO: constraints on type variables
export type TVar = TCommon & {
  t: "TVar";
};

// TODO: default + optional type args
export type TCon = TCommon & {
  t: "TCon";
  name: string; // how do we disambiguate across files?
  typeArgs: readonly Type[];
  // TODO:
  // - how do we enforce that Array<> and Promise<> only take a single type arg?
  // - if the argTypes in TFunction are named, we could also make the type args here
  //   named as well
};

export type TParam = TCommon & {
  t: "TParam";
  name: string;
  type: Type;
  optional: boolean;
};

export type TFun = TCommon & {
  t: "TFun";
  // TODO: support optional params, this needs to be done during parsing, since
  // argTypes can reference param types of the Lambda or arg types of the Apply.
  paramTypes: readonly TParam[]; // we could make these named
  retType: Type;
};

export type TRec = TCommon & {
  t: "TRec";
  // if properties was an object, we could look up each property by
  // its name.
  properties: readonly TProp[];
};

export type TProp = TCommon & {
  t: "TProp";
  name: string; // could we also use TLiteral here as well?
  type: Type;
  optional: boolean; // this is equivalent to `T | undefined`
};

export type TTuple = TCommon & {
  t: "TTuple";
  types: readonly Type[];
};

export type TUnion = TCommon & {
  t: "TUnion";
  types: readonly Type[];
};

export type Type = 
  | TLiteral  // 5, false, "hello"
  | TVar      // a, b, etc.
  | TCon      // Array<number>, Promise<a>
  | TFun      // (number, string) => boolean
  | TRec      // {x: number, y?: string}
  | TTuple    // [number, string]
  | TUnion;   // number | string

// TODO:
// - add `.frozen` property to each type so that we can't prevent widening
//   after a top-level declaration's type has been inferred.
// - do we need to differentiate between records and objects or
//   arrays and tuples to support https://github.com/tc39/proposal-record-tuple?
