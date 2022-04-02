import * as sb from "../syntax-builders";
import { scheme, print } from "../type-types";
import { createArrayScheme } from "../builtins";
import { Engine } from "../engine";

describe("Member access", () => {
  describe("errors", () => {
    test("access on literal string fails", () => {
      const eng = new Engine();

      const expr = sb.mem(sb.str("foo"), sb.ident("bar"));

      expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
        `"bar property doesn't exist on string"`
      );
    });

    test("using a property that isn't a TVar doesn't work", () => {
      const eng = new Engine();
      eng.defType("foo", eng.trec([eng.tprop("hello", eng.tNum())]));

      const expr = sb.mem(sb.ident("foo"), sb.str("hello"));

      expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
        `"property must be an identifier when accessing a member on a record"`
      );
    });

    test("attempt to access property that doesn't exist on object fails", () => {
      const eng = new Engine();
      eng.defType("foo", eng.trec([]));

      const expr = sb.mem(sb.ident("foo"), sb.ident("bar"));

      expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
        `"Record literal doesn't contain property 'bar'"`
      );
    });

    test("access property on TCon that hasn't been defined fails", () => {
      const eng = new Engine();
      eng.defType("foo", eng.tgen("Foo", []));

      const expr = sb.mem(sb.ident("foo"), sb.ident("bar"));

      expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
        `"No type named Foo in environment"`
      );
    });

    test("type param count mismatch", () => {
      const eng = new Engine();
      const tVar = eng.tvar("T");
      eng.defScheme("Foo", scheme([tVar], eng.tNum()));
      eng.defType("foo", eng.tgen("Foo", []));

      const expr = sb.mem(sb.ident("foo"), sb.ident("bar"));

      expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
        `"Foo was given the wrong number of type params"`
      );
    });

    test("alias type is not a TRec", () => {
      const eng = new Engine();
      eng.defScheme("Foo", scheme([], eng.tNum()));
      eng.defType("foo", eng.tgen("Foo", []));

      const expr = sb.mem(sb.ident("foo"), sb.ident("bar"));

      expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
        `"bar property doesn't exist on number"`
      );
    });

    test("property doesn't exist on aliased TRec type", () => {
      const eng = new Engine();
      eng.defScheme("Foo", scheme([], eng.trec([])));
      eng.defType("foo", eng.tgen("Foo", []));

      const expr = sb.mem(sb.ident("foo"), sb.ident("bar"));

      expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
        `"Record literal doesn't contain property 'bar'"`
      );
    });

    // TODO: add more type alias tests, e.g. aliased primitives, aliased tuple

    test("access on TPrim stored in TVar throws", () => {
      const eng = new Engine();
      eng.defType("foo", eng.tNum());

      const expr = sb.mem(sb.ident("foo"), sb.ident("bar"));

      expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
        `"bar property doesn't exist on number"`
      );
    });

    test("{foo: 'hello'}['bar'] throws", () => {
      const eng = new Engine();

      const expr = sb.mem(
        sb.rec([sb.prop("foo", sb.str("hello"))]),
        sb.ident("bar")
      );

      expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
        `"Record literal doesn't contain property 'bar'"`
      );
    });
  });

  // TODO: make these type-level operations, we're still operating
  // on value-level things in these tests.  We need to introduce a
  // sb.type.  We should also split ctx.env into ctx.valueEnv and
  // ctx.typeEnv so it's easier to when we're dealing with one vs.
  // the other
  describe("types", () => {
    test("Array['length'] -> number", () => {
      const eng = new Engine();
      eng.defScheme("Array", createArrayScheme(eng.ctx));

      const expr = sb.mem(sb.ident("Array"), sb.ident("length"));
      const result = eng.inferExpr(expr);

      expect(print(result)).toMatchInlineSnapshot(`"number"`);
    });

    test("{foo: 'hello'}['foo'] -> 'hello'", () => {
      const eng = new Engine();

      const expr = sb.mem(
        sb.rec([sb.prop("foo", sb.str("hello"))]),
        sb.ident("foo")
      );

      const result = eng.inferExpr(expr);

      expect(print(result)).toMatchInlineSnapshot(`"\\"hello\\""`);
    });
  });

  it("should work on a record inside an tuple", () => {
    const eng = new Engine();

    const result = eng.inferExpr(
      sb._let(
        "nested",
        sb.tuple([
          sb.rec([sb.prop("x", sb.num(5)), sb.prop("y", sb.num(10))]),

          sb.rec([sb.prop("foo", sb.str("hello")), sb.prop("bar", sb.num(5))]),
        ]),
        sb.mem(sb.mem(sb.ident("nested"), sb.num(1)), sb.ident("foo"))
      )
    );

    expect(print(result)).toEqual('"hello"');
  });

  it("should work on a tuple inside a record", () => {
    const eng = new Engine();

    const result = eng.inferExpr(
      sb._let(
        "nested",
        sb.rec([
          sb.prop("foo", sb.tuple([sb.num(5), sb.num(10)])),
          sb.prop("bar", sb.tuple([sb.str("hello"), sb.str("world")])),
        ]),
        sb.mem(sb.mem(sb.ident("nested"), sb.ident("foo")), sb.num(1))
      )
    );

    expect(print(result)).toEqual("10");
  });

  it("should work on a record inside a record", () => {
    const eng = new Engine();

    const result = eng.inferExpr(
      sb._let(
        "nested",
        sb.rec([
          sb.prop(
            "a",
            sb.rec([sb.prop("x", sb.num(5)), sb.prop("y", sb.num(10))])
          ),
          sb.prop(
            "b",
            sb.rec([sb.prop("foo", sb.str("hello")), sb.prop("bar", sb.num(5))])
          ),
        ]),
        sb.mem(sb.mem(sb.ident("nested"), sb.ident("b")), sb.ident("foo"))
      )
    );

    expect(print(result)).toEqual('"hello"');
  });
});
