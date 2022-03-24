import { Expr } from "../syntax-types";
import * as sb from "../syntax-builders";
import { scheme, print } from "../type-types";
import { createArrayScheme } from "../builtins";
import { Engine } from "../engine";

describe("Member access", () => {
  describe("errors", () => {
    test("access on literal string fails", () => {
      const eng = new Engine();

      const expr: Expr = {
        tag: "Mem",
        // This is just a convenience for now.
        object: sb.str("foo"),
        property: sb._var("bar"),
      };

      expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
        `"object must be a variable when accessing a member"`
      );
    });

    test("using a property that isn't a TVar doesn't work", () => {
      const eng = new Engine();
      eng.defType("foo", eng.trec([eng.tprop("hello", eng.tNum())]));

      const expr: Expr = {
        tag: "Mem",
        // This is just a convenience for now.
        object: sb._var("foo"),
        property: sb.str("hello"),
      };

      expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
        `"property must be a variable when accessing a member on a record"`
      );
    });

    test("attempt to access property that doesn't exist on object fails", () => {
      const eng = new Engine();
      eng.defType("foo", eng.trec([]));

      const expr: Expr = sb.mem("foo", "bar");

      expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
        `"{} doesn't contain property bar"`
      );
    });

    test("access property on TCon that hasn't been defined fails", () => {
      const eng = new Engine();
      eng.defType("foo", eng.tcon("Foo", []));

      const expr: Expr = sb.mem("foo", "bar");

      expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
        `"No type named Foo in environment"`
      );
    });

    test("type param count mismatch", () => {
      const eng = new Engine();
      const tVar = eng.tvar("T");
      eng.defScheme("Foo", scheme([tVar], eng.tNum()));
      eng.defType("foo", eng.tcon("Foo", []));

      const expr: Expr = sb.mem("foo", "bar");

      expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
        `"number of type params in foo doesn't match those in Foo"`
      );
    });

    test("alias type is not a TRec", () => {
      const eng = new Engine();
      eng.defScheme("Foo", scheme([], eng.tNum()));
      eng.defType("foo", eng.tcon("Foo", []));

      const expr: Expr = sb.mem("foo", "bar");

      expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
        `"Can't use member access on TPrim"`
      );
    });

    test("property doesn't exist on aliased TRec type", () => {
      const eng = new Engine();
      eng.defScheme("Foo", scheme([], eng.trec([])));
      eng.defType("foo", eng.tcon("Foo", []));

      const expr: Expr = sb.mem("foo", "bar");

      expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
        `"bar property doesn't exist on {}"`
      );
    });

    test("access on TPrim stored in TVar throws", () => {
      const eng = new Engine();
      eng.defType("foo", eng.tNum());

      const expr: Expr = sb.mem("foo", "bar");

      expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
        `"Can't use member access on TPrim"`
      );
    });

    test("{foo: 'hello'}['bar'] throws", () => {
      const eng = new Engine();

      const expr: Expr = {
        tag: "Mem",
        object: sb.rec([sb.prop("foo", sb.str("hello"))]),
        property: sb._var("bar"),
      };

      expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
        `"Record literal doesn't contain property 'bar'"`
      );
    });
  });

  describe("types", () => {
    test("Array['length'] -> number", () => {
      const eng = new Engine();
      eng.defScheme("Array", createArrayScheme(eng.ctx));

      const expr: Expr = sb.mem("Array", "length");
      const result = eng.inferExpr(expr);

      expect(print(result)).toMatchInlineSnapshot(`"number"`);
    });

    test("{foo: 'hello'}['foo'] -> 'hello'", () => {
      const eng = new Engine();

      const expr: Expr = {
        tag: "Mem",
        object: sb.rec([sb.prop("foo", sb.str("hello"))]),
        property: sb._var("foo"),
      };

      const result = eng.inferExpr(expr);

      expect(print(result)).toMatchInlineSnapshot(`"\\"hello\\""`);
    });
  });
});
