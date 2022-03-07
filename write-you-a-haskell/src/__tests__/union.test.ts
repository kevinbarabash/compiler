import { Map } from "immutable";

import { inferExpr, constraintsExpr } from "../infer";
import { Expr } from "../syntax-types";
import { Env, print, Scheme, TVar, TCon, TFun } from "../type";
import * as b from "../syntax-builders";

type Binding = [string, Expr];

describe("Union types and type widening", () => {
  test("call function that returns a union type", () => {
    const aVar: TVar = { tag: "TVar", id: 0, name: "a" };
    const bVar: TVar = { tag: "TVar", id: 1, name: "b" };

    const retUnion: Scheme = {
      tag: "Forall",
      qualifiers: [aVar, bVar],
      type: {
        tag: "TFun",
        id: 2,
        args: [aVar, bVar],
        ret: { tag: "TUnion", id: 3, types: [aVar, bVar] },
      },
    };

    const call: Expr = {
      tag: "App",
      fn: b._var("retUnion"),
      args: [b.int(5), b.bool(true)],
    };
    let env: Env = Map();

    env = env.set("retUnion", retUnion);

    const result0 = env.get("retUnion");
    if (!result0) {
      throw new Error("retUnion is undefined");
    }
    expect(print(result0)).toEqual("<a, b>(a, b) => a | b");

    const result1 = inferExpr(env, call, { count: 4 });

    expect(print(result1)).toEqual("Int | Bool");

    const call2: Expr = {
      tag: "App",
      fn: b._var("retUnion"),
      args: [b.bool(false), b.int(10)],
    };

    env = env.set("retUnion", retUnion);
    const result2 = inferExpr(env, call2, { count: 4 });

    expect(print(result2)).toEqual("Bool | Int");
  });

  // TODO: figure out a way to normalize union types.
  test.todo("order of types in union doesn't matter");

  test("infer lambda with union return type", () => {
    const expr: Expr = b.lam(
      ["x", "y"],
      b._if(
        b._var("x"),
        b.app(b._var("y"), [b.int(5)]),
        b.app(b._var("y"), [b.bool(true)])
      )
    );

    const env: Env = Map();

    const result = inferExpr(env, expr);
    expect(print(result)).toEqual("<a>(Bool, (Int | Bool) => a) => a");
  });

  test("infer union of function types", () => {
    const int: TCon = { tag: "TCon", id: 0, name: "Int", params: [] };
    const bool: TCon = { tag: "TCon", id: 1, name: "Bool", params: [] };
    const foo: Scheme = {
      tag: "Forall",
      qualifiers: [],
      type: {
        tag: "TFun",
        id: 0,
        args: [{ tag: "TCon", id: 1, name: "Int", params: [] }],
        ret: { tag: "TCon", id: 2, name: "Bool", params: [] },
      },
    };
    const bar: Scheme = {
      tag: "Forall",
      qualifiers: [],
      type: {
        tag: "TFun",
        id: 3,
        args: [{ tag: "TCon", id: 4, name: "Bool", params: [] }],
        ret: { tag: "TCon", id: 5, name: "Int", params: [] },
      },
    };
    const expr: Expr = b.lam(
      ["x"],
      b._if(
        b._var("x"),
        b._var("foo"),
        b._var("bar"),
      )
    );

    let env: Env = Map();
    env = env.set("foo", foo);
    env = env.set("bar", bar);

    const result = inferExpr(env, expr, {count: 4});
    expect(print(result)).toMatchInlineSnapshot(`"(Bool | Int) => (Int | Bool) => Bool | Int"`)
  });

  test("widen existing union type", () => {
    const int: TCon = { tag: "TCon", id: 0, name: "Int", params: [] };
    const bool: TCon = { tag: "TCon", id: 1, name: "Bool", params: [] };

    const union: Scheme = {
      tag: "Forall",
      qualifiers: [],
      type: {
        tag: "TUnion",
        id: 2,
        types: [int, bool],
      },
    };

    let env: Env = Map();
    env = env.set("union", union);

    const expr: Expr = b.lam(
      ["x", "y"],
      b._if(
        b._var("x"),
        b.app(b._var("y"), [b._var("union")]),
        b.app(b._var("y"), [b.str("hello")])
      )
    );

    const result = inferExpr(env, expr);
    expect(print(result)).toEqual("<a>(Bool, Int | Bool | Str) => a");
  });

  test("widen inferred union type", () => {
    const expr: Expr = b.lam(
      ["x"],
      b._let(
        "a",
        b.app(b._var("x"), [b.int(5)]),
        b._let(
          "b",
          b.app(b._var("x"), [b.bool(true)]),
          b._let(
            "c",
            b.app(b._var("x"), [b.str("hello")]),
            b._var("c"),
          ),
        ),
      ),
    );

    const env: Env = Map();
    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("<a>((Int | Bool | Str) => a) => a");
  });

  test("should not widen frozen types", () => {
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
});
