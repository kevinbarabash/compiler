import { Expr, Program } from "./syntax";

const operators = {
  Add :'+',
  Sub :'-',
  Mul :'*',
  Div :'/',
}

export const print = (p: Program): string => {
  return p.body.map((value) => {
    if (value.tag === "Decl") {
      return `let ${value.name} = ${printExpr(value.value)}`;
    } else {
      return printExpr(value);
    }
  }).join("\n");
}

// TODO: define rules for pretty printing, e.g. when to add line breaks and such
// TODO: add roundtrip tests that show we can printExpr(parse(str)) === str
export const printExpr = (e: Expr): string => {
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
          return `[${lit.values.map(printExpr).join(", ")}]`;
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
      // return `(${e.params.join(", ")}) => ${printExpr(e.body)}`;
      const stmts = [];
      let line: Expr = e.body;
      while (line.tag === "Let") {
        stmts.push(`let ${line.name} = ${printExpr(line.value)}`);
        line = line.body;
      }
      stmts.push(`${printExpr(line)}`);
      const params = e.params.map(({name, type}) => `${name}:${type}`);
      if (stmts.length > 1) {
        return `(${params.join(", ")}) => {\n${stmts.join("\n")}\n}`;
      } else {
        return `(${params.join(", ")}) => ${stmts[0]}`;
      }
    case "App": {
      // TODO: handle precendence for arithmetic operations
      const func = printExpr(e.func);
      const args = e.args.map(printExpr);
      return `(${func})(${args.join(", ")})`;
    }
    case "Let":
      // TODO: create unique names if `e.name` is shadowed in the same scope.
      // When we create a unique name, we need to have a mapping from the original
      // name to the unique one so that we can printExpr out the unique one whenever
      // we run into a `Var` in the body
      return `let ${e.name} = ${printExpr(e.value)}\n${printExpr(e.body)}`;
  }
};
