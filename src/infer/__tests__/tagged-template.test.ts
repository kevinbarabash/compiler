import * as sb from "../syntax-builders";
import { print } from "../type-types";
import { Engine } from "../engine";

describe("tagged templates", () => {
  test("the return type of a simple tagged template literal", () => {
    const eng = new Engine();

    // sql: (Array<string>, ...Array<string>) => string
    eng.defType(
      "sql",
      eng.tfun(
        [
          eng.tgen("Array", [eng.tprim("string")]),
          eng.tgen("Array", [eng.tprim("string")]),
        ],
        eng.tprim("string"),
        true
      )
    );
    eng.inferDecl("table", sb.str("users"));
    eng.inferDecl("id", sb.str("1234"));

    // sql`SELECT * FROM ${table} WHERE id = ${id}`;
    const result = eng.inferExpr(
      sb.taggedTemplate(
        sb.ident("sql"),
        [sb.str("SELECT * FROM "), sb.str(" WHERE ID = "), sb.str("")],
        [sb.ident("table"), sb.ident("id")]
      )
    );

    expect(print(result)).toEqual("string");
  });

  test("errors if the expression types don't match", () => {
    const eng = new Engine();

    // sql: (Array<string>, ...Array<string>) => string
    eng.defType(
      "sql",
      eng.tfun(
        [
          eng.tgen("Array", [eng.tprim("string")]),
          eng.tgen("Array", [eng.tprim("string")]),
        ],
        eng.tprim("string"),
        true
      )
    );
    eng.inferDecl("table", sb.str("users"));
    eng.inferDecl("id", sb.num(1234)); // `sql` expects strings for each interpolation

    // sql`SELECT * FROM ${table} WHERE id = ${id}`;
    expect(() =>
      eng.inferExpr(
        sb.taggedTemplate(
          sb.ident("sql"),
          [sb.str("SELECT * FROM "), sb.str(" WHERE ID = "), sb.str("")],
          [sb.ident("table"), sb.ident("id")]
        )
      )
    ).toThrowErrorMatchingInlineSnapshot(`"1234 is not a subtype of string"`);
  });
});