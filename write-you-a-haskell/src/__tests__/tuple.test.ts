import { Expr } from "../syntax-types";
import * as sb from "../syntax-builders";
import { print, scheme, Scheme } from "../type-types";
import { Engine } from "../engine";
import { createArrayScheme } from "../builtins";

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
        `"Couldn't unify [5, \\"hello\\", true] with [e, f]"`
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
        `"Couldn't unify [5] with [e, f]"`
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
          eng.tprim("number")
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
          eng.tprim("number")
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

  describe("member access", () => {
    it("should return the correct type", () => {
      const eng = new Engine();

      const result = eng.inferExpr(
        sb._let("foo", sb.tuple([sb.num(5), sb.num(10)]), sb.mem("foo", 1))
      );

      expect(print(result)).toEqual("10");
    });

    it("should work on a tuple literal", () => {
      const eng = new Engine();

      const result = eng.inferExpr({
        tag: "Mem",
        object: sb.tuple([sb.num(5), sb.num(10)]),
        property: sb.num(1),
      });

      expect(print(result)).toEqual("10");
    });

    it("should work on an array", () => {
      const eng = new Engine();
      eng.defScheme("Array", createArrayScheme(eng.ctx));

      eng.defType("foo", eng.tcon("Array", [eng.tprim("number")]));
      const result = eng.inferExpr(sb.mem("foo", 1));

      // TODO: once we start add type refinements, if a person checks
      // the length of an array is greater or equal to a certain value
      // we should be able to treat it like a tuple when using indices
      // that are less than that value.
      expect(print(result)).toEqual("number | undefined");
    });

    it("should throw if the indexer is not valid", () => {
      const eng = new Engine();

      expect(() =>
        eng.inferExpr(
          sb._let("foo", sb.tuple([sb.num(5), sb.num(10)]), {
            tag: "Mem",
            object: sb._var("foo"),
            property: sb.bool(true),
          })
        )
      ).toThrowErrorMatchingInlineSnapshot(
        `"property must be a number when accessing an index on a tuple"`
      );
    });

    it("should throw if the indexer is not valid on tuple literal", () => {
      const eng = new Engine();

      expect(() =>
        eng.inferExpr({
          tag: "Mem",
          object: sb.tuple([sb.num(5), sb.num(10)]),
          property: sb.bool(true),
        })
      ).toThrowErrorMatchingInlineSnapshot(
        `"property must be a number when accessing an index on a tuple"`
      );
    });

    it("should throw if the indexer out of bounds", () => {
      const eng = new Engine();

      expect(() =>
        eng.inferExpr(
          sb._let("foo", sb.tuple([sb.num(5), sb.num(10)]), sb.mem("foo", 2))
        )
      ).toThrowErrorMatchingInlineSnapshot(
        `"index is greater than the size of the tuple"`
      );
    });

    it("should throw if the indexer out of bounds on a tuple literal", () => {
      const eng = new Engine();

      expect(() =>
        eng.inferExpr({
          tag: "Mem",
          object: sb.tuple([sb.num(5), sb.num(10)]),
          property: sb.num(2),
        })
      ).toThrowErrorMatchingInlineSnapshot(
        `"index is greater than the size of the tuple"`
      );
    });

    it("should work on nested tuples", () => {
      const eng = new Engine();

      const result = eng.inferExpr(
        sb._let(
          "nested",
          sb.tuple([
            sb.tuple([sb.num(5), sb.num(10)]),
            sb.tuple([sb.str("hello"), sb.str("world")]),
          ]),
          {
            tag: "Mem",
            object: {
              tag: "Mem",
              object: sb._var("nested"),
              property: sb.num(1),
            },
            property: sb.num(1),
          }
        )
      );

      expect(print(result)).toEqual('"world"');
    });

    it("should work on nested tuples literal", () => {
      const eng = new Engine();

      const result = eng.inferExpr({
        tag: "Mem",
        object: {
          tag: "Mem",
          object: sb.tuple([
            sb.tuple([sb.num(5), sb.num(10)]),
            sb.tuple([sb.str("hello"), sb.str("world")]),
          ]),
          property: sb.num(1),
        },
        property: sb.num(1),
      });

      expect(print(result)).toEqual('"world"');
    });
  });
});
