import { Expr } from "../syntax-types";
import { print, scheme } from "../type-types";
import * as sb from "../syntax-builders";
import { createArrayScheme } from "../builtins";
import { Engine } from "../engine";

type Binding = [string, Expr];

const _const: Binding = [
  "const",
  sb.lam([sb.ident("x"), sb.ident("y")], sb.ident("x")),
];

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
          [sb.ident("fib")],
          sb.lam(
            [sb.ident("n")],
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
        [sb.ident("y")],
        sb._let(
          "f",
          sb.lam(
            [sb.ident("x")],
            sb._if(sb.ident("x"), sb.bool(true), sb.bool(false))
          ),
          sb.app(sb.ident("const"), [
            sb.app(sb.ident("f"), [sb.ident("y")]),
            sb.ident("y"),
          ])
        )
      ),
    ];
    // let id x = x;
    const id: Binding = ["id", sb.lam([sb.ident("x")], sb.ident("x"))];
    // let foo x = let y = id x in y + 1;
    const foo: Binding = [
      "foo",
      sb.lam(
        [sb.ident("x")],
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
        [sb.ident("f")],
        sb.lam(
          [sb.ident("g")],
          sb.lam(
            [sb.ident("x")],
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
        [sb.ident("g"), sb.ident("f")],
        sb.lam(
          [sb.ident("x"), sb.ident("y")],
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
        [sb.ident("f"), sb.ident("x")],
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
          [sb.ident("until")],
          sb.lam(
            [sb.ident("p"), sb.ident("f"), sb.ident("x")],
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
      sb.lam(
        [sb.ident("a"), sb.ident("b")],
        sb.add(sb.ident("a"), sb.ident("b"))
      ),
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
      sb.lam(
        [sb.ident("a"), sb.ident("b")],
        sb.add(sb.ident("a"), sb.ident("b"))
      ),
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
      sb.app(
        sb.lam(
          [sb.ident("a"), sb.ident("b")],
          sb.add(sb.ident("a"), sb.ident("b"))
        ),
        [sb.num(5)]
      ),
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
      sb.lam(
        [sb.ident("a"), sb.ident("b")],
        sb.add(sb.ident("a"), sb.ident("b"))
      ),
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
      sb.lam([sb.ident("x")], sb.eql(sb.ident("x"), sb.num(0))),
    ]);

    const result = eng.inferExpr(call);

    expect(print(result)).toEqual("Array<boolean>");
  });

  test("strArray.map((elem) => 5) -> Array<5>", () => {
    const eng = new Engine();

    eng.defScheme(
      "strArray",
      scheme([], eng.tgen("Array", [eng.tprim("string")]))
    );

    // TODO: allow `(elem) => 5` to be passed as the callback
    const expr = sb.app(sb.mem(sb.ident("strArray"), sb.ident("map")), [
      sb.lam([sb.ident("elem")], sb.num(5)),
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
      sb.lam(
        [sb.ident("a"), sb.ident("b")],
        sb.add(sb.ident("a"), sb.ident("b"))
      ),
    ];
    eng.inferDecl(_add[0], _add[1]);

    const call = sb.app(sb.ident("map"), [
      sb.ident("array"),
      sb.lam([sb.ident("x")], sb.app(sb.ident("add"), [sb.ident("x")])),
    ]);

    const result = eng.inferExpr(call);

    expect(print(result)).toEqual("Array<(number) => number>");
  });

  describe("varargs", () => {
    test("basic inference", () => {
      const eng = new Engine();
      const foo = sb.lam([sb.rest("rest")], sb.num(5));

      const result = eng.inferExpr(foo);

      expect(print(result)).toEqual("<a>(...Array<a>) => 5");
    });

    test("multiple rest params is not allowed", () => {
      const eng = new Engine();
      const foo = sb.lam([sb.rest("rest"), sb.rest("rest")], sb.num(5));

      expect(() => eng.inferExpr(foo)).toThrowErrorMatchingInlineSnapshot(
        `"Rest param must come last."`
      );
    });

    test("rest param must come last", () => {
      const eng = new Engine();
      const foo = sb.lam([sb.rest("rest"), sb.ident("x")], sb.num(5));

      expect(() => eng.inferExpr(foo)).toThrowErrorMatchingInlineSnapshot(
        `"Rest param must come last."`
      );
    });

    test("varargs with numbers only", () => {
      const eng = new Engine();
      const foo = sb._let(
        "foo",
        sb.lam([sb.rest("rest")], sb.ident("rest")),
        sb.app(sb.ident("foo"), [sb.num(5), sb.num(10)])
      );

      const result = eng.inferExpr(foo);

      expect(print(result)).toEqual("Array<10 | 5>");
    });

    test("varargs with a mix of types", () => {
      const eng = new Engine();
      const foo = sb._let(
        "foo",
        sb.lam([sb.rest("rest")], sb.ident("rest")),
        sb.app(sb.ident("foo"), [sb.num(5), sb.bool(true)])
      );

      const result = eng.inferExpr(foo);

      expect(print(result)).toEqual("Array<true | 5>");
    });

    test("varargs with no args", () => {
      const eng = new Engine();
      const foo = sb._let(
        "foo",
        sb.lam([sb.rest("rest")], sb.ident("rest")),
        sb.app(sb.ident("foo"), [])
      );

      const result = eng.inferExpr(foo);

      expect(print(result)).toEqual("<a>Array<a>");
    });

    test("varargs with regular args", () => {
      const eng = new Engine();
      const foo = sb._let(
        "foo",
        sb.lam([sb.ident("x"), sb.rest("rest")], sb.ident("rest")),
        sb.app(sb.ident("foo"), [sb.str("hello"), sb.num(5), sb.num(10)])
      );

      const result = eng.inferExpr(foo);

      expect(print(result)).toEqual("Array<10 | 5>");
    });

    test("varargs with regular args (but no varargs passed)", () => {
      const eng = new Engine();
      const foo = sb._let(
        "foo",
        sb.lam([sb.ident("x"), sb.rest("rest")], sb.ident("rest")),
        sb.app(sb.ident("foo"), [sb.str("hello")])
      );

      const result = eng.inferExpr(foo);

      expect(print(result)).toEqual("<a>Array<a>");
    });

    test("regular args with varargs", () => {
      const eng = new Engine();
      const foo = sb._let(
        "foo",
        sb.lam([sb.ident("x"), sb.rest("rest")], sb.ident("x")),
        sb.app(sb.ident("foo"), [sb.str("hello"), sb.num(5), sb.num(10)])
      );

      const result = eng.inferExpr(foo);

      expect(print(result)).toEqual('"hello"');
    });

    test("partially application of varargs", () => {
      const eng = new Engine();
      const foo = sb._let(
        "foo",
        sb.lam(
          [sb.ident("x"), sb.ident("y"), sb.rest("rest")],
          sb.ident("rest")
        ),
        sb.app(sb.ident("foo"), [sb.str("hello")])
      );

      const result = eng.inferExpr(foo);

      expect(print(result)).toEqual("<a>(Array<a>) => Array<a>");
    });

    test("variadic callbacks", () => {
      const eng = new Engine();
      eng.inferDecl(
        "foo",
        sb.lam([sb.ident("x"), sb.rest("rest")], sb.ident("x"))
      );
      eng.inferDecl(_const[0], _const[1]);
      const bar = sb.app(sb.ident("const"), [sb.ident("foo")]);

      const result = eng.inferExpr(bar);

      expect(print(result)).toMatchInlineSnapshot(
        `"<a, b, c>(a) => (b, ...Array<c>) => b"`
      );
    });

    test("calling a pre-defined func with variadic callback", () => {
      const eng = new Engine();
      eng.defType(
        "foo",
        eng.tfun(
          [eng.tgen("Array", [eng.tprim("number")])],
          eng.tprim("number"),
          true
        )
      );

      const result = eng.inferExpr(
        sb.lam([sb.ident("x")], sb.app(sb.ident("foo"), [sb.ident("x")]))
      );

      expect(print(result)).toMatchInlineSnapshot(`"(number) => number"`);
    });

    test("passing a variadic function as an arg", () => {
      const eng = new Engine();
      eng.defType(
        "foo",
        eng.tfun(
          [eng.tgen("Array", [eng.tprim("number")])],
          eng.tprim("number"),
          true
        )
      );
      eng.inferDecl(_const[0], _const[1]);

      const result = eng.inferExpr(
        sb.app(sb.ident("const"), [sb.ident("foo"), sb.str("hello")])
      );

      expect(print(result)).toMatchInlineSnapshot(
        `"(...Array<number>) => number"`
      );
    });
  });
});
