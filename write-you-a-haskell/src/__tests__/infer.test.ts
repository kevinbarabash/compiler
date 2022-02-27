import { Map } from "immutable";

import { inferExpr } from "../infer";
import { Expr } from "../syntax";
import { Env, print } from "../type";

type Binding = [string, Expr];

const app = (fn: Expr, arg: Expr): Expr => ({ tag: "App", fn, arg });
const _if = (cond: Expr, th: Expr, el: Expr): Expr => ({
  tag: "If",
  cond,
  th,
  el,
});
const fix = (expr: Expr): Expr => ({ tag: "Fix", expr });
const lam = (arg: string, body: Expr): Expr => ({ tag: "Lam", arg, body });
const _let = (name: string, value: Expr, body: Expr): Expr => ({
  tag: "Let",
  name,
  value,
  body,
});
const _var = (name: string): Expr => ({ tag: "Var", name });

const int = (value: number): Expr => ({
  tag: "Lit",
  value: { tag: "LInt", value },
});
const bool = (value: boolean): Expr => ({
  tag: "Lit",
  value: { tag: "LBool", value },
});

const add = (left: Expr, right: Expr): Expr => ({
  tag: "Op",
  op: "Add",
  left,
  right,
});
const sub = (left: Expr, right: Expr): Expr => ({
  tag: "Op",
  op: "Sub",
  left,
  right,
});
const mul = (left: Expr, right: Expr): Expr => ({
  tag: "Op",
  op: "Mul",
  left,
  right,
});
const eql = (left: Expr, right: Expr): Expr => ({
  tag: "Op",
  op: "Eql",
  left,
  right,
});

const I: Binding = ["I", lam("x", _var("x"))];
const K: Binding = ["K", lam("x", lam("y", _var("x")))];
// let S = (f) => (g) => (x) => f(x)(g(x))
const S: Binding = [
  "S",
  lam(
    "f",
    lam(
      "g",
      lam("x", app(app(_var("f"), _var("x")), app(_var("g"), _var("x"))))
    )
  ),
];

describe("inferExpr", () => {
  describe("SKI cominbators", () => {
    test("let I x = x", () => {
      const env: Env = Map();
      const result = inferExpr(env, I[1]);

      expect(print(result)).toEqual("forall a => (a -> a)");
    });

    test("let K x y = x", () => {
      const env: Env = Map();
      const result = inferExpr(env, K[1]);

      expect(print(result)).toEqual("forall a, b => (a -> (b -> a))");
    });

    test("let S f g x = f x (g x)", () => {
      const env: Env = Map();
      const result = inferExpr(env, S[1]);

      expect(print(result)).toEqual(
        "forall a, b, c => ((a -> (b -> c)) -> ((a -> b) -> (a -> c)))"
      );
    });

    test("SKK", () => {
      const skk: Binding = ["skk", app(app(_var("S"), _var("K")), _var("K"))];

      let env: Env = Map();
      env = env.set(S[0], inferExpr(env, S[1]));
      env = env.set(K[0], inferExpr(env, K[1]));
      env = env.set(skk[0], inferExpr(env, skk[1]));

      const result = env.get("skk");
      if (!result) {
        throw new Error("skk is undefined");
      }

      expect(print(result)).toEqual("forall a => (a -> a)");
    });

    test("Mu f = f (fix f)", () => {
      const Mu: Binding = ["Mu", lam("f", app(_var("f"), fix(_var("f"))))];

      const env: Env = Map();
      const result = inferExpr(env, Mu[1]);

      expect(print(result)).toEqual("forall a => ((a -> a) -> a)");
    });
  });

  describe("Integer arithmetic", () => {
    describe("let nsucc x = x + 1", () => {
      const nsucc: Binding = ["nsucc", lam("x", add(_var("x"), int(1)))];

      const env: Env = Map();
      const result = inferExpr(env, nsucc[1]);

      expect(print(result)).toEqual("(Int -> Int)");
    });

    describe("let npred x = x - 1", () => {
      const nsucc: Binding = ["nsucc", lam("x", add(_var("x"), int(1)))];

      const env: Env = Map();
      const result = inferExpr(env, nsucc[1]);

      expect(print(result)).toEqual("(Int -> Int)");
    });
  });

  describe("Functions", () => {
    test("let rec fib = (n) => ...", () => {
      // letrecdecl takes
      // `let rec fib = (n) => ...`
      // and converts it to
      // `let fib = fix((fib) => (n) => ...)`
      const fib: Binding = [
        "fib",
        fix(
          lam(
            "fib",
            lam(
              "n",
              _if(
                eql(_var("n"), int(0)),
                // then
                int(0),
                // else
                _if(
                  eql(_var("n"), int(1)),
                  // then
                  int(1),
                  // else
                  add(
                    app(_var("fib"), sub(_var("n"), int(1))),
                    app(_var("fib"), sub(_var("n"), int(2)))
                  )
                )
              )
            )
          )
        ),
      ];

      const env: Env = Map();
      const result = inferExpr(env, fib[1]);

      expect(print(result)).toEqual("(Int -> Int)");
    });

    test.todo("let const = (x) => (y) => x");
    test.todo("let compose = (f) => (g) => (x) => f(g(x))");
    test.todo("let twice = (f) => (x) => f(f(x))");
    test.todo("let on = ...");
    test.todo("let ap = ...");
  });

  describe("Let Polymorphism", () => {
    test("let poly = I (I I) (I 3);", () => {
      const poly: Binding = ["poly", app(app(I[1], I[1]), app(I[1], int(3)))];

      let env: Env = Map();
      env = env.set(I[0], inferExpr(env, I[1]));
      env = env.set(poly[0], inferExpr(env, poly[1]));

      const result = env.get("poly");
      if (!result) {
        throw new Error("poly is undefined");
      }

      expect(print(result)).toEqual("Int");
    });

    test("let self = ((x) => x)((x) => x)", () => {
      const self: Binding = [
        "self",
        app(lam("x", _var("x")), lam("x", _var("x"))),
      ];

      const env: Env = Map();
      const result = inferExpr(env, self[1]);

      expect(print(result)).toEqual("forall a => (a -> a)");
    });

    test("let innerlet = (x) => (let y = (z) => z in y)", () => {
      const innerlet: Binding = [
        "innerlet",
        lam("x", _let("y", lam("z", _var("z")), _var("y"))),
      ];

      const env: Env = Map();
      const result = inferExpr(env, innerlet[1]);

      // the 'x' param is ignored
      expect(print(result)).toEqual("forall a, b => (a -> (b -> b))");
    });

    // The expression tree for `let rec` appears to be the same as that
    // for `let`.
    test.todo("let innerletrec = (x) => (let rec y = (z) => z in y)");
  });
});
