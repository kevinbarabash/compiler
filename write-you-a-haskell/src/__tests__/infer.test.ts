import { Map } from "immutable";

import { inferExpr } from "../infer";
import { Expr } from "../syntax-types";
import { Env, print, Scheme, TVar } from "../type";
import * as b from "../syntax-builders";

type Binding = [string, Expr];

const I: Binding = ["I", b.lam(["x"], b._var("x"))];
const K: Binding = ["K", b.lam(["x"], b.lam(["y"], b._var("x")))];
// let S = (f) => (g) => (x) => f(x)(g(x))
const S: Binding = [
  "S",
  b.lam(
    ["f"],
    b.lam(
      ["g"],
      b.lam(
        ["x"],
        b.app(b.app(b._var("f"), [b._var("x")]), [
          b.app(b._var("g"), [b._var("x")]),
        ])
      )
    )
  ),
];

describe("inferExpr", () => {
  describe("SKI cominbators", () => {
    test("let I x = x", () => {
      const env: Env = Map();
      const result = inferExpr(env, I[1]);

      expect(print(result)).toEqual("<a>(a) => a");
    });

    test("let K x y = x", () => {
      const env: Env = Map();
      const result = inferExpr(env, K[1]);

      expect(print(result)).toEqual("<a, b>(a) => (b) => a");
    });

    test("let S f g x = f x (g x)", () => {
      const env: Env = Map();
      const result = inferExpr(env, S[1]);

      expect(print(result)).toEqual(
        "<a, b, c>((a) => (b) => c) => ((a) => b) => (a) => c"
      );
    });

    test("SKK", () => {
      const skk: Binding = [
        "skk",
        b.app(b.app(b._var("S"), [b._var("K")]), [b._var("K")]),
      ];

      let env: Env = Map();
      env = env.set(S[0], inferExpr(env, S[1]));
      env = env.set(K[0], inferExpr(env, K[1]));
      env = env.set(skk[0], inferExpr(env, skk[1]));

      const result = env.get("skk");
      if (!result) {
        throw new Error("skk is undefined");
      }

      expect(print(result)).toEqual("<a>(a) => a");
    });

    test("Mu f = f (fix f)", () => {
      const Mu: Binding = [
        "Mu",
        b.lam(["f"], b.app(b._var("f"), [b.fix(b._var("f"))])),
      ];

      const env: Env = Map();
      const result = inferExpr(env, Mu[1]);

      expect(print(result)).toEqual("<a>((a) => a) => a");
    });
  });

  describe("Integer arithmetic", () => {
    test("let nsucc x = x + 1", () => {
      const nsucc: Binding = [
        "nsucc",
        b.lam(["x"], b.add(b._var("x"), b.int(1))),
      ];

      const env: Env = Map();
      const result = inferExpr(env, nsucc[1]);

      expect(print(result)).toEqual("(Int) => Int");
    });

    test("let npred x = x - 1", () => {
      const nsucc: Binding = [
        "nsucc",
        b.lam(["x"], b.add(b._var("x"), b.int(1))),
      ];

      const env: Env = Map();
      const result = inferExpr(env, nsucc[1]);

      expect(print(result)).toEqual("(Int) => Int");
    });
  });

  describe("Let Polymorphism", () => {
    test("let poly = I (I I) (I 3);", () => {
      const poly: Binding = [
        "poly",
        b.app(b.app(I[1], [I[1]]), [b.app(I[1], [b.int(3)])]),
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
        b.app(b.lam(["x"], b._var("x")), [b.lam(["x"], b._var("x"))]),
      ];

      const env: Env = Map();
      const result = inferExpr(env, self[1]);

      expect(print(result)).toEqual("<a>(a) => a");
    });

    test("let innerlet = (x) => (let y = (z) => z in y)", () => {
      const innerlet: Binding = [
        "innerlet",
        b.lam(["x"], b._let("y", b.lam(["z"], b._var("z")), b._var("y"))),
      ];

      const env: Env = Map();
      const result = inferExpr(env, innerlet[1]);

      // the 'x' param is ignored
      expect(print(result)).toEqual("<a, b>(a) => (b) => b");
    });

    // The expression tree for `let rec` appears to be the same as that
    // for `let`.
    test.todo("let innerletrec = (x) => (let rec y = (z) => z in y)");

    test("let f = let add = (a, b) => a + b in add;", () => {
      const f: Binding = [
        "f",
        b._let(
          "add",
          b.lam(["a", "b"], b.add(b._var("a"), b._var("b"))),
          b._var("add")
        ),
      ];

      const env: Env = Map();
      const result = inferExpr(env, f[1]);

      expect(print(result)).toEqual("(Int, Int) => Int");
    });
  });

  describe("Type Constructors", () => {
    test("infer promise type", () => {
      const aVar: TVar = { tag: "TVar", id: 0, name: "a" };
      // <a>(a) => Promise<a>
      const promisifyScheme: Scheme = {
        tag: "Forall",
        qualifiers: [aVar],
        type: {
          tag: "TFun",
          args: [aVar],
          ret: { tag: "TCon", id: 1, name: "Promise", params: [aVar] },
          src: "Lam",
        },
      };

      let env: Env = Map();

      env = env.set("promisify", promisifyScheme);
      const intCall: Binding = ["call", b.app(b._var("promisify"), [b.int(5)])];
      const intResult = inferExpr(env, intCall[1], { count: 2 });
      expect(print(intResult)).toEqual("Promise<Int>");

      const boolCall: Binding = [
        "call",
        b.app(b._var("promisify"), [b.bool(true)]),
      ];
      const boolResult = inferExpr(env, boolCall[1], { count: 2 });
      expect(print(boolResult)).toEqual("Promise<Bool>");
    });

    test("extract value from type constructor", () => {
      const aVar: TVar = { tag: "TVar", id: 0, name: "a" };
      // <a>(Foo<a>) => a
      const extractScheme: Scheme = {
        tag: "Forall",
        qualifiers: [aVar],
        type: {
          tag: "TFun",
          args: [{ tag: "TCon", id: 2, name: "Foo", params: [aVar] }],
          ret: aVar,
          src: "Lam",
        },
      };

      let env: Env = Map();

      env = env.set("extract", extractScheme);

      const addFoos = b.lam(
        ["x", "y"],
        b.add(
          b.app(b._var("extract"), [b._var("x")]),
          b.app(b._var("extract"), [b._var("y")])
        )
      );

      const result = inferExpr(env, addFoos, { count: 3 });
      expect(print(result)).toEqual("(Foo<Int>, Foo<Int>) => Int");
    });

    test("extract value from type constructor 2", () => {
      const aVar: TVar = { tag: "TVar", id: 0, name: "a" };
      // <a>(Foo<a>) => a
      const extractScheme: Scheme = {
        tag: "Forall",
        qualifiers: [aVar],
        type: {
          tag: "TFun",
          args: [{ tag: "TCon", id: 1, name: "Foo", params: [aVar] }],
          ret: aVar,
          src: "Lam",
        },
      };

      let env: Env = Map();

      env = env.set("extract", extractScheme);
      // x is of type Foo<Int>
      env = env.set("x", {
        tag: "Forall",
        qualifiers: [],
        type: {
          tag: "TCon",
          id: 2,
          name: "Foo",
          params: [{ tag: "TCon", id: 3, name: "Int", params: [] }],
        },
      });

      const extractedX = b.app(b._var("extract"), [b._var("x")]);

      const result = inferExpr(env, extractedX, { count: 4 });
      expect(print(result)).toEqual("Int");
    });
  });

  describe("errors", () => {
    test("UnboundVariable", () => {
      const unbound: Binding = ["unbound", b.app(b._var("foo"), [b._var("x")])];

      const env: Env = Map();
      expect(() =>
        inferExpr(env, unbound[1])
      ).toThrowErrorMatchingInlineSnapshot(`"foo is unbound"`);
    });

    test("UnificationFail", () => {
      const _add: Binding = [
        "add",
        b.lam(["a", "b"], b.add(b._var("a"), b._var("b"))),
      ];
      const expr: Expr = b.app(b._var("add"), [b.int(5), b.bool(true)]);

      let env: Env = Map();
      env = env.set(_add[0], inferExpr(env, _add[1]));

      expect(() => inferExpr(env, expr)).toThrowErrorMatchingInlineSnapshot(
        `"Couldn't unify Int with Bool"`
      );
    });

    test("InfiniteType", () => {
      const omega: Binding = [
        "omega",
        b.lam(["x"], b.app(b._var("x"), [b._var("x")])),
      ];

      const env: Env = Map();

      expect(() => inferExpr(env, omega[1])).toThrowErrorMatchingInlineSnapshot(
        `"b appears in (b) => c"`
      );
    });
  });
});
