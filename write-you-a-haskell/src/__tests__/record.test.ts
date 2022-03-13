import { Map } from "immutable";

import { inferExpr } from "../infer";
import { Expr } from "../syntax-types";
import * as sb from "../syntax-builders";
import * as tb from "../type-builders";
import { Env, freeze, print, scheme, Scheme } from "../type-types";

describe("record", () => {
  test("can infer a tuple containing different types", () => {
    const expr: Expr = sb.rec([
      sb.prop("foo", sb.str("hello")),
      sb.prop("bar", sb.num(5)),
    ]);

    const env: Env = Map();

    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("{foo: Str, bar: Num}");
  });

  test("can infer a function returning a lambda", () => {
    const expr: Expr = sb.lam(
      [],
      sb.rec([sb.prop("foo", sb.str("hello")), sb.prop("bar", sb.num(5))])
    );

    const env: Env = Map();

    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("() => {foo: Str, bar: Num}");
  });

  test("get foo", () => {
    const ctx = tb.createCtx();
    const aVar = tb.tvar("a", ctx);
    const bVar = tb.tvar("b", ctx);
    const getFoo: Scheme = scheme(
      [aVar, bVar],
      tb.tfun(
        [tb.trec([tb.tprop("foo", aVar), tb.tprop("bar", bVar)], ctx)],
        aVar,
        ctx
      )
    );
    freeze(getFoo.type);

    let env: Env = Map();
    env = env.set("getFoo", getFoo);

    const expr: Expr = sb.app(sb._var("getFoo"), [
      sb.rec([sb.prop("foo", sb.num(5)), sb.prop("bar", sb.str("hello"))]),
    ]);

    const result = inferExpr(env, expr);

    expect(print(getFoo)).toEqual("<a, b>({foo: a, bar: b}) => a");
    expect(print(result)).toEqual("Num");
  });

  describe("errors", () => {
    test("extra property", () => {
      const ctx = tb.createCtx();
      const aVar = tb.tvar("a", ctx);
      const bVar = tb.tvar("b", ctx);
      const getFoo: Scheme = scheme(
        [aVar, bVar],
        tb.tfun(
          [tb.trec([tb.tprop("foo", aVar), tb.tprop("bar", bVar)], ctx)],
          aVar,
          ctx
        )
      );
      freeze(getFoo.type);

      let env: Env = Map();
      env = env.set("getFoo", getFoo);

      const expr: Expr = sb.app(sb._var("getFoo"), [
        sb.rec([
          sb.prop("foo", sb.num(5)),
          sb.prop("bar", sb.str("hello")),
          sb.prop("baz", sb.bool(true)),
        ]),
      ]);

      expect(() => inferExpr(env, expr)).toThrowErrorMatchingInlineSnapshot(
        `"{foo: Num, bar: Str, baz: Bool} has following extra keys: baz"`
      );
    });

    test("missing property", () => {
      const ctx = tb.createCtx();
      const aVar = tb.tvar("a", ctx);
      const bVar = tb.tvar("b", ctx);
      const getFoo: Scheme = scheme(
        [aVar, bVar],
        tb.tfun(
          [tb.trec([tb.tprop("foo", aVar), tb.tprop("bar", bVar)], ctx)],
          aVar,
          ctx
        )
      );
      freeze(getFoo.type);

      let env: Env = Map();
      env = env.set("getFoo", getFoo);

      const expr: Expr = sb.app(sb._var("getFoo"), [
        sb.rec([sb.prop("foo", sb.num(5))]),
      ]);

      expect(() => inferExpr(env, expr)).toThrowErrorMatchingInlineSnapshot(
        `"{foo: Num} is missing the following keys: bar"`
      );
    });

    test("property has wrong type", () => {
      const ctx = tb.createCtx();
      const getFoo: Scheme = scheme(
        [],
        tb.tfun(
          [
            tb.trec(
              [
                tb.tprop("foo", tb.tcon("Num", [], ctx)),
                tb.tprop("bar", tb.tcon("Str", [], ctx)),
              ],
              ctx
            ),
          ],
          tb.tcon("Bool", [], ctx),
          ctx
        )
      );
      freeze(getFoo.type);

      let env: Env = Map();
      env = env.set("getFoo", getFoo);

      const expr: Expr = sb.app(sb._var("getFoo"), [
        sb.rec([sb.prop("foo", sb.num(5)), sb.prop("bar", sb.bool(true))]),
      ]);

      expect(() => inferExpr(env, expr)).toThrowErrorMatchingInlineSnapshot(
        `"Couldn't unify Str with Bool"`
      );
    });
  });

  // TODO: record subtyping
});
