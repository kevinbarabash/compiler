import { PrimName } from "./type-types";

// TODO: provide a way to declare types as part of the syntax AST
// We'll need this eventually to support defining bindings to external libraries.
// It will also help simplify writing tests where we need to define the type of
// of something that we can't easily infer from an expression.

// TODO: update tags to match type name
export type EApp = { tag: "App"; fn: Expr; args: readonly Expr[] };
export type EAwait = { tag: "Await"; expr: Expr };
export type EFix = { tag: "Fix"; expr: Expr };
export type EIf = { tag: "If"; cond: Expr; th: Expr; el: Expr };
export type ELam = { tag: "Lam"; args: readonly string[]; body: Expr; async?: boolean }; // prettier-ignore
export type ELet = { tag: "Let"; pattern: Pattern; value: Expr; body: Expr };
export type ELit = { tag: "Lit"; value: Literal };
export type EOp = { tag: "Op"; op: Binop; left: Expr; right: Expr };
export type ERec = { tag: "Rec"; properties: readonly EProp[] }; // rename to EObj
export type ETuple = { tag: "Tuple"; elements: readonly Expr[] };
export type EIdent = { tag: "Ident"; name: string }; // rename to EIdent?
export type EMem = { tag: "Mem"; object: Expr; property: Expr };

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

export type EProp = { tag: "EProp"; name: string; value: Expr };

export type Literal =
  | { tag: "LNum"; value: number }
  | { tag: "LBool"; value: boolean }
  | { tag: "LStr"; value: string }
  | { tag: "LNull" }
  | { tag: "LUndefined" };

export type Binop = "Add" | "Sub" | "Mul" | "Eql";

export type Program = { tag: "Program"; decls: readonly Decl[]; expr: Expr };

export type Decl = [string, Expr];

export type PVar = { tag: "PVar"; name: string }; // treat this the same was a `name: string` in Let
export type PWild = { tag: "PWild" }; // corresponds to `_`
export type PRec = { tag: "PRec"; properties: readonly PProp[] };
export type PTuple = { tag: "PTuple"; patterns: readonly Pattern[] };
export type PLit = { tag: "PLit"; value: Literal };
export type PPrim = { tag: "PPrim"; name?: string; primName: PrimName };

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
export type PProp = { tag: "PProp"; name: string; pattern: Pattern };
