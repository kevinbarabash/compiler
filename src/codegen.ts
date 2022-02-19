import { Expr, Program } from "./syntax";

const operators = {
  Add :'+',
  Sub :'-',
  Mul :'*',
  Div :'/',
}

export const printJs = (p: Program): string => {
  return p.body.map((value) => {
    if (value.tag === "Decl") {
      return `const ${value.name} = ${printJsExpr(value.value)}`;
    } else {
      return printJsExpr(value);
    }
  }).join("\n");
}

// TODO: include a context object that tracks the level of indentation and
// possibly other things
// TODO: define rules for pretty printing, e.g. when to add line breaks and such
// TODO: add roundtrip tests that show we can print(parse(str)) === str
const printJsExpr = (e: Expr): string => {
  switch (e.tag) {
    case "Lit": {
      const { value: lit } = e;
      switch (lit.tag) {
        case "LNum":
          return String(lit.value);
        case "LBool":
          return String(lit.value);
        case "LStr":
          return `"${lit.value}"`; // TODO: escape special characters
        case "LArr":
          return `[${lit.value.map(printJsExpr).join(", ")}]`;
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
      const params = e.params.map(param => param.name);

      // If body is a `Let` we'll need to convert the linked list to an array
      // and make sure the last line does a return.
      // Otherwise we can print it without the braces.
      if (e.body.tag === "Let") {
        const stmts = [];
        let line: Expr = e.body;
        while (line.tag === "Let") {
          stmts.push(`let ${line.name} = ${printJsExpr(line.value)};`);
          line = line.body;
        }
        stmts.push(`return ${printJsExpr(line)};`);
        return `(${params.join(", ")}) => {\n${stmts.join("\n")}\n}`;
      } else {
        return `(${params.join(", ")}) => ${printJsExpr(e.body)}`;
      }
    case "App": {
      // Built-in operators
      // TODO: handle precedence
      if (e.func.tag === "Var" && ["+", "-", "*", "/"].includes(e.func.name)) {
        return `(${printJsExpr(e.args[0])} ${e.func.name} ${printJsExpr(e.args[1])})`;
      }
      const func = printJsExpr(e.func);
      const args = e.args.map(printJsExpr);
      return `(${func})(${args.join(", ")})`;
    }
    case "Let":
      // TODO: create unique names if `e.name` is shadowed in the same scope.
      // When we create a unique name, we need to have a mapping from the original
      // name to the unique one so that we can print out the unique one whenever
      // we run into a `Var` in the body
      throw new Error("we don't handle top-level 'let' yet");
  }
};
