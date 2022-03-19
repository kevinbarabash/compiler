import { Map } from "immutable";

import { inferExpr } from "../infer";
import { Expr } from "../syntax-types";
import { Env } from "../context";
import { print, scheme } from "../type-types";
import * as sb from "../syntax-builders";
import * as tb from "../type-builders";

type Binding = [string, Expr];

const _const: Binding = ["const", sb.lam(["x", "y"], sb._var("x"))];

describe("Functions", () => {
  test("let rec fib = (n) => ...", () => {
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
              sb.eql(sb._var("n"), sb.num(0)),
              // then
              sb.num(0),
              // else
              sb._if(
                sb.eql(sb._var("n"), sb.num(1)),
                // then
                sb.num(1),
                // else
                sb.add(
                  sb.app(sb._var("fib"), [sb.sub(sb._var("n"), sb.num(1))]),
                  sb.app(sb._var("fib"), [sb.sub(sb._var("n"), sb.num(2))])
                )
              )
            )
          )
        )
      ),
    ];

    const env: Env = Map();
    const result = inferExpr(env, fib[1]);

    // TODO: subsume 0 and 1 into number
    expect(print(result)).toEqual("(number) => number");
  });

  test("let const = (x) => (y) => x", () => {
    let env: Env = Map();
    const result = inferExpr(env, _const[1]);

    expect(print(result)).toEqual("<a, b>(a, b) => a");
  });

  test("issue #82", () => {
    // let y = \y -> {
    //   let f = \x -> if x then True else False in const(f(y), y);
    // }
    const y: Binding = [
      "y",
      sb.lam(
        ["y"],
        sb._let(
          "f",
          sb.lam(["x"], sb._if(sb._var("x"), sb.bool(true), sb.bool(false))),
          sb.app(sb._var("const"), [
            sb.app(sb._var("f"), [sb._var("y")]),
            sb._var("y"),
          ])
        )
      ),
    ];
    // let id x = x;
    const id: Binding = ["id", sb.lam(["x"], sb._var("x"))];
    // let foo x = let y = id x in y + 1;
    const foo: Binding = [
      "foo",
      sb.lam(
        ["x"],
        sb._let(
          "y",
          sb.app(sb._var("id"), [sb._var("x")]),
          sb.add(sb._var("y"), sb.num(1))
        )
      ),
    ];

    let env: Env = Map();
    env = env.set(_const[0], inferExpr(env, _const[1]));
    env = env.set(y[0], inferExpr(env, y[1]));
    env = env.set(id[0], inferExpr(env, id[1]));
    env = env.set(foo[0], inferExpr(env, foo[1]));

    const fooType = env.get("foo");
    if (!fooType) {
      throw new Error("foo is undefined");
    }

    expect(print(fooType)).toEqual("(number) => number");

    const yType = env.get("y");
    if (!yType) {
      throw new Error("y is undefined");
    }

    // This was (boolean) => boolean before...
    // Is <a>(boolean) => a more accurate?
    expect(print(yType)).toEqual("<a>(boolean) => a");
  });

  test("let compose = (f) => (g) => (x) => g(f(x))", () => {
    // compose f g x == g (f x)
    const compose: Binding = [
      "compose",
      sb.lam(
        ["f"],
        sb.lam(
          ["g"],
          sb.lam(
            ["x"],
            sb.app(sb._var("g"), [sb.app(sb._var("f"), [sb._var("x")])])
          )
        )
      ),
    ];

    let env: Env = Map();
    const result = inferExpr(env, compose[1]);

    expect(print(result)).toEqual(
      "<a, b, c>((a) => b) => ((b) => c) => (a) => c"
    );
  });

  test("let on = (g, f) => (x, y) => g(f(x), f(y))", () => {
    const on: Binding = [
      "on",
      sb.lam(
        ["g", "f"],
        sb.lam(
          ["x", "y"],
          sb.app(sb._var("g"), [
            sb.app(sb._var("f"), [sb._var("x")]),
            sb.app(sb._var("f"), [sb._var("y")]),
          ])
        )
      ),
    ];

    let env: Env = Map();
    const result = inferExpr(env, on[1]);

    // TODO: include variable names in the output of the inferred type
    expect(print(result)).toEqual(
      "<a, b, c>((a, a) => b, (c) => a) => (c, c) => b"
    );
  });

  test("let ap = (f, x) => f(f(x);", () => {
    const ap: Binding = [
      "ap",
      sb.lam(
        ["f", "x"],
        sb.app(sb._var("f"), [sb.app(sb._var("f"), [sb._var("x")])])
      ),
    ];

    let env: Env = Map();
    const result = inferExpr(env, ap[1]);

    expect(print(result)).toEqual("<a>((a) => a, a) => a");
  });

  test("until (n-ary)", () => {
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
              sb.app(sb._var("p"), [sb._var("x")]),
              //   then x
              sb._var("x"),
              //   else (until p f (f x));
              sb.app(sb._var("until"), [
                sb._var("p"),
                sb._var("f"),
                sb.app(sb._var("f"), [sb._var("x")]),
              ])
            )
          )
        )
      ),
    ];

    let env: Env = Map();
    const result = inferExpr(env, until[1]);

    expect(print(result)).toEqual("<a>((a) => boolean, (a) => a, a) => a");
  });

  test("no args", () => {
    const foo: Binding = ["foo", sb.lam([], sb.num(5))];

    let env: Env = Map();
    const result = inferExpr(env, foo[1]);

    expect(print(result)).toEqual("() => 5");
  });
});

describe("partial applicaiton", () => {
  test("add5 = add(5)", () => {
    const _add: Binding = [
      "add",
      sb.lam(["a", "b"], sb.add(sb._var("a"), sb._var("b"))),
    ];
    const add5: Binding = ["add5", sb.app(sb._var("add"), [sb.num(5)])];

    let env: Env = Map();
    const addScheme = inferExpr(env, _add[1]);
    env = env.set(_add[0], addScheme);
    env = env.set(add5[0], inferExpr(env, add5[1]));

    const result = env.get("add5");
    if (!result) {
      throw new Error("add5 is undefined");
    }

    expect(print(result)).toEqual("(number) => number");
  });

  test("let sum = add(5)(10)", () => {
    const _add: Binding = [
      "add",
      sb.lam(["a", "b"], sb.add(sb._var("a"), sb._var("b"))),
    ];
    const sum: Binding = [
      "sum",
      sb.app(sb.app(sb._var("add"), [sb.num(5)]), [sb.num(10)]),
    ];

    let env: Env = Map();
    const addScheme = inferExpr(env, _add[1]);
    env = env.set(_add[0], addScheme);
    env = env.set(sum[0], inferExpr(env, sum[1]));

    const result = env.get("sum");
    if (!result) {
      throw new Error("sum is undefined");
    }

    expect(print(result)).toEqual("number");
  });

  test("((a, b) => a + b)(5)", () => {
    const add5: Binding = [
      "add5",
      sb.app(sb.lam(["a", "b"], sb.add(sb._var("a"), sb._var("b"))), [
        sb.num(5),
      ]),
    ];

    const env: Env = Map();
    const result = inferExpr(env, add5[1]);

    expect(print(result)).toEqual("(number) => number");
  });
});

describe("function subtyping", () => {
  test("extra args are allowed and ignored", () => {
    const _add: Binding = [
      "add",
      sb.lam(["a", "b"], sb.add(sb._var("a"), sb._var("b"))),
    ];
    const sum: Binding = [
      "sum",
      sb.app(sb._var("add"), [sb.num(5), sb.num(10), sb.num(99)]),
    ];

    let env: Env = Map();
    const addScheme = inferExpr(env, _add[1]);
    env = env.set(_add[0], addScheme);
    env = env.set(sum[0], inferExpr(env, sum[1]));
  });

  test("passing a callback with fewer params is allowed", () => {
    const ctx = tb.createCtx();
    const aVar = tb.tvar("a", ctx);
    const bVar = tb.tvar("b", ctx);

    const mapScheme = scheme(
      [aVar, bVar],
      tb.tfun(
        [
          tb.tcon("Array", [aVar], ctx),
          // Why is this TFun's `src` an "App"?
          tb.tfun([aVar, tb.tprim("number", ctx)], bVar, ctx, "App"),
        ],
        tb.tcon("Array", [bVar], ctx),
        ctx
      )
    );

    let env: Env = Map();
    env = env.set("map", mapScheme);

    const intArray = scheme(
      [],
      tb.tcon("Array", [tb.tprim("number", ctx)], ctx)
    );

    env = env.set("array", intArray);

    const call: Expr = {
      tag: "App",
      fn: sb._var("map"),
      args: [sb._var("array"), sb.lam(["x"], sb.eql(sb._var("x"), sb.num(0)))],
    };

    const result = inferExpr(env, call, ctx.state);

    expect(print(result)).toEqual("Array<boolean>");
  });

  test("partial application of a callback", () => {
    const ctx = tb.createCtx();
    const aVar = tb.tvar("a", ctx);
    const bVar = tb.tvar("b", ctx);

    const mapScheme = scheme(
      [aVar, bVar],
      tb.tfun(
        [
          tb.tcon("Array", [aVar], ctx),
          tb.tfun([aVar, tb.tprim("number", ctx)], bVar, ctx, "App"),
        ],
        tb.tcon("Array", [bVar], ctx),
        ctx
      )
    );

    let env: Env = Map();
    env = env.set("map", mapScheme);

    const intArray = scheme(
      [],
      tb.tcon("Array", [tb.tprim("number", ctx)], ctx)
    );

    env = env.set("array", intArray);

    const _add: Binding = [
      "add",
      sb.lam(["a", "b"], sb.add(sb._var("a"), sb._var("b"))),
    ];
    env = env.set(_add[0], inferExpr(env, _add[1]));

    const call: Expr = {
      tag: "App",
      fn: sb._var("map"),
      args: [
        sb._var("array"),
        sb.lam(["x"], sb.app(sb._var("add"), [sb._var("x")])),
      ],
    };

    const result = inferExpr(env, call, ctx.state);

    expect(print(result)).toEqual("Array<(number) => number>");
  });
});
