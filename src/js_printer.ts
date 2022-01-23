import { Expr } from "./syntax";

const operators = {
  Add :'+',
  Sub :'-',
  Mul :'*',
  Div :'/',
}

// TODO: include a context object that tracks the level of indentation and
// possibly other things
// TODO: define rules for pretty printing, e.g. when to add line breaks and such
// TODO: add roundtrip tests that show we can print(parse(str)) === str
export const printJs = (e: Expr): string => {
  switch (e.tag) {
    case "Lit": {
      const { value: lit } = e;
      switch (lit.tag) {
        case "LNum":
          return String(lit.value);
        case "LBool":
          return String(lit.value);
      }
    }
    case "Var":
      // TODO: check if there's a unique name for the this `Var` in the
      // current scope.
      return e.name;
    case "Lam":
      // TODO: create a series of nested scope dictionaries to track
      // which variables have been defined within a particular scope.
      // This will allow us to know whether we need to create a unique
      // name for a variable or if it's fine to rely on JS shadowing.

      // If body is a `Let` we'll need to convert the linked list to an array
      // and make sure the last line does a return.
      // Otherwise we can print it without the braces.
      if (e.body.tag === "Let") {
        const stmts = [];
        let line: Expr = e.body;
        while (line.tag === "Let") {
          stmts.push(`let ${line.name} = ${printJs(line.value)};`);
          line = line.body;
        }
        stmts.push(`return ${printJs(line)};`);
        return `(${e.params.join(", ")}) => {\n${stmts.join("\n")}\n}`;
      } else {
        return `(${e.params.join(", ")}) => ${printJs(e.body)}`;
      }
    case "App": {
      const func = printJs(e.func);
      const args = e.args.map(printJs);
      return `(${func})(${args.join(", ")})`;
    }
    case "Prim": {
      // TODO: handle precedence
      return `${printJs(e.args[0])} ${operators[e.op]} ${printJs(e.args[1])}`;
    }
    case "Let":
      // TODO: create unique names if `e.name` is shadowed in the same scope.
      // When we create a unique name, we need to have a mapping from the original
      // name to the unique one so that we can print out the unique one whenever
      // we run into a `Var` in the body
      throw new Error("we don't handle top-level 'let' yet");
  }
};
