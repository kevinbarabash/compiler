import { parse } from "../../parser";
import { Expr } from "../../syntax";

import { infer } from "../infer";
import { print } from "../printer";
import { clone } from "../util";
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
      const annAst = infer(ast.body[0]);
      expect(print(annAst.ann)).toEqual("() => 5");
    }
  });

  // TODO: make param types optional in the parser
  test("(f:ignore) => {f(5) + 10}", () => {
    const ast = parse("(f:ignore) => {f(5) + 10};");
    const env = new Map<string, t.Type>();
    const frozenNumber = JSON.parse(JSON.stringify(builtins.tNumber));
    frozenNumber.frozen = true;
    env.set(
      "+",
      build.tFun(
        [build.tParam("", frozenNumber), build.tParam("", frozenNumber)],
        frozenNumber
      )
    );

    if (ast.body[0].tag !== "Decl") {
      const annAst = infer(ast.body[0], env);
      // The return type of `f` is inferred based on usage
      expect(print(annAst.ann)).toEqual(
        "(f: (arg0: 5) => number(frozen)) => number(frozen)"
      );
    }
  });

  test('(f:ignore) => {let x = f(5) + f(10); "hello"};', () => {
    const ast = parse('(f:ignore) => {let x = f(5) + f(10); "hello"};');
    const env = new Map<string, t.Type>();
    const frozenNumber = JSON.parse(JSON.stringify(builtins.tNumber));
    frozenNumber.frozen = true;
    env.set(
      "+",
      build.tFun(
        [build.tParam("", frozenNumber), build.tParam("", frozenNumber)],
        frozenNumber
      )
    );

    if (ast.body[0].tag !== "Decl") {
      const annAst = infer(ast.body[0], env);
      // The return type of `f` is inferred based on usage
      expect(print(annAst.ann)).toEqual(
        '(f: (arg0: 5 | 10) => number(frozen)) => "hello"'
      );
    }
  });

  test('(f:ignore) => {let x = f(5); let y = f(10); "hello"};', () => {
    const ast = parse('(f:ignore) => {let x = f(5); let y = f(10); "hello"};');
    const env = new Map<string, t.Type>();
    const frozenNumber = JSON.parse(JSON.stringify(builtins.tNumber));
    frozenNumber.frozen = true;
    env.set(
      "+",
      build.tFun(
        [build.tParam("", frozenNumber), build.tParam("", frozenNumber)],
        frozenNumber
      )
    );

    if (ast.body[0].tag !== "Decl") {
      const annAst = infer(ast.body[0], env);
      expect(print(annAst.ann)).toEqual('(f: (arg0: 5 | 10) => a) => "hello"');
    }
  });

  test("widening is flattend, i.e. 5 | number -> number", () => {
    const ast = parse('(f:ignore) => {let x = f(foo); let y = f(10); "hello"};');
    const env = new Map<string, t.Type>();
    const frozenNumber = JSON.parse(JSON.stringify(builtins.tNumber));
    frozenNumber.frozen = true;
    env.set(
      "+",
      build.tFun(
        [build.tParam("", frozenNumber), build.tParam("", frozenNumber)],
        frozenNumber
      )
    );
    env.set("foo", clone(builtins.tNumber));

    if (ast.body[0].tag !== "Decl") {
      const annAst = infer(ast.body[0], env);
      expect(print(annAst.ann)).toEqual('(f: (arg0: number) => a) => "hello"');
    }
  });

  test("widening can create union types with different type constructors", () => {
    const ast = parse('(f:ignore) => {let x = f(foo); let y = f(bar); "hello"};');
    const env = new Map<string, t.Type>();
    const frozenNumber = JSON.parse(JSON.stringify(builtins.tNumber));
    frozenNumber.frozen = true;
    env.set(
      "+",
      build.tFun(
        [build.tParam("", frozenNumber), build.tParam("", frozenNumber)],
        frozenNumber
      )
    );

    // TODO: what if the values are frozen, how do we ensure that the param types
    // are still widened?
    // NOTE: we must clone these types otherwise they any widening is shared across
    // all uses of tNumber and tBoolean.
    // TODO: change these to be factories instead of singletons
    const fooType = clone(builtins.tNumber);
    // fooType.frozen = true;
    const barType = clone(builtins.tBoolean);
    // barType.frozen = true;
    env.set("foo", fooType);
    env.set("bar", barType);

    if (ast.body[0].tag !== "Decl") {
      const annAst = infer(ast.body[0], env);
      expect(print(annAst.ann)).toEqual('(f: (arg0: number | boolean) => a) => "hello"');
    }
  });

  test.skip("widening can create union types with different type constructors (frozen args)", () => {
    const ast = parse('(f:ignore) => {let x = f(foo); let y = f(bar); "hello"};');
    const env = new Map<string, t.Type>();
    const frozenNumber = JSON.parse(JSON.stringify(builtins.tNumber));
    frozenNumber.frozen = true;
    env.set(
      "+",
      build.tFun(
        [build.tParam("", frozenNumber), build.tParam("", frozenNumber)],
        frozenNumber
      )
    );

    // TODO: what if the values are frozen, how do we ensure that the param types
    // are still widened?
    // NOTE: we must clone these types otherwise they any widening is shared across
    // all uses of tNumber and tBoolean.
    // TODO: change these to be factories instead of singletons
    const fooType = clone(builtins.tNumber);
    fooType.frozen = true;
    const barType = clone(builtins.tBoolean);
    barType.frozen = true;
    env.set("foo", fooType);
    env.set("bar", barType);

    if (ast.body[0].tag !== "Decl") {
      const annAst = infer(ast.body[0], env);
      // console.log("annAst = ", JSON.stringify(annAst, null, 2));
      expect(print(annAst.ann)).toEqual('(f: (arg0: number | boolean) => a) => "hello"');
    }
  });

  test("() => {let f = (x) => x; f(5) + 10; f}", () => {
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
        [build.tParam("", frozenNumber), build.tParam("", frozenNumber)],
        frozenNumber
      )
    );

    if (ast.body[0].tag !== "Decl") {
      const annAst = infer(ast.body[0], env);

      expect(print(annAst.ann)).toEqual("() => number(frozen)");

      // @ts-expect-error
      const fType = annAst.body.value.ann;
      expect(print(fType)).toEqual("(x: 5) => 5");
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

    const annAst = infer(ast);

    expect(print(annAst.ann)).toEqual("5"); // the result of ((x) => x)(5)
  });

  test("((x) => x) -> (x: a) => a", () => {
    const ast: Expr = {
      tag: "Lam",
      params: [{ tag: "Param", name: "x", type: "" }],
      body: { tag: "Var", name: "x" },
    };

    const annAst = infer(ast);

    expect(print(annAst.ann)).toEqual("(x: a) => a");
  });

  test("pass a tuple to a function expecting an array", () => {
    const env = new Map<string, t.Type>();
    const frozenNumber = JSON.parse(JSON.stringify(builtins.tNumber));
    frozenNumber.frozen = true;
    const frozenArray = builtins.tArray(frozenNumber);
    frozenArray.frozen = true;
    env.set("length", build.tFun([build.tParam("", frozenArray)], frozenNumber));

    const ast = parse("() => {let tuple = [5, 10]; length(tuple)};");

    if (ast.body[0].tag !== "Decl") {
      const annAst = infer(ast.body[0], env);
      expect(print(annAst.ann)).toEqual("() => number(frozen)");

      // @ts-expect-error
      const tupleType = annAst.body.value.ann;
      expect(print(tupleType)).toEqual("[5, 10]");
    }
  });
});
