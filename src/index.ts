import util from 'util'

import { evaluate } from './eval'
import { parse } from './parser'
// import { print } from './printer'
import { printJs } from './js_printer'

const expr1 = parse("(x) => (y) => x + y");
console.log(expr1);

const options = { showHidden: false, depth: null, colors: true };
const expr2 = parse("((x) => (y) => (z) => x + y + z)(1)(2)(3)");
console.log(util.inspect(expr2, options));
console.log(evaluate(expr2));
console.log(printJs(expr2));
console.log(`js eval'd: ${eval(printJs(expr2))}`);

// TODO: require braces around functions that contain `let` expressions
const expr3 = parse(`
((x, y, z) =>
  let sum = x + y + z
  sum)(1, 2, 3)`);
console.log(util.inspect(expr3, options));
console.log(evaluate(expr3));
console.log(`js = ${printJs(expr3)}`);
console.log(`js eval'd: ${eval(printJs(expr3))}`);
