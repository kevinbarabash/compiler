import { computeUnion } from "../constraint-solver";
import { Expr } from "../syntax-types";
import { print, scheme } from "../type-types";
import * as sb from "../syntax-builders";
import { Engine } from "../engine";

type Binding = [string, Expr];

describe("Union types and type widening", () => {
  test("call function that returns a union type", () => {
    const eng = new Engine();
    const aVar = eng.tvar("a");
    const bVar = eng.tvar("b");

    // We reuse TVars in multiple places since this is what happense when
    // inferring an expression because we use lookupEnv to get the TVar based
    // on name.
    const retUnion = scheme(
      [aVar, bVar],
      eng.tfun([aVar, bVar], eng.tunion([aVar, bVar]))
    );

    const call: Expr = {
      tag: "App",
      fn: sb._var("retUnion"),
      args: [sb.num(5), sb.bool(true)],
    };

    eng.defScheme("retUnion", retUnion);
    expect(print(retUnion)).toEqual("<a, b>(a, b) => a | b");

    const result1 = eng.inferExpr(call);

    expect(print(result1)).toEqual("5 | true");

    const call2: Expr = {
      tag: "App",
      fn: sb._var("retUnion"),
      args: [sb.bool(false), sb.num(10)],
    };

    const result2 = eng.inferExpr(call2);

    expect(print(result2)).toEqual("false | 10");
  });

  // TODO: figure out a way to normalize union types.
  test.todo("order of types in union doesn't matter");

  test("infer lambda with union return type", () => {
    const eng = new Engine();
    const expr: Expr = sb.lam(
      ["x", "y"],
      sb._if(
        sb._var("x"),
        sb.app(sb._var("y"), [sb.num(5)]),
        sb.app(sb._var("y"), [sb.bool(true)])
      )
    );

    const result = eng.inferExpr(expr);
    expect(print(result)).toMatchInlineSnapshot(
      `"<a>(boolean, (true | 5) => a) => a"`
    );
  });

  test("infer union of function types", () => {
    const eng = new Engine();
    const foo = scheme(
      [],
      eng.tfun([eng.tprim("number")], eng.tprim("boolean"))
    );
    const bar = scheme(
      [],
      eng.tfun([eng.tprim("boolean")], eng.tprim("number"))
    );
    // We purposely don't use eng.defScheme() since that freezes types
    // and widening of types only works on types that aren't frozen.
    eng.ctx.env = eng.ctx.env.set("foo", foo);
    eng.ctx.env = eng.ctx.env.set("bar", bar);

    const expr: Expr = sb.lam(
      ["x"],
      sb._if(sb._var("x"), sb._var("foo"), sb._var("bar"))
    );

    const result = eng.inferExpr(expr);
    expect(print(result)).toMatchInlineSnapshot(
      `"(boolean) => (number | boolean) => boolean | number"`
    );
  });

  test("widen existing union type", () => {
    const eng = new Engine();
    const union = scheme(
      [],
      eng.tunion([eng.tprim("number"), eng.tprim("boolean")])
    );

    // We purposely don't use eng.defScheme() since that freezes types
    // and widening of types only works on types that aren't frozen.
    eng.ctx.env = eng.ctx.env.set("union", union);
    expect(print(union)).toEqual("number | boolean");

    const expr: Expr = sb.lam(
      ["x", "y"],
      sb._if(
        sb._var("x"),
        sb.app(sb._var("y"), [sb._var("union")]), // number | boolean
        sb.app(sb._var("y"), [sb.str("hello")]) // "hello"
      )
    );

    const result = eng.inferExpr(expr);
    // "<a>(boolean, (number | boolean | string) => a) => a"
    expect(print(result)).toMatchInlineSnapshot(
      `"<a>(boolean, (number | boolean | \\"hello\\") => a) => a"`
    );
  });

  test("widen inferred union type", () => {
    const eng = new Engine();
    const expr: Expr = sb.lam(
      ["x"],
      sb._let(
        "a",
        sb.app(sb._var("x"), [sb.num(5)]),
        sb._let(
          "b",
          sb.app(sb._var("x"), [sb.bool(true)]),
          sb._let("c", sb.app(sb._var("x"), [sb.str("hello")]), sb._var("c"))
        )
      )
    );

    const result = eng.inferExpr(expr);

    expect(print(result)).toMatchInlineSnapshot(
      `"<a>((\\"hello\\" | true | 5) => a) => a"`
    );
  });

  test("should not widen frozen types", () => {
    const eng = new Engine();
    const _add: Binding = [
      "add",
      sb.lam(["a", "b"], sb.add(sb._var("a"), sb._var("b"))),
    ];
    const expr: Expr = sb.app(sb._var("add"), [sb.num(5), sb.bool(true)]);

    eng.inferDecl(_add[0], _add[1]);

    // `add` was inferred to have type `(number, number) => number` so
    // we can't pass it a boolean, in this case, `true`
    expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
      `"true is not a subtype of number"`
    );
  });

  describe("computeUnion", () => {
    test("5 | number => number", () => {
      const eng = new Engine();
      const lit = eng.tlit({ tag: "LNum", value: 5 });
      const num = eng.tprim("number");
      const result = computeUnion(lit, num, eng.ctx);

      expect(print(result)).toEqual("number");
    });

    test("5 | 10 => 5 | 10", () => {
      const eng = new Engine();
      const lit5 = eng.tlit({ tag: "LNum", value: 5 });
      const lit10 = eng.tlit({ tag: "LNum", value: 10 });
      const result = computeUnion(lit5, lit10, eng.ctx);

      expect(print(result)).toEqual("5 | 10");
    });

    test("5 | 5 => 5", () => {
      const eng = new Engine();
      const lit5a = eng.tlit({ tag: "LNum", value: 5 });
      const lit5b = eng.tlit({ tag: "LNum", value: 5 });
      const result = computeUnion(lit5a, lit5b, eng.ctx);

      expect(print(result)).toEqual("5");
    });

    test("true | boolean => boolean", () => {
      const eng = new Engine();
      const litTrue = eng.tlit({ tag: "LBool", value: true });
      const bool = eng.tprim("boolean");
      const result = computeUnion(litTrue, bool, eng.ctx);

      expect(print(result)).toEqual("boolean");
    });

    test("true | false => boolean", () => {
      const eng = new Engine();
      const litTrue = eng.tlit({ tag: "LBool", value: true });
      const litFalse = eng.tlit({ tag: "LBool", value: false });
      const result = computeUnion(litTrue, litFalse, eng.ctx);

      expect(print(result)).toEqual("boolean");
    });

    test("true | true => true", () => {
      const eng = new Engine();
      const litTrue = eng.tlit({ tag: "LBool", value: true });
      const litFalse = eng.tlit({ tag: "LBool", value: true });
      const result = computeUnion(litTrue, litFalse, eng.ctx);

      expect(print(result)).toEqual("true");
    });

    test('"hello" | string => string', () => {
      const eng = new Engine();
      const hello = eng.tlit({ tag: "LStr", value: "hello" });
      const str = eng.tprim("string");
      const result = computeUnion(hello, str, eng.ctx);

      expect(print(result)).toEqual("string");
    });

    test('"hello" | "world" => string', () => {
      const eng = new Engine();
      const hello = eng.tlit({ tag: "LStr", value: "hello" });
      const world = eng.tlit({ tag: "LStr", value: "world" });
      const result = computeUnion(hello, world, eng.ctx);

      expect(print(result)).toEqual('"hello" | "world"');
    });

    test("number | number => number", () => {
      const eng = new Engine();
      const numa = eng.tprim("number");
      const numb = eng.tprim("number");
      const result = computeUnion(numa, numb, eng.ctx);

      expect(print(result)).toEqual("number");
    });

    test("string | string => string", () => {
      const eng = new Engine();
      const stra = eng.tprim("string");
      const strb = eng.tprim("string");
      const result = computeUnion(stra, strb, eng.ctx);

      expect(print(result)).toEqual("string");
    });

    test("string | number => string | number", () => {
      const eng = new Engine();
      const str = eng.tprim("string");
      const num = eng.tprim("number");
      const result = computeUnion(str, num, eng.ctx);

      expect(print(result)).toEqual("string | number");
    });

    test("number | string => string | number", () => {
      const eng = new Engine();
      const num = eng.tprim("number");
      const str = eng.tprim("string");
      const result = computeUnion(num, str, eng.ctx);

      expect(print(result)).toEqual("number | string");
    });

    test("(5 | 10) | 15 => 5 | 10 | 15", () => {
      const eng = new Engine();
      const lit5 = eng.tlit({ tag: "LNum", value: 5 });
      const lit10 = eng.tlit({ tag: "LNum", value: 10 });
      const union = computeUnion(lit5, lit10, eng.ctx);
      const lit15 = eng.tlit({ tag: "LNum", value: 15 });
      const result = computeUnion(union, lit15, eng.ctx);

      expect(print(result)).toEqual("5 | 10 | 15");
    });

    test("(5 | 10) | number => number", () => {
      const eng = new Engine();
      const lit5 = eng.tlit({ tag: "LNum", value: 5 });
      const lit10 = eng.tlit({ tag: "LNum", value: 10 });
      const union = computeUnion(lit5, lit10, eng.ctx);
      const result = computeUnion(union, eng.tprim("number"), eng.ctx);

      expect(print(result)).toEqual("number");
    });
  });
});
