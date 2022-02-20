import * as build from "./builders";
import * as t from "./types";
import { zip, getParamType, getPropType, isSubtypeOf } from "./util";
import { print } from "./printer";
import { equal, flatten, clone } from "./util";
import { getId } from "./core";

export type Constraint = [t.Type, t.Type];
export type Subst = [number, t.Type]; // [id, type]

export const unify = (constraints: Constraint[]): Subst[] => {
  if (constraints.length === 0) {
    return [];
  }

  // TODO: rewrite this without using recursion
  // This is left recursive in order to prioritize definitions
  // over uses.
  const [a, b] = constraints[constraints.length - 1];
  const rest = constraints.slice(0, -1);
  const s2 = unify(rest); // unify constraints from right to left
  const s1 = unifyTypes(applySubst(s2, a), applySubst(s2, b));

  return [...s2, ...s1];
};

// TODO: instead of throwing on the first error, can we capture
// all of the errors and still have `unify` terminate?

// types passed to unify_one must already be applied.
const unifyTypes = (a: t.Type, b: t.Type): Subst[] => {
  if (a.t === "TVar") {
    if (equal(a, b)) {
      return [];
    }
    // TODO: add occurs in check?
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
    if (!a.frozen && b.frozen) {
      // TODO: move frozen checks into isSubtypeOf()
      if (isSubtypeOf(a, b)) {
        if (process.env.DEBUG) {
          console.log(`${print(a)} is a subtype of ${print(b)}`);
        }
        return [];
      }
    }
    if (!b.frozen && a.frozen) {
      // TODO: move frozen checks into isSubtypeOf()
      if (isSubtypeOf(b, a)) {
        if (process.env.DEBUG) {
          console.log(`${print(b)} is a subtype of ${print(a)}`);
        }
        return [];
      }
    }

    if (!a.frozen && !b.frozen) {
      const union = flatten(build.tUnion(a, b));
      return [
        [a.id, union],
        [b.id, union],
      ];
    }

    throw new Error(`mismatched types: ${a.t} != ${b.t}`);
  }
};

const widen = (a: t.Type, b: t.Type): Subst[] => {
  // We have to give the types in the union different ids then
  // the types the union is replacing otherwise we'll end up with
  // a | b expanded to a | a | b.
  const aClone = clone(a);
  aClone.id = getId();
  const bClone = clone(b);
  bClone.id = getId();
  const union = flatten(build.tUnion(aClone, bClone));
  return [
    [a.id, union],
    [b.id, union],
  ];
};

const unifyLiteral = (a: t.TLiteral, b: t.TLiteral): Subst[] => {
  if (equal(a, b)) {
    return [];
  }

  if (!a.frozen && !b.frozen) {
    return widen(a, b);
  }

  const aLit = a.literal;
  const bLit = b.literal;

  throw new Error(`${aLit.t} != ${bLit.t}`);
};

// TODO: function subtyping
// TODO: optional/default params
const unifyFun = (a: t.TFun, b: t.TFun): Subst[] => {
  // assume that type generator has already done the appropriate
  // subtyping and partial application checks
  // WARNING: `getParamType` can return a copy of the original type if
  // it has to make it optional.  How do we deal with this?
  const aParamTypes = a.paramTypes.map(getParamType);
  const bParamTypes = b.paramTypes.map(getParamType);

  const constraints: Constraint[] = [
    ...zip(aParamTypes, bParamTypes),
    [a.retType, b.retType],
  ];

  const result = unify(constraints);

  return result;
};

const unifyCon = (a: t.TCon, b: t.TCon): Subst[] => {
  if (a.name !== b.name) {
    if (!a.frozen && !b.frozen) {
      return widen(a, b);
    }
    throw new Error(`type constructor mismatch: ${a.name} != ${b.name}`);
  }

  if (a.typeArgs.length !== b.typeArgs.length) {
    // TODO: support this via option/default type args
    throw new Error("type constructors have different number of type args");
  }

  // TODO: don't bother calling unify if there are no type args
  return unify(zip(a.typeArgs, b.typeArgs));
};

// TODO: subtyping
// TODO: optional properties
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
};

const unifyTuple = (a: t.TTuple, b: t.TTuple): Subst[] => {
  if (a.types.length !== b.types.length) {
    
    throw new Error("tuple types have different numbers of elements");
  }

  return unify(zip(a.types, b.types));
};

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

// TODO: add a check to avoid recursive unification and add a test for it
const substitute = (sub: Subst, type: t.Type): t.Type => {
  switch (type.t) {
    case "TLit":
      return type.id === sub[0] ? sub[1] : type;
    case "TVar":
      return type.id === sub[0] ? sub[1] : type;
    case "TFun": {
      if (type.id === sub[0]) {
        return sub[1];
      }
      // TODO: check if there's actually anything to subtitute
      const result = build.tFun(
        type.paramTypes.map((p) => {
          return build.tParam(p.name, substitute(sub, p.type), p.optional);
        }),
        substitute(sub, type.retType)
      );
      result.id = type.id;
      result.frozen = type.frozen;
      return result;
    }
    case "TCon": {
      if (type.id === sub[0]) {
        return sub[1];
      } else {
        // TODO: check if there's actually anything to subtitute
        const result = build.tCon(
          type.name,
          type.typeArgs.map((a) => substitute(sub, a))
        );
        result.id = type.id;
        result.frozen = type.frozen;
        return result;
      }
    }
    case "TRec": {
      if (type.id === sub[0]) {
        return sub[1];
      }
      const result = build.tRec(
        ...type.properties.map((p) =>
          build.tProp(p.name, substitute(sub, p.type), p.optional)
        )
      );
      result.id = type.id;
      result.frozen = type.frozen;
      return result;
    }
    case "TTuple": {
      if (type.id === sub[0]) {
        return sub[1];
      } 
      const result = build.tTuple(
        ...type.types.map((e) => substitute(sub, e))
      );
      result.id = type.id;
      result.frozen = type.frozen;
      return result;
    }
    case "TUnion": {
      if (type.id === sub[0]) {
        return sub[1];
      }
      const result = build.tUnion(
        ...type.types.map((e) => substitute(sub, e))
      );
      result.id = type.id;
      result.frozen = type.frozen;
      return result;
    }
  }
};

export const applySubst = (subs: Subst[], type: t.Type): t.Type => {
  // This is left recursive to match unify which is also left recursive.
  return subs.reduce((prev, curr) => substitute(curr, prev), type);
};
