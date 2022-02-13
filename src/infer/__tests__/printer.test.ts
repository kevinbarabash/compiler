import * as b from "../builders";
import { print } from "../printer";

describe("print", () => {
  describe("TLit", () => {
    test("true", () => {
      const ast = b.tLit(b.lBool(true));
      expect(print(ast)).toEqual("true");
    });

    test("false", () => {
      const ast = b.tLit(b.lBool(false));
      expect(print(ast)).toEqual("false");
    });

    test("5", () => {
      const ast = b.tLit(b.lNum(5));
      expect(print(ast)).toEqual("5");
    });

    test('"hello"', () => {
      const ast = b.tLit(b.lStr("hello"));
      expect(print(ast)).toEqual('"hello"');
    });
  });

  test("TVar", () => {
    expect(print(b.tVar())).toEqual("a");
  });

  describe("TCon", () => {
    test("Promise<number>", () => {
      const ast = b.tCon("Promise", [b.tCon("number")]);
      expect(print(ast)).toEqual("Promise<number>");
    });
  });

  describe("TFun", () => {
    test("() => bool", () => {
      const ast = b.tFun([], b.tCon("bool"));
      expect(print(ast)).toEqual("() => bool");
    });

    test("(number) => number", () => {
      const num = b.tCon("number");
      const ast = b.tFun([b.tParam("", num)], num);
      expect(print(ast)).toEqual("(arg0: number) => number");
    });

    test("(string, string) => void", () => {
      const str = b.tCon("string");
      const ast = b.tFun(
        [b.tParam("", str), b.tParam("", str)],
        b.tCon("void")
      );
      expect(print(ast)).toEqual("(arg0: string, arg1: string) => void");
    });

    test("(foo: string, bar?: string) => void", () => {
      const str = b.tCon("string");
      const ast = b.tFun(
        [b.tParam("foo", str), b.tParam("bar", str, true)],
        b.tCon("void")
      );
      expect(print(ast)).toEqual("(foo: string, bar?: string) => void");
    });

    test("(a) => (b) => c", () => {
      const ast = b.tFun(
        [b.tParam("", b.tVar())],
        b.tFun([b.tParam("", b.tVar())], b.tVar())
      );
      expect(print(ast)).toEqual("(arg0: a) => (arg0: b) => c");
    });
  });

  describe("TRec", () => {
    test("{x: number, y?: number", () => {
      const num = b.tCon("number");
      const ast = b.tRec(b.tProp("x", num), b.tProp("y", num, true));
      expect(print(ast)).toEqual("{ x: number, y?: number }");
    });
  });

  describe("TUnion", () => {
    test("true | false", () => {
      const ast = b.tUnion(b.tLit(b.lBool(true)), b.tLit(b.lBool(false)));
      expect(print(ast)).toEqual("true | false");
    });

    test("(int) => void | (string) => void", () => {
      const ast = b.tUnion(
        b.tFun([b.tParam("", b.tCon("int"))], b.tCon("void")),
        b.tFun([b.tParam("", b.tCon("string"))], b.tCon("void"))
      );
      expect(print(ast)).toEqual(
        "((arg0: int) => void) | ((arg0: string) => void)"
      );
    });
  });
});
