import { Map } from "immutable";

import { inferExpr } from "../infer";
import { Expr } from "../syntax-types";
import { Env, print, scheme } from "../type-types";
import * as sb from "../syntax-builders";
import * as tb from "../type-builders";

describe("Async/Await", () => {
  test("return value is wrapped in a promise", () => {
    const expr: Expr = sb.lam([], sb.int(5), true);

    const env: Env = Map();
    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("() => Promise<Int>");
  });

  test("return value is not rewrapped if already a promise", () => {
    const ctx = tb.createCtx();
    const retVal = scheme(
      [],
      tb.tcon("Promise", [tb.tcon("Int", [], ctx)], ctx),
    );
    const expr: Expr = sb.lam([], sb._var("retVal"), true);

    let env: Env = Map();
    env = env.set("retVal", retVal);
    const result = inferExpr(env, expr, { count: 2 });

    expect(print(result)).toEqual("() => Promise<Int>");
  });

  test("awaiting a promise will unwrap it", () => {
    const ctx = tb.createCtx();
    const retVal = scheme(
      [],
      tb.tcon("Promise", [tb.tcon("Int", [], ctx)], ctx),
    );
    // Passing an awaited Promise<Int> to add() verifies that we're
    // unwrapping promises.
    const expr: Expr = sb.lam([], sb.add(sb._await(sb._var("retVal")), sb.int(5)), true);

    let env: Env = Map();
    env = env.set("retVal", retVal);
    const result = inferExpr(env, expr, { count: 2 });

    expect(print(result)).toEqual("() => Promise<Int>");
  });

  test("awaiting a non-promise value is a no-op", () => {
    // Passing an awaited Promise<Int> to add() verifies that we're
    // unwrapping promises.
    const expr: Expr = sb.lam([], sb.add(sb._await(sb.int(5)), sb.int(10)), true);

    const env: Env = Map();
    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("() => Promise<Int>");
  });

  test("inferring an async function that returns a polymorphic promise", () => {
    const expr: Expr = sb.lam(["x"], sb.app(sb._var("x"), []), true);

    const env: Env = Map();
    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("<a>(() => a) => Promise<a>");
  });

  test("awaiting inside a non-async lambda", () => {
    const expr: Expr = sb.lam([], sb.add(sb._await(sb.int(5)), sb.int(10)));

    const env: Env = Map();
    expect(() => inferExpr(env, expr)).toThrowErrorMatchingInlineSnapshot(
      `"Can't use \`await\` inside non-async lambda"`
    );
  });

  test("awaiting inside a nested non-async lambda", () => {
    const expr: Expr = sb.lam(
      [],
      sb._let(
        "add",
        sb.lam(["a", "b"], sb.add(sb._await(sb._var("a")), sb._var("b"))),
        sb.app(sb._var("add"), [sb.int(5), sb.int(10)])
      ),
      true // Even though the outer lambda is async, the inner one isn't
    );

    const env: Env = Map();
    expect(() => inferExpr(env, expr)).toThrowErrorMatchingInlineSnapshot(
      `"Can't use \`await\` inside non-async lambda"`
    );
  });

  test("awaiting inside a nested async lambda", () => {
    const expr: Expr = sb.lam(
      [],
      sb._let(
        "add",
        sb.lam(["a", "b"], sb.add(sb._await(sb._var("a")), sb._var("b")), true),
        sb.app(sb._var("add"), [sb.int(5), sb.int(10)])
      ),
      false
    );

    const env: Env = Map();
    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("() => Promise<Int>");
  });
});
