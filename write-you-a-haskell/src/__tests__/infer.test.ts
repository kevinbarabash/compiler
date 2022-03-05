import { Map } from "immutable";

import { inferExpr } from "../infer";
import { Expr } from "../syntax";
import { Env, print, Scheme, Type, TVar, tInt } from "../type";

type Binding = [string, Expr];

const app = (fn: Expr, args: Expr[]): Expr => ({ tag: "App", fn, args });
const _if = (cond: Expr, th: Expr, el: Expr): Expr => ({
  tag: "If",
  cond,
  th,
  el,
});
const fix = (expr: Expr): Expr => ({ tag: "Fix", expr });
const lam = (args: string[], body: Expr): Expr => ({
  tag: "Lam",
  args,
  body,
});
const _let = (name: string, value: Expr, body: Expr): Expr => ({
  tag: "Let",
  name,
  value,
  body,
});
const _var = (name: string): Expr => ({ tag: "Var", name });

const int = (value: number): Expr => ({
  tag: "Lit",
  value: { tag: "LInt", value },
});
const bool = (value: boolean): Expr => ({
  tag: "Lit",
  value: { tag: "LBool", value },
});

const add = (left: Expr, right: Expr): Expr => ({
  tag: "Op",
  op: "Add",
  left,
  right,
});
const sub = (left: Expr, right: Expr): Expr => ({
  tag: "Op",
  op: "Sub",
  left,
  right,
});
const mul = (left: Expr, right: Expr): Expr => ({
  tag: "Op",
  op: "Mul",
  left,
  right,
});
const eql = (left: Expr, right: Expr): Expr => ({
  tag: "Op",
  op: "Eql",
  left,
  right,
});

const I: Binding = ["I", lam(["x"], _var("x"))];
const K: Binding = ["K", lam(["x"], lam(["y"], _var("x")))];
// let S = (f) => (g) => (x) => f(x)(g(x))
const S: Binding = [
  "S",
  lam(
    ["f"],
    lam(
      ["g"],
      lam(
        ["x"],
        app(app(_var("f"), [_var("x")]), [app(_var("g"), [_var("x")])])
      )
    )
  ),
];

const _const: Binding = ["const", lam(["x", "y"], _var("x"))];

describe("inferExpr", () => {
  describe("SKI cominbators", () => {
    test("let I x = x", () => {
      const env: Env = Map();
      const result = inferExpr(env, I[1]);

      expect(print(result)).toEqual("<a>(a) => a");
    });

    test("let K x y = x", () => {
      const env: Env = Map();
      const result = inferExpr(env, K[1]);

      expect(print(result)).toEqual("<a, b>(a) => (b) => a");
    });

    test("let S f g x = f x (g x)", () => {
      const env: Env = Map();
      const result = inferExpr(env, S[1]);

      expect(print(result)).toEqual(
        "<a, b, c>((a) => (b) => c) => ((a) => b) => (a) => c"
      );
    });

    test("SKK", () => {
      const skk: Binding = [
        "skk",
        app(app(_var("S"), [_var("K")]), [_var("K")]),
      ];

      let env: Env = Map();
      env = env.set(S[0], inferExpr(env, S[1]));
      env = env.set(K[0], inferExpr(env, K[1]));
      env = env.set(skk[0], inferExpr(env, skk[1]));

      const result = env.get("skk");
      if (!result) {
        throw new Error("skk is undefined");
      }

      expect(print(result)).toEqual("<a>(a) => a");
    });

    test("Mu f = f (fix f)", () => {
      const Mu: Binding = ["Mu", lam(["f"], app(_var("f"), [fix(_var("f"))]))];

      const env: Env = Map();
      const result = inferExpr(env, Mu[1]);

      expect(print(result)).toEqual("<a>((a) => a) => a");
    });
  });

  describe("Integer arithmetic", () => {
    test("let nsucc x = x + 1", () => {
      const nsucc: Binding = ["nsucc", lam(["x"], add(_var("x"), int(1)))];

      const env: Env = Map();
      const result = inferExpr(env, nsucc[1]);

      expect(print(result)).toEqual("(Int) => Int");
    });

    test("let npred x = x - 1", () => {
      const nsucc: Binding = ["nsucc", lam(["x"], add(_var("x"), int(1)))];

      const env: Env = Map();
      const result = inferExpr(env, nsucc[1]);

      expect(print(result)).toEqual("(Int) => Int");
    });
  });

  describe("Functions", () => {
    test("let rec fib = (n) => ...", () => {
      // letrecdecl takes
      // `let rec fib = (n) => ...`
      // and converts it to
      // `let fib = fix((fib) => (n) => ...)`
      const fib: Binding = [
        "fib",
        fix(
          lam(
            ["fib"],
            lam(
              ["n"],
              _if(
                eql(_var("n"), int(0)),
                // then
                int(0),
                // else
                _if(
                  eql(_var("n"), int(1)),
                  // then
                  int(1),
                  // else
                  add(
                    app(_var("fib"), [sub(_var("n"), int(1))]),
                    app(_var("fib"), [sub(_var("n"), int(2))])
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
        lam(
          ["y"],
          _let(
            "f",
            lam(["x"], _if(_var("x"), bool(true), bool(false))),
            app(_var("const"), [app(_var("f"), [_var("y")]), _var("y")])
          )
        ),
      ];
      // let id x = x;
      const id: Binding = ["id", lam(["x"], _var("x"))];
      // let foo x = let y = id x in y + 1;
      const foo: Binding = [
        "foo",
        lam(
          ["x"],
          _let("y", app(_var("id"), [_var("x")]), add(_var("y"), int(1)))
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
        lam(
          ["f"],
          lam(["g"], lam(["x"], app(_var("g"), [app(_var("f"), [_var("x")])])))
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
        lam(
          ["g", "f"],
          lam(
            ["x", "y"],
            app(_var("g"), [
              app(_var("f"), [_var("x")]),
              app(_var("f"), [_var("y")]),
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
        lam(["f", "x"], app(_var("f"), [app(_var("f"), [_var("x")])])),
      ];

      let env: Env = Map();
      const result = inferExpr(env, ap[1]);

      expect(print(result)).toEqual("<a>((a) => a, a) => a");
    });

    test("until (n-ary)", () => {
      const until: Binding = [
        "until",
        // let rec until p f x =
        fix(
          lam(
            ["until"],
            lam(
              ["p", "f", "x"],
              _if(
                //   if (p x)
                app(_var("p"), [_var("x")]),
                //   then x
                _var("x"),
                //   else (until p f (f x));
                app(_var("until"), [
                  _var("p"),
                  _var("f"),
                  app(_var("f"), [_var("x")]),
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
      const foo: Binding = ["foo", lam([], int(5))];

      let env: Env = Map();
      const result = inferExpr(env, foo[1]);

      expect(print(result)).toEqual("() => Int");
    });
  });

  describe("Let Polymorphism", () => {
    test("let poly = I (I I) (I 3);", () => {
      const poly: Binding = [
        "poly",
        app(app(I[1], [I[1]]), [app(I[1], [int(3)])]),
      ];

      let env: Env = Map();
      env = env.set(I[0], inferExpr(env, I[1]));
      env = env.set(poly[0], inferExpr(env, poly[1]));

      const result = env.get("poly");
      if (!result) {
        throw new Error("poly is undefined");
      }

      expect(print(result)).toEqual("Int");
    });

    test("let self = ((x) => x)((x) => x)", () => {
      const self: Binding = [
        "self",
        app(lam(["x"], _var("x")), [lam(["x"], _var("x"))]),
      ];

      const env: Env = Map();
      const result = inferExpr(env, self[1]);

      expect(print(result)).toEqual("<a>(a) => a");
    });

    test("let innerlet = (x) => (let y = (z) => z in y)", () => {
      const innerlet: Binding = [
        "innerlet",
        lam(["x"], _let("y", lam(["z"], _var("z")), _var("y"))),
      ];

      const env: Env = Map();
      const result = inferExpr(env, innerlet[1]);

      // the 'x' param is ignored
      expect(print(result)).toEqual("<a, b>(a) => (b) => b");
    });

    // The expression tree for `let rec` appears to be the same as that
    // for `let`.
    test.todo("let innerletrec = (x) => (let rec y = (z) => z in y)");

    test("let f = let add = (a, b) => a + b in add;", () => {
      const f: Binding = [
        "f",
        _let("add", lam(["a", "b"], add(_var("a"), _var("b"))), _var("add")),
      ];

      const env: Env = Map();
      const result = inferExpr(env, f[1]);

      expect(print(result)).toEqual("(Int, Int) => Int");
    });
  });

  describe("partial applicaiton", () => {
    test("add5 = add(5)", () => {
      const _add: Binding = ["add", lam(["a", "b"], add(_var("a"), _var("b")))];
      const add5: Binding = ["add5", app(_var("add"), [int(5)])];

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
      const _add: Binding = ["add", lam(["a", "b"], add(_var("a"), _var("b")))];
      const sum: Binding = ["sum", app(app(_var("add"), [int(5)]), [int(10)])];

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
        app(lam(["a", "b"], add(_var("a"), _var("b"))), [int(5)]),
      ];

      const env: Env = Map();
      const result = inferExpr(env, add5[1]);

      expect(print(result)).toEqual("(Int) => Int");
    });
  });

  describe("function subtyping", () => {
    test("extra args are allowed and ignored", () => {
      const _add: Binding = ["add", lam(["a", "b"], add(_var("a"), _var("b")))];
      const sum: Binding = ["sum", app(_var("add"), [int(5), int(10), int(99)])];

      let env: Env = Map();
      const addScheme = inferExpr(env, _add[1]);
      env = env.set(_add[0], addScheme);
      env = env.set(sum[0], inferExpr(env, sum[1]));
    });

    test("passing a callback with fewer params is allowed", () => {
      const aVar: Type = {tag: "TVar", name: "a"};
      const bVar: Type = {tag: "TVar", name: "b"};
      
      const mapScheme: Scheme = {
        tag: "Forall",
        qualifiers: [aVar, bVar],
        type: {
          tag: "TApp",
          args: [
            {tag: "TCon", name: "Array", params: [aVar]},
            {tag: "TApp", args: [aVar, tInt], ret: bVar, src: "App"},
          ],
          ret: {tag: "TCon", name: "Array", params: [bVar]},
        },
      };

      let env: Env = Map();
      env = env.set("map", mapScheme);

      const intArray: Scheme = {
        tag: "Forall",
        qualifiers: [],
        type: {tag: "TCon", name: "Array", params: [tInt]},
      };
      
      env = env.set("array", intArray);

      const call: Expr = {
        tag: "App",
        fn: _var("map"),
        args: [
          _var("array"),
          lam(["x"], eql(_var("x"), int(0))),
        ],
      };

      const result = inferExpr(env, call);

      expect(print(result)).toEqual("Array<Bool>")
    });

    test("partial application of a callback", () => {
      const aVar: Type = {tag: "TVar", name: "a"};
      const bVar: Type = {tag: "TVar", name: "b"};
      
      const mapScheme: Scheme = {
        tag: "Forall",
        qualifiers: [aVar, bVar],
        type: {
          tag: "TApp",
          args: [
            {tag: "TCon", name: "Array", params: [aVar]},
            {tag: "TApp", args: [aVar, tInt], ret: bVar, src: "App"},
          ],
          ret: {tag: "TCon", name: "Array", params: [bVar]},
        },
      };

      let env: Env = Map();
      env = env.set("map", mapScheme);

      const intArray: Scheme = {
        tag: "Forall",
        qualifiers: [],
        type: {tag: "TCon", name: "Array", params: [tInt]},
      };
      
      env = env.set("array", intArray);

      const _add: Binding = ["add", lam(["a", "b"], add(_var("a"), _var("b")))];
      env = env.set(_add[0], inferExpr(env, _add[1]));

      const call: Expr = {
        tag: "App",
        fn: _var("map"),
        args: [
          _var("array"),
          lam(["x"], app(_var("add"), [_var("x")])),
        ],
      };

      const result = inferExpr(env, call);

      expect(print(result)).toEqual("Array<(Int) => Int>")
    });
  });

  describe("Type Constructors", () => {
    test("infer promise type", () => {
      const aVar: TVar = { tag: "TVar", name: "a" };
      // <a>(a) => Promise<a>
      const promisifyScheme: Scheme = {
        tag: "Forall",
        qualifiers: [aVar],
        type: {
          tag: "TApp",
          args: [aVar],
          ret: { tag: "TCon", name: "Promise", params: [aVar] },
          src: "Lam",
        },
      };

      let env: Env = Map();

      env = env.set("promisify", promisifyScheme);
      const intCall: Binding = ["call", app(_var("promisify"), [int(5)])];
      const intResult = inferExpr(env, intCall[1]);
      expect(print(intResult)).toEqual("Promise<Int>");

      const boolCall: Binding = ["call", app(_var("promisify"), [bool(true)])];
      const boolResult = inferExpr(env, boolCall[1]);
      expect(print(boolResult)).toEqual("Promise<Bool>");
    });

    test("extract value from type constructor", () => {
      const aVar: TVar = { tag: "TVar", name: "a" };
      // <a>(Foo<a>) => a
      const extractScheme: Scheme = {
        tag: "Forall",
        qualifiers: [aVar],
        type: {
          tag: "TApp",
          args: [{ tag: "TCon", name: "Foo", params: [aVar] }],
          ret: aVar,
          src: "Lam",
        },
      };

      let env: Env = Map();

      env = env.set("extract", extractScheme);

      const addFoos = lam(
        ["x", "y"],
        add(
          app(_var("extract"), [_var("x")]),
          app(_var("extract"), [_var("y")])
        )
      );

      const result = inferExpr(env, addFoos);
      expect(print(result)).toEqual("(Foo<Int>, Foo<Int>) => Int");
    });

    test("extract value from type constructor 2", () => {
      const aVar: TVar = { tag: "TVar", name: "a" };
      // <a>(Foo<a>) => a
      const extractScheme: Scheme = {
        tag: "Forall",
        qualifiers: [aVar],
        type: {
          tag: "TApp",
          args: [{ tag: "TCon", name: "Foo", params: [aVar] }],
          ret: aVar,
          src: "Lam",
        },
      };

      let env: Env = Map();

      env = env.set("extract", extractScheme);
      // x is of type Foo<Int>
      env = env.set("x", {
        tag: "Forall",
        qualifiers: [],
        type: {
          tag: "TCon",
          name: "Foo",
          params: [{ tag: "TCon", name: "Int", params: [] }],
        },
      });

      const extractedX = app(_var("extract"), [_var("x")]);

      const result = inferExpr(env, extractedX);
      expect(print(result)).toEqual("Int");
    });
  });

  describe("Union types", () => {
    test("call function that returns a union type", () => {
      const aVar: TVar = {tag: "TVar", name: "a"};
      const bVar: TVar = {tag: "TVar", name: "b"};
      
      const retUnion: Scheme = {
        tag: "Forall",
        qualifiers: [aVar, bVar],
        type: {
          tag: "TApp",
          args: [aVar, bVar],
          ret: {tag: "TUnion", types: [aVar, bVar]},
        }
      };

      const call: Expr = {
        tag: "App",
        fn: _var("retUnion"),
        args: [int(5), bool(true)],
      };
      let env: Env = Map();

      env = env.set("retUnion", retUnion);

      const result0 = env.get("retUnion");
      if (!result0) {
        throw new Error("retUnion is undefined");
      }
      expect(print(result0)).toEqual("<a, b>(a, b) => a | b");

      const result1 = inferExpr(env, call);

      expect(print(result1)).toEqual("Int | Bool");

      const call2: Expr = {
        tag: "App",
        fn: _var("retUnion"),
        args: [bool(false), int(10)],
      };

      env = env.set("retUnion", retUnion);
      const result2 = inferExpr(env, call2);

      expect(print(result2)).toEqual("Bool | Int");
    });

    test("order of types in union doesn't matter", () => {
      
    });

    // TODO: need to
    // - change constraints to use IDs
    // - give all types IDs
    // - update unifies to generate union constraints
    test.skip("infer lambda with union return type", () => {
      const expr: Expr = lam(["x", "y"], 
        _if(
          _var("y"),
          app(_var("x"), [int(5)]),
          app(_var("x"), [bool(true)]),
        ),
      );

      const env: Env = Map();

      const result = inferExpr(env, expr);
      expect(print(result)).toEqual("Promise<Int>");
    });
  });

  describe("errors", () => {
    test("UnboundVariable", () => {
      const unbound: Binding = ["unbound", app(_var("foo"), [_var("x")])];

      const env: Env = Map();
      expect(() =>
        inferExpr(env, unbound[1])
      ).toThrowErrorMatchingInlineSnapshot(`"foo is unbound"`);
    });

    test("UnificationFail", () => {
      const fail: Binding = [
        "fail",
        lam(["foo"], add(bool(true), bool(false))),
      ];

      const env: Env = Map();

      expect(() => inferExpr(env, fail[1])).toThrowErrorMatchingInlineSnapshot(
        `"Couldn't unify Bool with Int"`
      );
    });

    test("InfiniteType", () => {
      const omega: Binding = ["omega", lam(["x"], app(_var("x"), [_var("x")]))];

      const env: Env = Map();

      expect(() => inferExpr(env, omega[1])).toThrowErrorMatchingInlineSnapshot(
        `"b appears in (b) => c"`
      );
    });
  });
});
