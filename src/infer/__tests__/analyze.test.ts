import { Expr } from "../../syntax";

import { annotate, collect } from "../analyze";
import { unify, applySubst, Subst } from "../unify";
import * as t from "../types";
import { print } from "../printer";

const printSubstitutions = (subs: Subst[]): string[] => {
  const varNames = {};

  return subs.map(([key, val]) => {
    const type = applySubst(subs, val);
    return `t${key} ≡ ${print(type, varNames, true)}`;
  });
};

describe("annotate", () => {
  test("let f = (x) => x in f(5)", () => {
    const ast: Expr = {
      tag: "Let",
      name: "f",
      value: {
        tag: "Lam",
        params: [{ tag: "Param", name: "x", type: "" }],
        body: { tag: "Var", name: "x" },
      },
      body: {
        tag: "App",
        func: { tag: "Var", name: "f" },
        args: [{ tag: "Lit", value: { tag: "LNum", value: 5 } }],
      },
    };

    const env = new Map<string, t.Type>();
    const annotatedAst = annotate(ast, env);
    const constraints = collect(annotatedAst);
    const substitutions = unify(constraints);
    const result = printSubstitutions(substitutions);
    expect(result).toEqual(["t0 ≡ 5", "t2 ≡ 5", "t1 ≡ (arg0: 5) => 5"]);
  });

  test("((x) => x)(5)", () => {
    const ast: Expr = {
      tag: "App",
      func: {
        tag: "Lam",
        params: [{ tag: "Param", name: "x", type: "" }],
        body: { tag: "Var", name: "x" },
      },
      args: [{ tag: "Lit", value: { tag: "LNum", value: 5 } }],
    };

    const env = new Map<string, t.Type>();
    const annotatedAst = annotate(ast, env);
    const constraints = collect(annotatedAst);
    const substitutions = unify(constraints);
    const result = printSubstitutions(substitutions);
    expect(result).toEqual(["t3 ≡ 5", "t4 ≡ 5"]);
  });
});
