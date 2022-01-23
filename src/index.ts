import util from 'util'

import { evaluate } from './eval'
import { parse } from './parser'
import { print } from './printer'

const expr1 = parse("(x) => (y) => x + y");
console.log(expr1);

const options = { showHidden: false, depth: null, colors: true };
const expr2 = parse("((x) => (y) => (z) => x + y + z)(1)(2)(3)");
console.log(util.inspect(expr2, options));
console.log(evaluate(expr2));
console.log(print(expr2));
