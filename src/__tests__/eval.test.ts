import { evaluate, print } from '../eval';
import { parse } from '../parser'

describe('evaluate', () => {
  test.each([
    ['((x:number, y:number, z:number) => x + y + z)(1, 2, 3)', '6'],
    ['((x:number, y:number, z:number) => x + y + z)(1)(2)(3)', '6'],
  ])('%s = %s', (source, expected) => {
    const prog = parse(source + ';');
    const value = evaluate(prog);
    if (!value) {
      throw new Error("program did not return a value");
    }
    const actual = print(value);
    expect(actual).toEqual(expected);
  })
});
