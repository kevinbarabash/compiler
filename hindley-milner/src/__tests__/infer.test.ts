import {
  Identifier,
  Apply,
  Lambda,
  Let,
  Letrec,
  Literal,
  Int,
  Bool,
} from "../ast";
import {
  freezeType,
  TVar,
  TFunction,
  TInteger,
  TBool,
  TAny,
  TCon,
  Type,
  TLit,
} from "../types";
import { analyze } from "../infer";

describe("#analyze", () => {
  const my_env = new Map<string, Type>();

  beforeEach(() => {
    // reset static variables between test cases
    TVar.nextVariableId = 0;
    TVar.nextVariableName = "a";

    const var1 = new TVar();
    const var2 = new TVar();
    const pair_type = new TCon("*", [var1, var2]);

    my_env.clear();

    // pair is curried
    my_env.set("pair", new TFunction([var1], new TFunction([var2], pair_type)));
    // tuple2 is the uncurried equivalent
    my_env.set("tuple2", new TFunction([var1, var2], pair_type));

    my_env.set(
      "cond",
      new TFunction([TBool], new TFunction([var1], new TFunction([var1], var1)))
    );
    my_env.set("zero", new TFunction([TInteger], TBool));
    my_env.set("pred", new TFunction([TInteger], TInteger));

    my_env.set(
      "times",
      new TFunction([TInteger], new TFunction([TInteger], TInteger))
    );
    // TODO: figure out how to implement constrained generics, e.g.
    // const foo: <T: number | string>(T, T) => T
    my_env.set("add", new TFunction([TInteger, TInteger], TInteger));

    // returns an empty array
    my_env.set("empty", new TFunction([], new TCon("[]", [TAny])));
  });

  describe("basic hindley-milner", () => {
    test("factorial", () => {
      // factorial
      const ast = new Letrec(
        "factorial", // letrec factorial =
        new Lambda(
          "n", // fn n =>
          new Apply(
            new Apply( // cond (zero n) 1
              new Apply(
                new Identifier("cond"), // cond (zero n)
                new Apply(new Identifier("zero"), new Identifier("n"))
              ),
              new Literal(new Int(1))
            ),
            new Apply( // times n
              new Apply(new Identifier("times"), new Identifier("n")),
              new Apply(
                new Identifier("factorial"),
                new Apply(new Identifier("pred"), new Identifier("n"))
              )
            )
          )
        ), // in
        new Apply(new Identifier("factorial"), new Literal(new Int(5)))
      );

      const t = analyze(ast, my_env);

      expect(ast.toString()).toEqual(
        "(letrec factorial = (fn n => (((cond (zero n)) 1) ((times n) (factorial (pred n))))) in (factorial 5))"
      );
      expect(t.toString()).toEqual("int");
    });

    test("fn x => (pair(x(3) (x(true))) should fail", () => {
      const ast = new Lambda(
        "x",
        new Apply(
          new Apply(
            new Identifier("pair"),
            new Apply(new Identifier("x"), new Literal(new Int(3)))
          ),
          new Apply(new Identifier("x"), new Literal(new Bool(true)))
        )
      );

      expect(ast.toString()).toEqual("(fn x => ((pair (x 3)) (x true)))");
      expect(() => analyze(ast, my_env)).toThrowErrorMatchingInlineSnapshot(
        `"Type mismatch: true != 3"`
      );
    });

    test("pair(f(4), f(true))", () => {
      const ast = new Apply(
        new Apply(
          new Identifier("pair"),
          new Apply(new Identifier("f"), new Literal(new Int(4)))
        ),
        new Apply(new Identifier("f"), new Literal(new Bool(true)))
      );

      expect(ast.toString()).toEqual("((pair (f 4)) (f true))");
      expect(() => analyze(ast, my_env)).toThrowErrorMatchingInlineSnapshot(
        `"Undefined symbol f"`
      );
    });

    test("let f = (fn x => x) in ((pair (f 4)) (f true))", () => {
      const pair = new Apply(
        new Apply(
          new Identifier("pair"),
          new Apply(new Identifier("f"), new Literal(new Int(4)))
        ),
        new Apply(new Identifier("f"), new Literal(new Bool(true)))
      );
      const ast = new Let("f", new Lambda("x", new Identifier("x")), pair);

      const t = analyze(ast, my_env);

      expect(ast.toString()).toEqual(
        "(let f = (fn x => x) in ((pair (f 4)) (f true)))"
      );
      expect(t.toString()).toEqual("(4 * true)");
    });

    test("(fn f => (f f))", () => {
      const ast = new Lambda(
        "f",
        new Apply(new Identifier("f"), new Identifier("f"))
      );

      expect(ast.toString()).toEqual("(fn f => (f f))");
      expect(() => analyze(ast, my_env)).toThrowErrorMatchingInlineSnapshot(
        `"recursive unification"`
      );
    });

    test("(let g = (fn f => 5) in (g g))", () => {
      // we can pass anything as the `f` param since it's ignored
      // the result of g(g) is an int is g always returns 5
      const ast = new Let(
        "g",
        new Lambda("f", new Literal(new Int(5))),
        new Apply(new Identifier("g"), new Identifier("g"))
      );

      const t = analyze(ast, my_env);

      expect(ast.toString()).toEqual("(let g = (fn f => 5) in (g g))");
      expect(t.toString()).toEqual("5");
    });

    test("(fn g => (let f = (fn x => g) in ((pair (f 3)) (f true))))", () => {
      const ast = new Lambda(
        "g",
        new Let(
          "f",
          new Lambda("x", new Identifier("g")),
          new Apply(
            new Apply(
              new Identifier("pair"),
              new Apply(new Identifier("f"), new Literal(new Int(3)))
            ),
            new Apply(new Identifier("f"), new Literal(new Bool(true)))
          )
        )
      );

      const t = analyze(ast, my_env);

      expect(ast.toString()).toEqual(
        "(fn g => (let f = (fn x => g) in ((pair (f 3)) (f true))))"
      );
      expect(t.toString()).toEqual("(a -> (a * a))");
    });

    test("(fn f => (fn g => (fn arg => (g (f arg)))))", () => {
      const ast = new Lambda(
        "f",
        new Lambda(
          "g",
          new Lambda(
            "arg",
            new Apply(
              new Identifier("g"),
              new Apply(new Identifier("f"), new Identifier("arg"))
            )
          )
        )
      );

      const t = analyze(ast, my_env);

      expect(ast.toString()).toEqual(
        "(fn f => (fn g => (fn arg => (g (f arg)))))"
      );
      expect(t.toString()).toEqual("((a -> b) -> ((b -> c) -> (a -> c)))");
    });

    test("(fn x => x)", () => {
      const ast = new Lambda("x", new Identifier("x"));

      const t = analyze(ast, my_env);

      expect(ast.toString()).toEqual("(fn x => x)");
      expect(t.toString()).toEqual("(a -> a)");
    });

    test("analyze() doesn't reuse type variables across calls", () => {
      const ast1 = new Lambda("x", new Identifier("x"));
      const t1 = analyze(ast1, my_env);
      const ast2 = new Lambda("x", new Identifier("x"));
      const t2 = analyze(ast2, my_env);

      expect(t1.toString()).toEqual("(a -> a)");
      expect(t2.toString()).toEqual("(b -> b)");
    });
  });

  describe("n-ary extensions", () => {
    test("fn x y => pair(x, y)", () => {
      const ast = new Lambda(
        ["x", "y"],
        new Apply(
          new Apply(new Identifier("pair"), new Identifier("x")),
          new Identifier("y")
        )
      );

      const t = analyze(ast, my_env);

      expect(ast.toString()).toEqual("(fn x y => ((pair x) y))");
      expect(t.toString()).toEqual("(a b -> (a * b))");
    });

    test("fn x y => add x y", () => {
      const ast = new Lambda(
        ["x", "y"],
        new Apply(new Identifier("add"), [
          new Identifier("x"),
          new Identifier("y"),
        ])
      );

      const t = analyze(ast, my_env);

      expect(ast.toString()).toEqual("(fn x y => (add x y))");
      expect(t.toString()).toEqual("(int int -> int)");
    });

    // partial application
    // This also tests that integer literals can be accepted wherever an
    // integer is expect.
    test("add 5", () => {
      const ast = new Apply(new Identifier("add"), [new Literal(new Int(5))]);

      const t = analyze(ast, my_env);

      expect(ast.toString()).toEqual("(add 5)");
      expect(t.toString()).toEqual("(int -> int)");
    });

    // ignore extra arguments, this is necessary to allow function subtyping
    test("fn x y => add x y 0", () => {
      const ast = new Lambda(
        ["x", "y"],
        new Apply(new Identifier("add"), [
          new Identifier("x"),
          new Identifier("y"),
          new Literal(new Int(0)),
        ])
      );

      const t = analyze(ast, my_env);

      expect(ast.toString()).toEqual("(fn x y => (add x y 0))");
      expect(t.toString()).toEqual("(int int -> int)");
    });

    test("(tuple2 (tuple2 5 10) (tuple2 true false))", () => {
      const ast = new Apply(new Identifier("tuple2"), [
        new Apply(new Identifier("tuple2"), [
          new Literal(new Int(5)),
          new Literal(new Int(10)),
        ]),
        new Apply(new Identifier("tuple2"), [
          new Literal(new Bool(true)),
          new Literal(new Bool(false)),
        ]),
      ]);

      const t = analyze(ast, my_env);

      expect(ast.toString()).toEqual(
        "(tuple2 (tuple2 5 10) (tuple2 true false))"
      );
      expect(t.toString()).toEqual("((5 * 10) * (true * false))");
    });

    test("(tuple2 (tuple2 a b) (tuple2 c d))", () => {
      const ast = new Lambda(
        ["a", "b", "c", "d"],
        new Apply(new Identifier("tuple2"), [
          new Apply(new Identifier("tuple2"), [
            new Identifier("a"),
            new Identifier("b"),
          ]),
          new Apply(new Identifier("tuple2"), [
            new Identifier("c"),
            new Identifier("d"),
          ]),
        ])
      );

      const t = analyze(ast, my_env);

      expect(ast.toString()).toEqual(
        "(fn a b c d => (tuple2 (tuple2 a b) (tuple2 c d)))"
      );
      expect(t.toString()).toEqual("(a b c d -> ((a * b) * (c * d)))");
    });

    // apply with no args
    test("(empty ())", () => {
      const ast = new Apply(new Identifier("empty"), []);

      const t = analyze(ast, my_env);

      expect(ast.toString()).toEqual("(empty )");
      expect(t.toString()).toEqual("[] any");
    });
  });

  describe("sub-typing", () => {
    // Using sub-typing to infer x's param is an int (3 ∈ TInteger, 5 ∈ TInteger)
    test("fn x => (pair(x(3) (x(5))) : ((int -> a) -> (a * a))", () => {
      const ast = new Lambda(
        "x",
        new Apply(
          new Apply(
            new Identifier("pair"),
            new Apply(new Identifier("x"), new Literal(new Int(3)))
          ),
          new Apply(new Identifier("x"), new Literal(new Int(5)))
        )
      );

      const t = analyze(ast, my_env);

      expect(ast.toString()).toEqual("(fn x => ((pair (x 3)) (x 5)))");
      expect(t.toString()).toEqual("((int -> a) -> (a * a))");
    });

    // Using sub-typing to infer x's param is a boolean (true | false)
    test("fn x => (pair(x(false) (x(true))) : ((bool -> a) -> (a * a))", () => {
      const ast = new Lambda(
        "x",
        new Apply(
          new Apply(
            new Identifier("pair"),
            new Apply(new Identifier("x"), new Literal(new Bool(false)))
          ),
          new Apply(new Identifier("x"), new Literal(new Bool(true)))
        )
      );

      const t = analyze(ast, my_env);

      expect(ast.toString()).toEqual("(fn x => ((pair (x false)) (x true)))");
      expect(t.toString()).toEqual("((bool -> a) -> (a * a))");
    });

    // Doesn't widen type construtors
    // add : int -> int
    test("(add 3 true) fails", () => {
      const ast = new Apply(new Identifier("add"), [
        new Literal(new Int(3)),
        new Literal(new Bool(true)),
      ]);

      expect(() => analyze(ast, my_env)).toThrowErrorMatchingInlineSnapshot(
        `"Type mismatch: true is not a subtype of int"`
      );
    });

    // Doesn't widen frozen type literals for functions already typed
    // Here we try to pass `10` to a function that only accepts `5`
    test("let _ = (foo5 10) in foo5", () => {
      const lit5 = new Literal(new Int(5));
      const fiveToInt = new TFunction([new TLit(lit5)], TInteger);
      my_env.set("foo5", fiveToInt);

      // Once the type of `foo5` has been defined, we need to freeze
      // it to prevent widening of any of its types.  If we try to
      // widen a frozen type during unification, a error will be thrown.
      freezeType(fiveToInt);

      const ast = new Let(
        "_",
        new Apply(new Identifier("foo5"), [new Literal(new Int(10))]),
        new Identifier("foo5")
      );

      expect(ast.toString()).toEqual("(let _ = (foo5 10) in foo5)");

      expect(() => analyze(ast, my_env)).toThrowErrorMatchingInlineSnapshot(
        `"Type mismatch: 10 != 5"`
      );
    });

    test("(int -> int)(true) should fail", () => {
      const intToInt = new TFunction([TInteger], TInteger);
      my_env.set("foo", intToInt);

      const ast = new Apply(new Identifier("foo"), [
        new Literal(new Bool(true)),
      ]);

      expect(() => analyze(ast, my_env)).toThrowErrorMatchingInlineSnapshot(
        `"Type mismatch: true is not a subtype of int"`
      );
    });

    // Infers literal return types
    test("(fn x => 5) : a -> 5", () => {
      const ast = new Lambda(["x"], new Literal(new Int(5)));

      const t = analyze(ast, my_env);

      expect(t.toString()).toEqual("(a -> 5)");
    });

    // Doesn't expand the return type when calling a function
    test("(let five = (fn x => 5) in (let sum = (add (five true) 10) in five)) : a -> 5", () => {
      const ast = new Let(
        "five",
        new Lambda(["x"], new Literal(new Int(5))),
        new Let(
          "sum",
          new Apply(new Identifier("add"), [
            new Apply(new Identifier("five"), [new Literal(new Bool(true))]),
            new Literal(new Int(10)),
          ]),
          new Identifier("five")
        )
      );

      const t = analyze(ast, my_env);

      expect(ast.toString()).toEqual(
        "(let five = (fn x => 5) in (let sum = (add (five true) 10) in five))"
      );
      expect(t.toString()).toEqual("(a -> 5)");
    });

    // function sub-typing
    // if foo accepts a callback of `(a, int) -> b` and then we pass it a function
    // of type `(a) -> b` then it should accept it
    test.todo("function sub-typing");

    // Adapt the following example:
    // a : boolean
    // b : int
    // test("fn x => (pair(x(a) (x(b))) : ((int | boolean -> a) -> (a * a))", () => {
    test.todo("widening of `int` and `bool` to `int | bool`");
  });
});
