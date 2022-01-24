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
    ["1 + 2 + 3"],
    ["1 * 2 * 3"],
    ["1 + 2 * 3"],
    ["(x) => x + 1"],
    ["(x) => (y) => x + y"],
    ["((x) => (y) => x + y)(1)(2)"],
    ["(x, y, z) => x + y + z"],
    ["((x, y, z) => x + y + z)(1, 2, 3)"],
    [`((x, y, z) => {
      let sum = x + y + z
      sum
    })`],
    [`((x, y, z) => {
      let sum = x + y + z; sum
    })`]
  ])("should parse '%s'", (input) => {
    expect(input).toParse();
  });

  it.each([
    ["."],
    [`((x, y, z) => let sum = x + y + z; sum)`],
    [`((x, y, z) =>
      let sum = x + y + z
      sum
    )`]
  ])("should not parse '%s'", (input) => {
    expect(input).not.toParse();
  });
});
