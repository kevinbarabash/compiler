import { PrimName } from "./type-types";

export type Program = { tag: "Program"; decls: readonly Decl[]; expr: Expr };
export type Decl = [string, Expr];

// TODO: provide a way to declare types as part of the syntax AST
// We'll need this eventually to support defining bindings to external libraries.
// It will also help simplify writing tests where we need to define the type of
// of something that we can't easily infer from an expression.

/**
 * Expression types
 */

export type EApp = { tag: "EApp"; fn: Expr; args: readonly Expr[] };
export type EAwait = { tag: "EAwait"; expr: Expr };
export type EFix = { tag: "EFix"; expr: Expr };
export type EIf = { tag: "EIf"; cond: Expr; th: Expr; el: Expr };
export type ELam = { tag: "ELam"; args: readonly string[]; body: Expr; async?: boolean }; // prettier-ignore
export type ELet = { tag: "ELet"; pattern: Pattern; value: Expr; body: Expr };
export type ELit<L extends Literal = Literal> = { tag: "ELit"; value: L };
export type EOp = { tag: "EOp"; op: Binop; left: Expr; right: Expr };
export type ERec = { tag: "ERec"; properties: readonly EProp[] };
export type ETuple = { tag: "ETuple"; elements: readonly Expr[] };
export type EIdent = { tag: "EIdent"; name: string };
export type EMem = { tag: "EMem"; object: Expr; property: ELit<LNum> | ELit<LStr> | EIdent }; // prettier-ignore

export type Binop = "Add" | "Sub" | "Mul" | "Eql";
export type EProp = { tag: "EProp"; name: string; value: Expr };

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
  | EMem;

/**
 * Literal types
 */

export type LNum = { tag: "LNum"; value: number };
export type LBool = { tag: "LBool"; value: boolean };
export type LStr = { tag: "LStr"; value: string };
export type LNull = { tag: "LNull" };
export type LUndefined = { tag: "LUndefined" };

export type Literal = LNum | LBool | LStr | LNull | LUndefined;

/**
 * Pattern types
 */

export type PVar = { tag: "PVar"; name: string }; // treat this the same was a `name: string` in Let
export type PWild = { tag: "PWild" }; // corresponds to `_`
export type PRec = { tag: "PRec"; properties: readonly PProp[] };
export type PTuple = { tag: "PTuple"; patterns: readonly Pattern[] };
export type PLit = { tag: "PLit"; value: Literal };
export type PPrim = { tag: "PPrim"; name?: string; primName: PrimName };

export type PProp = { tag: "PProp"; name: string; pattern: Pattern };

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
