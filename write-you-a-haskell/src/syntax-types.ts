// TODO: update these types to prefix all of their tags with E, e.g.
// EVar, EApp, ELam, etc.
export type Expr =
  | { tag: "Var"; name: string }
  | { tag: "App"; fn: Expr; args: readonly Expr[] }
  | { tag: "Lam"; args: readonly string[]; body: Expr; async?: boolean }
  // TODO: support destructuring, this will require replacing `name: string`
  // with `pattern: Pattern`.
  | { tag: "Let"; pattern: Pattern; value: Expr; body: Expr }
  | { tag: "Lit"; value: Literal }
  | { tag: "If"; cond: Expr; th: Expr; el: Expr }
  | { tag: "Fix"; expr: Expr }
  | { tag: "Op"; op: Binop; left: Expr; right: Expr }
  | { tag: "Await"; expr: Expr }
  | { tag: "Tuple"; elements: readonly Expr[] }
  | { tag: "Rec"; properties: readonly EProp[] };

export type EProp = { tag: "EProp"; name: string; value: Expr }

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
type PProp = { tag: "PProp"; name: string; pattern?: Pattern };
