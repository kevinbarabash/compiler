import { Map } from "immutable";

import { inferExpr } from "../infer";
import { Expr } from "../syntax-types";
import { Env } from "../context";
import { print, scheme } from "../type-types";
import * as sb from "../syntax-builders";
import * as tb from "../type-builders";

type Binding = [string, Expr];

const I: Binding = ["I", sb.lam(["x"], sb._var("x"))];
const K: Binding = ["K", sb.lam(["x"], sb.lam(["y"], sb._var("x")))];
// let S = (f) => (g) => (x) => f(x)(g(x))
const S: Binding = [
  "S",
  sb.lam(
    ["f"],
    sb.lam(
      ["g"],
      sb.lam(
        ["x"],
        sb.app(sb.app(sb._var("f"), [sb._var("x")]), [
          sb.app(sb._var("g"), [sb._var("x")]),
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
        sb.app(sb.app(sb._var("S"), [sb._var("K")]), [sb._var("K")]),
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
        sb.lam(["f"], sb.app(sb._var("f"), [sb.fix(sb._var("f"))])),
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
        sb.lam(["x"], sb.add(sb._var("x"), sb.num(1))),
      ];

      const env: Env = Map();
      const result = inferExpr(env, nsucc[1]);

      expect(print(result)).toEqual("(number) => number");
    });

    test("let npred x = x - 1", () => {
      const nsucc: Binding = [
        "nsucc",
        sb.lam(["x"], sb.add(sb._var("x"), sb.num(1))),
      ];

      const env: Env = Map();
      const result = inferExpr(env, nsucc[1]);

      expect(print(result)).toEqual("(number) => number");
    });
  });

  describe("Let Polymorphism", () => {
    test("let poly = I (I I) (I 3);", () => {
      const poly: Binding = [
        "poly",
        sb.app(sb.app(I[1], [I[1]]), [sb.app(I[1], [sb.num(3)])]),
      ];

      let env: Env = Map();
      env = env.set(I[0], inferExpr(env, I[1]));
      env = env.set(poly[0], inferExpr(env, poly[1]));

      const result = env.get("poly");
      if (!result) {
        throw new Error("poly is undefined");
      }

      expect(print(result)).toEqual("3");
    });

    test("let self = ((x) => x)((x) => x)", () => {
      const self: Binding = [
        "self",
        sb.app(sb.lam(["x"], sb._var("x")), [sb.lam(["x"], sb._var("x"))]),
      ];

      const env: Env = Map();
      const result = inferExpr(env, self[1]);

      expect(print(result)).toEqual("<a>(a) => a");
    });

    test("let innerlet = (x) => (let y = (z) => z in y)", () => {
      const innerlet: Binding = [
        "innerlet",
        sb.lam(["x"], sb._let("y", sb.lam(["z"], sb._var("z")), sb._var("y"))),
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
        sb._let(
          "add",
          sb.lam(["a", "b"], sb.add(sb._var("a"), sb._var("b"))),
          sb._var("add")
        ),
      ];

      const env: Env = Map();
      const result = inferExpr(env, f[1]);

      expect(print(result)).toEqual("(number, number) => number");
    });
  });

  describe("Type Constructors", () => {
    test("infer promise type", () => {
      const ctx = tb.createCtx();
      const aVar = tb.tvar("a", ctx);
      // <a>(a) => Promise<a>
      const promisifyScheme = scheme(
        [aVar],
        tb.tfun([aVar], tb.tcon("Promise", [aVar], ctx), ctx, "Lam")
      );

      let env: Env = Map();

      env = env.set("promisify", promisifyScheme);
      const intCall: Binding = [
        "call",
        sb.app(sb._var("promisify"), [sb.num(5)]),
      ];
      const intResult = inferExpr(env, intCall[1], ctx.state);
      expect(print(intResult)).toEqual("Promise<5>");

      const boolCall: Binding = [
        "call",
        sb.app(sb._var("promisify"), [sb.bool(true)]),
      ];
      const boolResult = inferExpr(env, boolCall[1], ctx.state);
      expect(print(boolResult)).toEqual("Promise<true>");
    });

    test("extract value from type constructor", () => {
      const ctx = tb.createCtx();
      const aVar = tb.tvar("a", ctx);
      // <a>(Foo<a>) => a
      const extractScheme = scheme(
        [aVar],
        tb.tfun([tb.tcon("Foo", [aVar], ctx)], aVar, ctx, "Lam")
      );

      let env: Env = Map();

      env = env.set("extract", extractScheme);

      const addFoos = sb.lam(
        ["x", "y"],
        sb.add(
          sb.app(sb._var("extract"), [sb._var("x")]),
          sb.app(sb._var("extract"), [sb._var("y")])
        )
      );

      const result = inferExpr(env, addFoos, { count: 3 });
      expect(print(result)).toEqual("(Foo<number>, Foo<number>) => number");
    });

    test("extract value from type constructor 2", () => {
      const ctx = tb.createCtx();
      const aVar = tb.tvar("a", ctx);
      // <a>(Foo<a>) => a
      const extractScheme = scheme(
        [aVar],
        tb.tfun([tb.tcon("Foo", [aVar], ctx)], aVar, ctx, "Lam")
      );

      let env: Env = Map();

      env = env.set("extract", extractScheme);
      // x is of type Foo<number>
      env = env.set("x", {
        tag: "Forall",
        qualifiers: [],
        type: {
          tag: "TCon",
          id: 3,
          name: "Foo",
          params: [{ tag: "TCon", id: 4, name: "number", params: [] }],
        },
      });

      const extractedX = sb.app(sb._var("extract"), [sb._var("x")]);

      const result = inferExpr(env, extractedX, { count: 5 });
      expect(print(result)).toEqual("number");
    });
  });

  describe("errors", () => {
    test("UnboundVariable", () => {
      const unbound: Binding = [
        "unbound",
        sb.app(sb._var("foo"), [sb._var("x")]),
      ];

      const env: Env = Map();
      expect(() =>
        inferExpr(env, unbound[1])
      ).toThrowErrorMatchingInlineSnapshot(`"foo is unbound"`);
    });

    test("UnificationFail", () => {
      const _add: Binding = [
        "add",
        sb.lam(["a", "b"], sb.add(sb._var("a"), sb._var("b"))),
      ];
      const expr: Expr = sb.app(sb._var("add"), [sb.num(5), sb.bool(true)]);

      let env: Env = Map();
      env = env.set(_add[0], inferExpr(env, _add[1]));

      // TODO: improve this error so that it says something like:
      // Can't pass `true` where the `+` operator expects a `number`
      expect(() => inferExpr(env, expr)).toThrowErrorMatchingInlineSnapshot(
        `"Couldn't unify number with true"`
      );
    });

    test("InfiniteType", () => {
      const omega: Binding = [
        "omega",
        sb.lam(["x"], sb.app(sb._var("x"), [sb._var("x")])),
      ];

      const env: Env = Map();

      expect(() => inferExpr(env, omega[1])).toThrowErrorMatchingInlineSnapshot(`"a appears in (a) => b"`);
    });
  });
});
