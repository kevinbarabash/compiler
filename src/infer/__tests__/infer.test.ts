import { parse } from "../../parser";
import { Expr } from "../../syntax";

import { infer } from "../infer";
import { print } from "../printer";
import * as t from "../types";
import * as build from "../builders";
import * as builtins from "../builtins";
import { printExpr } from "../../printer";

describe("infer", () => {
  test("() => {let f = (x) => x; f(5)}", () => {
    const ast = parse("() => {let f = (x:number) => x; f(5)};");

    if (ast.body[0].tag !== "Decl") {
      const type = infer(ast.body[0]);
      expect(print(type)).toEqual("() => 5");
    }
  });

  // TODO: make param types optional in the parser
  test.skip("(f:number) => {f(5) + 10}", () => {
    const ast = parse("(f:number) => {f(5) + 10};");
    const env = new Map<string, t.Type>();
    env.set(
      "+",
      build.tFun(
        [
          build.tParam("", builtins.tNumber),
          build.tParam("", builtins.tNumber),
        ],
        builtins.tNumber
      )
    );

    if (ast.body[0].tag !== "Decl") {
      console.log(JSON.stringify(ast.body[0]));
      console.log(printExpr(ast.body[0]));
      const type = infer(ast.body[0], env);

      // TODO: f should be inferred as f: (arg0: 5) => 5
      expect(print(type)).toEqual("(f: (arg0: 5) => number) => number");
    }
  });

  test("((x) => x)(5)", () => {
    const ast: Expr = {
      tag: "App",
      func: {
        tag: "Lam",
        params: [{ tag: "Param", name: "x", type: "" }],
        body: { tag: "Var", name: "x" },
      },
      args: [{ tag: "Lit", value: { tag: "LNum", value: 5 } }],
    };

    const type = infer(ast);

    expect(print(type)).toEqual("5"); // the result of ((x) => x)(5)
  });
});
