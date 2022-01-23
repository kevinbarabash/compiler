import fs from "fs";
import path from "path";

import * as nearley from "nearley";

// @ts-expect-error
import parserGrammar from "nearley/lib/nearley-language-bootstrapped.js";
// @ts-expect-error
import generate from "nearley/lib/generate.js";
// @ts-expect-error
import lint from "nearley/lib/lint.js";
// @ts-expect-error
import Compile from "nearley/lib/compile.js";

// https://stackoverflow.com/questions/17581830/load-node-js-module-from-string-in-memory
function requireFromString(src: string, filename: string) {
  const Module = module.constructor;
  // @ts-expect-error
  const m = new Module();
  m._compile(src, filename);
  return m.exports;
}

const parser = new nearley.Parser(parserGrammar);

const filename = path.join(__dirname, "../src/grammar.ne");
const grammarSrc = fs.readFileSync(filename, "utf-8");
parser.feed(grammarSrc);

const c = Compile(parser.results[0], {});

const lints: string[] = [];
lint(c, {
  out: {
    write: (msg: string) => lints.push(msg),
  },
});
if (lints.length > 0) {
  for (const lint of lints) {
    console.warn(lint);
  }
  process.exit(1);
}

const mod = requireFromString(generate(c), filename);
export const grammar = nearley.Grammar.fromCompiled(mod);
