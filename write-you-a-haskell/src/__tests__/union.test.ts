import { Map } from "immutable";

import { inferExpr } from "../infer";
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

    expect(print(result1)).toEqual("Int | Bool");

    const call2: Expr = {
      tag: "App",
      fn: sb._var("retUnion"),
      args: [sb.bool(false), sb.num(10)],
    };

    env = env.set("retUnion", retUnion);
    const result2 = inferExpr(env, call2, ctx.state);

    expect(print(result2)).toEqual("Bool | Int");
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
    expect(print(result)).toEqual("<a>(Bool, (Int | Bool) => a) => a");
  });

  test("infer union of function types", () => {
    const ctx = tb.createCtx();
    const foo = scheme(
      [],
      tb.tfun([tb.tcon("Int", [], ctx)], tb.tcon("Bool", [], ctx), ctx)
    );
    const bar = scheme(
      [],
      tb.tfun([tb.tcon("Bool", [], ctx)], tb.tcon("Int", [], ctx), ctx)
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
      `"(Bool) => (Int | Bool) => Bool | Int"`
    );
  });

  test("widen existing union type", () => {
    const ctx = tb.createCtx();
    const union = scheme(
      [],
      tb.tunion([tb.tcon("Int", [], ctx), tb.tcon("Bool", [], ctx)], ctx)
    );

    let env: Env = Map();
    env = env.set("union", union);
    expect(print(union)).toEqual("Int | Bool");

    const expr: Expr = sb.lam(
      ["x", "y"],
      sb._if(
        sb._var("x"),
        sb.app(sb._var("y"), [sb._var("union")]),
        sb.app(sb._var("y"), [sb.str("hello")])
      )
    );

    const result = inferExpr(env, expr, ctx.state);
    expect(print(result)).toEqual("<a>(Bool, (Int | Bool | Str) => a) => a")
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

    expect(print(result)).toEqual("<a>((Int | Bool | Str) => a) => a");
  });

  test("should not widen frozen types", () => {
    const _add: Binding = [
      "add",
      sb.lam(["a", "b"], sb.add(sb._var("a"), sb._var("b"))),
    ];
    const expr: Expr = sb.app(sb._var("add"), [sb.num(5), sb.bool(true)]);

    let env: Env = Map();
    env = env.set(_add[0], inferExpr(env, _add[1]));

    expect(() => inferExpr(env, expr)).toThrowErrorMatchingInlineSnapshot(
      `"Couldn't unify Int with Bool"`
    );
  });
});
