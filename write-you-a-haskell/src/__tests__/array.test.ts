import { Map } from "immutable";

import { inferExpr } from "../infer";
import { Expr } from "../syntax-types";
import { Env, freeze, print, scheme } from "../type-types";
import * as sb from "../syntax-builders";
import * as tb from "../type-builders";

describe("Array", () => {
  test("parametric definition of object w/ methods", () => {
    const ctx = tb.createCtx();
    const tVar = tb.tvar("T", ctx);
    const uVar = tb.tvar("U", ctx);
    const sc = scheme(
      [tVar],
      tb.trec(
        [
          tb.tprop("length", tb.tprim("number", ctx)),
          tb.tprop(
            "map",
            // TODO: properties need to be able to accept Schemes
            // as well as types.
            tb.tfun(
              [
                tb.tfun(
                  [
                    tVar,
                    tb.tprim("number", ctx),
                    // TODO: how do we handle record types that
                    // reference themselves.
                    tb.tcon("Array", [tVar], ctx),
                  ],
                  uVar,
                  ctx
                ),
              ],
              tb.tcon("Array", [uVar], ctx),
              ctx
            )
          ),
        ],
        ctx
      )
    );

    let env: Env = Map();
    env = env.set("Array", sc);

    expect(print(sc)).toMatchInlineSnapshot(
      `"<T>{length: number, map: ((T, number, Array<T>) => U) => Array<U>}"`
    );

    env = env.set(
      "strArray",
      scheme([], tb.tcon("Array", [tb.tprim("string", ctx)], ctx))
    );

    const expr: Expr = sb._var("strArray");
    const result1 = inferExpr(env, expr);

    expect(print(result1)).toMatchInlineSnapshot(`"Array<string>"`);

    const memExpr: Expr = sb.mem("strArray", "map");
    const result2 = inferExpr(env, memExpr);

    // This is wrong on two accounts:
    // - `a` should the only qualifier in the scheme
    // - `a` should copy its name from the original type/scheme
    // We need a function that converts a type to a scheme.
    expect(print(result2)).toMatchInlineSnapshot(
      `"<a>((string, number, Array<string>) => a) => Array<a>"`
    );

    const appExpr: Expr = sb.app(sb.mem("strArray", "map"), [
      sb.lam(["elem", "index", "array"], sb.num(5)),
    ]);
    const result3 = inferExpr(env, appExpr);

    expect(print(result3)).toMatchInlineSnapshot(`"Array<5>"`);

    const appExpr2: Expr = sb.app(sb.mem("strArray", "map"), [
      sb.lam(["elem", "index", "array"], sb._var("index")),
    ]);
    const result4 = inferExpr(env, appExpr2);

    expect(print(result4)).toMatchInlineSnapshot(`"Array<number>"`);

    const appExpr3: Expr = sb.app(sb.mem("strArray", "map"), [
      sb.lam(["elem", "index", "array"], sb._var("array")),
    ]);
    const result5 = inferExpr(env, appExpr3);

    expect(print(result5)).toMatchInlineSnapshot(`"Array<Array<string>>"`);

    // TODO: turn this into a separate test case so that we can investigate
    // separately.
    const appExpr4: Expr = sb.app(sb.mem("strArray", "map"), [
      sb.lam(["elem", "index", "array"], sb.mem("array", "length")),
    ]);
    const result6 = inferExpr(env, appExpr4);

    expect(print(result6)).toMatchInlineSnapshot(`"<a>a"`);
  });

  test("member access on TVar that doesn't exist in env", () => {
    const ctx = tb.createCtx();
    const tVar = tb.tvar("T", ctx);
    const uVar = tb.tvar("U", ctx);
    const sc = scheme(
      [tVar],
      tb.trec(
        [
          tb.tprop("length", tb.tprim("number", ctx)),
          tb.tprop(
            "map",
            // TODO: properties need to be able to accept Schemes
            // as well as types.
            tb.tfun(
              [
                tb.tfun(
                  [
                    tVar,
                    tb.tprim("number", ctx),
                    // TODO: how do we handle record types that
                    // reference themselves.
                    tb.tcon("Array", [tVar], ctx),
                  ],
                  uVar,
                  ctx
                ),
              ],
              tb.tcon("Array", [uVar], ctx),
              ctx
            )
          ),
        ],
        ctx
      )
    );
    freeze(sc.type);

    let env: Env = Map();
    env = env.set("Array", sc);

    expect(print(sc)).toMatchInlineSnapshot(
      `"<T>{length: number, map: ((T, number, Array<T>) => U) => Array<U>}"`
    );

    env = env.set(
      "strArray",
      scheme([], tb.tcon("Array", [tb.tprim("string", ctx)], ctx))
    );

    const expr: Expr = sb._var("strArray");
    const result1 = inferExpr(env, expr, ctx.state);

    expect(print(result1)).toMatchInlineSnapshot(`"Array<string>"`);

    const appExpr4: Expr = sb.app(sb.mem("strArray", "map"), [
      sb.lam(["elem", "index", "array"], sb.mem("array", "length")),
    ]);
    const result6 = inferExpr(env, appExpr4, ctx.state);

    // We're getting closer, this is still incorrect.  It should be
    // Array<number>.
    // We're either missing (or dropping) a constraint between
    // array and {length: number} at some point.
    expect(print(result6)).toMatchInlineSnapshot(`"Array<number>"`);
  });
});
