import { Map } from "immutable";

import { inferExpr } from "../infer";
import { Expr } from "../syntax-types";
import { Env } from "../context";
import { print } from "../type-types";
import * as sb from "../syntax-builders";

describe("destructuring", () => {
  test("single property - let {x} = {x: 5, y: true} in x", () => {
    let expr: Expr = {
      tag: "Let",
      pattern: sb.prec([sb.pprop("x")]),
      value: sb.rec([sb.prop("x", sb.num(5)), sb.prop("y", sb.bool(true))]),
      body: sb._var("x"),
    };

    const env: Env = Map();
    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("5");
  });

  test("single property from a variable - let {x} = {x: 5, y: true} in x", () => {
    const myRec: Expr = sb.rec([
      sb.prop("x", sb.num(5)),
      sb.prop("y", sb.bool(true)),
    ]);
    let env: Env = Map();

    env = env.set("myRec", inferExpr(env, myRec));

    let expr: Expr = {
      tag: "Let",
      pattern: sb.prec([sb.pprop("x")]),
      value: sb._var("myRec"),
      body: sb._var("x"),
    };

    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("5");
  });

  test("multiple properties - let {x, y} = {x: 5, y: 10} in x + y", () => {
    let expr: Expr = {
      tag: "Let",
      pattern: sb.prec([sb.pprop("x"), sb.pprop("y")]),
      value: sb.rec([sb.prop("x", sb.num(5)), sb.prop("y", sb.num(10))]),
      body: sb.add(sb._var("x"), sb._var("y")),
    };

    const env: Env = Map();
    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("number");
  });

  test("renaming a property - let {x: a} = {x: 5, y: 10} in a", () => {
    let expr: Expr = {
      tag: "Let",
      pattern: sb.prec([sb.pprop("x", sb.pvar("a"))]),
      value: sb.rec([sb.prop("x", sb.num(5)), sb.prop("y", sb.num(10))]),
      body: sb._var("a"),
    };

    const env: Env = Map();
    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("5");
  });

  test("record with wildcard - let {x: a, y: _} = {x: 5, y: 10} in a", () => {
    let expr: Expr = {
      tag: "Let",
      pattern: sb.prec([
        sb.pprop("x", sb.pvar("a")),
        sb.pprop("y", sb.pwild()),
      ]),
      value: sb.rec([sb.prop("x", sb.num(5)), sb.prop("y", sb.num(10))]),
      body: sb._var("a"),
    };

    const env: Env = Map();
    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("5");
  });

  test("nested record - let {p:{x: a}} = {p:{x: 5, y: 10}} in a", () => {
    let expr: Expr = {
      tag: "Let",
      pattern: sb.prec([sb.pprop("p", sb.prec([sb.pprop("x", sb.pvar("a"))]))]),
      value: sb.rec([
        sb.prop(
          "p",
          sb.rec([sb.prop("x", sb.num(5)), sb.prop("y", sb.num(10))])
        ),
      ]),
      body: sb._var("a"),
    };

    const env: Env = Map();
    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("5");
  });

  test("matching literal - let {x, y: 10} = {x: 5, y: 10} in x + y", () => {
    let expr: Expr = {
      tag: "Let",
      pattern: sb.prec([
        sb.pprop("x"),
        sb.pprop("y", sb.plit(sb.num(10).value)),
      ]),
      value: sb.rec([sb.prop("x", sb.num(5)), sb.prop("y", sb.num(10))]),
      body: sb._var("x"),
    };

    const env: Env = Map();
    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("5");
  });

  test("mismatched literal - let {x, y: true} = {x: 5, y: 10} in x", () => {
    let expr: Expr = {
      tag: "Let",
      pattern: sb.prec([
        sb.pprop("x"),
        sb.pprop("y", sb.plit(sb.bool(true).value)),
      ]),
      value: sb.rec([sb.prop("x", sb.num(5)), sb.prop("y", sb.num(10))]),
      body: sb._var("x"),
    };

    const env: Env = Map();
    // TODO: this should be "Couldn't unify true with 10"
    expect(() => inferExpr(env, expr)).toThrowErrorMatchingInlineSnapshot(
      `"Couldn't unify true with 10"`
    );
  });

  test("missing property - let {x, z} = {x: 5, y: 10} in x", () => {
    let expr: Expr = {
      tag: "Let",
      pattern: sb.prec([sb.pprop("x"), sb.pprop("z")]),
      value: sb.rec([sb.prop("x", sb.num(5)), sb.prop("y", sb.num(10))]),
      body: sb._var("x"),
    };

    const env: Env = Map();
    expect(() => inferExpr(env, expr)).toThrowErrorMatchingInlineSnapshot(
      `"{x: 5, y: 10} doesn't contain z property"`
    );
  });

  test("tuple - let [x, y] = [5, true] in x", () => {
    const myTuple: Expr = sb.tuple([sb.num(5), sb.bool(true)]);
    let env: Env = Map();

    env = env.set("myTuple", inferExpr(env, myTuple));

    let expr: Expr = {
      tag: "Let",
      pattern: sb.ptuple([sb.pvar("x"), sb.pvar("y")]),
      value: sb._var("myTuple"),
      body: sb._var("x"),
    };

    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("5");
  });

  test("tuple (wrong length) - let [x] = [5, true] in x", () => {
    const myTuple: Expr = sb.tuple([sb.num(5), sb.bool(true)]);
    let env: Env = Map();

    env = env.set("myTuple", inferExpr(env, myTuple));

    let expr: Expr = {
      tag: "Let",
      pattern: sb.ptuple([sb.pvar("x")]),
      value: sb._var("myTuple"),
      body: sb._var("x"),
    };

    expect(() => inferExpr(env, expr)).toThrowErrorMatchingInlineSnapshot(
      `"element count mismatch"`
    );
  });

  test("tuple/record - let [x, y] = {x:5, y:true} in x", () => {
    const myRec: Expr = sb.rec([
      sb.prop("x", sb.num(5)),
      sb.prop("y", sb.num(10)),
    ]);
    let env: Env = Map();

    env = env.set("myRec", inferExpr(env, myRec));

    let expr: Expr = {
      tag: "Let",
      pattern: sb.ptuple([sb.pvar("x"), sb.pvar("y")]),
      value: sb._var("myRec"),
      body: sb._var("x"),
    };

    expect(() => inferExpr(env, expr)).toThrowErrorMatchingInlineSnapshot(
      `"type doesn't match pattern"`
    );
  });

  test("record/tuple - let {x, y} = [5, true] in x", () => {
    const myTuple: Expr = sb.tuple([sb.num(5), sb.bool(true)]);
    let env: Env = Map();

    env = env.set("myTuple", inferExpr(env, myTuple));

    let expr: Expr = {
      tag: "Let",
      pattern: sb.prec([sb.pprop("x"), sb.pprop("y")]),
      value: sb._var("myTuple"),
      body: sb._var("x"),
    };

    expect(() => inferExpr(env, expr)).toThrowErrorMatchingInlineSnapshot(
      `"type doesn't match pattern"`
    );
  });

  test("parametrized record", () => {
    const expr: Expr = sb.lam(["x"], {
      tag: "Let",
      pattern: sb.prec([sb.pprop("x", sb.pvar("a"))]),
      value: sb.rec([sb.prop("x", sb._var("x"))]),
      body: sb._var("a"),
    });

    const env: Env = Map();
    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("<a>(a) => a");
  });

  test("parametrized tuple", () => {
    const expr: Expr = sb.lam(["x"], {
      tag: "Let",
      pattern: sb.ptuple([sb.pvar("a")]),
      value: sb.tuple([sb._var("x")]),
      body: sb._var("a"),
    });

    const env: Env = Map();
    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("<a>(a) => a");
  });
});
