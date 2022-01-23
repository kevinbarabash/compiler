import { Expr } from "./syntax";

const operators = {
  Add :'+',
  Sub :'-',
  Mul :'*',
  Div :'/',
}

// TODO: define rules for pretty printing, e.g. when to add line breaks and such
// TODO: add roundtrip tests that show we can print(parse(str)) === str
export const print = (e: Expr): string => {
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
      // return `(${e.params.join(", ")}) => ${print(e.body)}`;
      const stmts = [];
      let line: Expr = e.body;
      while (line.tag === "Let") {
        stmts.push(`let ${line.name} = ${print(line.value)}`);
        line = line.body;
      }
      stmts.push(`${print(line)}`);
      return `(${e.params.join(", ")}) => {\n${stmts.join("\n")}\n}`;
    case "App": {
      const func = print(e.func);
      const args = e.args.map(print);
      return `(${func})(${args.join(", ")})`;
    }
    case "Prim": {
      // TODO: handle precedence
      return `${print(e.args[0])} ${operators[e.op]} ${print(e.args[1])}`;
    }
    case "Let":
      // TODO: create unique names if `e.name` is shadowed in the same scope.
      // When we create a unique name, we need to have a mapping from the original
      // name to the unique one so that we can print out the unique one whenever
      // we run into a `Var` in the body
      return `let ${e.name} = ${print(e.value)}\n${print(e.body)}`;
  }
};
