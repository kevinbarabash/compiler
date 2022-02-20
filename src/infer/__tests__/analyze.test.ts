import { Expr } from "../../syntax";

import { annotate, collect } from "../analyze";
import { unify, applySubst, Subst } from "../unify";
import * as t from "../types";
import { print } from "../printer";
import * as core from "../core";

const printSubstitutions = (subs: Subst[]): string[] => {
  const varNames = {};

  return subs.map(([key, val]) => {
    const type = applySubst(subs, val);
    return `t${key} ≡ ${print(type, varNames, true)}`;
  });
};

describe("annotate", () => {
  beforeEach(() => {
    let id = 0;
    jest.spyOn(core, "getId").mockImplementation(() => id++);
  });

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
    expect(result).toMatchInlineSnapshot(`
Array [
  "t3 ≡ (x: 5) => 5",
  "t0 ≡ 5",
  "t5 ≡ 5",
]
`);
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
    expect(result).toMatchInlineSnapshot(`
Array [
  "t0 ≡ 5",
]
`);
  });
});
