import * as nearley from "nearley";

import {grammar} from "./grammar"
import type { Expr } from "./syntax";

export const parse = (input: string): Expr => {
  const parser = new nearley.Parser(grammar);
  parser.feed(input);
  return parser.results[0];
};
