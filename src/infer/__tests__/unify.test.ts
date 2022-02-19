import * as b from "../builders";
import * as builtins from "../builtins";
import { print } from "../printer";
import { applySubst, unify, Constraint, Subst } from "../unify";

const printSubstitutions = (subs: Subst[]): string[] => {
  const varNames = {};

  return subs.map(([key, val]) => {
    const type = applySubst(subs, val);
    return `t${key} ≡ ${print(type, varNames, true)}`;
  });
};

describe("unify", () => {
  test("simple example", () => {
    const t0 = b.tVar(); // ignore this, we create it so that the ids line up

    const t1 = b.tVar();
    const t2 = b.tVar();
    const t3 = b.tVar();
    const t4 = b.tVar();
    const t5 = b.tVar();
    const t6 = b.tVar();
    const t7 = b.tVar();

    let constraints: Constraint[] = [
      [t1, b.tFun([b.tParam("", t5)], t4)], // function call
      [t5, builtins.tNumber],
      [t4, builtins.tBoolean],
      [t6, builtins.tNumber],
      [t7, builtins.tNumber],
      [t6, t3],
      [t7, t3],
      [t2, b.tFun([b.tParam("", t1)], t3)], // function definition
    ];

    const result = unify(constraints);

    expect(printSubstitutions(result)).toMatchInlineSnapshot(`
Array [
  "t1 ≡ (arg0: number) => boolean",
  "t5 ≡ number",
  "t4 ≡ boolean",
  "t6 ≡ number",
  "t7 ≡ number",
  "t3 ≡ number",
  "t2 ≡ (arg0: (arg0: number) => boolean) => number",
]
`);
  });
});
