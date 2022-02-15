import * as b from "./builders";
import * as t from "./types";
import { print } from "./printer";
import { zip, getParamType, getPropType } from "./util";

type ID = number;

export type Constraint = [t.Type, t.Type];
export type Substitution = [ID, t.Type];

export const unify = (constraints: Constraint[]): Substitution[] => {
  // console.log("--- unify ---");
  // const varNames = {};
  // for (const c of constraints) {
  //   console.log(`${print(c[0], varNames)} =?= ${print(c[1], varNames)}`)
  // }
  if (constraints.length === 0) {
    return [];
  } else {
    const [x, y] = constraints[0];
    const rest = constraints.slice(1);
    const s2 = unify(rest);
    const s1 = unify_one(apply(s2, x), apply(s2, y));
    return [...s1, ...s2];
  }
};

// TODO: instead of throwing on the first error, can we capture
// all of the errors and still have `unify` terminate?

// types passed to unify_one must already be applied.
const unify_one = (t1: t.Type, t2: t.Type): Substitution[] => {
  if (t1.t === "TLit" && t2.t === "TLit") {
    const l1 = t1.literal;
    const l2 = t2.literal;
    // Right now a Substitution maps a type variable to a type,
    // but in the future we could also map a type literal to a
    // widened type, e.g. 5 -> 5 | 10, 10 -> 5 | 10
    if (l1.t === "LBool" && l2.t === "LBool") {
      return [];
    } else if (l1.t === "LNum" && l2.t === "LBool") {
      return [];
    } else if (l1.t === "LStr" && l2.t === "LStr") {
      return [];
    }
    throw new Error(`${l1.t} != ${l2.t}`);
  } else if (t1.t === "TVar") {
    return [[t1.id, t2]];
  } else if (t2.t === "TVar") {
    return [[t2.id, t1]];
  } else if (t1.t === "TFun" && t2.t === "TFun") {
    // assume that type generator has already done the appropriate
    // subtyping and partial application checks
    const t1ParamTypes = t1.paramTypes.map(getParamType);
    const t2ParamTypes = t1.paramTypes.map(getParamType);
    const constraints: Constraint[] = [
      ...zip(t1ParamTypes, t2ParamTypes),
      [t1.retType, t2.retType],
    ];
    return unify(constraints);
  } else if (t1.t === "TCon" && t2.t === "TCon") {
    if (t1.name !== t2.name) {
      throw new Error(`type constructor mismatch: ${t1.name} != ${t2.name}`);
    }
    if (t1.typeArgs.length !== t2.typeArgs.length) {
      throw new Error("type constructors have different number of type args");
    }
    const constraints: Constraint[] = zip(t1.typeArgs, t2.typeArgs);
    return unify(constraints);
  } else if (t1.t === "TRec" && t2.t === "TRec") {
    const constraints: Constraint[] = [];
    if (t1.properties.length !== t2.properties.length) {
      throw new Error("record types have different numbers of properties");
    }
    t1.properties.forEach((t1Prop) => {
      const t2Prop = t1.properties.find((p) => p.name === t1Prop.name);
      if (!t2Prop) {
        throw new Error(`record type is missing ${t1Prop.name} property`);
      }
      constraints.push([getPropType(t1Prop), getPropType(t2Prop)]);
    });
    return unify(constraints);
  } else if (t1.t === "TTuple" && t2.t === "TTuple") {
    return [];
  } else if (t1.t === "TUnion" && t2.t === "TUnion") {
    // How do we unify a union of types?
    // unify([a | b, c | d]), what does this even mean?

    // TODO: we need to call `apply` on the constraints before passing them to unify
    // Cases:
    // - t1 and t2 contain no type variables: check if they're equivalent
    // - one of them contains type variables, but the other doesn't:
    //   - removal all elements that are the same
    // - both contain type variabls:
    //   - remove all elements that are the same
    //   - then what?
    // unify([a | int, b | string]) -> unify([a, string], [int, b])

    // What if we say that unifying two unions results in both of them
    // widening to t1 | t2?  That is, unless one of them is frozen.
    // TODO: implement widening
    return [];
  } else {
    throw new Error(`mismatched types: ${t1.t} != ${t2.t}`);
  }
};

const substitute = (sub: Substitution, type: t.Type): t.Type => {
  switch (type.t) {
    case "TLit":
      return type;
    case "TVar":
      return type.id === sub[0] ? sub[1] : type;
    // Subtyping:
    // If we tag TFun's as either calls or definitions, we can use that to determine
    // the direction of subtyping when unifying a call with its definition.

    // return a new type where each instance of the type variable sol[0] has
    // been replaced with type sol[1]
    case "TFun":
      return b.tFun(
        type.paramTypes.map((p) =>
          b.tParam(p.name, substitute(sub, p.type), p.optional)
        ),
        substitute(sub, type.retType)
      );
    case "TCon":
      return b.tCon(
        type.name,
        type.typeArgs.map((a) => substitute(sub, a))
      );
    case "TRec":
      return b.tRec(
        ...type.properties.map((p) =>
          b.tProp(p.name, substitute(sub, p.type), p.optional)
        )
      );
    case "TTuple":
      return b.tTuple(...type.types.map((e) => substitute(sub, e)));
    case "TUnion":
      return b.tUnion(...type.types.map((e) => substitute(sub, e)));
  }
};

export const apply = (subs: Substitution[], type: t.Type): t.Type => {
  return subs.reduceRight((prev, curr) => substitute(curr, prev), type);
};
