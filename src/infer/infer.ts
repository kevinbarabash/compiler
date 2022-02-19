import { Expr } from "../syntax";

import { AExpr, annotate, collect } from "./analyze";
import { unify, applySubst, Constraint, Subst } from "./unify";
import * as t from "./types";
import { print } from "./printer";
import { equal } from "./util";

const printConstraints = (constraints: Constraint[]) => {
  const varNames = {};
  const message = constraints
    .map(([left, right]) => {
      return `${print(left, varNames, true)} ≡ ${print(right, varNames, true)}`;
    })
    .join("\n");
  console.log(message);
};

const printSubstitutions = (subs: Subst[]) => {
  const varNames = {};

  const message = subs
    .map(([key, val]) => {
      const type = applySubst(subs, val);
      return `t${key} ≡ ${print(type, varNames, true)}`;
    })
    .join("\n");
  console.log(message);
};

export const infer = (ast: Expr, env?: Map<string, t.Type>): AExpr => {
  const annAst = annotate(ast, env || new Map());
  // We filter collected contraints to remove trivial constraints where.
  const constraints = collect(annAst).filter(([a, b]) => !equal(a, b));
  try {
    const subs = unify(constraints);
    if (process.env.DEBUG) {
      printSubstitutions(subs);
      console.log(JSON.stringify(annAst.ann, null, 2));
    }
    // Updates types in annAst by mutating it
    applySubstToAExpr(subs, annAst);
    return annAst;
  } catch (e) {
    printConstraints(constraints);
    throw e;
  }
};

// NOTE: this mutates the AExpr that's passed in
const applySubstToAExpr = (subs: Subst[], ae: AExpr) => {
  ae.ann = applySubst(subs, ae.ann);
  switch (ae.tag) {
    case "AApp": {
      ae.args.map(arg => applySubstToAExpr(subs, arg));
      applySubstToAExpr(subs, ae.func);
      break;
    }
    case "ALam": {
      // ae.params.map(param => applySubstToAExpr(subs, param.type));
      applySubstToAExpr(subs, ae.body);
      break;
    }
    case "ALet": {
      applySubstToAExpr(subs, ae.value);
      applySubstToAExpr(subs, ae.body);
      break;
    }
    case "ALit": {
      break;
    }
    case "AVar": {
      break;
    }
  }
};
