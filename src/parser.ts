import * as nearley from 'nearley'
import rules from './grammar'

import type { Expr } from './syntax'

// @ts-expect-error
const grammar = nearley.Grammar.fromCompiled(rules)

export const parse = (input: string): Expr => {
    const parser = new nearley.Parser(grammar)
    parser.feed(input)
    return parser.results[0]
}
