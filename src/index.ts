import { Stack } from 'immutable'
import util from 'util'

import { evaluate } from './eval'
import { parse } from './parser'
import { print } from './printer'
import { printJs } from './js_printer'
import { check } from './checker';

const options = { showHidden: false, depth: null, colors: true };

const expr1 = parse("(x:number) => (y:number) => x + y");
console.log(expr1);

const expr2 = parse("((x:number) => (y:number) => (z:number) => x + y + z)(1)(2)(3)");
console.log(util.inspect(expr2, options));
check(expr2, {scopes: Stack()});
console.log(evaluate(expr2));
console.log(printJs(expr2));
console.log(`js eval'd: ${eval(printJs(expr2))}`);

const expr3 = parse(`
((x:number, y:number, z:number) => {
  let sum = x + y + z
  sum
})(1, 2, 3)`);
console.log(util.inspect(expr3, options));
check(expr3, {scopes: Stack()});
console.log(evaluate(expr3));
console.log(`src:\n${print(expr3)}\n`);
console.log(`js:\n${printJs(expr3)}\n`);
console.log(`js eval'd: ${eval(printJs(expr3))}`);

const expr4 = parse("(() => 5)()");
console.log(util.inspect(expr4, options));
console.log(evaluate(expr4));
