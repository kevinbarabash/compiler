import { Expr } from "../syntax-types";
import { print } from "../type-types";
import * as sb from "../syntax-builders";
import * as tb from "../type-builders";
import { createArrayScheme } from "../builtins";
import { Engine } from "../engine";

describe("Array", () => {
  test("printing the type", () => {
    const ctx = tb.createCtx();
    const sc = createArrayScheme(ctx);

    expect(print(sc)).toMatchInlineSnapshot(
      `"<T>{length: number, map: ((T, number, Array<T>) => U) => Array<U>}"`
    );
  });

  test("strArray = Array<string>", () => {
    const eng = new Engine();
    eng.defScheme("Array", createArrayScheme(eng.ctx));
    eng.defType("strArray", eng.tcon("Array", [eng.tprim("string")]));

    const result = eng.inferExpr(sb._var("strArray"));

    expect(print(result)).toMatchInlineSnapshot(`"Array<string>"`);
  });

  test("type of strArray.map", () => {
    const eng = new Engine();
    eng.defScheme("Array", createArrayScheme(eng.ctx));
    eng.defType("strArray", eng.tcon("Array", [eng.tprim("string")]));

    const result = eng.inferExpr(sb.mem("strArray", "map"));

    // TODO:
    // - `a` should copy its name from the original type/scheme
    // We need a function that converts a type to a scheme.
    expect(print(result)).toMatchInlineSnapshot(
      `"<a>((string, number, Array<string>) => a) => Array<a>"`
    );
  });

  test("strArray.map((elem) => 5) -> Array<5>", () => {
    const eng = new Engine();
    eng.defScheme("Array", createArrayScheme(eng.ctx));
    eng.defType("strArray", eng.tcon("Array", [eng.tprim("string")]));

    const expr: Expr = sb.app(sb.mem("strArray", "map"), [
      sb.lam(["elem"], sb.num(5)),
    ]);
    const result = eng.inferExpr(expr);

    expect(print(result)).toMatchInlineSnapshot(`"Array<5>"`);
  });

  test("strArray.map((elem, index, array) => index) -> Array<number>", () => {
    const eng = new Engine();
    eng.defScheme("Array", createArrayScheme(eng.ctx));
    eng.defType("strArray", eng.tcon("Array", [eng.tprim("string")]));

    const expr: Expr = sb.app(sb.mem("strArray", "map"), [
      sb.lam(["elem", "index", "array"], sb._var("index")),
    ]);
    const result = eng.inferExpr(expr);

    expect(print(result)).toMatchInlineSnapshot(`"Array<number>"`);
  });

  test("strArray.map((elem, index, array) => array) -> Array<Array<string>>", () => {
    const eng = new Engine();
    eng.defScheme("Array", createArrayScheme(eng.ctx));
    eng.defType("strArray", eng.tcon("Array", [eng.tprim("string")]));

    const expr: Expr = sb.app(sb.mem("strArray", "map"), [
      sb.lam(["elem", "index", "array"], sb._var("array")),
    ]);
    const result = eng.inferExpr(expr);

    expect(print(result)).toMatchInlineSnapshot(`"Array<Array<string>>"`);
  });

  test("member access on TVar that doesn't exist in env", () => {
    const eng = new Engine();
    eng.defScheme("Array", createArrayScheme(eng.ctx));
    eng.defType("strArray", eng.tcon("Array", [eng.tprim("string")]));

    const expr: Expr = sb.app(sb.mem("strArray", "map"), [
      sb.lam(["elem", "index", "array"], sb.mem("array", "length")),
    ]);
    const result = eng.inferExpr(expr);

    expect(print(result)).toMatchInlineSnapshot(`"Array<number>"`);
  });
});
