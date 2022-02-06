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
  TVar,
  TFunction,
  TInteger,
  TBool,
  TAny,
  TCon,
  Type,
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
        `"Type mismatch: bool != int"`
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
      expect(t.toString()).toEqual("(int * bool)");
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
      expect(t.toString()).toEqual("int");
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
      expect(t.toString()).toEqual("((int * int) * (bool * bool))");
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
});
