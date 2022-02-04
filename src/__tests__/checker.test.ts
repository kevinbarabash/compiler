import { check } from "../checker";
import { parse } from '../parser'

describe("checker", () => {
  test.each([
    ['((x:number, y:number, z:number) => x + y + z)(1, 2, 3)'],
    ['((x:number, y:number, z:number) => x + y + z)(1)(2)(3)'],
    // It's okay to apply more args than params
    ['((x:number, y:number) => x + y)(1, 2, 3)'],
  ])('%s', (source) => {
    const prog = parse(source + ';');
    expect(() => check(prog)).not.toThrow();
  })
});
