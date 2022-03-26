import { Expr } from "../syntax-types";
import { print, scheme } from "../type-types";
import * as sb from "../syntax-builders";
import { Engine } from "../engine";

describe("Async/Await", () => {
  test("return value is wrapped in a promise", () => {
    const eng = new Engine();
    const expr: Expr = sb.lam([], sb.num(5), true);

    const result = eng.inferExpr(expr);

    expect(print(result)).toEqual("() => Promise<5>");
  });

  test("return value is not rewrapped if already a promise", () => {
    const eng = new Engine();
    const retVal = scheme([], eng.tgen("Promise", [eng.tprim("number")]));
    eng.defScheme("retVal", retVal);

    const expr: Expr = sb.lam([], sb.ident("retVal"), true);
    const result = eng.inferExpr(expr);

    expect(print(result)).toEqual("() => Promise<number>");
  });

  test("awaiting a promise will unwrap it", () => {
    const eng = new Engine();
    const retVal = scheme([], eng.tgen("Promise", [eng.tprim("number")]));
    eng.defScheme("retVal", retVal);

    // Passing an awaited Promise<number> to add() verifies that we're
    // unwrapping promises.
    const expr: Expr = sb.lam(
      [],
      sb.add(sb._await(sb.ident("retVal")), sb.num(5)),
      true
    );
    const result = eng.inferExpr(expr);

    expect(print(result)).toEqual("() => Promise<number>");
  });

  test("awaiting a non-promise value is a no-op", () => {
    const eng = new Engine();
    // Passing an awaited Promise<number> to add() verifies that we're
    // unwrapping promises.
    const expr: Expr = sb.lam(
      [],
      sb.add(sb._await(sb.num(5)), sb.num(10)),
      true
    );

    const result = eng.inferExpr(expr);

    expect(print(result)).toEqual("() => Promise<number>");
  });

  test("inferring an async function that returns a polymorphic promise", () => {
    const eng = new Engine();
    const expr: Expr = sb.lam([sb.ident("x")], sb.app(sb.ident("x"), []), true);

    const result = eng.inferExpr(expr);

    expect(print(result)).toEqual("<a>(() => a) => Promise<a>");
  });

  test("awaiting inside a non-async lambda", () => {
    const eng = new Engine();
    const expr: Expr = sb.lam([], sb.add(sb._await(sb.num(5)), sb.num(10)));

    expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
      `"Can't use \`await\` inside non-async lambda"`
    );
  });

  test("awaiting inside a nested non-async lambda", () => {
    const eng = new Engine();
    const expr: Expr = sb.lam(
      [],
      sb._let(
        "add",
        sb.lam(
          [sb.ident("a"), sb.ident("b")],
          sb.add(sb._await(sb.ident("a")), sb.ident("b"))
        ),
        sb.app(sb.ident("add"), [sb.num(5), sb.num(10)])
      ),
      true // Even though the outer lambda is async, the inner one isn't
    );

    expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
      `"Can't use \`await\` inside non-async lambda"`
    );
  });

  test("awaiting inside a nested async lambda", () => {
    const eng = new Engine();
    const expr: Expr = sb.lam(
      [],
      sb._let(
        "add",
        sb.lam(
          [sb.ident("a"), sb.ident("b")],
          sb.add(sb._await(sb.ident("a")), sb.ident("b")),
          true
        ),
        sb.app(sb.ident("add"), [sb.num(5), sb.num(10)])
      ),
      false
    );

    const result = eng.inferExpr(expr);

    expect(print(result)).toEqual("() => Promise<number>");
  });
});
