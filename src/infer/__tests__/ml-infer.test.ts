// TODO: port the tests from hindly-milner/src/__tests__/infer.test.ts
import { Type } from "../types";
import * as build from "../builders";
import * as builtins from "../builtins";
import { parse } from "../../parser";
import { print as printProgram } from "../../printer";
import { print } from "../printer";
import { infer } from "../infer";

// TODO: finish porting these tests
describe("hindley-milner type inference", () => {
  let my_env: Map<string, Type>;

  beforeEach(() => {
    my_env = new Map();

    const var1 = build.tVar();
    const var2 = build.tVar();
    const pair_type = build.tCon("*", [var1, var2]);

    my_env = new Map();
    my_env.set(
      "tuple",
      build.tFun([build.tParam("", var1), build.tParam("", var2)], pair_type)
    );

    my_env.set(
      "cond",
      build.tFun(
        [
          build.tParam("", builtins.tBoolean()),
          build.tParam("", var1),
          build.tParam("", var1),
        ],
        var1
      )
    );
    //   cond: build.tFun(
    //     [TBool],
    //     build.tFun([var1], build.tFun([var1], var1))
    //   ),
    //   zero: build.tFun([TInteger], TBool),
    //   pred: build.tFun([TInteger], TInteger),
    //   times: build.tFun([TInteger], build.tFun([TInteger], TInteger)),
    //   // TODO: figure out how to implement constrained generics, e.g.
    //   // const foo: <T: number | string>(T, T) => T
    //   add: build.tFun([TInteger, TInteger], TInteger),
    //   // returns an empty array
    //   empty: build.tFun([], new TCon("[]", [TAny])),
    // });
  });

  test("fn x => (tuple(x(3) (x(true))) should infer x: (3 | true) => a", () => {
    const ast = parse("let f = (x:ignore) => tuple(x(3), x(true));");

    expect(printProgram(ast)).toMatchInlineSnapshot(
      `"let f = (x:ignore) => (tuple)((x)(3), (x)(true))"`
    );

    if (ast.body[0].tag === "Decl") {
      const annAst = infer(ast.body[0].value, my_env);
      expect(print(annAst.ann)).toMatchInlineSnapshot(
        `"(x: (arg0: 3 | true) => a) => *<a, a>"`
      );
    }
  });

  test("tuple(f(4), f(true))", () => {
    const ast = parse("tuple(f(4), f(true));");

    // TODO: improve the printer so we aren't wrapping the function identifier
    // in parens for each function call.
    expect(printProgram(ast)).toEqual("(tuple)((f)(4), (f)(true))");

    if (ast.body[0].tag !== "Decl") {
      expect(() => {
        // @ts-expect-error
        infer(ast.body[0], my_env);
      }).toThrowErrorMatchingInlineSnapshot(`"variable \\"f\\" not defined"`);
    }
  });

  test("tuple(4, true)", () => {
    const ast = parse("tuple(4, true);");

    // TODO: improve the printer so we aren't wrapping the function identifier
    // in parens for each function call.
    expect(printProgram(ast)).toEqual("(tuple)(4, true)");

    if (ast.body[0].tag !== "Decl") {
      const annAst = infer(ast.body[0], my_env);
      expect(print(annAst.ann)).toEqual("*<4, true>");
    }
  });

  test("let f = (fn x => x) in ((pair (f 4)) (f true))", () => {
    const ast = parse("() => {let f = (x:ignore) => x;tuple(f(4), f(true))};");

    expect(printProgram(ast)).toMatchInlineSnapshot(`
"() => {
let f = (x:ignore) => x
(tuple)((f)(4), (f)(true))
}"
`);

    if (ast.body[0].tag !== "Decl") {
      const annAst = infer(ast.body[0], my_env);
      // TODO: avoid widening types when calling polymorphic functions,
      // e.g. f = (x) => x.
      // Basically, whenever we apply a function that is polymorphic, we
      // want to create new instances for the polymorphic type args.
      // In this case 'x' would be given a new type variable.  Of course
      // the type can be more complicated.  We basically need to port over
      // the `nonGeneric` adn `fresh()` part from hindley-milner/src/infer.ts
      expect(print(annAst.ann)).toEqual("() => *<4 | true, 4 | true>");
    }
  });


  test("(fn f => (f f))", () => {
    // The implementation in hindley-milner/src/ can't handle this.  It throws
    // a "recursive unification" exception, but our implementation seems to
    // handle this just fine.
    // TODO: dig into this more since the inferred type doesn't seem quite right
    const ast = parse("(f:ignore) => f(f);");

    expect(printProgram(ast)).toMatchInlineSnapshot(`"(f:ignore) => (f)(f)"`);

    if (ast.body[0].tag !== "Decl") {
      const annAst = infer(ast.body[0], my_env);
      expect(print(annAst.ann)).toMatchInlineSnapshot(
        `"(f: (arg0: a) => b) => b"`
      );
    }
  });

  test("(let g = (fn f => 5) in (g g))", () => {
    // we can pass anything as the `f` param since it's ignored
    // the result of g(g) is an int is g always returns 5
    // TODO: update parser so that we can port the test cases
    const ast = parse("() => {let g = (f:ignore) => 5;g(g)};");

    expect(printProgram(ast)).toMatchInlineSnapshot(`
"() => {
let g = (f:ignore) => 5
(g)(g)
}"
`);

    if (ast.body[0].tag !== "Decl") {
      const annAst = infer(ast.body[0], my_env);
      expect(print(annAst.ann)).toEqual("() => 5");
    }
  });

  test("(fn g => (let f = (fn x => g) in ((pair (f 3)) (f true))))", () => {
    const ast = parse(
      "(g:ignore) => {let f = (x:ignore) => g;tuple(f(3), f(true))};"
    );

    expect(printProgram(ast)).toMatchInlineSnapshot(`
"(g:ignore) => {
let f = (x:ignore) => g
(tuple)((f)(3), (f)(true))
}"
`);

    if (ast.body[0].tag !== "Decl") {
      const annAst = infer(ast.body[0], my_env);

      expect(print(annAst.ann)).toEqual(
        // (a -> (a * a))
        "(g: a) => *<a, a>",
      );
    }
  });

  test("(fn f => (fn g => (fn arg => (g (f arg)))))", () => {
    const ast = parse("(f:ignore) => (g:ignore) => (arg:ignore) => g(f(arg));");

    expect(printProgram(ast)).toMatchInlineSnapshot(
      `"(f:ignore) => (g:ignore) => (arg:ignore) => (g)((f)(arg))"`
    );

    if (ast.body[0].tag !== "Decl") {
      const annAst = infer(ast.body[0], my_env);
      expect(print(annAst.ann)).toMatchInlineSnapshot(
        // ((a -> b) -> ((b -> c) -> (a -> c)))
        `"(f: (arg0: a) => b) => ((g: (arg0: b) => c) => ((arg: a) => c))"`
      );
    }
  });

  test("(fn x => x)", () => {
    const ast = parse("let f = (x:ignored) => x;");

    if (ast.body[0].tag === "Decl") {
      const t = infer(ast.body[0].value, my_env);

      expect(printProgram(ast)).toEqual("let f = (x:ignored) => x");
      expect(print(t.ann)).toEqual("(x: a) => a");
    }
  });

  test("analyze() doesn't reuse type variables across calls", () => {
    const ast1 = parse("let f = (x:ignored) => x;");
    const ast2 = parse("let f = (x:ignored) => x;");

    if (ast1.body[0].tag === "Decl" && ast2.body[0].tag === "Decl") {
      const t1 = infer(ast1.body[0].value, my_env);
      const t2 = infer(ast1.body[0].value, my_env);

      const varNames = {};

      expect(printProgram(ast1)).toEqual("let f = (x:ignored) => x");
      expect(print(t1.ann, varNames)).toEqual("(x: a) => a");

      expect(printProgram(ast2)).toEqual("let f = (x:ignored) => x");
      expect(print(t2.ann, varNames)).toEqual("(x: b) => b");
    }
  });
});
