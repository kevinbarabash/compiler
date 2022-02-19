import { parse } from "../../parser";
import { Expr } from "../../syntax";

import { infer } from "../infer";
import { print } from "../printer";
import * as t from "../types";
import * as build from "../builders";
import * as builtins from "../builtins";
import * as core from "../core";

describe("infer", () => {
  beforeEach(() => {
    let id = 0;
    jest.spyOn(core, "getId").mockImplementation(() => id++);
  });

  test("() => {let f = (x) => x; f(5)}", () => {
    const ast = parse("() => {let f = (x:number) => x; f(5)};");

    if (ast.body[0].tag !== "Decl") {
      const type = infer(ast.body[0]);
      expect(print(type)).toEqual("() => 5");
    }
  });

  // TODO: make param types optional in the parser
  test("(f:number) => {f(5) + 10}", () => {
    const ast = parse("(f:number) => {f(5) + 10};");
    const env = new Map<string, t.Type>();
    const frozenNumber = JSON.parse(JSON.stringify(builtins.tNumber));
    frozenNumber.frozen = true;
    env.set(
      "+",
      build.tFun(
        [
          build.tParam("", frozenNumber),
          build.tParam("", frozenNumber),
        ],
        frozenNumber
      )
    );

    if (ast.body[0].tag !== "Decl") {
      const type = infer(ast.body[0], env);

      // This is a reasonable thing to infer since we don't specify the
      // implementation of f and thus have to infer its type based on usage.
      const varNames = {};
      expect(print(type, varNames, true)).toEqual("(f: (arg0: 5) => number(frozen)) => number(frozen)");
    }
  });

  test("() => {let f = (x) => x; f(5) + 10; f}", () => {
    // We need to allow f to be inferred as `5` => `5` but still allow
    // the output of `f(5)` to be added to 10.
    const ast = parse("() => {let f = (x:foo) => x; f(5) + 10;};");
    const env = new Map<string, t.Type>();
    // For any pre-defined functions (or top-level decls after being defined)
    // we can freeze them.  This will signify two things:
    // - their types can't be widened
    // - they accept subtypes as args
    const frozenNumber = JSON.parse(JSON.stringify(builtins.tNumber));
    frozenNumber.frozen = true;
    env.set(
      "+",
      build.tFun(
        [
          build.tParam("", frozenNumber),
          build.tParam("", frozenNumber),
        ],
        frozenNumber
      )
    );

    if (ast.body[0].tag !== "Decl") {
      const type = infer(ast.body[0], env);

      expect(print(type, {}, true)).toEqual("() => number(frozen)");

      // // @ts-expect-error
      // const fType = infer(ast.body[0].body.value);
      // expect(print(fType, {}, true)).toEqual("() => number(frozen)");
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
