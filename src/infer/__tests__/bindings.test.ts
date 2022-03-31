import * as sb from "../syntax-builders";
import * as tt from "../type-types";
import { addBindings } from "../bindings";
import { Engine } from "../engine";

describe("addBindings", () => {
  test("'hello'.length", () => {
    const eng = new Engine();
    addBindings(eng);

    const result = eng.inferExpr(sb.mem(sb.str("hello"), sb.ident("length")));

    expect(tt.print(result)).toEqual("number");
  });

  test("'hello, world'.split(',')", () => {
    const eng = new Engine();
    addBindings(eng);

    const result = eng.inferExpr(
      sb.app(sb.mem(sb.str("hello, world"), sb.ident("split")), [
        sb.str(","),
        sb.num(100), // limit - how many items to return
      ])
    );

    expect(tt.print(result)).toEqual("Array<string>");
  });

  test("string.length", () => {
    const eng = new Engine();
    addBindings(eng);

    eng.defType("msg", eng.tprim("string"));

    const result = eng.inferExpr(sb.mem(sb.ident("msg"), sb.ident("length")));

    expect(tt.print(result)).toEqual("number");
  });

  test("string.split(',')", () => {
    const eng = new Engine();
    addBindings(eng);

    eng.defType("msg", eng.tprim("string"));

    const result = eng.inferExpr(
      sb.app(sb.mem(sb.ident("msg"), sb.ident("split")), [
        sb.str(","),
        sb.num(100), // limit - how many items to return
      ])
    );

    expect(tt.print(result)).toEqual("Array<string>");
  });
});
