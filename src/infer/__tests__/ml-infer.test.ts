// TODO: port the tests from hindly-milner/src/__tests__/infer.test.ts
import { Type } from "../types";
import * as build from "../builders";
import { parse } from "../../parser";
import { print as printProgram } from "../../printer";
import { print} from "../printer";
import { infer } from "../infer";

describe("hindley-milner type inference", () => {
  let my_env: Map<string, Type>;

  beforeEach(() => {
    my_env = new Map();

    const var1 = build.tVar();
    const var2 = build.tVar();
    const pair_type = build.tCon("*", [var1, var2]);

    my_env = new Map();
    // pair is curried
    my_env.set(
      "pair",
      build.tFun(
        [build.tParam("", var1), build.tParam("", var2)],
        pair_type,
      )
    );

    //   // tuple2 is the uncurried equivalent
    //   tuple2: build.tFun([var1, var2], pair_type),
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

  test("pair(f(4), f(true))", () => {
    const ast = parse("pair(f(4), f(true));");

    // TODO: improve the printer so we aren't wrapping the function identifier
    // in parens for each function call.
    expect(printProgram(ast)).toEqual("(pair)((f)(4), (f)(true))");

    if (ast.body[0].tag !== "Decl") {
      expect(() => {
        // @ts-expect-error
        infer(ast.body[0], my_env);
      }).toThrowErrorMatchingInlineSnapshot(`"variable \\"f\\" not defined"`);
    }
  });

  test.skip("(let g = (fn f => 5) in (g g))", () => {
    // we can pass anything as the `f` param since it's ignored
    // the result of g(g) is an int is g always returns 5
    // TODO: update parser so that we can port the test cases
    const ast = parse("(let g = (f:ignore) => {5}; g(g))")
    
    // new Let(
    //   "g",
    //   new Lambda("f", new Literal(new Int(5))),
    //   new Apply(new Identifier("g"), new Identifier("g"))
    // );

    // const t = analyze(ast, my_env);

    // expect(ast.toString()).toEqual("(let g = (fn f => 5) in (g g))");
    // expect(t.toString()).toEqual("5");
  });

  test("(fn g => (let f = (fn x => g) in ((pair (f 3)) (f true))))", () => {
    const ast = parse("(g:ignored) => {let f = (x:ignored) => g; pair(f(3), f(true))};");
    
    expect(printProgram(ast)).toMatchInlineSnapshot(`
"(g:ignored) => {
let f = (x:ignored) => g
(pair)((f)(3), (f)(true))
}"
`)

    if (ast.body[0].tag !== "Decl") {
      const annAst = infer(ast.body[0], my_env);
      expect(print(annAst.ann)).toEqual('(g: a) => *<a, a>');
    }
  });
});
