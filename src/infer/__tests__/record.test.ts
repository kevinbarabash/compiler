import * as sb from "../syntax-builders";
import { print, scheme, Scheme } from "../type-types";
import { Engine } from "../engine";

describe("record", () => {
  test("can infer a tuple containing different types", () => {
    const eng = new Engine();
    const expr = sb.rec([
      sb.prop("foo", sb.str("hello")),
      sb.prop("bar", sb.num(5)),
    ]);

    const result = eng.inferExpr(expr);

    expect(print(result)).toEqual(`{foo: "hello", bar: 5}`);
  });

  test("can infer a function returning a lambda", () => {
    const eng = new Engine();
    const expr = sb.lam(
      [],
      sb.rec([sb.prop("foo", sb.str("hello")), sb.prop("bar", sb.num(5))])
    );

    const result = eng.inferExpr(expr);

    expect(print(result)).toEqual(`() => {foo: "hello", bar: 5}`);
  });

  test("get foo", () => {
    const eng = new Engine();
    const aVar = eng.tvar("a");
    const bVar = eng.tvar("b");
    const getFoo: Scheme = scheme(
      [aVar, bVar],
      eng.tfun(
        [eng.trec([eng.tprop("foo", aVar), eng.tprop("bar", bVar)])],
        aVar
      )
    );

    eng.defScheme("getFoo", getFoo);

    const expr = sb.app(sb.ident("getFoo"), [
      sb.rec([sb.prop("foo", sb.num(5)), sb.prop("bar", sb.str("hello"))]),
    ]);
    const result = eng.inferExpr(expr);

    expect(print(getFoo)).toEqual("<a, b>({foo: a, bar: b}) => a");
    expect(print(result)).toEqual("5");
  });

  test("simple member access", () => {
    const eng = new Engine();

    const expr = eng.inferExpr(
      sb._let(
        "obj",
        sb.rec([sb.prop("foo", sb.str("hello")), sb.prop("bar", sb.num(5))]),
        sb.mem(sb.ident("obj"), sb.ident("bar"))
      )
    );

    expect(print(expr)).toEqual("5");
  });

  test("simple member access on a literal", () => {
    const eng = new Engine();

    const expr = eng.inferExpr(
      sb.mem(
        sb.rec([sb.prop("foo", sb.str("hello")), sb.prop("bar", sb.num(5))]),
        sb.ident("bar")
      )
    );

    expect(print(expr)).toEqual("5");
  });

  test("nested member access", () => {
    const eng = new Engine();

    const expr = eng.inferExpr(
      sb._let(
        "obj",
        sb.rec([
          sb.prop("foo", sb.str("hello")),
          sb.prop(
            "bar",
            sb.rec([sb.prop("x", sb.num(5)), sb.prop("y", sb.num(10))])
          ),
        ]),
        sb.mem(sb.mem(sb.ident("obj"), sb.ident("bar")), sb.ident("y"))
      )
    );

    expect(print(expr)).toEqual("10");
  });

  test("nested member access on a literal", () => {
    const eng = new Engine();

    const expr = eng.inferExpr(
      sb.mem(
        sb.mem(
          sb.rec([
            sb.prop("foo", sb.str("hello")),
            sb.prop(
              "bar",
              sb.rec([sb.prop("x", sb.num(5)), sb.prop("y", sb.num(10))])
            ),
          ]),
          sb.ident("bar")
        ),
        sb.ident("y")
      )
    );

    expect(print(expr)).toEqual("10");
  });

  describe("errors", () => {
    test("extra property", () => {
      const eng = new Engine();
      const aVar = eng.tvar("a");
      const bVar = eng.tvar("b");
      const getFoo: Scheme = scheme(
        [aVar, bVar],
        eng.tfun(
          [eng.trec([eng.tprop("foo", aVar), eng.tprop("bar", bVar)])],
          aVar
        )
      );

      eng.defScheme("getFoo", getFoo);
      const expr = sb.app(sb.ident("getFoo"), [
        sb.rec([
          sb.prop("foo", sb.num(5)),
          sb.prop("bar", sb.str("hello")),
          sb.prop("baz", sb.bool(true)),
        ]),
      ]);

      expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
        `"{foo: 5, bar: \\"hello\\", baz: true} has following extra keys: baz"`
      );
    });

    test("missing property", () => {
      const eng = new Engine();
      const aVar = eng.tvar("a");
      const bVar = eng.tvar("b");
      const getFoo: Scheme = scheme(
        [aVar, bVar],
        eng.tfun(
          [eng.trec([eng.tprop("foo", aVar), eng.tprop("bar", bVar)])],
          aVar
        )
      );

      eng.defScheme("getFoo", getFoo);
      const expr = sb.app(sb.ident("getFoo"), [
        sb.rec([sb.prop("foo", sb.num(5))]),
      ]);

      expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
        `"{foo: 5} is missing the following keys: bar"`
      );
    });

    test("property has wrong type", () => {
      const eng = new Engine();
      const getFoo: Scheme = scheme(
        [],
        eng.tfun(
          [
            eng.trec([
              eng.tprop("foo", eng.tprim("number")),
              eng.tprop("bar", eng.tprim("string")),
            ]),
          ],
          eng.tprim("boolean")
        )
      );

      eng.defScheme("getFoo", getFoo);

      const expr = sb.app(sb.ident("getFoo"), [
        sb.rec([sb.prop("foo", sb.num(5)), sb.prop("bar", sb.bool(true))]),
      ]);

      expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
        `"true is not a subtype of string"`
      );
    });
  });

  // TODO: record subtyping
});
