import { Map } from "immutable";

import { inferExpr } from "../infer";
import { Expr } from "../syntax-types";
import { Env, print, Scheme } from "../type";
import * as b from "../syntax-builders";

describe("Async/Await", () => {
  test("return value is wrapped in a promise", () => {
    const expr: Expr = b.lam([], b.int(5), true);

    const env: Env = Map();
    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("() => Promise<Int>");
  });

  test("return value is not rewrapped if already a promise", () => {
    const retVal: Scheme = {
      tag: "Forall",
      qualifiers: [],
      type: {
        tag: "TCon",
        id: 0,
        name: "Promise",
        params: [{ tag: "TCon", name: "Int", id: 1, params: [] }],
      },
    };
    const expr: Expr = b.lam([], b._var("retVal"), true);

    let env: Env = Map();
    env = env.set("retVal", retVal);
    const result = inferExpr(env, expr, { count: 2 });

    expect(print(result)).toEqual("() => Promise<Int>");
  });

  test("awaiting a promise will unwrap it", () => {
    const retVal: Scheme = {
      tag: "Forall",
      qualifiers: [],
      type: {
        tag: "TCon",
        id: 0,
        name: "Promise",
        params: [{ tag: "TCon", name: "Int", id: 1, params: [] }],
      },
    };
    // Passing an awaited Promise<Int> to add() verifies that we're
    // unwrapping promises.
    const expr: Expr = b.lam([], b.add(b._await(b._var("retVal")), b.int(5)), true);

    let env: Env = Map();
    env = env.set("retVal", retVal);
    const result = inferExpr(env, expr, { count: 2 });

    expect(print(result)).toEqual("() => Promise<Int>");
  });

  test("awaiting a non-promise value is a no-op", () => {
    // Passing an awaited Promise<Int> to add() verifies that we're
    // unwrapping promises.
    const expr: Expr = b.lam([], b.add(b._await(b.int(5)), b.int(10)), true);

    const env: Env = Map();
    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("() => Promise<Int>");
  });

  test("inferring an async function that returns a polymorphic promise", () => {
    const expr: Expr = b.lam(["x"], b.app(b._var("x"), []), true);

    const env: Env = Map();
    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("<a>(() => a) => Promise<a>");
  });

  test("awaiting inside a non-async lambda", () => {
    const expr: Expr = b.lam([], b.add(b._await(b.int(5)), b.int(10)));

    const env: Env = Map();
    expect(() => inferExpr(env, expr)).toThrowErrorMatchingInlineSnapshot(
      `"Can't use \`await\` inside non-async lambda"`
    );
  });

  test("awaiting inside a nested non-async lambda", () => {
    const expr: Expr = b.lam(
      [],
      b._let(
        "add",
        b.lam(["a", "b"], b.add(b._await(b._var("a")), b._var("b"))),
        b.app(b._var("add"), [b.int(5), b.int(10)])
      ),
      true // Even though the outer lambda is async, the inner one isn't
    );

    const env: Env = Map();
    expect(() => inferExpr(env, expr)).toThrowErrorMatchingInlineSnapshot(
      `"Can't use \`await\` inside non-async lambda"`
    );
  });

  test("awaiting inside a nested async lambda", () => {
    const expr: Expr = b.lam(
      [],
      b._let(
        "add",
        b.lam(["a", "b"], b.add(b._await(b._var("a")), b._var("b")), true),
        b.app(b._var("add"), [b.int(5), b.int(10)])
      ),
      false
    );

    const env: Env = Map();
    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("() => Promise<Int>");
  });
});
