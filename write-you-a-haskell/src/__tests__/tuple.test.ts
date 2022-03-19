import { Map } from "immutable";

import { inferExpr } from "../infer";
import { Expr } from "../syntax-types";
import * as sb from "../syntax-builders";
import * as tb from "../type-builders";
import { Env } from "../context";
import { freeze, print, scheme, Scheme } from "../type-types";

describe("tuple", () => {
  test("can infer a tuple containing different types", () => {
    const expr: Expr = sb.tuple([sb.num(5), sb.bool(true), sb.str("hello")]);

    const env: Env = Map();

    const result = inferExpr(env, expr);

    expect(print(result)).toEqual(`[5, true, "hello"]`);
  });

  test("can infer a function returning a lambda", () => {
    const expr: Expr = sb.lam(
      [],
      sb.tuple([sb.num(5), sb.bool(true), sb.str("hello")])
    );

    const env: Env = Map();

    const result = inferExpr(env, expr);

    expect(print(result)).toEqual(`() => [5, true, "hello"]`);
  });

  test("snd (function)", () => {
    const ctx = tb.createCtx();
    const aVar = tb.tvar("a", ctx);
    const bVar = tb.tvar("b", ctx);
    const snd: Scheme = scheme(
      [aVar, bVar],
      tb.tfun([tb.ttuple([aVar, bVar], ctx)], bVar, ctx)
    );
    freeze(snd.type);

    let env: Env = Map();
    env = env.set("snd", snd);

    const expr: Expr = sb.app(sb._var("snd"), [
      sb.tuple([sb.num(5), sb.str("hello")]),
    ]);

    const result = inferExpr(env, expr);

    expect(print(snd)).toEqual("<a, b>([a, b]) => b");
    expect(print(result)).toEqual(`"hello"`);
  });

  describe("errors", () => {
    const ctx = tb.createCtx();
    const aVar = tb.tvar("a", ctx);
    const bVar = tb.tvar("b", ctx);
    const snd: Scheme = scheme(
      [aVar, bVar],
      tb.tfun([tb.ttuple([aVar, bVar], ctx)], bVar, ctx)
    );
    freeze(snd.type);

    test("arg tuple has too many elements", () => {
      let env: Env = Map();
      env = env.set("snd", snd);

      const expr: Expr = sb.app(sb._var("snd"), [
        sb.tuple([sb.num(5), sb.str("hello"), sb.bool(true)]),
      ]);

      expect(() => inferExpr(env, expr)).toThrowErrorMatchingInlineSnapshot(`"Couldn't unify [a, b] with [5, \\"hello\\", true]"`);
    });

    test("arg tuple has few many elements", () => {
      let env: Env = Map();
      env = env.set("snd", snd);

      const expr: Expr = sb.app(sb._var("snd"), [sb.tuple([sb.num(5)])]);

      expect(() => inferExpr(env, expr)).toThrowErrorMatchingInlineSnapshot(`"Couldn't unify [a, b] with [5]"`);
    });

    test("element mismatch", () => {
      const ctx = tb.createCtx();
      const foo: Scheme = scheme(
        [],
        tb.tfun(
          [tb.ttuple([tb.tprim("number", ctx), tb.tprim("string", ctx)], ctx)],
          tb.tprim("string", ctx),
          ctx
        )
      );
      freeze(foo.type);

      let env: Env = Map();
      env = env.set("foo", foo);

      const expr: Expr = sb.app(sb._var("foo"), [
        sb.tuple([sb.num(5), sb.bool(true)]),
      ]);

      expect(() => inferExpr(env, expr)).toThrowErrorMatchingInlineSnapshot(
        `"Couldn't unify string with true"`
      );
    });
  });

  // TODO: tuple subtyping
});
