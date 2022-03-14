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

    expect(print(result)).toEqual(`{foo: "hello", bar: 5}`);
  });

  test("can infer a function returning a lambda", () => {
    const expr: Expr = sb.lam(
      [],
      sb.rec([sb.prop("foo", sb.str("hello")), sb.prop("bar", sb.num(5))])
    );

    const env: Env = Map();

    const result = inferExpr(env, expr);

    expect(print(result)).toEqual(`() => {foo: "hello", bar: 5}`);
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
    expect(print(result)).toEqual("5");
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
        `"{foo: 5, bar: \\"hello\\", baz: true} has following extra keys: baz"`
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
        `"{foo: 5} is missing the following keys: bar"`
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
                tb.tprop("foo", tb.tprim("number", ctx)),
                tb.tprop("bar", tb.tprim("string", ctx)),
              ],
              ctx
            ),
          ],
          tb.tprim("boolean", ctx),
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
        `"Couldn't unify string with true"`
      );
    });
  });

  // TODO: record subtyping
});
