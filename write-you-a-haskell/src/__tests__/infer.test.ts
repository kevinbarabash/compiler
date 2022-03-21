import { Expr } from "../syntax-types";
import { print, scheme } from "../type-types";
import * as sb from "../syntax-builders";
import { Engine } from "../engine";

type Binding = [string, Expr];

const I: Binding = ["I", sb.lam(["x"], sb._var("x"))];
const K: Binding = ["K", sb.lam(["x"], sb.lam(["y"], sb._var("x")))];
// let S = (f) => (g) => (x) => f(x)(g(x))
const S: Binding = [
  "S",
  sb.lam(
    ["f"],
    sb.lam(
      ["g"],
      sb.lam(
        ["x"],
        sb.app(sb.app(sb._var("f"), [sb._var("x")]), [
          sb.app(sb._var("g"), [sb._var("x")]),
        ])
      )
    )
  ),
];

describe("inferExpr", () => {
  describe("SKI cominbators", () => {
    test("let I x = x", () => {
      const eng = new Engine();
      const result = eng.inferExpr(I[1]);

      expect(print(result)).toEqual("<a>(a) => a");
    });

    test("let K x y = x", () => {
      const eng = new Engine();
      const result = eng.inferExpr(K[1]);

      expect(print(result)).toEqual("<a, b>(a) => (b) => a");
    });

    test("let S f g x = f x (g x)", () => {
      const eng = new Engine();
      const result = eng.inferExpr(S[1]);

      expect(print(result)).toEqual(
        "<a, b, c>((a) => (b) => c) => ((a) => b) => (a) => c"
      );
    });

    test("SKK", () => {
      const eng = new Engine();
      const skk: Binding = [
        "skk",
        sb.app(sb.app(sb._var("S"), [sb._var("K")]), [sb._var("K")]),
      ];

      eng.inferDecl(S[0], S[1]);
      eng.inferDecl(K[0], K[1]);
      const result = eng.inferDecl(skk[0], skk[1]);

      expect(print(result)).toEqual("<a>(a) => a");
    });

    test("Mu f = f (fix f)", () => {
      const eng = new Engine();
      const Mu: Binding = [
        "Mu",
        sb.lam(["f"], sb.app(sb._var("f"), [sb.fix(sb._var("f"))])),
      ];

      const result = eng.inferExpr(Mu[1]);

      expect(print(result)).toEqual("<a>((a) => a) => a");
    });
  });

  describe("Integer arithmetic", () => {
    test("let nsucc x = x + 1", () => {
      const eng = new Engine();
      const nsucc: Binding = [
        "nsucc",
        sb.lam(["x"], sb.add(sb._var("x"), sb.num(1))),
      ];

      const result = eng.inferExpr(nsucc[1]);

      expect(print(result)).toEqual("(number) => number");
    });

    test("let npred x = x - 1", () => {
      const eng = new Engine();
      const nsucc: Binding = [
        "nsucc",
        sb.lam(["x"], sb.add(sb._var("x"), sb.num(1))),
      ];

      const result = eng.inferExpr(nsucc[1]);

      expect(print(result)).toEqual("(number) => number");
    });
  });

  describe("Let Polymorphism", () => {
    test("let poly = I (I I) (I 3);", () => {
      const eng = new Engine();
      const poly: Binding = [
        "poly",
        sb.app(sb.app(I[1], [I[1]]), [sb.app(I[1], [sb.num(3)])]),
      ];

      eng.inferDecl(I[0], I[1]);
      const result = eng.inferDecl(poly[0], poly[1]);

      expect(print(result)).toEqual("3");
    });

    test("let self = ((x) => x)((x) => x)", () => {
      const eng = new Engine();
      const self: Binding = [
        "self",
        sb.app(sb.lam(["x"], sb._var("x")), [sb.lam(["x"], sb._var("x"))]),
      ];

      const result = eng.inferExpr(self[1]);

      expect(print(result)).toEqual("<a>(a) => a");
    });

    test("let innerlet = (x) => (let y = (z) => z in y)", () => {
      const eng = new Engine();
      const innerlet: Binding = [
        "innerlet",
        sb.lam(["x"], sb._let("y", sb.lam(["z"], sb._var("z")), sb._var("y"))),
      ];

      const result = eng.inferExpr(innerlet[1]);

      // the 'x' param is ignored
      expect(print(result)).toEqual("<a, b>(a) => (b) => b");
    });

    // The expression tree for `let rec` appears to be the same as that
    // for `let`.
    test.todo("let innerletrec = (x) => (let rec y = (z) => z in y)");

    test("let f = let add = (a, b) => a + b in add;", () => {
      const eng = new Engine();
      const f: Binding = [
        "f",
        sb._let(
          "add",
          sb.lam(["a", "b"], sb.add(sb._var("a"), sb._var("b"))),
          sb._var("add")
        ),
      ];

      const result = eng.inferExpr(f[1]);

      expect(print(result)).toEqual("(number, number) => number");
    });
  });

  describe("Type Constructors", () => {
    test("infer promise type", () => {
      const eng = new Engine();
      const aVar = eng.tvar("a");
      // <a>(a) => Promise<a>
      const promisifyScheme = scheme(
        [aVar],
        eng.tfun([aVar], eng.tcon("Promise", [aVar]))
      );

      eng.defScheme("promisify", promisifyScheme);
      const intCall: Binding = [
        "call",
        sb.app(sb._var("promisify"), [sb.num(5)]),
      ];
      const intResult = eng.inferExpr(intCall[1]);
      expect(print(intResult)).toEqual("Promise<5>");

      const boolCall: Binding = [
        "call",
        sb.app(sb._var("promisify"), [sb.bool(true)]),
      ];
      const boolResult = eng.inferExpr(boolCall[1]);
      expect(print(boolResult)).toEqual("Promise<true>");
    });

    test("extract value from type constructor", () => {
      const eng = new Engine();
      const aVar = eng.tvar("a");
      // <a>(Foo<a>) => a
      const extractScheme = scheme(
        [aVar],
        eng.tfun([eng.tcon("Foo", [aVar])], aVar)
      );

      eng.defScheme("extract", extractScheme);

      const addFoos = sb.lam(
        ["x", "y"],
        sb.add(
          sb.app(sb._var("extract"), [sb._var("x")]),
          sb.app(sb._var("extract"), [sb._var("y")])
        )
      );

      const result = eng.inferExpr(addFoos);
      expect(print(result)).toEqual("(Foo<number>, Foo<number>) => number");
    });

    test("extract value from type constructor 2", () => {
      const eng = new Engine();
      const aVar = eng.tvar("a");
      // <a>(Foo<a>) => a
      const extractScheme = scheme(
        [aVar],
        eng.tfun([eng.tcon("Foo", [aVar])], aVar)
      );

      eng.defScheme("extract", extractScheme);
      // x is of type Foo<number>
      eng.defType("x", {
        tag: "TCon",
        id: 3,
        name: "Foo",
        params: [{ tag: "TCon", id: 4, name: "number", params: [] }],
      });

      const extractedX = sb.app(sb._var("extract"), [sb._var("x")]);

      const result = eng.inferExpr(extractedX);
      expect(print(result)).toEqual("number");
    });
  });

  describe("errors", () => {
    test("UnboundVariable", () => {
      const eng = new Engine();
      const unbound: Binding = [
        "unbound",
        sb.app(sb._var("foo"), [sb._var("x")]),
      ];

      expect(() =>
        eng.inferExpr(unbound[1])
      ).toThrowErrorMatchingInlineSnapshot(`"foo is unbound"`);
    });

    test("UnificationFail", () => {
      const eng = new Engine();
      const _add: Binding = [
        "add",
        sb.lam(["a", "b"], sb.add(sb._var("a"), sb._var("b"))),
      ];
      const expr: Expr = sb.app(sb._var("add"), [sb.num(5), sb.bool(true)]);

      eng.inferDecl(_add[0], _add[1]);

      // TODO: improve this error so that it says something like:
      // Can't pass `true` where the `+` operator expects a `number`
      expect(() => eng.inferExpr(expr)).toThrowErrorMatchingInlineSnapshot(
        `"true is not a subtype of number"`
      );
    });

    test("InfiniteType", () => {
      const eng = new Engine();
      const omega: Binding = [
        "omega",
        sb.lam(["x"], sb.app(sb._var("x"), [sb._var("x")])),
      ];

      expect(() => eng.inferExpr(omega[1])).toThrowErrorMatchingInlineSnapshot(
        `"a appears in (a) => b"`
      );
    });
  });
});
