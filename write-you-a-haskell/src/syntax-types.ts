// TODO: update tags to match type name
export type EApp = { tag: "App"; fn: Expr; args: readonly Expr[] };
export type EAwait = { tag: "Await"; expr: Expr };
export type EFix = { tag: "Fix"; expr: Expr };
export type EIf = { tag: "If"; cond: Expr; th: Expr; el: Expr };
export type ELam = {
  tag: "Lam";
  args: readonly string[];
  body: Expr;
  async?: boolean;
};
export type ELet = { tag: "Let"; pattern: Pattern; value: Expr; body: Expr };
export type ELit = { tag: "Lit"; value: Literal };
export type EOp = { tag: "Op"; op: Binop; left: Expr; right: Expr };
export type ERec = { tag: "Rec"; properties: readonly EProp[] };
export type ETuple = { tag: "Tuple"; elements: readonly Expr[] };
export type EVar = { tag: "Var"; name: string };

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
  | EVar;

export type EProp = { tag: "EProp"; name: string; value: Expr };

export type Literal =
  | { tag: "LInt"; value: number }
  | { tag: "LBool"; value: boolean }
  | { tag: "LStr"; value: string };

export type Binop = "Add" | "Sub" | "Mul" | "Eql";

export type Program = { tag: "Program"; decls: Decl[]; expr: Expr };

export type Decl = [string, Expr];

export type Pattern =
  | { tag: "PVar"; name: string } // treat this the same was a `name: string` in Let
  | { tag: "PWild" } // corresponds to `_`
  | { tag: "PRec"; properties: PProp[] }
  | { tag: "PTuple"; patterns: Pattern[] }
  | { tag: "PLit"; value: Literal };
// TODO:
// - PCon, need to wait until the introduction of opaque types and/or type aliases
//   since it doesn't make sense for Array<Int> to be modeled as a type constructor
//   since it doesn't make sense to destructure the `Int` from the Array...
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
type PProp = { tag: "PProp"; name: string; pattern: Pattern };
