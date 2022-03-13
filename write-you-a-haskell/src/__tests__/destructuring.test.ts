import { Map } from "immutable";

import { inferExpr } from "../infer";
import { Expr } from "../syntax-types";
import { Env, print, scheme } from "../type-types";
import * as sb from "../syntax-builders";
import * as tb from "../type-builders";

describe("destructuring", () => {
  test("single property - let {x} = {x: 5, y: true} in x", () => {
    let expr: Expr = {
      tag: "Let",
      pattern: {
        tag: "PRec",
        properties: [
          {
            tag: "PProp",
            name: "x",
            pattern: sb.pvar("x"),
          },
        ],
      },
      value: sb.rec([sb.prop("x", sb.int(5)), sb.prop("y", sb.bool(true))]),
      body: sb._var("x"),
    };

    const env: Env = Map();
    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("Int");
  });

  test("single property from a variable - let {x} = {x: 5, y: true} in x", () => {
    const myRec: Expr = sb.rec([
      sb.prop("x", sb.int(5)),
      sb.prop("y", sb.bool(true)),
    ]);
    let env: Env = Map();

    env = env.set("myRec", inferExpr(env, myRec));

    let expr: Expr = {
      tag: "Let",
      pattern: {
        tag: "PRec",
        properties: [
          {
            tag: "PProp",
            name: "x",
            pattern: sb.pvar("x"),
          },
        ],
      },
      value: sb._var("myRec"),
      body: sb._var("x"),
    };

    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("Int");
  });

  test("multiple properties - let {x, y} = {x: 5, y: 10} in x + y", () => {
    let expr: Expr = {
      tag: "Let",
      pattern: {
        tag: "PRec",
        properties: [
          {
            tag: "PProp",
            name: "x",
            pattern: sb.pvar("x"),
          },
          {
            tag: "PProp",
            name: "y",
            pattern: sb.pvar("y"),
          },
        ],
      },
      value: sb.rec([sb.prop("x", sb.int(5)), sb.prop("y", sb.int(10))]),
      body: sb.add(sb._var("x"), sb._var("y")),
    };

    const env: Env = Map();
    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("Int");
  });

  test("renaming a property - let {x: a} = {x: 5, y: 10} in a", () => {
    let expr: Expr = {
      tag: "Let",
      pattern: {
        tag: "PRec",
        properties: [
          {
            tag: "PProp",
            name: "x",
            pattern: sb.pvar("a"),
          },
        ],
      },
      value: sb.rec([sb.prop("x", sb.int(5)), sb.prop("y", sb.int(10))]),
      body: sb._var("a"),
    };

    const env: Env = Map();
    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("Int");
  });

  test("record with wildcard - let {x: a, y: _} = {x: 5, y: 10} in a", () => {
    let expr: Expr = {
      tag: "Let",
      pattern: {
        tag: "PRec",
        properties: [
          {
            tag: "PProp",
            name: "x",
            pattern: sb.pvar("a"),
          },
          {
            tag: "PProp",
            name: "y",
            pattern: sb.pwild(),
          },
        ],
      },
      value: sb.rec([sb.prop("x", sb.int(5)), sb.prop("y", sb.int(10))]),
      body: sb._var("a"),
    };

    const env: Env = Map();
    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("Int");
  });

  test("nested record - let {p:{x: a}} = {p:{x: 5, y: 10}} in a", () => {
    let expr: Expr = {
      tag: "Let",
      pattern: {
        tag: "PRec",
        properties: [
          {
            tag: "PProp",
            name: "p",
            pattern: {
              tag: "PRec",
              properties: [
                {
                  tag: "PProp",
                  name: "x",
                  pattern: sb.pvar("a"),
                },
              ],
            },
          },
        ],
      },
      value: sb.rec([
        sb.prop(
          "p",
          sb.rec([sb.prop("x", sb.int(5)), sb.prop("y", sb.int(10))])
        ),
      ]),
      body: sb._var("a"),
    };

    const env: Env = Map();
    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("Int");
  });

  test("matching literal - let {x, y: 10} = {x: 5, y: 10} in x + y", () => {
    let expr: Expr = {
      tag: "Let",
      pattern: {
        tag: "PRec",
        properties: [
          {
            tag: "PProp",
            name: "x",
            pattern: sb.pvar("x"),
          },
          {
            tag: "PProp",
            name: "y",
            pattern: sb.plit(sb.int(10)),
          },
        ],
      },
      value: sb.rec([sb.prop("x", sb.int(5)), sb.prop("y", sb.int(10))]),
      body: sb._var("x"),
    };

    const env: Env = Map();
    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("Int");
  });

  test("mismatched literal - let {x, y: true} = {x: 5, y: 10} in x", () => {
    let expr: Expr = {
      tag: "Let",
      pattern: {
        tag: "PRec",
        properties: [
          {
            tag: "PProp",
            name: "x",
            pattern: sb.pvar("x"),
          },
          {
            tag: "PProp",
            name: "y",
            pattern: sb.plit(sb.bool(true)),
          },
        ],
      },
      value: sb.rec([sb.prop("x", sb.int(5)), sb.prop("y", sb.int(10))]),
      body: sb._var("x"),
    };

    const env: Env = Map();
    expect(() => inferExpr(env, expr)).toThrowErrorMatchingInlineSnapshot(
      `"Couldn't unify Bool with Int"`
    );
  });

  test("missing property - let {x, z} = {x: 5, y: 10} in x", () => {
    let expr: Expr = {
      tag: "Let",
      pattern: {
        tag: "PRec",
        properties: [
          {
            tag: "PProp",
            name: "x",
            pattern: sb.pvar("x"),
          },
          {
            tag: "PProp",
            name: "z",
            pattern: sb.pvar("z"),
          },
        ],
      },
      value: sb.rec([sb.prop("x", sb.int(5)), sb.prop("y", sb.int(10))]),
      body: sb._var("x"),
    };

    const env: Env = Map();
    expect(() => inferExpr(env, expr)).toThrowErrorMatchingInlineSnapshot(
      `"{x: Int, y: Int} doesn't contain z property"`
    );
  });

  test("tuple - let [x, y] = [5, true] in x", () => {
    const myTuple: Expr = sb.tuple([sb.int(5), sb.bool(true)]);
    let env: Env = Map();

    env = env.set("myTuple", inferExpr(env, myTuple));

    let expr: Expr = {
      tag: "Let",
      pattern: {
        tag: "PTuple",
        patterns: [
          { tag: "PVar", name: "x" },
          { tag: "PVar", name: "y" },
        ],
      },
      value: sb._var("myTuple"),
      body: sb._var("x"),
    };

    const result = inferExpr(env, expr);

    expect(print(result)).toEqual("Int");
  });

  test("tuple (wrong length) - let [x] = [5, true] in x", () => {
    const myTuple: Expr = sb.tuple([sb.int(5), sb.bool(true)]);
    let env: Env = Map();

    env = env.set("myTuple", inferExpr(env, myTuple));

    let expr: Expr = {
      tag: "Let",
      pattern: {
        tag: "PTuple",
        patterns: [{ tag: "PVar", name: "x" }],
      },
      value: sb._var("myTuple"),
      body: sb._var("x"),
    };

    expect(() => inferExpr(env, expr)).toThrowErrorMatchingInlineSnapshot(
      `"element count mismatch"`
    );
  });

  test("tuple/record - let [x, y] = {x:5, y:true} in x", () => {
    const myRec: Expr = sb.rec([
      sb.prop("x", sb.int(5)),
      sb.prop("y", sb.int(10)),
    ]);
    let env: Env = Map();

    env = env.set("myRec", inferExpr(env, myRec));

    let expr: Expr = {
      tag: "Let",
      pattern: {
        tag: "PTuple",
        patterns: [
          { tag: "PVar", name: "x" },
          { tag: "PVar", name: "y" },
        ],
      },
      value: sb._var("myRec"),
      body: sb._var("x"),
    };

    expect(() => inferExpr(env, expr)).toThrowErrorMatchingInlineSnapshot(
      `"type doesn't match pattern"`
    );
  });

  test("record/tuple - let {x, y} = [5, true] in x", () => {
    const myTuple: Expr = sb.tuple([sb.int(5), sb.bool(true)]);
    let env: Env = Map();

    env = env.set("myTuple", inferExpr(env, myTuple));

    let expr: Expr = {
      tag: "Let",
      pattern: {
        tag: "PRec",
        properties: [
          {
            tag: "PProp",
            name: "x",
            pattern: sb.pvar("x"),
          },
          {
            tag: "PProp",
            name: "y",
            pattern: sb.pvar("y"),
          },
        ],
      },
      value: sb._var("myTuple"),
      body: sb._var("x"),
    };

    expect(() => inferExpr(env, expr)).toThrowErrorMatchingInlineSnapshot(
      `"type doesn't match pattern"`
    );
  });
});
