import { Map } from "immutable";

import { inferExpr } from "../infer";
import { computeUnion } from "../constraint-solver";
import { Expr } from "../syntax-types";
import { Env, print, scheme } from "../type-types";
import * as sb from "../syntax-builders";
import * as tb from "../type-builders";

type Binding = [string, Expr];

describe("Union types and type widening", () => {
  test("call function that returns a union type", () => {
    const ctx = tb.createCtx();
    const aVar = tb.tvar("a", ctx);
    const bVar = tb.tvar("b", ctx);

    // We reuse TVars in multiple places since this is what happense when
    // inferring an expression because we use lookupEnv to get the TVar based
    // on name.
    const retUnion = scheme(
      [aVar, bVar],
      tb.tfun([aVar, bVar], tb.tunion([aVar, bVar], ctx), ctx)
    );

    const call: Expr = {
      tag: "App",
      fn: sb._var("retUnion"),
      args: [sb.num(5), sb.bool(true)],
    };
    let env: Env = Map();

    env = env.set("retUnion", retUnion);

    const result0 = env.get("retUnion");
    if (!result0) {
      throw new Error("retUnion is undefined");
    }
    expect(print(result0)).toEqual("<a, b>(a, b) => a | b");

    const result1 = inferExpr(env, call, ctx.state);

    expect(print(result1)).toEqual("5 | true");

    const call2: Expr = {
      tag: "App",
      fn: sb._var("retUnion"),
      args: [sb.bool(false), sb.num(10)],
    };

    env = env.set("retUnion", retUnion);
    const result2 = inferExpr(env, call2, ctx.state);

    expect(print(result2)).toEqual("false | 10");
  });

  // TODO: figure out a way to normalize union types.
  test.todo("order of types in union doesn't matter");

  test("infer lambda with union return type", () => {
    const expr: Expr = sb.lam(
      ["x", "y"],
      sb._if(
        sb._var("x"),
        sb.app(sb._var("y"), [sb.num(5)]),
        sb.app(sb._var("y"), [sb.bool(true)])
      )
    );

    const env: Env = Map();

    const result = inferExpr(env, expr);
    expect(print(result)).toMatchInlineSnapshot(
      `"<a>(boolean, (5 | true) => a) => a"`
    );
  });

  test("infer union of function types", () => {
    const ctx = tb.createCtx();
    const foo = scheme(
      [],
      tb.tfun([tb.tprim("number", ctx)], tb.tprim("boolean", ctx), ctx)
    );
    const bar = scheme(
      [],
      tb.tfun([tb.tprim("boolean", ctx)], tb.tprim("number", ctx), ctx)
    );
    const expr: Expr = sb.lam(
      ["x"],
      sb._if(sb._var("x"), sb._var("foo"), sb._var("bar"))
    );

    let env: Env = Map();
    env = env.set("foo", foo);
    env = env.set("bar", bar);

    const result = inferExpr(env, expr, ctx.state);
    expect(print(result)).toMatchInlineSnapshot(
      `"(boolean) => (number | boolean) => boolean | number"`
    );
  });

  test("widen existing union type", () => {
    const ctx = tb.createCtx();
    const union = scheme(
      [],
      tb.tunion([tb.tprim("number", ctx), tb.tprim("boolean", ctx)], ctx)
    );

    let env: Env = Map();
    env = env.set("union", union);
    expect(print(union)).toEqual("number | boolean");

    const expr: Expr = sb.lam(
      ["x", "y"],
      sb._if(
        sb._var("x"),
        sb.app(sb._var("y"), [sb._var("union")]), // number | boolean
        sb.app(sb._var("y"), [sb.str("hello")]) // "hello"
      )
    );

    const result = inferExpr(env, expr, ctx.state);
    // "<a>(boolean, (number | boolean | string) => a) => a"
    expect(print(result)).toMatchInlineSnapshot(
      `"<a>(boolean, (number | boolean | \\"hello\\") => a) => a"`
    );
  });

  test("widen inferred union type", () => {
    const expr: Expr = sb.lam(
      ["x"],
      sb._let(
        "a",
        sb.app(sb._var("x"), [sb.num(5)]),
        sb._let(
          "b",
          sb.app(sb._var("x"), [sb.bool(true)]),
          sb._let("c", sb.app(sb._var("x"), [sb.str("hello")]), sb._var("c"))
        )
      )
    );

    const env: Env = Map();
    const result = inferExpr(env, expr);

    expect(print(result)).toMatchInlineSnapshot(
      `"<a>((5 | true | \\"hello\\") => a) => a"`
    );
  });

  test("should not widen frozen types", () => {
    const _add: Binding = [
      "add",
      sb.lam(["a", "b"], sb.add(sb._var("a"), sb._var("b"))),
    ];
    const expr: Expr = sb.app(sb._var("add"), [sb.num(5), sb.bool(true)]);

    let env: Env = Map();
    env = env.set(_add[0], inferExpr(env, _add[1]));

    // `add` was inferred to have type `(number, number) => number` so
    // we can't pass it a boolean, in this case, `true`
    expect(() => inferExpr(env, expr)).toThrowErrorMatchingInlineSnapshot(
      `"Couldn't unify number with true"`
    );
  });

  describe("computeUnion", () => {
    test("5 | number => number", () => {
      const ctx = tb.createCtx();
      const lit = tb.tlit({ tag: "LNum", value: 5 }, ctx);
      const num = tb.tprim("number", ctx);
      const result = computeUnion(lit, num, ctx);

      expect(print(result)).toEqual("number");
    });

    test("5 | 10 => 5 | 10", () => {
      const ctx = tb.createCtx();
      const lit5 = tb.tlit({ tag: "LNum", value: 5 }, ctx);
      const lit10 = tb.tlit({ tag: "LNum", value: 10 }, ctx);
      const result = computeUnion(lit5, lit10, ctx);

      expect(print(result)).toEqual("5 | 10");
    });

    test("5 | 5 => 5", () => {
      const ctx = tb.createCtx();
      const lit5a = tb.tlit({ tag: "LNum", value: 5 }, ctx);
      const lit5b = tb.tlit({ tag: "LNum", value: 5 }, ctx);
      const result = computeUnion(lit5a, lit5b, ctx);

      expect(print(result)).toEqual("5");
    });

    test("true | boolean => boolean", () => {
      const ctx = tb.createCtx();
      const litTrue = tb.tlit({ tag: "LBool", value: true }, ctx);
      const bool = tb.tprim("boolean", ctx);
      const result = computeUnion(litTrue, bool, ctx);

      expect(print(result)).toEqual("boolean");
    });


    test("true | false => boolean", () => {
      const ctx = tb.createCtx();
      const litTrue = tb.tlit({ tag: "LBool", value: true }, ctx);
      const litFalse = tb.tlit({ tag: "LBool", value: false }, ctx);
      const result = computeUnion(litTrue, litFalse, ctx);

      expect(print(result)).toEqual("boolean");
    });

    test("true | true => true", () => {
      const ctx = tb.createCtx();
      const litTrue = tb.tlit({ tag: "LBool", value: true }, ctx);
      const litFalse = tb.tlit({ tag: "LBool", value: true }, ctx);
      const result = computeUnion(litTrue, litFalse, ctx);

      expect(print(result)).toEqual("true");
    });

    test('"hello" | string => string', () => {
      const ctx = tb.createCtx();
      const hello = tb.tlit({tag: "LStr", value: "hello"}, ctx);
      const str = tb.tprim("string", ctx);
      const result = computeUnion(hello, str, ctx);

      expect(print(result)).toEqual("string");
    });

    test('"hello" | "world" => string', () => {
      const ctx = tb.createCtx();
      const hello = tb.tlit({tag: "LStr", value: "hello"}, ctx);
      const world = tb.tlit({tag: "LStr", value: "world"}, ctx);
      const result = computeUnion(hello, world, ctx);

      expect(print(result)).toEqual('"hello" | "world"');
    });

    test("number | number => number", () => {
      const ctx = tb.createCtx();
      const numa = tb.tprim("number", ctx);
      const numb = tb.tprim("number", ctx);
      const result = computeUnion(numa, numb, ctx);

      expect(print(result)).toEqual("number");
    });

    test("string | string => string", () => {
      const ctx = tb.createCtx();
      const stra = tb.tprim("string", ctx);
      const strb = tb.tprim("string", ctx);
      const result = computeUnion(stra, strb, ctx);

      expect(print(result)).toEqual("string");
    });

    test("string | number => string | number", () => {
      const ctx = tb.createCtx();
      const str = tb.tprim("string", ctx);
      const num = tb.tprim("number", ctx);
      const result = computeUnion(str, num, ctx);

      expect(print(result)).toEqual("string | number");
    });

    test("number | string => string | number", () => {
      const ctx = tb.createCtx();
      const num = tb.tprim("number", ctx);
      const str = tb.tprim("string", ctx);
      const result = computeUnion(num, str, ctx);

      expect(print(result)).toEqual("number | string");
    });

    test("(5 | 10) | 15 => 5 | 10 | 15", () => {
      const ctx = tb.createCtx();
      const lit5 = tb.tlit({ tag: "LNum", value: 5 }, ctx);
      const lit10 = tb.tlit({ tag: "LNum", value: 10 }, ctx);
      const union = computeUnion(lit5, lit10, ctx);
      const lit15 = tb.tlit({ tag: "LNum", value: 15 }, ctx);
      const result = computeUnion(union, lit15, ctx);

      expect(print(result)).toEqual("5 | 10 | 15");
    });

    test("(5 | 10) | number => number", () => {
      const ctx = tb.createCtx();
      const lit5 = tb.tlit({ tag: "LNum", value: 5 }, ctx);
      const lit10 = tb.tlit({ tag: "LNum", value: 10 }, ctx);
      const union = computeUnion(lit5, lit10, ctx);
      const result = computeUnion(union, tb.tprim("number", ctx), ctx);

      expect(print(result)).toEqual("number");
    });
  });
});
