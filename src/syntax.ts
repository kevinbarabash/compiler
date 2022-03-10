export type Program = { tag: "Program"; body: (Expr | Decl)[] };

export type Decl = { tag: "Decl"; name: string; value: Expr };

export type Expr =
  | { tag: "Var"; name: string }
  | { tag: "Lit"; value: Lit }
  | { tag: "App"; func: Expr; args: readonly Expr[] }
  | { tag: "Lam"; params: readonly Param[]; body: Expr }
  | { tag: "Let"; name: string; value: Expr; body: Expr }; // TODO: support destructuring

export type Lit =
  // TODO: replace LNum with LInt and LFloat
  | { tag: "LNum"; value: number }
  | { tag: "LBool"; value: boolean }
  | { tag: "LStr"; value: string }
  | { tag: "LArr"; values: Expr[] };

export type Param = { tag: "Param"; name: string; type: string };

export type BinOp = "Add" | "Sub" | "Mul" | "Div";
