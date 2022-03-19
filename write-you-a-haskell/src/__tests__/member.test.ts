import { Map } from "immutable";

import { inferExpr } from "../infer";
import { Expr } from "../syntax-types";
import * as sb from "../syntax-builders";
import * as tb from "../type-builders";
import { Env } from "../context";
import { scheme } from "../type-types";

describe("Member access", () => {
  describe("errors", () => {
    test("access on literal string fails", () => {
      const ctx = tb.createCtx();
      let env: Env = Map();

      const expr: Expr = {
        tag: "Mem",
        // This is just a convenience for now.
        object: sb.str("foo"),
        property: sb._var("bar"),
      };

      expect(() =>
        inferExpr(env, expr, ctx.state)
      ).toThrowErrorMatchingInlineSnapshot(
        `"object must be a variable when accessing a member"`
      );
    });

    test("using a property that isn't a TVar doesn't work", () => {
      const ctx = tb.createCtx();
      let env: Env = Map();
      env = env.set("foo", scheme([], tb.tNum(ctx)));

      const expr: Expr = {
        tag: "Mem",
        // This is just a convenience for now.
        object: sb._var("foo"),
        property: sb.str("hello"),
      };

      expect(() =>
        inferExpr(env, expr, ctx.state)
      ).toThrowErrorMatchingInlineSnapshot(
        `"property must be a variable when accessing a member"`
      );
    });

    test("attempt to access property that doesn't exist on object fails", () => {
      const ctx = tb.createCtx();
      let env: Env = Map();
      env = env.set("foo", scheme([], tb.trec([], ctx)));

      const expr: Expr = sb.mem("foo", "bar");

      expect(() =>
        inferExpr(env, expr, ctx.state)
      ).toThrowErrorMatchingInlineSnapshot(`"Can't use member access on TRec"`);
    });

    test("access property on TCon that hasn't been defined fails", () => {
      const ctx = tb.createCtx();
      let env: Env = Map();
      env = env.set("foo", scheme([], tb.tcon("Foo", [], ctx)));

      const expr: Expr = sb.mem("foo", "bar");

      expect(() =>
        inferExpr(env, expr, ctx.state)
      ).toThrowErrorMatchingInlineSnapshot(
        `"No type named Foo in environment"`
      );
    });

    test("type param count mismatch", () => {
      const ctx = tb.createCtx();
      const tVar = tb.tvar("T", ctx);
      let env: Env = Map();
      env = env.set("Foo", scheme([tVar], tb.tNum(ctx)));
      env = env.set("foo", scheme([], tb.tcon("Foo", [], ctx)));

      const expr: Expr = sb.mem("foo", "bar");

      expect(() =>
        inferExpr(env, expr, ctx.state)
      ).toThrowErrorMatchingInlineSnapshot(
        `"number of type params in foo doesn't match those in Foo"`
      );
    });

    test("alias type is not a TRec", () => {
      const ctx = tb.createCtx();
      let env: Env = Map();
      env = env.set("Foo", scheme([], tb.tNum(ctx)));
      env = env.set("foo", scheme([], tb.tcon("Foo", [], ctx)));

      const expr: Expr = sb.mem("foo", "bar");

      expect(() =>
        inferExpr(env, expr, ctx.state)
      ).toThrowErrorMatchingInlineSnapshot(
        `"Can't use member access on TPrim"`
      );
    });

    test("property doesn't exist on aliased TRec type", () => {
      const ctx = tb.createCtx();
      let env: Env = Map();
      env = env.set("Foo", scheme([], tb.trec([], ctx)));
      env = env.set("foo", scheme([], tb.tcon("Foo", [], ctx)));

      const expr: Expr = sb.mem("foo", "bar");

      expect(() =>
        inferExpr(env, expr, ctx.state)
      ).toThrowErrorMatchingInlineSnapshot(
        `"bar property doesn't exist on {}"`
      );
    });

    test("access on TPrim stored in TVar throws", () => {
      const ctx = tb.createCtx();
      let env: Env = Map();
      env = env.set("foo", scheme([], tb.tNum(ctx)));

      const expr: Expr = sb.mem("foo", "bar");

      expect(() =>
        inferExpr(env, expr, ctx.state)
      ).toThrowErrorMatchingInlineSnapshot(
        `"Can't use member access on TPrim"`
      );
    });
  });

  // TODO: test TMem type once it's been created

  test("should pass", () => {
    expect(true).toBe(true);
  });
});
