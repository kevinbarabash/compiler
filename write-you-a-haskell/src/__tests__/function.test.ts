import { Expr } from "../syntax-types";
import { print, scheme } from "../type-types";
import * as sb from "../syntax-builders";
import { createArrayScheme } from "../builtins";
import { Engine } from "../engine";

type Binding = [string, Expr];

const _const: Binding = ["const", sb.lam(["x", "y"], sb.ident("x"))];

describe("Functions", () => {
  test("let rec fib = (n) => ...", () => {
    const eng = new Engine();
    // letrecdecl takes
    // `let rec fib = (n) => ...`
    // and converts it to
    // `let fib = fix((fib) => (n) => ...)`
    const fib: Binding = [
      "fib",
      sb.fix(
        sb.lam(
          ["fib"],
          sb.lam(
            ["n"],
            sb._if(
              sb.eql(sb.ident("n"), sb.num(0)),
              // then
              sb.num(0),
              // else
              sb._if(
                sb.eql(sb.ident("n"), sb.num(1)),
                // then
                sb.num(1),
                // else
                sb.add(
                  sb.app(sb.ident("fib"), [sb.sub(sb.ident("n"), sb.num(1))]),
                  sb.app(sb.ident("fib"), [sb.sub(sb.ident("n"), sb.num(2))])
                )
              )
            )
          )
        )
      ),
    ];

    const result = eng.inferExpr(fib[1]);

    // TODO: subsume 0 and 1 into number
    expect(print(result)).toEqual("(number) => number");
  });

  test("let const = (x) => (y) => x", () => {
    const eng = new Engine();
    const result = eng.inferExpr(_const[1]);

    expect(print(result)).toEqual("<a, b>(a, b) => a");
  });

  test("issue #82", () => {
    const eng = new Engine();
    // let y = \y -> {
    //   let f = \x -> if x then True else False in const(f(y), y);
    // }
    const y: Binding = [
      "y",
      sb.lam(
        ["y"],
        sb._let(
          "f",
          sb.lam(["x"], sb._if(sb.ident("x"), sb.bool(true), sb.bool(false))),
          sb.app(sb.ident("const"), [
            sb.app(sb.ident("f"), [sb.ident("y")]),
            sb.ident("y"),
          ])
        )
      ),
    ];
    // let id x = x;
    const id: Binding = ["id", sb.lam(["x"], sb.ident("x"))];
    // let foo x = let y = id x in y + 1;
    const foo: Binding = [
      "foo",
      sb.lam(
        ["x"],
        sb._let(
          "y",
          sb.app(sb.ident("id"), [sb.ident("x")]),
          sb.add(sb.ident("y"), sb.num(1))
        )
      ),
    ];

    eng.inferDecl(_const[0], _const[1]);
    eng.inferDecl(y[0], y[1]);
    eng.inferDecl(id[0], id[1]);
    eng.inferDecl(foo[0], foo[1]);

    const fooType = eng.ctx.env.get("foo");
    if (!fooType) {
      throw new Error("foo is undefined");
    }

    expect(print(fooType)).toEqual("(number) => number");

    const yType = eng.ctx.env.get("y");
    if (!yType) {
      throw new Error("y is undefined");
    }

    expect(print(yType)).toEqual("(boolean) => boolean");
  });

  test("let compose = (f) => (g) => (x) => g(f(x))", () => {
    const eng = new Engine();
    // compose f g x == g (f x)
    const compose: Binding = [
      "compose",
      sb.lam(
        ["f"],
        sb.lam(
          ["g"],
          sb.lam(
            ["x"],
            sb.app(sb.ident("g"), [sb.app(sb.ident("f"), [sb.ident("x")])])
          )
        )
      ),
    ];

    const result = eng.inferExpr(compose[1]);

    expect(print(result)).toEqual(
      "<a, b, c>((a) => b) => ((b) => c) => (a) => c"
    );
  });

  test("let on = (g, f) => (x, y) => g(f(x), f(y))", () => {
    const eng = new Engine();
    const on: Binding = [
      "on",
      sb.lam(
        ["g", "f"],
        sb.lam(
          ["x", "y"],
          sb.app(sb.ident("g"), [
            sb.app(sb.ident("f"), [sb.ident("x")]),
            sb.app(sb.ident("f"), [sb.ident("y")]),
          ])
        )
      ),
    ];

    const result = eng.inferExpr(on[1]);

    // TODO: include variable names in the output of the inferred type
    expect(print(result)).toEqual(
      "<a, b, c>((a, a) => b, (c) => a) => (c, c) => b"
    );
  });

  test("let ap = (f, x) => f(f(x);", () => {
    const eng = new Engine();
    const ap: Binding = [
      "ap",
      sb.lam(
        ["f", "x"],
        sb.app(sb.ident("f"), [sb.app(sb.ident("f"), [sb.ident("x")])])
      ),
    ];

    const result = eng.inferExpr(ap[1]);

    expect(print(result)).toEqual("<a>((a) => a, a) => a");
  });

  test("until (n-ary)", () => {
    const eng = new Engine();
    const until: Binding = [
      "until",
      // let rec until p f x =
      sb.fix(
        sb.lam(
          ["until"],
          sb.lam(
            ["p", "f", "x"],
            sb._if(
              //   if (p x)
              sb.app(sb.ident("p"), [sb.ident("x")]),
              //   then x
              sb.ident("x"),
              //   else (until p f (f x));
              sb.app(sb.ident("until"), [
                sb.ident("p"),
                sb.ident("f"),
                sb.app(sb.ident("f"), [sb.ident("x")]),
              ])
            )
          )
        )
      ),
    ];

    const result = eng.inferExpr(until[1]);

    expect(print(result)).toEqual("<a>((a) => boolean, (a) => a, a) => a");
  });

  test("no args", () => {
    const eng = new Engine();
    const foo: Binding = ["foo", sb.lam([], sb.num(5))];

    const result = eng.inferExpr(foo[1]);

    expect(print(result)).toEqual("() => 5");
  });
});

describe("partial applicaiton", () => {
  test("add5 = add(5)", () => {
    const eng = new Engine();
    const _add: Binding = [
      "add",
      sb.lam(["a", "b"], sb.add(sb.ident("a"), sb.ident("b"))),
    ];
    const add5: Binding = ["add5", sb.app(sb.ident("add"), [sb.num(5)])];

    eng.inferDecl(_add[0], _add[1]);
    const result = eng.inferDecl(add5[0], add5[1]);

    expect(print(result)).toEqual("(number) => number");
  });

  test("let sum = add(5)(10)", () => {
    const eng = new Engine();
    const _add: Binding = [
      "add",
      sb.lam(["a", "b"], sb.add(sb.ident("a"), sb.ident("b"))),
    ];
    const sum: Binding = [
      "sum",
      sb.app(sb.app(sb.ident("add"), [sb.num(5)]), [sb.num(10)]),
    ];

    eng.inferDecl(_add[0], _add[1]);
    const result = eng.inferDecl(sum[0], sum[1]);

    expect(print(result)).toEqual("number");
  });

  test("((a, b) => a + b)(5)", () => {
    const eng = new Engine();
    const add5: Binding = [
      "add5",
      sb.app(sb.lam(["a", "b"], sb.add(sb.ident("a"), sb.ident("b"))), [
        sb.num(5),
      ]),
    ];

    const result = eng.inferExpr(add5[1]);

    expect(print(result)).toEqual("(number) => number");
  });
});

describe("function subtyping", () => {
  test("extra args are allowed and ignored", () => {
    const eng = new Engine();
    const _add: Binding = [
      "add",
      sb.lam(["a", "b"], sb.add(sb.ident("a"), sb.ident("b"))),
    ];
    const sum: Binding = [
      "sum",
      sb.app(sb.ident("add"), [sb.num(5), sb.num(10), sb.num(99)]),
    ];

    eng.inferDecl(_add[0], _add[1]);
    eng.inferDecl(sum[0], sum[1]);

    // TODO: add assertion
  });

  test("passing a callback with fewer params is allowed", () => {
    const eng = new Engine();
    const aVar = eng.tvar("a");
    const bVar = eng.tvar("b");

    const mapScheme = scheme(
      [aVar, bVar],
      eng.tfun(
        [
          eng.tgen("Array", [aVar]),
          // Why is this TFun's `src` an "App"?
          eng.tfun([aVar, eng.tprim("number")], bVar),
        ],
        eng.tgen("Array", [bVar])
      )
    );

    eng.defScheme("map", mapScheme);

    const intArray = scheme([], eng.tgen("Array", [eng.tprim("number")]));

    eng.defScheme("array", intArray);

    const call = sb.app(sb.ident("map"), [
      sb.ident("array"),
      sb.lam(["x"], sb.eql(sb.ident("x"), sb.num(0))),
    ]);

    const result = eng.inferExpr(call);

    expect(print(result)).toEqual("Array<boolean>");
  });

  test("strArray.map((elem) => 5) -> Array<5>", () => {
    const eng = new Engine();

    eng.defScheme("Array", createArrayScheme(eng.ctx));

    eng.defScheme(
      "strArray",
      scheme([], eng.tgen("Array", [eng.tprim("string")]))
    );

    // TODO: allow `(elem) => 5` to be passed as the callback
    const expr = sb.app(sb.mem(sb.ident("strArray"), sb.ident("map")), [
      sb.lam(["elem"], sb.num(5)),
    ]);
    const result = eng.inferExpr(expr);

    expect(print(result)).toMatchInlineSnapshot(`"Array<5>"`);
  });

  test("partial application of a callback", () => {
    const eng = new Engine();
    const aVar = eng.tvar("a");
    const bVar = eng.tvar("b");

    const mapScheme = scheme(
      [aVar, bVar],
      eng.tfun(
        [
          eng.tgen("Array", [aVar]),
          eng.tfun([aVar, eng.tprim("number")], bVar),
        ],
        eng.tgen("Array", [bVar])
      )
    );

    eng.defScheme("map", mapScheme);

    const intArray = scheme([], eng.tgen("Array", [eng.tprim("number")]));

    eng.defScheme("array", intArray);

    const _add: Binding = [
      "add",
      sb.lam(["a", "b"], sb.add(sb.ident("a"), sb.ident("b"))),
    ];
    eng.inferDecl(_add[0], _add[1]);

    const call = sb.app(sb.ident("map"), [
      sb.ident("array"),
      sb.lam(["x"], sb.app(sb.ident("add"), [sb.ident("x")])),
    ]);

    const result = eng.inferExpr(call);

    expect(print(result)).toEqual("Array<(number) => number>");
  });
});
