import { Map } from "immutable";

import { constraintsExpr, inferExpr } from "../infer";
import { Expr } from "../syntax";
import { Env, print } from "../type";

type Binding = [string, Expr];

const I: Binding = [
  "I",
  {
    tag: "Lam",
    arg: "x",
    body: { tag: "Var", name: "x" },
  },
];

const K: Binding = [
  "K",
  {
    tag: "Lam",
    arg: "x",
    body: {
      tag: "Lam",
      arg: "y",
      body: { tag: "Var", name: "x" },
    },
  },
];

// let S = (f) => (g) => (x) => f(x)(g(x))
const S: Binding = [
  "S",
  {
    tag: "Lam",
    arg: "f",
    body: {
      tag: "Lam",
      arg: "g",
      body: {
        tag: "Lam",
        arg: "x",
        body: {
          tag: "App",
          fn: {
            tag: "App",
            fn: { tag: "Var", name: "f" },
            arg: { tag: "Var", name: "x" },
          },
          arg: {
            tag: "App",
            fn: { tag: "Var", name: "g" },
            arg: { tag: "Var", name: "x" },
          },
        },
      },
    },
  },
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
      const S: Binding = [
        "S",
        {
          tag: "Lam",
          arg: "f",
          body: {
            tag: "Lam",
            arg: "g",
            body: {
              tag: "Lam",
              arg: "x",
              body: {
                tag: "App",
                fn: {
                  tag: "App",
                  fn: { tag: "Var", name: "f" },
                  arg: { tag: "Var", name: "x" },
                },
                arg: {
                  tag: "App",
                  fn: { tag: "Var", name: "g" },
                  arg: { tag: "Var", name: "x" },
                },
              },
            },
          },
        },
      ];
  
      const skk: Binding = [
        "skk",
        {
          tag: "App",
          fn: {
            tag: "App",
            fn: { tag: "Var", name: "S" },
            arg: { tag: "Var", name: "K" },
          },
          arg: { tag: "Var", name: "K" },
        },
      ];
  
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
      const K: Binding = [
        "Mu",
        {
          tag: "Lam",
          arg: "f",
          body: {
            tag: "App",
            fn: { tag: "Var", name: "f" },
            arg: { tag: "Fix", expr: { tag: "Var", name: "f" } },
          },
        },
      ];
  
      const env: Env = Map();
      const result = inferExpr(env, K[1]);
  
      expect(print(result)).toEqual("forall a => ((a -> a) -> a)");
    });
  });

  describe("Functions", () => {
    test.todo("let rec fib = (n) => ...");
    test.todo("let const = (x) => (y) => x");
    test.todo("let compose = (f) => (g) => (x) => f(g(x))");
    test.todo("let twice = (f) => (x) => f(f(x))");
    test.todo("let on = ...");
    test.todo("let ap = ...");
  });

  describe("Let Polymorphism", () => {
    test("let poly = I (I I) (I 3);", () => {
      const poly: Binding = [
        "poly",
        {
          tag: "App",
          fn: {
            tag: "App",
            fn: I[1],
            arg: I[1],
          },
          arg: {
            tag: "App",
            fn: I[1],
            arg: {
              tag: "Lit",
              value: {
                tag: "LInt",
                value: 3,
              }
            }
          }
        }
      ];

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
        {
          tag: "App",
          fn: {tag: "Lam", arg: "x", body: {tag: "Var", name: "x"}},
          arg: {tag: "Lam", arg: "x", body: {tag: "Var", name: "x"}},
        },
      ];

      const env: Env = Map();
      const result = inferExpr(env, self[1]);

      expect(print(result)).toEqual("forall a => (a -> a)");
    });

    test("let innerlet = (x) => (let y = (z) => z in y)", () => {
      const innerlet: Binding = [
        "innerlet",
        {
          tag: "Lam",
          arg: "x",
          body: {
            tag: "Let",
            name: "y",
            value: {
              tag: "Lam",
              arg: "z",
              body: {tag: "Var", name: "z"},
            },
            body: {tag: "Var", name: "y"},
          }
        }
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
