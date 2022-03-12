import { Map } from "immutable";

import { inferExpr } from "../infer";
import { Expr } from "../syntax-types";
import { Env, print, scheme } from "../type-types";
import * as sb from "../syntax-builders";
import * as tb from "../type-builders";

describe("destructuring", () => {
  test("let {x} = {x: 5, y: true} in x", () => {
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

  test("let {x, y} = {x: 5, y: 10} in x + y", () => {
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

  test("let {x: a} = {x: 5, y: 10} in a", () => {
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
});
