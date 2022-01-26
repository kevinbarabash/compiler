import { parse } from "../parser";

declare global {
  namespace jest {
    interface Matchers<R> {
      toParse(): R;
    }
  }
}

expect.extend({
  toParse(received: string) {
    try {
      const result = parse(received);
      if (result) {
        return {
          pass: true,
          message: () => `Expected ${received} not to parse`,
        };
      } else {
        return {
          pass: false,
          message: () => `Expected ${received} to parse`,
        };
      }
    } catch (error) {
      return {
        pass: false,
        message: () => `Expected ${received} to parse`,
      };
    }
  },
});

describe("parse", () => {
  it.each([
    ["5"],
    ["1.0"],
    ["1."],
    [".1"],
    ["true"],
    ["false"],
    [`"hello, world"`],
    ["[1, 2, 3]"],
    [`"\\"\\r\\t\\n"`],
    ["1 + 2 + 3"],
    ["1 * 2 * 3"],
    ["1 + 2 * 3"],
    ["() => 1"],
    ["(() => 1)()"],
    ["(x) => x + 1"],
    ["(x) => (y) => x + y"],
    ["(x) => {let foo = 5; foo}"],
    ["((x) => (y) => x + y)(1)(2)"],
    ["(x, y, z) => x + y + z"],
    ["((x, y, z) => x + y + z)(1, 2, 3)"],
    [`((x, y, z) => {
      let sum = x + y + z
      sum
    })`],
    [`((x, y, z) => {
      let sum = x + y + z; sum
    })`],
  ])("should parse '%s'", (input) => {
    expect(input).toParse();
  });

  it.each([
    [".", "Unexpected '.' at 1:1"],
    ["((x, y, z) => let sum = x + y + z; sum)", "Unexpected 'let' at 1:15"],
    [`((x, y, z) =>
      let sum = x + y + z
      sum
    )`, "Unexpected 'let' at 2:7"],
    ["(x) => {let let = 5; foo}", "Unexpected 'let' at 1:13"], // keywords can't be identifiers
    [`"hello, ""world!"`, "Unexpected '\"world!\"' at 1:10"]
  ])("should not parse '%s'", (input, error) => {
    expect(() => parse(input)).toThrowError(error)
  });
});
