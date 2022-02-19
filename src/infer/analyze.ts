import * as t from "./types";
import * as b from "./builders";
import { Constraint } from "./unify";
import { getParamType, zip } from "./util";
import { Expr } from "../syntax";

type Environment = Map<string, t.Type>;

// TODO:
// - `let` polymorphism, the following should type-check
//   let foo = () => {
//     let id = (x) => x in
//     let n = id(5) in
//     let b = id(true) in
//     b
//   }
//

export const annotate = (e: Expr, env: Environment): AExpr => {
  switch (e.tag) {
    case "Lit": {
      const lit = e.value;
      switch (lit.tag) {
        case "LBool":
          return { tag: "ALit", value: lit, ann: b.tBool(lit.value) };
        case "LNum":
          return { tag: "ALit", value: lit, ann: b.tNum(lit.value) };
        case "LStr":
          return { tag: "ALit", value: lit, ann: b.tStr(lit.value) };
      }
      throw new Error("unhandled LArr in annotate");
    }
    case "Var": {
      const varType = env.get(e.name);
      if (varType) {
        return { tag: "AVar", name: e.name, ann: varType };
      } else {
        console.log(`e.name = ${e.name}`);
        console.log(`env = `, env);
        for (const key of env.keys()) {
          console.log(`key = ${key}, e.name = ${e.name}, ${key === e.name}`);
          console.log(typeof key);
          console.log(typeof e.name);
        }
        throw new Error(`variable "${e.name}" not defined`);
      }
    }
    case "Let": {
      const { name } = e;
      const value = annotate(e.value, env);

      const newEnv = new Map(env);
      const boundVarType = b.tVar(); // introduce a new variable
      newEnv.set(name, boundVarType);
      const body = annotate(e.body, newEnv);

      return { tag: "ALet", name, value, body, ann: typeOf(body), boundVarType };
    }
    case "Lam": {
      const newEnv = new Map(env);
      const params: Param[] = e.params.map((param) => {
        const { name } = param;
        const type = b.tVar(); // introduce a new variable
        newEnv.set(name, type);
        return { tag: "Param", name, type };
      });

      const body = annotate(e.body, newEnv);

      const type = b.tFun(
        params.map(p => b.tParam(p.name, p.type)),
        typeOf(body),
      );

      return { tag: "ALam", params, body, ann: type };
    }
    case "App": {
      const func = annotate(e.func, env);
      const args = e.args.map(arg => annotate(arg, env));
      return { tag: "AApp", func, args, ann: b.tVar() };
    }
  }
};

export const collect = (ae: AExpr): Constraint[] => {
  switch (ae.tag) {
    case "ALit":
      return []; // no constraints to impose on literals
    case "AVar":
      return []; // single occurence of a variable so no constraint
    case "ALam": {
      switch (ae.ann.t) {
        case "TFun": {
          // What about the variables that we're introduced?
          // Do we add these to `env`?
          const { body } = ae;
          const { retType } = ae.ann;
          return [...collect(body), [typeOf(body), retType]];
        }
        default:
          throw new Error("not a function");
      }
    }
    // TODO: handle partial application
    case "AApp": {
      const funcType = typeOf(ae.func);
      switch (funcType.t) {
        case "TFun": {
          return [
            ...collect(ae.func),
            ...ae.args.flatMap(collect),
            ...zip(ae.args.map(typeOf), funcType.paramTypes.map(getParamType)),
            [ae.ann, funcType.retType],
          ];
        }
        case "TVar": {
          return [
            ...collect(ae.func),
            ...ae.args.flatMap(collect),
            [
              funcType,
              b.tFun(
                ae.args.map((arg) => b.tParam("", typeOf(arg))),
                ae.ann
              ),
            ],
          ];
        }
        default:
          throw new Error("incorrect function application");
      }
    }
    case "ALet": {
      return [
        ...collect(ae.value),
        [ae.boundVarType, typeOf(ae.value)],
        ...collect(ae.body),
      ];
    }
  }
};

const typeOf = (ae: AExpr): t.Type => ae.ann;

export type Program = { tag: "Program"; body: (AExpr | Decl)[] };

export type Decl = { tag: "Decl"; name: string; value: AExpr };

export type AExpr =
  | { tag: "AVar"; name: string; ann: t.Type }
  | { tag: "ALit"; value: Lit; ann: t.Type }
  | { tag: "AApp"; func: AExpr; args: readonly AExpr[]; ann: t.Type }
  | { tag: "ALam"; params: readonly Param[]; body: AExpr; ann: t.Type }
  | {
      tag: "ALet";
      name: string;
      value: AExpr;
      body: AExpr;
      ann: t.Type;
      boundVarType: t.Type;
    };

export type Lit =
  // TODO: replace LNum with LInt and LFloat
  | { tag: "LNum"; value: number }
  | { tag: "LBool"; value: boolean }
  | { tag: "LStr"; value: string }
  | { tag: "LArr"; value: AExpr[] };

// How do we model variables whose type can be inferred as well as
// specified if desired?
export type Param = { tag: "Param"; name: string; type: t.Type };

export type BinOp = "Add" | "Sub" | "Mul" | "Div";

// Notes on primitives:
// - can probably be replaced by App nodes
// - if they're still needed by the parser we can do a pass to convert
//   them into App nodes
