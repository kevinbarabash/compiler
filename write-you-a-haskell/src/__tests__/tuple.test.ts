import { Expr } from "../syntax-types";
import * as sb from "../syntax-builders";
import { print, scheme, Scheme } from "../type-types";
import { Engine } from "../engine";

describe("tuple", () => {
  test("can infer a tuple containing different types", () => {
    const eng = new Engine();
    const expr: Expr = sb.tuple([sb.num(5), sb.bool(true), sb.str("hello")]);

    const result = eng.inferExpr(expr);

    expect(print(result)).toEqual(`[5, true, "hello"]`);
  });

  test("can infer a function returning a lambda", () => {
    const eng = new Engine();
    const expr: Expr = sb.lam(
      [],
      sb.tuple([sb.num(5), sb.bool(true), sb.str("hello")])
    );

    const result = eng.inferExpr(expr);

    expect(print(result)).toEqual(`() => [5, true, "hello"]`);
  });

  test("snd (function)", () => {
    const eng = new Engine();
    const aVar = eng.tvar("a");
    const bVar = eng.tvar("b");
    const snd: Scheme = scheme(
      [aVar, bVar],
      eng.tfun([eng.ttuple([aVar, bVar])], bVar)
    );
    eng.defScheme("snd", snd);

    const expr: Expr = sb.app(sb._var("snd"), [
      sb.tuple([sb.num(5), sb.str("hello")]),
    ]);
    const result = eng.inferExpr(expr);

    expect(print(snd)).toEqual("<a, b>([a, b]) => b");
    expect(print(result)).toEqual(`"hello"`);
  });

  describe("errors", () => {
    test("arg tuple has too many elements", () => {
      const eng = new Engine();
      const aVar = eng.tvar("a");
      const bVar = eng.tvar("b");
      const snd: Scheme = scheme(
        [aVar, bVar],
        eng.tfun([eng.ttuple([aVar, bVar])], bVar)
      );
      eng.defScheme("snd", snd);

      const expr: Expr = sb.app(sb._var("snd"), [
        sb.tuple([sb.num(5), sb.str("hello"), sb.bool(true)]),
      ]);

      // TODO: fix message to use [a, b] instead of [e, f];
      expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
        `"Couldn't unify [e, f] with [5, \\"hello\\", true]"`
      );
    });

    test("arg tuple has few many elements", () => {
      const eng = new Engine();
      const aVar = eng.tvar("a");
      const bVar = eng.tvar("b");
      const snd: Scheme = scheme(
        [aVar, bVar],
        eng.tfun([eng.ttuple([aVar, bVar])], bVar)
      );
      eng.defScheme("snd", snd);

      const expr: Expr = sb.app(sb._var("snd"), [sb.tuple([sb.num(5)])]);

      // TODO: fix message to use [a, b] instead of [e, f];
      expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
        `"Couldn't unify [e, f] with [5]"`
      );
    });

    test("element mismatch", () => {
      const eng = new Engine();
      const foo: Scheme = scheme(
        [],
        eng.tfun(
          [eng.ttuple([eng.tprim("number"), eng.tprim("string")])],
          eng.tprim("string")
        )
      );

      eng.defScheme("foo", foo);

      const expr: Expr = sb.app(sb._var("foo"), [
        sb.tuple([sb.num(5), sb.bool(true)]),
      ]);

      expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
        `"true is not a subtype of string"`
      );
    });
  });

  describe("subtyping", () => {
    test("[5, 5] is a subtype of Array<5>", () => {
      const eng = new Engine();
      eng.defType(
        "foo",
        eng.tfun(
          [eng.tcon("Array", [eng.tlit({ tag: "LNum", value: 5 })])],
          eng.tprim("number"),
          "Lam"
        )
      );

      expect(() =>
        eng.inferExpr(
          sb.app(sb._var("foo"), [sb.tuple([sb.num(5), sb.num(5)])])
        )
      ).not.toThrow();
    });

    test("[1, 2, 3] is a subtype of Array<number>", () => {
      const eng = new Engine();
      eng.defType(
        "foo",
        eng.tfun(
          [eng.tcon("Array", [eng.tprim("number")])],
          eng.tprim("number")
        )
      );

      expect(() =>
        eng.inferExpr(
          sb.app(sb._var("foo"), [sb.tuple([sb.num(1), sb.num(2), sb.num(3)])])
        )
      ).not.toThrow();
    });

    test("Array<number> is not a subtype of [5, 10]", () => {
      const eng = new Engine();
      eng.defType(
        "foo",
        eng.tfun(
          [
            eng.ttuple([
              eng.tlit({ tag: "LNum", value: 5 }),
              eng.tlit({ tag: "LNum", value: 10 }),
            ]),
          ],
          eng.tprim("number"),
          "Lam"
        )
      );
      eng.defType("numArray", eng.tcon("Array", [eng.tprim("number")]));

      expect(() =>
        eng.inferExpr(sb.app(sb._var("foo"), [sb._var("numArray")]))
      ).toThrowErrorMatchingInlineSnapshot(
        `"Array<number> is not a subtype of [5, 10]"`
      );
    });
  });
});
