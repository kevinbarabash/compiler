import { Map } from "immutable";

import { inferExpr } from "../infer";
import { Expr } from "../syntax-types";
import * as sb from "../syntax-builders";
import * as tb from "../type-builders";
import { Env, freeze, print, scheme, Scheme } from "../type-types";

describe("record", () => {
  test("can infer a tuple containing different types", () => {
    const expr: Expr = {
      tag: "Rec",
      properties: [
        { tag: "EProp", name: "foo", value: sb.str("hello") },
        { tag: "EProp", name: "bar", value: sb.int(5) },
      ],
    };

    const env: Env = Map();

    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("{foo: Str, bar: Int}");
  });

  test("can infer a function returning a lambda", () => {
    const expr: Expr = sb.lam([], {
      tag: "Rec",
      properties: [
        { tag: "EProp", name: "foo", value: sb.str("hello") },
        { tag: "EProp", name: "bar", value: sb.int(5) },
      ],
    });

    const env: Env = Map();

    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("() => {foo: Str, bar: Int}");
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
      {
        tag: "Rec",
        properties: [
          { tag: "EProp", name: "foo", value: sb.int(5) },
          { tag: "EProp", name: "bar", value: sb.str("hello") },
        ],
      },
    ]);

    const result = inferExpr(env, expr);

    expect(print(getFoo)).toEqual("<a, b>({foo: a, bar: b}) => a");
    expect(print(result)).toEqual("Int");
  });

  // TODO: record subtyping
});
