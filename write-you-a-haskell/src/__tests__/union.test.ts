import { Map } from "immutable";

import { inferExpr } from "../infer";
import { Expr } from "../syntax-types";
import { Env, print, Scheme, TVar } from "../type";
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
        args: [aVar, bVar],
        ret: { tag: "TUnion", types: [aVar, bVar] },
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

    const result1 = inferExpr(env, call, { count: 2 });

    expect(print(result1)).toEqual("Int | Bool");

    const call2: Expr = {
      tag: "App",
      fn: b._var("retUnion"),
      args: [b.bool(false), b.int(10)],
    };

    env = env.set("retUnion", retUnion);
    const result2 = inferExpr(env, call2, { count: 2 });

    expect(print(result2)).toEqual("Bool | Int");
  });

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
