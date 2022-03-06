import { Map } from "immutable";

import { inferExpr } from "../infer";
import { Expr } from "../syntax-types";
import { Env, print, Scheme, Type, tInt } from "../type";
import * as b from "../syntax-builders";

type Binding = [string, Expr];

const _const: Binding = ["const", b.lam(["x", "y"], b._var("x"))];

describe("Functions", () => {
  test("let rec fib = (n) => ...", () => {
    // letrecdecl takes
    // `let rec fib = (n) => ...`
    // and converts it to
    // `let fib = fix((fib) => (n) => ...)`
    const fib: Binding = [
      "fib",
      b.fix(
        b.lam(
          ["fib"],
          b.lam(
            ["n"],
            b._if(
              b.eql(b._var("n"), b.int(0)),
              // then
              b.int(0),
              // else
              b._if(
                b.eql(b._var("n"), b.int(1)),
                // then
                b.int(1),
                // else
                b.add(
                  b.app(b._var("fib"), [b.sub(b._var("n"), b.int(1))]),
                  b.app(b._var("fib"), [b.sub(b._var("n"), b.int(2))])
                )
              )
            )
          )
        )
      ),
    ];

    const env: Env = Map();
    const result = inferExpr(env, fib[1]);

    expect(print(result)).toEqual("(Int) => Int");
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
      b.lam(
        ["y"],
        b._let(
          "f",
          b.lam(["x"], b._if(b._var("x"), b.bool(true), b.bool(false))),
          b.app(b._var("const"), [
            b.app(b._var("f"), [b._var("y")]),
            b._var("y"),
          ])
        )
      ),
    ];
    // let id x = x;
    const id: Binding = ["id", b.lam(["x"], b._var("x"))];
    // let foo x = let y = id x in y + 1;
    const foo: Binding = [
      "foo",
      b.lam(
        ["x"],
        b._let(
          "y",
          b.app(b._var("id"), [b._var("x")]),
          b.add(b._var("y"), b.int(1))
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

    expect(print(fooType)).toEqual("(Int) => Int");

    const yType = env.get("y");
    if (!yType) {
      throw new Error("y is undefined");
    }

    expect(print(yType)).toEqual("(Bool) => Bool");
  });

  test("let compose = (f) => (g) => (x) => g(f(x))", () => {
    // compose f g x == g (f x)
    const compose: Binding = [
      "compose",
      b.lam(
        ["f"],
        b.lam(
          ["g"],
          b.lam(["x"], b.app(b._var("g"), [b.app(b._var("f"), [b._var("x")])]))
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
      b.lam(
        ["g", "f"],
        b.lam(
          ["x", "y"],
          b.app(b._var("g"), [
            b.app(b._var("f"), [b._var("x")]),
            b.app(b._var("f"), [b._var("y")]),
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
      b.lam(
        ["f", "x"],
        b.app(b._var("f"), [b.app(b._var("f"), [b._var("x")])])
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
      b.fix(
        b.lam(
          ["until"],
          b.lam(
            ["p", "f", "x"],
            b._if(
              //   if (p x)
              b.app(b._var("p"), [b._var("x")]),
              //   then x
              b._var("x"),
              //   else (until p f (f x));
              b.app(b._var("until"), [
                b._var("p"),
                b._var("f"),
                b.app(b._var("f"), [b._var("x")]),
              ])
            )
          )
        )
      ),
    ];

    let env: Env = Map();
    const result = inferExpr(env, until[1]);

    expect(print(result)).toEqual("<a>((a) => Bool, (a) => a, a) => a");
  });

  test("no args", () => {
    const foo: Binding = ["foo", b.lam([], b.int(5))];

    let env: Env = Map();
    const result = inferExpr(env, foo[1]);

    expect(print(result)).toEqual("() => Int");
  });
});

describe("partial applicaiton", () => {
  test("add5 = add(5)", () => {
    const _add: Binding = [
      "add",
      b.lam(["a", "b"], b.add(b._var("a"), b._var("b"))),
    ];
    const add5: Binding = ["add5", b.app(b._var("add"), [b.int(5)])];

    let env: Env = Map();
    const addScheme = inferExpr(env, _add[1]);
    env = env.set(_add[0], addScheme);
    env = env.set(add5[0], inferExpr(env, add5[1]));

    const result = env.get("add5");
    if (!result) {
      throw new Error("add5 is undefined");
    }

    expect(print(result)).toEqual("(Int) => Int");
  });

  test("let sum = add(5)(10)", () => {
    const _add: Binding = [
      "add",
      b.lam(["a", "b"], b.add(b._var("a"), b._var("b"))),
    ];
    const sum: Binding = [
      "sum",
      b.app(b.app(b._var("add"), [b.int(5)]), [b.int(10)]),
    ];

    let env: Env = Map();
    const addScheme = inferExpr(env, _add[1]);
    env = env.set(_add[0], addScheme);
    env = env.set(sum[0], inferExpr(env, sum[1]));

    const result = env.get("sum");
    if (!result) {
      throw new Error("sum is undefined");
    }

    expect(print(result)).toEqual("Int");
  });

  test("((a, b) => a + b)(5)", () => {
    const add5: Binding = [
      "add5",
      b.app(b.lam(["a", "b"], b.add(b._var("a"), b._var("b"))), [b.int(5)]),
    ];

    const env: Env = Map();
    const result = inferExpr(env, add5[1]);

    expect(print(result)).toEqual("(Int) => Int");
  });
});

describe("function subtyping", () => {
  test("extra args are allowed and ignored", () => {
    const _add: Binding = [
      "add",
      b.lam(["a", "b"], b.add(b._var("a"), b._var("b"))),
    ];
    const sum: Binding = [
      "sum",
      b.app(b._var("add"), [b.int(5), b.int(10), b.int(99)]),
    ];

    let env: Env = Map();
    const addScheme = inferExpr(env, _add[1]);
    env = env.set(_add[0], addScheme);
    env = env.set(sum[0], inferExpr(env, sum[1]));
  });

  test("passing a callback with fewer params is allowed", () => {
    const aVar: Type = { tag: "TVar", id: 0, name: "a" };
    const bVar: Type = { tag: "TVar", id: 1, name: "b" };

    const mapScheme: Scheme = {
      tag: "Forall",
      qualifiers: [aVar, bVar],
      type: {
        tag: "TFun",
        args: [
          { tag: "TCon", id: 2, name: "Array", params: [aVar] },
          { tag: "TFun", args: [aVar, tInt], ret: bVar, src: "App" },
        ],
        ret: { tag: "TCon", id: 3, name: "Array", params: [bVar] },
      },
    };

    let env: Env = Map();
    env = env.set("map", mapScheme);

    const intArray: Scheme = {
      tag: "Forall",
      qualifiers: [],
      type: { tag: "TCon", id: 4, name: "Array", params: [tInt] },
    };

    env = env.set("array", intArray);

    const call: Expr = {
      tag: "App",
      fn: b._var("map"),
      args: [b._var("array"), b.lam(["x"], b.eql(b._var("x"), b.int(0)))],
    };

    const result = inferExpr(env, call, { count: 5 });

    expect(print(result)).toEqual("Array<Bool>");
  });

  test("partial application of a callback", () => {
    const aVar: Type = { tag: "TVar", id: 0, name: "a" };
    const bVar: Type = { tag: "TVar", id: 1, name: "b" };

    const mapScheme: Scheme = {
      tag: "Forall",
      qualifiers: [aVar, bVar],
      type: {
        tag: "TFun",
        args: [
          { tag: "TCon", id: 3, name: "Array", params: [aVar] },
          { tag: "TFun", args: [aVar, tInt], ret: bVar, src: "App" },
        ],
        ret: { tag: "TCon", id: 4, name: "Array", params: [bVar] },
      },
    };

    let env: Env = Map();
    env = env.set("map", mapScheme);

    const intArray: Scheme = {
      tag: "Forall",
      qualifiers: [],
      type: { tag: "TCon", id: 5, name: "Array", params: [tInt] },
    };

    env = env.set("array", intArray);

    const _add: Binding = [
      "add",
      b.lam(["a", "b"], b.add(b._var("a"), b._var("b"))),
    ];
    env = env.set(_add[0], inferExpr(env, _add[1]));

    const call: Expr = {
      tag: "App",
      fn: b._var("map"),
      args: [
        b._var("array"),
        b.lam(["x"], b.app(b._var("add"), [b._var("x")])),
      ],
    };

    const result = inferExpr(env, call, { count: 6 });

    expect(print(result)).toEqual("Array<(Int) => Int>");
  });
});
