import { Expr } from "./syntax";

const operators = {
  Add :'+',
  Sub :'-',
  Mul :'*',
  Div :'/',
}

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
      return e.name;
    case "Lam":
      return `(${e.params.join(", ")}) => ${print(e.body)}`;
    case "App": {
      const func = print(e.func);
      const args = e.args.map(print);
      return `(${func})(${args.join(", ")})`;
    }
    case "Prim": {
      // TODO: handle precedence
      return `${print(e.args[0])} ${operators[e.op]} ${print(e.args[1])}`;
    }
  }
};
