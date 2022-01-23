export type BinOp = "Add" | "Sub" | "Mul" | "Div";

export type Expr =
  | { tag: "Var"; name: string }
  | { tag: "Lit"; value: Lit }
  | { tag: "App"; func: Expr; arg: Expr }
  | { tag: "Lam"; param: string; body: Expr }
  | { tag: "Prim"; op: BinOp; args: Expr[] };

export type Lit =
  // TODO: replace LNum with LInt and LFloat
  | { tag: "LNum"; value: number }
  | { tag: "LBool"; value: boolean };
