import { PrimName } from "./type-types";

type Node<T extends string, P extends {} = {}> = { __type: T } & P;

export type Program = Node<"Program", { decls: readonly Decl[]; expr: Expr }>;
export type Decl = [string, Expr];

// TODO: provide a way to declare types as part of the syntax AST
// We'll need this eventually to support defining bindings to external libraries.
// It will also help simplify writing tests where we need to define the type of
// of something that we can't easily infer from an expression.

/**
 * Expression types
 */

export type EApp = Node<"EApp", { fn: Expr; args: readonly Expr[] }>;
export type EAwait = Node<"EAwait", { expr: Expr }>;
export type EFix = Node<"EFix", { expr: Expr }>;
export type EIf = Node<"EIf", { cond: Expr; th: Expr; el: Expr }>;
export type ELam = Node<"ELam", { args: readonly (EIdent | ERest)[]; body: Expr; async?: boolean }>; // prettier-ignore
export type ELet = Node<"ELet", { pattern: Pattern; value: Expr; body: Expr }>;
export type ELit<L extends Literal = Literal> = Node<"ELit", { value: L }>;
export type EOp = Node<"EOp", { op: EBinop; left: Expr; right: Expr }>;
export type ERec = Node<"ERec", { properties: readonly EProp[] }>;
export type ETuple = Node<"ETuple", { elements: readonly Expr[] }>;
export type EIdent = Node<"EIdent", { name: string }>;
export type EMem = Node<"EMem", { object: Expr; property: ELit<LNum> | ELit<LStr> | EIdent }>; // prettier-ignore
export type ERest = Node<"ERest", { identifier: EIdent }>;
// TODO: figure out how to include `.raw` property on each of the elements in `strings`
// See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals
export type ETagTemp = Node<"ETagTemp", { tag: EIdent; expressions: readonly Expr[]; strings: readonly ELit<LStr>[] }>; // prettier-ignore

export type EBinop = "Add" | "Sub" | "Mul" | "Eql";
export type EProp = Node<"EProp", { name: string; value: Expr }>;

export type Expr =
  | EApp
  | EAwait
  | EFix
  | EIf
  | ELam
  | ELet
  | ELit
  | EOp
  | ERec
  | ETuple
  | EIdent
  | EMem
  | ERest
  | ETagTemp;

/**
 * Literal types
 */

export type LNum = Node<"LNum", { value: number }>;
export type LBool = Node<"LBool", { value: boolean }>;
export type LStr = Node<"LStr", { value: string }>;
export type LNull = Node<"LNull">;
export type LUndefined = Node<"LUndefined">;

export type Literal = LNum | LBool | LStr | LNull | LUndefined;

/**
 * Pattern types
 */

export type PVar = Node<"PVar", { name: string }>; // treat this the same was a `name: string` in Let
export type PWild = Node<"PWild">; // corresponds to `_`
export type PRec = Node<"PRec", { properties: readonly PProp[] }>;
export type PTuple = Node<"PTuple", { patterns: readonly Pattern[] }>;
export type PLit = Node<"PLit", { value: Literal }>;
export type PPrim = Node<"PPrim", { name?: string; primName: PrimName }>;

export type PProp = Node<"PProp", { name: string; pattern: Pattern }>;

export type Pattern = PVar | PWild | PRec | PTuple | PLit | PPrim;

// TODO:
// - PCon, need to wait until the introduction of opaque types and/or type aliases
//   since it doesn't make sense for Array<Num> to be modeled as a type constructor
//   since it doesn't make sense to destructure the `Num` from the Array...
// - we can look at the rescript AST to see how they handle this
/*
    Pstr_type Nonrec
    [
      type_declaration "t"  
        ptype_params =
          []
        ptype_cstrs =
          []
        ptype_kind =
          Ptype_abstract (could also be Ptype_variant)
        ptype_private = Public
        ptype_manifest =
          None
    ]
   */
// - PNpk, PAs, need to figure out what these are all about

// `pattern` is option in PProp so that we can extract a property whose type
// is an object, or a sub-property within that property's object.
