import * as sb from "../../infer/syntax-builders";
import * as tt from "../../infer/type-types";
import { readTypes } from "../read-types";

describe("readTypes", () => {
  test("string.length", () => {
    const eng = readTypes();

    const result = eng.inferExpr(sb.mem(
        sb.str("hello"),
        sb.ident("length"),
    ));

    expect(tt.print(result)).toEqual("number");
  });

  test("string.split(',')", () => {
    const eng = readTypes();

    const result = eng.inferExpr(
        sb.app(
            sb.mem(
                sb.str("hello"),
                sb.ident("split"),
            ),
            [
                sb.str(","),
                sb.num(100), // limit - how many items to return
            ],
        ),
    );

    expect(tt.print(result)).toEqual("Array<string>");
  });
});
