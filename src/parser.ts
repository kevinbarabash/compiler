import * as nearley from "nearley";
import type {Token} from "moo";

import {grammar} from "./grammar"
import type { Expr } from "./syntax";

export const parse = (input: string): Expr => {
  const parser = new nearley.Parser(grammar);
  try {
    parser.feed(input);
    return parser.results[0];
  } catch (e) {
    // @ts-expect-error
    const token = e.token as Token;
    const {text, line, col} = token;
    throw new Error(`Unexpected '${text}' at ${line}:${col}`)
  }
};
