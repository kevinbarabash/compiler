export type BinOp = "Add" | "Sub" | "Mul" | "Div";

// TODO: add support for let-in
export type Expr =
  | { tag: "Var"; name: string }
  | { tag: "Lit"; value: Lit }
  | { tag: "App"; func: Expr; args: readonly Expr[] }
  | { tag: "Lam"; params: readonly string[]; body: Expr }
  | { tag: "Prim"; op: BinOp; args: readonly Expr[] }
  // TODO: support destructuring
  | { tag: "Let"; name: string; value: Expr; body: Expr }

export type Lit =
  // TODO: replace LNum with LInt and LFloat
  | { tag: "LNum"; value: number }
  | { tag: "LBool"; value: boolean }
