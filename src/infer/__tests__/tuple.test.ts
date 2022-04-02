import * as sb from "../syntax-builders";
import { print, scheme, Scheme } from "../type-types";
import { Engine } from "../engine";

describe("tuple", () => {
  test("can infer a tuple containing different types", () => {
    const eng = new Engine();
    const expr = sb.tuple([sb.num(5), sb.bool(true), sb.str("hello")]);

    const result = eng.inferExpr(expr);

    expect(print(result)).toEqual(`[5, true, "hello"]`);
  });

  test("can infer a function returning a lambda", () => {
    const eng = new Engine();
    const expr = sb.lam(
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

    const expr = sb.app(sb.ident("snd"), [
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

      const expr = sb.app(sb.ident("snd"), [
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

      const expr = sb.app(sb.ident("snd"), [sb.tuple([sb.num(5)])]);

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

      const expr = sb.app(sb.ident("foo"), [
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
          [eng.tgen("Array", [eng.tlit({ __type: "LNum", value: 5 })])],
          eng.tprim("number")
        )
      );

      expect(() =>
        eng.inferExpr(
          sb.app(sb.ident("foo"), [sb.tuple([sb.num(5), sb.num(5)])])
        )
      ).not.toThrow();
    });

    test("[1, 2, 3] is a subtype of Array<number>", () => {
      const eng = new Engine();
      eng.defType(
        "foo",
        eng.tfun(
          [eng.tgen("Array", [eng.tprim("number")])],
          eng.tprim("number")
        )
      );

      expect(() =>
        eng.inferExpr(
          sb.app(sb.ident("foo"), [sb.tuple([sb.num(1), sb.num(2), sb.num(3)])])
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
              eng.tlit({ __type: "LNum", value: 5 }),
              eng.tlit({ __type: "LNum", value: 10 }),
            ]),
          ],
          eng.tprim("number")
        )
      );
      eng.defType("numArray", eng.tgen("Array", [eng.tprim("number")]));

      expect(() =>
        eng.inferExpr(sb.app(sb.ident("foo"), [sb.ident("numArray")]))
      ).toThrowErrorMatchingInlineSnapshot(
        `"Array<number> is not a subtype of [5, 10]"`
      );
    });
  });

  describe("member access", () => {
    it("should return the correct type", () => {
      const eng = new Engine();

      const result = eng.inferExpr(
        sb._let(
          "foo",
          sb.tuple([sb.num(5), sb.num(10)]),
          sb.mem(sb.ident("foo"), sb.num(1))
        )
      );

      expect(print(result)).toEqual("10");
    });

    it("should work on a tuple literal", () => {
      const eng = new Engine();

      const result = eng.inferExpr(
        sb.mem(sb.tuple([sb.num(5), sb.num(10)]), sb.num(1))
      );

      expect(print(result)).toEqual("10");
    });

    it("should work on an array", () => {
      const eng = new Engine();

      eng.defType("foo", eng.tgen("Array", [eng.tprim("number")]));
      const result = eng.inferExpr(sb.mem(sb.ident("foo"), sb.num(1)));

      // TODO: once we start add type refinements, if a person checks
      // the length of an array is greater or equal to a certain value
      // we should be able to treat it like a tuple when using indices
      // that are less than that value.
      expect(print(result)).toEqual("number | undefined");
    });

    it("should work if the member is an Array member", () => {
      const eng = new Engine();

      const result = eng.inferExpr(
        sb._let(
          "foo",
          sb.tuple([sb.num(5), sb.num(10)]),
          sb.mem(sb.ident("foo"), sb.ident("length"))
        )
      );

      expect(print(result)).toEqual("number");
    });

    it("should work if the member is an Array member (generic)", () => {
      const eng = new Engine();

      const result = eng.inferExpr(
        sb._let(
          "foo",
          sb.tuple([sb.num(5), sb.num(10)]),
          sb.mem(sb.ident("foo"), sb.ident("map"))
        )
      );

      expect(print(result)).toMatchInlineSnapshot(
        `"<a>((5 | 10, number, Array<5 | 10>) => a) => Array<a>"`
      );
    });

    it("should work if the member is an Array member (generic & primitive)", () => {
      const eng = new Engine();
      eng.defType("a", eng.tprim("string"));
      eng.defType("b", eng.tprim("string"));

      const result = eng.inferExpr(
        sb._let(
          "foo",
          sb.tuple([sb.ident("a"), sb.ident("b")]),
          sb.mem(sb.ident("foo"), sb.ident("map"))
        )
      );

      // TODO: this should be:
      // <a>((string, number, Array<string>) => a) => Array<a>
      expect(print(result)).toMatchInlineSnapshot(
        `"<a>((string, number, Array<string>) => a) => Array<a>"`
      );
    });

    it("should throw if the member isn't an Array member", () => {
      const eng = new Engine();

      expect(() =>
        eng.inferExpr(
          sb._let(
            "foo",
            sb.tuple([sb.num(5), sb.num(10)]),
            sb.mem(sb.ident("foo"), sb.ident("bar"))
          )
        )
      ).toThrowErrorMatchingInlineSnapshot(`"Couldn't find bar on array"`);
    });

    it("should throw if the indexer is not valid", () => {
      const eng = new Engine();

      expect(() =>
        eng.inferExpr(
          sb._let(
            "foo",
            sb.tuple([sb.num(5), sb.num(10)]),
            sb.mem(
              sb.ident("foo"),
              // @ts-expect-error: `true` is not a valid indexer
              sb.bool(true)
            )
          )
        )
      ).toThrowErrorMatchingInlineSnapshot(
        `"property must be a number when accessing an index on a tuple"`
      );
    });

    it("should throw if the indexer is not valid on tuple literal", () => {
      const eng = new Engine();

      expect(() =>
        eng.inferExpr(
          sb.mem(
            sb.tuple([sb.num(5), sb.num(10)]),
            // @ts-expect-error: `true` is not a valid indexer
            sb.bool(true)
          )
        )
      ).toThrowErrorMatchingInlineSnapshot(
        `"property must be a number when accessing an index on a tuple"`
      );
    });

    it("should throw if the indexer out of bounds", () => {
      const eng = new Engine();

      expect(() =>
        eng.inferExpr(
          sb._let(
            "foo",
            sb.tuple([sb.num(5), sb.num(10)]),
            sb.mem(sb.ident("foo"), sb.num(2))
          )
        )
      ).toThrowErrorMatchingInlineSnapshot(
        `"index is greater than the size of the tuple"`
      );
    });

    it("should throw if the indexer out of bounds on a tuple literal", () => {
      const eng = new Engine();

      expect(() =>
        eng.inferExpr(sb.mem(sb.tuple([sb.num(5), sb.num(10)]), sb.num(2)))
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
          sb.mem(sb.mem(sb.ident("nested"), sb.num(1)), sb.num(1))
        )
      );

      expect(print(result)).toEqual('"world"');
    });

    it("should work on nested tuples literal", () => {
      const eng = new Engine();

      const result = eng.inferExpr(
        sb.mem(
          sb.mem(
            sb.tuple([
              sb.tuple([sb.num(5), sb.num(10)]),
              sb.tuple([sb.str("hello"), sb.str("world")]),
            ]),
            sb.num(1)
          ),
          sb.num(1)
        )
      );

      /*
        how do we go from: [[5, 10], ["hello", "world"]][1][1]

        to this: tmem(tmem([[5, 10], ["hello", "world"]], 1), 1)
        ???

        evaluating the inner tmem gives:
        tmem([[5, 10], ["hello", "world"]], 1) -> ["hello", "world"]
        resulting in the outer tmem looking like:
        tmem(["hello", "world"], 1)
        evaluating that gives:
        ["world"]
      */

      expect(print(result)).toEqual('"world"');
    });
  });
});
