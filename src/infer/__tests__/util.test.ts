import * as b from "../builders";
import * as builtins from "../builtins";
import { equal, isSubtypeOf, flatten } from "../util";
import { print } from "../printer";

describe("equal", () => {
  test("string literals", () => {
    const x = b.tStr("hello");
    const y = b.tStr("hello");
    expect(equal(x, y)).toBe(true);

    const z = b.tStr("goodbye");
    expect(equal(x, z)).toBe(false);
  });

  test("number literals", () => {
    const x = b.tNum(5);
    const y = b.tNum(5);
    expect(equal(x, y)).toBe(true);

    const z = b.tNum(10);
    expect(equal(x, z)).toBe(false);
  });

  test("boolean literals", () => {
    const x = b.tBool(false);
    const y = b.tBool(false);
    expect(equal(x, y)).toBe(true);

    const z = b.tBool(true);
    expect(equal(x, z)).toBe(false);
  });

  describe("type constructors", () => {
    test("foo<a>", () => {
      const a = b.tVar();
      const x = b.tCon("foo", [a]);
      const y = b.tCon("foo", [a]);
      expect(equal(x, y)).toBe(true);
    });

    test("foo<number>", () => {
      const x = b.tCon("foo", [builtins.tNumber]);
      const y = b.tCon("foo", [builtins.tNumber]);
      expect(equal(x, y)).toBe(true);
    });

    test("foo<5>", () => {
      const a = b.tNum(5);
      const x = b.tCon("foo", [a]);
      const y = b.tCon("foo", [a]);
      expect(equal(x, y)).toBe(true);
    });

    test("foo<number> != foo<string>", () => {
      const x = b.tCon("foo", [builtins.tNumber]);
      const y = b.tCon("foo", [builtins.tString]);
      expect(equal(x, y)).toBe(false);
    });

    test("foo<a> != foo<a, b>", () => {
      const a = b.tVar();
      const x = b.tCon("foo", [a]);
      const y = b.tCon("foo", [a, b.tVar()]);
      expect(equal(x, y)).toBe(false);
    });
  });

  describe("function types", () => {
    test("() => number", () => {
      const f1 = b.tFun([], builtins.tNumber);
      const f2 = b.tFun([], builtins.tNumber);
      expect(equal(f1, f2)).toBe(true);
    });

    test("(number, string) => void", () => {
      const f1 = b.tFun(
        [b.tParam("", builtins.tNumber), b.tParam("", builtins.tString)],
        builtins.tUndefined
      );
      const f2 = b.tFun(
        [b.tParam("", builtins.tNumber), b.tParam("", builtins.tString)],
        builtins.tUndefined
      );
      expect(equal(f1, f2)).toBe(true);
    });

    test("differences in param names are ignored", () => {
      const f1 = b.tFun(
        [b.tParam("foo", builtins.tNumber), b.tParam("bar", builtins.tString)],
        builtins.tUndefined
      );
      const f2 = b.tFun(
        [b.tParam("x", builtins.tNumber), b.tParam("y", builtins.tString)],
        builtins.tUndefined
      );
      expect(equal(f1, f2)).toBe(true);
    });

    test("different number of params", () => {
      const f1 = b.tFun(
        [b.tParam("", builtins.tNumber), b.tParam("", builtins.tString)],
        builtins.tUndefined
      );
      const f2 = b.tFun([b.tParam("", builtins.tNumber)], builtins.tUndefined);
      expect(equal(f1, f2)).toBe(false);
    });

    test("different return types", () => {
      const f1 = b.tFun(
        [b.tParam("", builtins.tNumber), b.tParam("", builtins.tString)],
        builtins.tUndefined
      );
      const f2 = b.tFun(
        [b.tParam("", builtins.tNumber), b.tParam("", builtins.tString)],
        builtins.tBoolean
      );
      expect(equal(f1, f2)).toBe(false);
    });

    test("different param types", () => {
      const f1 = b.tFun(
        [b.tParam("", builtins.tNumber), b.tParam("", builtins.tString)],
        builtins.tUndefined
      );
      const f2 = b.tFun(
        [b.tParam("", builtins.tNumber), b.tParam("", builtins.tBoolean)],
        builtins.tUndefined
      );
      expect(equal(f1, f2)).toBe(false);
    });

    test("optional params are the same as `T | undefined`", () => {
      const f1 = b.tFun(
        [b.tParam("", builtins.tNumber), b.tParam("", builtins.tString, true)],
        builtins.tUndefined
      );
      const f2 = b.tFun(
        [
          b.tParam("", builtins.tNumber),
          b.tParam("", b.tUnion(builtins.tString, builtins.tUndefined)),
        ],
        builtins.tUndefined
      );
      expect(equal(f1, f2)).toBe(true);
    });
  });

  describe("Record types", () => {
    test("same", () => {
      const r1 = b.tRec(
        b.tProp("x", builtins.tNumber),
        b.tProp("y", builtins.tString, true)
      );
      const r2 = b.tRec(
        b.tProp("x", builtins.tNumber),
        b.tProp("y", builtins.tString, true)
      );
      expect(equal(r1, r2)).toBe(true);
    });

    test("different optionality", () => {
      const r1 = b.tRec(
        b.tProp("x", builtins.tNumber),
        b.tProp("y", builtins.tString, true)
      );
      const r2 = b.tRec(
        b.tProp("x", builtins.tNumber),
        b.tProp("y", builtins.tString)
      );
      expect(equal(r1, r2)).toBe(false);
    });

    test("different property type", () => {
      const r1 = b.tRec(
        b.tProp("x", builtins.tNumber),
        b.tProp("y", builtins.tString, true)
      );
      const r2 = b.tRec(
        b.tProp("x", builtins.tNumber),
        b.tProp("y", builtins.tBoolean, true)
      );
      expect(equal(r1, r2)).toBe(false);
    });

    test("different property name", () => {
      const r1 = b.tRec(
        b.tProp("x", builtins.tNumber),
        b.tProp("y", builtins.tString, true)
      );
      const r2 = b.tRec(
        b.tProp("x", builtins.tNumber),
        b.tProp("z", builtins.tString, true)
      );
      expect(equal(r1, r2)).toBe(false);
    });

    test("optional is the same a `T | undefined`", () => {
      const r1 = b.tRec(
        b.tProp("x", builtins.tNumber),
        b.tProp("y", b.tUnion(builtins.tString, builtins.tUndefined))
      );
      const r2 = b.tRec(
        b.tProp("x", builtins.tNumber),
        b.tProp("y", builtins.tString, true)
      );
      // All tests should test both others to ensure that equal is
      // commutative
      expect(equal(r1, r2)).toBe(true);
      // expect(equal(r2, r2)).toBe(true);
    });
  });

  describe("type constructors", () => {
    test("same", () => {
      const t1 = b.tCon("Foo", [builtins.tNumber]);
      const t2 = b.tCon("Foo", [builtins.tNumber]);
      expect(equal(t1, t2)).toBe(true);
    });
  });

  test("different type of type", () => {
    const t1 = builtins.tNumber;
    const t2 = b.tFun([], builtins.tNumber);
    expect(equal(t1, t2)).toBe(false);
  });
});

describe("isSubtypeOf", () => {
  describe("literal subtyping", () => {
    test("5 is a subtype of itself", () => {
      const result = isSubtypeOf(b.tNum(5), b.tNum(5));
      expect(result).toBe(true);
    });

    test("5 is a subtype of number", () => {
      const result = isSubtypeOf(b.tNum(5), builtins.tNumber);
      expect(result).toBe(true);
    });

    test("5 is not a subtype of string", () => {
      const result = isSubtypeOf(b.tNum(5), builtins.tString);
      expect(result).toBe(false);
    });

    test("true is a subtype of boolean", () => {
      const result = isSubtypeOf(b.tBool(true), builtins.tBoolean);
      expect(result).toBe(true);
    });

    test("false is a subtype of boolean", () => {
      const result = isSubtypeOf(b.tBool(false), builtins.tBoolean);
      expect(result).toBe(true);
    });

    test("'hello' is a subtype of string", () => {
      const result = isSubtypeOf(b.tStr("hello"), builtins.tString);
      expect(result).toBe(true);
    });

    test("5 is a subtype of 5 | 10", () => {
      const t1 = b.tNum(5);
      const t2 = b.tUnion(b.tNum(5), b.tNum(10));
      const result = isSubtypeOf(t1, t2);
      expect(result).toBe(true);
    });

    test("5 | 10 is a subtype of 5 | 10", () => {
      const t1 = b.tUnion(b.tNum(5), b.tNum(10));
      const t2 = b.tUnion(b.tNum(5), b.tNum(10));
      const result = isSubtypeOf(t1, t2);
      expect(result).toBe(true);
    });

    test("5 is a subtype of number | string", () => {
      const t1 = b.tNum(5);
      const t2 = b.tUnion(builtins.tNumber, builtins.tString);
      const result = isSubtypeOf(t1, t2);
      expect(result).toBe(true);
    });

    test("5 is not a subtype of 0 | 1", () => {
      const t1 = b.tNum(5);
      const t2 = b.tUnion(b.tNum(0), b.tNum(1));
      const result = isSubtypeOf(t1, t2);
      expect(result).toBe(false);
    });
  });

  describe("record subtyping", () => {
    test("same", () => {
      const r1 = b.tRec(
        b.tProp("x", builtins.tNumber),
        b.tProp("y", builtins.tString, true)
      );
      const r2 = b.tRec(
        b.tProp("x", builtins.tNumber),
        b.tProp("y", builtins.tString, true)
      );
      const result = isSubtypeOf(r1, r2);
      expect(result).toBe(true);
    });

    test("the subtype can have extra fields", () => {
      const r1 = b.tRec(
        b.tProp("x", builtins.tNumber),
        b.tProp("y", builtins.tString, true),
        b.tProp("z", builtins.tBoolean)
      );
      const r2 = b.tRec(
        b.tProp("x", builtins.tNumber),
        b.tProp("y", builtins.tString, true)
      );
      const result = isSubtypeOf(r1, r2);
      expect(result).toBe(true);
    });

    test("optional property isn't a subtype of a non-optional one", () => {
      const r1 = b.tRec(
        b.tProp("x", builtins.tNumber),
        b.tProp("y", builtins.tString, true)
      );
      const r2 = b.tRec(
        b.tProp("x", builtins.tNumber),
        b.tProp("y", builtins.tString)
      );
      const result = isSubtypeOf(r1, r2);
      expect(result).toBe(false);
    });

    test("non-optional property is a subtype of a optional one", () => {
      const r1 = b.tRec(
        b.tProp("x", builtins.tNumber),
        b.tProp("y", builtins.tString)
      );
      const r2 = b.tRec(
        b.tProp("x", builtins.tNumber),
        b.tProp("y", builtins.tString, true)
      );
      const result = isSubtypeOf(r1, r2);
      expect(result).toBe(true);
    });

    test("the subtype can't have fewer fields", () => {
      const r1 = b.tRec(b.tProp("x", builtins.tNumber));
      const r2 = b.tRec(
        b.tProp("x", builtins.tNumber),
        b.tProp("y", builtins.tString, true)
      );
      const result = isSubtypeOf(r1, r2);
      expect(result).toBe(false);
    });
  });

  describe("tuple type", () => {
    test("same", () => {
      const t1 = b.tTuple(builtins.tNumber, builtins.tString);
      const t2 = b.tTuple(builtins.tNumber, builtins.tString);

      const result = isSubtypeOf(t1, t2);

      expect(result).toBe(true);
    });

    test("each elem is a subtype", () => {
      // [5, "hello"] is a subtype of [number, string]
      const t1 = b.tTuple(b.tNum(5), b.tStr("hello"));
      const t2 = b.tTuple(builtins.tNumber, builtins.tString);

      const result = isSubtypeOf(t1, t2);

      expect(result).toBe(true);
    });

    test("each elem is a subtype Array's type argument", () => {
      // [5, 10] is a subtype of Array<number>
      const t1 = b.tTuple(b.tNum(5), b.tNum(10));
      const t2 = builtins.tArray(builtins.tNumber);

      const result = isSubtypeOf(t1, t2);

      expect(result).toBe(true);
    });
  });

  describe("function sub-typing", () => {
    test("same", () => {
      const f1 = b.tFun(
        [b.tParam("", builtins.tNumber), b.tParam("", builtins.tString)],
        builtins.tBoolean
      );
      const f2 = b.tFun(
        [b.tParam("", builtins.tNumber), b.tParam("", builtins.tString)],
        builtins.tBoolean
      );

      const result = isSubtypeOf(f1, f2);
      expect(result).toBe(true);
    });

    test("return type is a subtype", () => {
      const f1 = b.tFun(
        [b.tParam("", builtins.tNumber), b.tParam("", builtins.tString)],
        builtins.tTrue
      );
      const f2 = b.tFun(
        [b.tParam("", builtins.tNumber), b.tParam("", builtins.tString)],
        builtins.tBoolean
      );

      const result = isSubtypeOf(f1, f2);
      expect(result).toBe(true);
    });

    test("not a subtype if return type is a supertype", () => {
      const f1 = b.tFun(
        [b.tParam("", builtins.tNumber), b.tParam("", builtins.tString)],
        builtins.tBoolean
      );
      const f2 = b.tFun(
        [b.tParam("", builtins.tNumber), b.tParam("", builtins.tString)],
        builtins.tTrue
      );

      const result = isSubtypeOf(f1, f2);
      expect(result).toBe(false);
    });

    test("is a subtype if arg type is a supertype", () => {
      // f1 = (x: number, y: string) => boolean
      const f1 = b.tFun(
        [b.tParam("", builtins.tNumber), b.tParam("", builtins.tString)],
        builtins.tBoolean
      );
      // f2 = (x: 5, y: string) => boolean
      const f2 = b.tFun(
        [b.tParam("", b.tNum(5)), b.tParam("", builtins.tString)],
        builtins.tBoolean
      );

      // f2(5, "hello") is valid and so is f1(5, "hello") because f1 accepts
      // all numbers
      const result = isSubtypeOf(f1, f2);
      expect(result).toBe(true);
    });

    test("is not a subtype if arg type is a subtype", () => {
      // f1 = (x: 5, y: string) => boolean
      const f1 = b.tFun(
        [b.tParam("", b.tNum(5)), b.tParam("", builtins.tString)],
        builtins.tBoolean
      );
      // f2 = (x: number, y: string) => boolean
      const f2 = b.tFun(
        [b.tParam("", builtins.tNumber), b.tParam("", builtins.tString)],
        builtins.tBoolean
      );

      // f2(10, "hello") is valid, but f1(10, "hello") is not
      const result = isSubtypeOf(f1, f2);
      expect(result).toBe(false);
    });

    test("having fewer params is a subtype", () => {
      const f1 = b.tFun([b.tParam("", builtins.tNumber)], builtins.tBoolean);
      const f2 = b.tFun(
        [b.tParam("", builtins.tNumber), b.tParam("", builtins.tString)],
        builtins.tBoolean
      );

      const result = isSubtypeOf(f1, f2);
      expect(result).toBe(true);
    });

    test("having more params is not a subtype", () => {
      const f1 = b.tFun(
        [
          b.tParam("", builtins.tNumber),
          b.tParam("", builtins.tString),
          b.tParam("", builtins.tNumber),
        ],
        builtins.tBoolean
      );
      const f2 = b.tFun(
        [b.tParam("", builtins.tNumber), b.tParam("", builtins.tString)],
        builtins.tBoolean
      );

      const result = isSubtypeOf(f1, f2);
      expect(result).toBe(false);
    });

    test("all extra params are optional makes it a subtype", () => {
      // This is because it's okay to call the function without those
      // extra params.
      const f1 = b.tFun(
        [
          b.tParam("", builtins.tNumber),
          b.tParam("", builtins.tString),
          b.tParam("", builtins.tBoolean, true),
        ],
        builtins.tBoolean
      );
      const f2 = b.tFun(
        [b.tParam("", builtins.tNumber), b.tParam("", builtins.tString)],
        builtins.tBoolean
      );

      const result = isSubtypeOf(f1, f2);
      expect(result).toBe(true);
    });

    // `(string) => undefined` should be a subtype of
    // `((string) => undefined) | ((number) => undefined)`
    // This should be helpful in implementing function overloading
    test.todo("union of functions");
  });

  describe("type variable", () => {
    test("subtype of itself", () => {
      let t = b.tVar();

      expect(isSubtypeOf(t, t)).toBe(true);
    });
  });

  describe("type constructor", () => {
    test("subtype if type args are subtypes", () => {
      let c1 = b.tCon("Foo", [b.tNum(5)]);
      let c2 = b.tCon("Foo", [builtins.tNumber]);

      expect(isSubtypeOf(c1, c2)).toBe(true);
    });

    test("not a subtype if type args are not subtypes", () => {
      let c1 = b.tCon("Foo", [builtins.tString]);
      let c2 = b.tCon("Foo", [builtins.tNumber]);

      expect(isSubtypeOf(c1, c2)).toBe(false);
    });

    test("not a subtype if type if different number of type args", () => {
      let c1 = b.tCon("Foo", [builtins.tNumber]);
      let c2 = b.tCon("Foo", [builtins.tNumber, builtins.tString]);

      expect(isSubtypeOf(c1, c2)).toBe(false);
    });
  });
});

describe("flatten", () => {
  test("3 | 5 | number -> number", () => {
    const t = b.tUnion(b.tNum(3), b.tNum(5), builtins.tNumber);

    const result = flatten(t);

    expect(print(result)).toEqual("number");
  });

  test("5 | (10 | number) -> number", () => {
    const t = b.tUnion(b.tNum(5), b.tUnion(b.tNum(5), builtins.tNumber));

    const result = flatten(t);

    expect(print(result)).toEqual("number");
  });

  test("(a | b) | (c | d) -> a | b | c | d", () => {
    const l = b.tUnion(b.tVar(), b.tVar());
    const r = b.tUnion(b.tVar(), b.tVar());
    const t = b.tUnion(l, r);

    const result = flatten(t);

    expect(print(result)).toEqual("a | b | c | d");
  });

  test("(a | b) | (b | c) -> a | b | c", () => {
    const at = b.tVar();
    const bt = b.tVar();
    const ct = b.tVar();
    const t = b.tUnion(b.tUnion(at, bt), b.tUnion(bt, ct));

    const result = flatten(t);

    expect(print(result)).toEqual("a | b | c");
  });
});
