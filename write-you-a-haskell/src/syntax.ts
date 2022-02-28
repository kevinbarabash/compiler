export type Expr =
  | { tag: "Var"; name: string }
  | { tag: "App"; fn: Expr; arg: Expr } // TODO: make this n-ary
  | { tag: "Lam"; arg: string; body: Expr }
  | { tag: "Let"; name: string; value: Expr; body: Expr }
  | { tag: "Lit"; value: Lit }
  | { tag: "If"; cond: Expr; th: Expr; el: Expr }
  | { tag: "Fix"; expr: Expr }
  | { tag: "Op"; op: Binop; left: Expr; right: Expr };

export type Lit =
  | { tag: "LInt"; value: number }
  | { tag: "LBool"; value: boolean };

export type Binop = "Add" | "Sub" | "Mul" | "Eql";

export type Program = { tag: "Program"; decls: Decl[]; expr: Expr };

export type Decl = [string, Expr];
