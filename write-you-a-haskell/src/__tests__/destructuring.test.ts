import { Expr } from "../syntax-types";
import { print } from "../type-types";
import * as sb from "../syntax-builders";
import { Engine } from "../engine";

describe("destructuring", () => {
  test("single property - let {x} = {x: 5, y: true} in x", () => {
    const eng = new Engine();
    const expr: Expr = {
      tag: "Let",
      pattern: sb.prec([sb.pprop("x")]),
      value: sb.rec([sb.prop("x", sb.num(5)), sb.prop("y", sb.bool(true))]),
      body: sb.ident("x"),
    };

    const result = eng.inferExpr(expr);

    expect(print(result)).toEqual("5");
  });

  test("single property from a variable - let {x} = {x: 5, y: true} in x", () => {
    const eng = new Engine();
    const myRec: Expr = sb.rec([
      sb.prop("x", sb.num(5)),
      sb.prop("y", sb.bool(true)),
    ]);

    eng.inferDecl("myRec", myRec);

    const expr: Expr = {
      tag: "Let",
      pattern: sb.prec([sb.pprop("x")]),
      value: sb.ident("myRec"),
      body: sb.ident("x"),
    };

    const result = eng.inferExpr(expr);

    expect(print(result)).toEqual("5");
  });

  test("multiple properties - let {x, y} = {x: 5, y: 10} in x + y", () => {
    const eng = new Engine();
    const expr: Expr = {
      tag: "Let",
      pattern: sb.prec([sb.pprop("x"), sb.pprop("y")]),
      value: sb.rec([sb.prop("x", sb.num(5)), sb.prop("y", sb.num(10))]),
      body: sb.add(sb.ident("x"), sb.ident("y")),
    };

    const result = eng.inferExpr(expr);

    expect(print(result)).toEqual("number");
  });

  test("renaming a property - let {x: a} = {x: 5, y: 10} in a", () => {
    const eng = new Engine();
    const expr: Expr = {
      tag: "Let",
      pattern: sb.prec([sb.pprop("x", sb.pvar("a"))]),
      value: sb.rec([sb.prop("x", sb.num(5)), sb.prop("y", sb.num(10))]),
      body: sb.ident("a"),
    };

    const result = eng.inferExpr(expr);

    expect(print(result)).toEqual("5");
  });

  test("record with wildcard - let {x: a, y: _} = {x: 5, y: 10} in a", () => {
    const eng = new Engine();
    const expr: Expr = {
      tag: "Let",
      pattern: sb.prec([
        sb.pprop("x", sb.pvar("a")),
        sb.pprop("y", sb.pwild()),
      ]),
      value: sb.rec([sb.prop("x", sb.num(5)), sb.prop("y", sb.num(10))]),
      body: sb.ident("a"),
    };

    const result = eng.inferExpr(expr);

    expect(print(result)).toEqual("5");
  });

  test("nested record - let {p:{x: a}} = {p:{x: 5, y: 10}} in a", () => {
    const eng = new Engine();
    const expr: Expr = {
      tag: "Let",
      pattern: sb.prec([sb.pprop("p", sb.prec([sb.pprop("x", sb.pvar("a"))]))]),
      value: sb.rec([
        sb.prop(
          "p",
          sb.rec([sb.prop("x", sb.num(5)), sb.prop("y", sb.num(10))])
        ),
      ]),
      body: sb.ident("a"),
    };

    const result = eng.inferExpr(expr);

    expect(print(result)).toEqual("5");
  });

  test("matching literal - let {x, y: 10} = {x: 5, y: 10} in x + y", () => {
    const eng = new Engine();
    const expr: Expr = {
      tag: "Let",
      pattern: sb.prec([
        sb.pprop("x"),
        sb.pprop("y", sb.plit(sb.num(10).value)),
      ]),
      value: sb.rec([sb.prop("x", sb.num(5)), sb.prop("y", sb.num(10))]),
      body: sb.ident("x"),
    };

    const result = eng.inferExpr(expr);

    expect(print(result)).toEqual("5");
  });

  test("mismatched literal - let {x, y: true} = {x: 5, y: 10} in x", () => {
    const eng = new Engine();
    const expr: Expr = {
      tag: "Let",
      pattern: sb.prec([
        sb.pprop("x"),
        sb.pprop("y", sb.plit(sb.bool(true).value)),
      ]),
      value: sb.rec([sb.prop("x", sb.num(5)), sb.prop("y", sb.num(10))]),
      body: sb.ident("x"),
    };

    // TODO: this should be "Couldn't unify true with 10"
    expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
      `"Couldn't unify true with 10"`
    );
  });

  test("missing property - let {x, z} = {x: 5, y: 10} in x", () => {
    const eng = new Engine();
    const expr: Expr = {
      tag: "Let",
      pattern: sb.prec([sb.pprop("x"), sb.pprop("z")]),
      value: sb.rec([sb.prop("x", sb.num(5)), sb.prop("y", sb.num(10))]),
      body: sb.ident("x"),
    };

    expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
      `"{x: 5, y: 10} doesn't contain z property"`
    );
  });

  test("tuple - let [x, y] = [5, true] in x", () => {
    const eng = new Engine();
    const myTuple: Expr = sb.tuple([sb.num(5), sb.bool(true)]);

    eng.inferDecl("myTuple", myTuple);

    const expr: Expr = {
      tag: "Let",
      pattern: sb.ptuple([sb.pvar("x"), sb.pvar("y")]),
      value: sb.ident("myTuple"),
      body: sb.ident("x"),
    };
    const result = eng.inferExpr(expr);

    expect(print(result)).toEqual("5");
  });

  test("tuple (wrong length) - let [x] = [5, true] in x", () => {
    const eng = new Engine();
    const myTuple: Expr = sb.tuple([sb.num(5), sb.bool(true)]);

    eng.inferDecl("myTuple", myTuple);

    const expr: Expr = {
      tag: "Let",
      pattern: sb.ptuple([sb.pvar("x")]),
      value: sb.ident("myTuple"),
      body: sb.ident("x"),
    };

    expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
      `"element count mismatch"`
    );
  });

  test("tuple/record - let [x, y] = {x:5, y:true} in x", () => {
    const eng = new Engine();
    const myRec: Expr = sb.rec([
      sb.prop("x", sb.num(5)),
      sb.prop("y", sb.num(10)),
    ]);

    eng.inferDecl("myRec", myRec);

    const expr: Expr = {
      tag: "Let",
      pattern: sb.ptuple([sb.pvar("x"), sb.pvar("y")]),
      value: sb.ident("myRec"),
      body: sb.ident("x"),
    };

    expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
      `"type doesn't match pattern"`
    );
  });

  test("record/tuple - let {x, y} = [5, true] in x", () => {
    const eng = new Engine();
    const myTuple: Expr = sb.tuple([sb.num(5), sb.bool(true)]);
    eng.inferDecl("myTuple", myTuple);

    const expr: Expr = {
      tag: "Let",
      pattern: sb.prec([sb.pprop("x"), sb.pprop("y")]),
      value: sb.ident("myTuple"),
      body: sb.ident("x"),
    };

    expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
      `"type doesn't match pattern"`
    );
  });

  test("parametrized record", () => {
    const eng = new Engine();
    const expr: Expr = sb.lam(["x"], {
      tag: "Let",
      pattern: sb.prec([sb.pprop("x", sb.pvar("a"))]),
      value: sb.rec([sb.prop("x", sb.ident("x"))]),
      body: sb.ident("a"),
    });

    const result = eng.inferExpr(expr);

    expect(print(result)).toEqual("<a>(a) => a");
  });

  test("parametrized tuple", () => {
    const eng = new Engine();
    const expr: Expr = sb.lam(["x"], {
      tag: "Let",
      pattern: sb.ptuple([sb.pvar("a")]),
      value: sb.tuple([sb.ident("x")]),
      body: sb.ident("a"),
    });

    const result = eng.inferExpr(expr);

    expect(print(result)).toEqual("<a>(a) => a");
  });
});
