import * as build from "./builders";
import * as t from "./types";
import { zip, getParamType, getPropType } from "./util";
import { print } from "./printer";

// TODO: replace Constraint w/ Constr
// TODO: use .relation to implement subtyping
type Constr = {
  types: [t.Type, t.Type],
  relation: null | "param,arg" | "arg,param",
};

export type Constraint = [t.Type, t.Type];
export type Subst = [number, t.Type]; // [id, type]

export const unify = (constraints: Constraint[]): Subst[] => {
  if (constraints.length === 0) {
    return [];
  }

  // TODO: rewrite this without using recursion
  const [a, b] = constraints[0];
  const rest = constraints.slice(1);
  const s2 = unify(rest); // unify constraints from right to left
  const s1 = unifyTypes(applySubst(s2, a), applySubst(s2, b));

  return [...s1, ...s2];
};

// TODO: instead of throwing on the first error, can we capture
// all of the errors and still have `unify` terminate?

// types passed to unify_one must already be applied.
const unifyTypes = (a: t.Type, b: t.Type): Subst[] => {
  if (a.t === "TVar") {
    return [[a.id, b]];
  } else if (b.t === "TVar") {
    return [[b.id, a]];
  } else if (a.t === "TLit" && b.t === "TLit") {
    return unifyLiteral(a, b);
  } else if (a.t === "TFun" && b.t === "TFun") {
    return unifyFun(a, b);
  } else if (a.t === "TCon" && b.t === "TCon") {
    return unifyCon(a, b);
  } else if (a.t === "TRec" && b.t === "TRec") {
    return unifyRec(a, b);
  } else if (a.t === "TTuple" && b.t === "TTuple") {
    return unifyTuple(a, b);
  } else if (a.t === "TUnion" && b.t === "TUnion") {
    return unifyUnion(a, b);
  } else {
    console.log(`a = ${print(a)}, b = ${print(b)}`);
    throw new Error(`mismatched types: ${a.t} != ${b.t}`);
  }
};

const unifyLiteral = (a: t.TLiteral, b: t.TLiteral): Subst[] => {
  const aLit = a.literal;
  const bLit = b.literal;
  // Right now a Substitution maps a type variable to a type,
  // but in the future we could also map a type literal to a
  // widened type, e.g. 5 -> 5 | 10, 10 -> 5 | 10
  if (aLit.t === "LBool" && bLit.t === "LBool") {
    return [];
  } else if (aLit.t === "LNum" && bLit.t === "LNum") {
    return [];
  } else if (aLit.t === "LStr" && bLit.t === "LStr") {
    return [];
  }
  throw new Error(`${aLit.t} != ${bLit.t}`);
}

const unifyFun = (a: t.TFun, b: t.TFun): Subst[] => {
  // assume that type generator has already done the appropriate
  // subtyping and partial application checks
  const aParamTypes = a.paramTypes.map(getParamType);
  const bParamTypes = b.paramTypes.map(getParamType);

  const constraints: Constraint[] = [
    ...zip(aParamTypes, bParamTypes),
    [a.retType, b.retType],
  ];

  return unify(constraints);
}

const unifyCon = (a: t.TCon, b: t.TCon): Subst[] => {
  if (a.name !== b.name) {
    throw new Error(`type constructor mismatch: ${a.name} != ${b.name}`);
  }
  if (a.typeArgs.length !== b.typeArgs.length) {
    throw new Error("type constructors have different number of type args");
  }

  return unify(zip(a.typeArgs, b.typeArgs));
}

const unifyRec = (a: t.TRec, b: t.TRec): Subst[] => {
  const constraints: Constraint[] = [];

  if (a.properties.length !== b.properties.length) {
    throw new Error("record types have different numbers of properties");
  }
  a.properties.forEach((aProp) => {
    const bProp = a.properties.find((p) => p.name === aProp.name);
    if (!bProp) {
      throw new Error(`record type is missing ${aProp.name} property`);
    }
    constraints.push([getPropType(aProp), getPropType(bProp)]);
  });

  return unify(constraints);
}

const unifyTuple = (a: t.TTuple, b: t.TTuple): Subst[] => {
  if (a.types.length !== b.types.length) {
    throw new Error("tuple types have different numbers of elements");
  }

  return unify(zip(a.types, b.types));
}

const unifyUnion = (a: t.TUnion, b: t.TUnion): Subst[] => {
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
};

const substitute = (sub: Subst, type: t.Type): t.Type => {
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
      return build.tFun(
        type.paramTypes.map((p) =>
          build.tParam(p.name, substitute(sub, p.type), p.optional)
        ),
        substitute(sub, type.retType)
      );
    case "TCon":
      return build.tCon(
        type.name,
        type.typeArgs.map((a) => substitute(sub, a))
      );
    case "TRec":
      return build.tRec(
        ...type.properties.map((p) =>
          build.tProp(p.name, substitute(sub, p.type), p.optional)
        )
      );
    case "TTuple":
      return build.tTuple(...type.types.map((e) => substitute(sub, e)));
    case "TUnion":
      return build.tUnion(...type.types.map((e) => substitute(sub, e)));
  }
};

export const applySubst = (subs: Subst[], type: t.Type): t.Type => {
  return subs.reduceRight((prev, curr) => substitute(curr, prev), type);
};
