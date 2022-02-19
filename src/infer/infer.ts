import { Expr } from "../syntax";

import { annotate, collect } from "./analyze";
import { unify, applySubst } from "./unify";
import * as t from "./types";
import { print } from "./printer";

export const infer = (ast: Expr, env?: Map<string, t.Type>): t.Type => {
  const annAst = annotate(ast, env || new Map());
  const constraints = collect(annAst);
  try {
    const subs = unify(constraints);
    return applySubst(subs, annAst.ann);
  } catch (e) {
    const varNames = {};
    const message = constraints.map(([left, right]) => {
      return `${print(left, varNames, true)} ≡ ${print(right, varNames, true)}`
    }).join("\n");
    console.log(message);
    throw e;
  }
};
