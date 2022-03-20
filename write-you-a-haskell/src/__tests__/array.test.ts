import { Map } from "immutable";

import { inferExpr } from "../infer";
import { Expr } from "../syntax-types";
import { Env } from "../context";
import { print, scheme } from "../type-types";
import * as sb from "../syntax-builders";
import * as tb from "../type-builders";
import { createArrayScheme } from "../builtins";

describe("Array", () => {
  test("printing the type", () => {
    const ctx = tb.createCtx();
    const sc = createArrayScheme(ctx);

    expect(print(sc)).toMatchInlineSnapshot(
      `"<T>{length: number, map: ((T, number, Array<T>) => U) => Array<U>}"`
    );
  });

  test("strArray = Array<string>", () => {
    const ctx = tb.createCtx();

    let env: Env = Map();
    env = env.set("Array", createArrayScheme(ctx));

    env = env.set(
      "strArray",
      scheme([], tb.tcon("Array", [tb.tprim("string", ctx)], ctx))
    );

    const expr: Expr = sb._var("strArray");
    const result = inferExpr(env, expr, ctx.state);

    expect(print(result)).toMatchInlineSnapshot(`"Array<string>"`);
  });

  test("type of strArray.map", () => {
    const ctx = tb.createCtx();

    let env: Env = Map();
    env = env.set("Array", createArrayScheme(ctx));

    env = env.set(
      "strArray",
      scheme([], tb.tcon("Array", [tb.tprim("string", ctx)], ctx))
    );

    const expr: Expr = sb.mem("strArray", "map");
    const result = inferExpr(env, expr, ctx.state);

    // This is wrong on two accounts:
    // - `a` should the only qualifier in the scheme
    // - `a` should copy its name from the original type/scheme
    // We need a function that converts a type to a scheme.
    expect(print(result)).toMatchInlineSnapshot(
      `"<a>((string, number, Array<string>) => a) => Array<a>"`
    );
  });

  test("strArray.map((elem, index, array) => 5) -> Array<5>", () => {
    const ctx = tb.createCtx();

    let env: Env = Map();
    env = env.set("Array", createArrayScheme(ctx));

    env = env.set(
      "strArray",
      scheme([], tb.tcon("Array", [tb.tprim("string", ctx)], ctx))
    );

    // TODO: allow `(elem) => 5` to be passed as the callback
    const expr: Expr = sb.app(sb.mem("strArray", "map"), [
      sb.lam(["elem", "index", "array"], sb.num(5)),
    ]);
    const result = inferExpr(env, expr, ctx.state);

    expect(print(result)).toMatchInlineSnapshot(`"Array<5>"`);
  });

  test("strArray.map((elem, index, array) => index) -> Array<number>", () => {
    const ctx = tb.createCtx();

    let env: Env = Map();
    env = env.set("Array", createArrayScheme(ctx));

    env = env.set(
      "strArray",
      scheme([], tb.tcon("Array", [tb.tprim("string", ctx)], ctx))
    );

    const expr: Expr = sb.app(sb.mem("strArray", "map"), [
      sb.lam(["elem", "index", "array"], sb._var("index")),
    ]);
    const result = inferExpr(env, expr, ctx.state);

    expect(print(result)).toMatchInlineSnapshot(`"Array<number>"`);
  });

  test("strArray.map((elem, index, array) => array) -> Array<Array<string>>", () => {
    const ctx = tb.createCtx();

    let env: Env = Map();
    env = env.set("Array", createArrayScheme(ctx));

    env = env.set(
      "strArray",
      scheme([], tb.tcon("Array", [tb.tprim("string", ctx)], ctx))
    );

    const expr: Expr = sb.app(sb.mem("strArray", "map"), [
      sb.lam(["elem", "index", "array"], sb._var("array")),
    ]);
    const result = inferExpr(env, expr, ctx.state);

    expect(print(result)).toMatchInlineSnapshot(`"Array<Array<string>>"`);
  });

  test("member access on TVar that doesn't exist in env", () => {
    const ctx = tb.createCtx();

    let env: Env = Map();
    env = env.set("Array", createArrayScheme(ctx));

    env = env.set(
      "strArray",
      scheme([], tb.tcon("Array", [tb.tprim("string", ctx)], ctx))
    );

    const expr: Expr = sb.app(sb.mem("strArray", "map"), [
      sb.lam(["elem", "index", "array"], sb.mem("array", "length")),
    ]);
    const result = inferExpr(env, expr, ctx.state);

    expect(print(result)).toMatchInlineSnapshot(`"Array<number>"`);
  });
});
