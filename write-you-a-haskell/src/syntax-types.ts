export type Expr =
  | { tag: "Var"; name: string }
  | { tag: "App"; fn: Expr; args: Expr[] }
  | { tag: "Lam"; args: string[]; body: Expr; async?: boolean }
  | { tag: "Let"; name: string; value: Expr; body: Expr }
  | { tag: "Lit"; value: Lit }
  | { tag: "If"; cond: Expr; th: Expr; el: Expr }
  | { tag: "Fix"; expr: Expr }
  | { tag: "Op"; op: Binop; left: Expr; right: Expr }
  | { tag: "Await"; expr: Expr };

export type Lit =
  | { tag: "LInt"; value: number }
  | { tag: "LBool"; value: boolean }
  | { tag: "LStr"; value: string };

export type Binop = "Add" | "Sub" | "Mul" | "Eql";

export type Program = { tag: "Program"; decls: Decl[]; expr: Expr };

export type Decl = [string, Expr];
