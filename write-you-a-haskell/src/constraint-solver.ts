import { Map, Set } from "immutable";
import { assert } from "console";

import { Context, lookupEnv } from "./context";
import * as t from "./type-types";
import * as tb from "./type-builders";
import { apply, ftv, zip } from "./util";
import {
  InfiniteType,
  UnificationFail,
  UnificationMismatch,
  ExtraProperties,
  MissingProperties,
} from "./errors";

//
// Constraint Solver
//

const emptySubst: t.Subst = Map();

export const runSolve = (
  cs: readonly t.Constraint[],
  ctx: Context
): t.Subst => {
  return solver([emptySubst, cs], ctx);
};

const unifyMany = (
  constraints: readonly t.Constraint[],
  ctx: Context
): t.Subst => {
  if (constraints.length === 0) {
    return emptySubst;
  }
  const [c, ...rest] = constraints;
  const su1 = unifies(c, ctx);
  // TODO: figure out how to make this step non recursive
  const su2 = unifyMany(apply(su1, rest), ctx);
  return composeSubs(su2, su1);
};

export const unifies = (c: t.Constraint, ctx: Context): t.Subst => {
  const [t1, t2] = c;
  if (t.isTVar(t1)) return bind(t1, t2, ctx);
  if (t.isTVar(t2)) return bind(t2, t1, ctx);
  if (t.isTFun(t1) && t.isTFun(t2)) return unifyFuncs(t1, t2, ctx);
  if (t.isTPrim(t1) && t.isTPrim(t2) && t1.name === t2.name) return emptySubst;
  // TODO: create unifyLiterals()
  if (
    t.isTLit(t1) &&
    t.isTLit(t2) &&
    t1.value.tag === t2.value.tag &&
    t1.value.value === t2.value.value
  ) {
    return emptySubst;
  }
  if (t.isTCon(t1) && t.isTCon(t2) && t1.name === t2.name) {
    if (t1.params.length !== t2.params.length) {
      throw new UnificationMismatch(t1.params, t2.params);
    }
    return unifyMany(zip(t1.params, t2.params), ctx);
  }
  if (t.isTUnion(t1) && t.isTUnion(t2)) return unifyUnions(t1, t2, ctx);
  if (t.isTTuple(t1) && t.isTTuple(t2)) return unifyTuples(t1, t2, ctx);
  if (t.isTRec(t1) && t.isTRec(t2)) return unifyRecords(t1, t2, ctx);
  if (t.isTMem(t1) && t.isTMem(t2) && t1.property === t2.property) {
    const result = unifies([t1.object, t2.object], ctx);
    return result;
  }

  // TODO: we need to specify the .src so that the sub-type check
  // only occurs in valid situations.
  if (isSubType(t2, t1) || isSubType(t1, t2)) {
    return emptySubst;
  }

  // As long as the types haven't been frozen then this is okay
  // NOTE: We may need to add .src info in the future if we notice
  // any places where unexpected type widening is occurring.
  if (!t1.frozen && !t2.frozen) {
    return widenTypes(t1, t2, ctx);
  }

  throw new UnificationFail(t1, t2);
};

const unifyFuncs = (t1: t.TFun, t2: t.TFun, ctx: Context): t.Subst => {
  // infer() only ever creates a Lam node on the left side of a constraint
  // and an App on the right side of a constraint so this check is sufficient.
  if (t1.src === "Lam" && t2.src === "App") {
    // partial application
    if (t1.args.length > t2.args.length) {
      const t1_partial: t.Type = {
        tag: "TFun",
        id: t1.id, // is it safe to reuse `id` here?
        args: t1.args.slice(0, t2.args.length),
        ret: tb.tfun(t1.args.slice(t2.args.length), t1.ret, ctx),
        src: t1.src,
      };
      const constraints: readonly t.Constraint[] = [
        ...zip(t1_partial.args, t2.args),
        [t1_partial.ret, t2.ret],
      ];
      return unifyMany(constraints, ctx);
    }

    // subtyping: we ignore extra args
    // TODO: Create a `isSubType` helper function
    // TODO: update this once we support rest params
    if (t1.args.length < t2.args.length) {
      const t2_without_extra_args: t.Type = {
        tag: "TFun",
        id: t2.id, // is it safe to reuse `id` here?
        args: t2.args.slice(0, t1.args.length),
        ret: t2.ret,
        src: t2.src,
      };
      const constraints: readonly t.Constraint[] = [
        ...zip(t1.args, t2_without_extra_args.args),
        [t1.ret, t2_without_extra_args.ret],
      ];
      return unifyMany(constraints, ctx);
    }
  }

  // The reverse can happen when a callback is passed as an arg
  if (t1.src === "App" && t2.src === "Lam") {
    // Can partial application happen in this situation?

    // subtyping: we ignore extra args
    // TODO: Create a `isSubType` helper function
    // TODO: update this once we support rest params
    if (t1.args.length > t2.args.length) {
      const t1_without_extra_args: t.Type = {
        tag: "TFun",
        id: t1.id, // is it safe to reuse `id` here?
        args: t1.args.slice(0, t2.args.length),
        ret: t1.ret,
        src: t1.src,
      };
      const constraints: readonly t.Constraint[] = [
        ...zip(t1_without_extra_args.args, t2.args),
        [t1_without_extra_args.ret, t2.ret],
      ];
      return unifyMany(constraints, ctx);
    }
  }

  // TODO: add support for optional params
  // we can model optional params as union types, e.g. int | void
  if (t1.args.length !== t2.args.length) {
    throw new UnificationMismatch(t1.args, t2.args);
  }
  const constraints: readonly t.Constraint[] = [
    ...zip(t1.args, t2.args),
    [t1.ret, t2.ret],
  ];

  return unifyMany(constraints, ctx);
};

const unifyRecords = (t1: t.TRec, t2: t.TRec, ctx: Context): t.Subst => {
  const keys1 = t1.properties.map((prop) => prop.name);
  const keys2 = t2.properties.map((prop) => prop.name);

  let missingKeys: Set<string>;

  missingKeys = Set(keys1).subtract(keys2);
  if (missingKeys.size > 0) {
    if (t2.frozen) {
      throw new ExtraProperties(t1, [...missingKeys]);
    } else {
      throw new MissingProperties(t2, [...missingKeys]);
    }
  }

  missingKeys = Set(keys2).subtract(keys1);
  if (missingKeys.size > 0) {
    if (t1.frozen) {
      throw new ExtraProperties(t2, [...missingKeys]);
    } else {
      throw new MissingProperties(t1, [...missingKeys]);
    }
  }

  // TODO: warn about:
  // - keys that appear more than once in either t1 or t2
  //   (this should probably be a parse error)
  const keys = Set.intersect([keys1, keys2]).toJS() as string[];

  const t1_obj = Object.fromEntries(
    t1.properties.map((prop) => [prop.name, prop.type])
  );
  const t2_obj = Object.fromEntries(
    t2.properties.map((prop) => [prop.name, prop.type])
  );

  const ot1 = keys.map((key) => t1_obj[key]);
  const ot2 = keys.map((key) => t2_obj[key]);

  // TODO: create a custom fork unifyMany() that knows how to report
  // errors from individual properties failing to unify.
  if (ot1.length !== ot2.length) {
    throw new UnificationMismatch(ot1, ot2);
  }
  return unifyMany(zip(ot1, ot2), ctx);
};

const unifyTuples = (t1: t.TTuple, t2: t.TTuple, ctx: Context): t.Subst => {
  if (t1.types.length !== t2.types.length) {
    throw new UnificationFail(t1, t2);
  }
  // TODO: create a custom fork unifyMany() that can report which elements
  // failed to unify within t1 and t2
  if (t1.types.length !== t2.types.length) {
    throw new UnificationMismatch(t1.types, t2.types);
  }
  return unifyMany(zip(t1.types, t2.types), ctx);
};

const unifyUnions = (t1: t.TUnion, t2: t.TUnion, ctx: Context): t.Subst => {
  // Assume that the union types have been normalized by this point
  // This only works if the types that make up the unions are ordered
  // consistently.  Is there a way to do this?
  if (t1.types.length !== t2.types.length) {
    throw new UnificationMismatch(t1.types, t2.types);
  }
  return unifyMany(zip(t1.types, t2.types), ctx);
};

const composeSubs = (s1: t.Subst, s2: t.Subst): t.Subst => {
  return s2.map((t) => apply(s1, t)).merge(s1);
};

// Unification solver
const solver = (u: t.Unifier, ctx: Context): t.Subst => {
  const [su, cs] = u;
  if (cs.length === 0) {
    return su;
  }
  const [c, ...rest] = cs;
  const su1 = unifies(c, ctx);
  return solver([composeSubs(su1, su), apply(su1, rest)], ctx);
};

const bind = (tv: t.TVar, type: t.Type, ctx: Context): t.Subst => {
  if (type.tag === "TMem") {
    const { object, property } = type;
    if (object.tag === "TCon") {
      // Checks if there's an alias for the object.
      const alias = lookupEnv(object.name, ctx);
      if (alias.tag === "TRec") {
        const prop = alias.properties.find((prop) => prop.name === property);
        if (prop) {
          type = prop.type;
        } else {
          throw new Error(
            `${t.print(alias)} doesn't contain ${property} property`
          );
        }
      }
    }
  }
  if (type.tag === "TVar" && type.id === tv.id) {
    return emptySubst;
  } else if (occursCheck(tv, type)) {
    throw new InfiniteType(tv, type);
  } else {
    return Map([[tv.id, type]]);
  }
};

const occursCheck = (tv: t.TVar, t: t.Type): boolean => {
  return ftv(t).includes(tv);
};

const isSubType = (sub: t.Type, sup: t.Type): boolean => {
  if (t.isTPrim(sup) && sup.name === "number") {
    if (t.isTLit(sub) && sub.value.tag === "LNum") {
      return true;
    }
    if (t.isTUnion(sub) && sub.types.every((type) => isSubType(type, sup))) {
      return true;
    }
  }

  if (t.isTLit(sub) && t.isTLit(sup)) {
    return sub.value.value === sup.value.value;
  }

  if (t.isTTuple(sub) && t.isTCon(sup) && sup.name === "Array") {
    return sub.types.every((type) => isSubType(type, sup.params[0]));
  }

  // TODO: handle type aliases like Array<T> and Promise<T>
  // NOTE: Promise<string> | Promise<number> can be used in place of a
  // Promise<string | number> because both Promise<string> and Promise<number>
  // are subtypes of Promise<string | number>.

  return false;
};

const flattenUnion = (type: t.Type): t.Type[] => {
  if (t.isTUnion(type)) {
    return type.types.flatMap(flattenUnion);
  } else {
    return [type];
  }
};

export const computeUnion = (t1: t.Type, t2: t.Type, ctx: Context): t.Type => {
  const names: string[] = [];
  // Flattens types
  const types = [...flattenUnion(t1), ...flattenUnion(t2)];

  // Splits by type of type
  const primTypes = nubPrimTypes(types.filter(t.isTPrim));
  let litTypes = nubLitTypes(types.filter(t.isTLit));

  // Subsumes literals into primitives
  for (const primType of primTypes) {
    if (primType.name === "number") {
      litTypes = litTypes.filter((type) => type.value.tag !== "LNum");
    } else if (primType.name === "boolean") {
      litTypes = litTypes.filter((type) => type.value.tag !== "LBool");
    } else if (primType.name === "string") {
      litTypes = litTypes.filter((type) => type.value.tag !== "LStr");
    }
  }

  // Replaces `true | false` with `boolean`
  const boolTypes = litTypes.filter((type) => type.value.tag === "LBool");
  if (boolTypes.length === 2) {
    litTypes = litTypes.filter((type) => type.value.tag !== "LBool");
    // It's safe to push without checking if primTypes already contains
    // `boolean` because if it did then `boolTypes` would've been empty.
    primTypes.push(tb.tprim("boolean", ctx));
  }

  // TODO:
  // - subsume tuples where each element is the same into an Array of that element
  //   e.g. ["hello", "world"] should be subsumed by Array<string>, more generally
  //   if each element is a subtype of T then a tuple of those elements is a subtype
  //   of Array<T>.
  //   NOTE: TypeScript doesn't do this yet.
  // - need to introduce type aliases to model Array<T>, Promise<T>, etc.
  //   in particular we want to support the following:
  //   type Array<T> = {
  //     get length: number,
  //     map: <U>((T, number, Array<T>) => U) => Array<U>,
  //     ...
  //   }
  // - start by trying to build a type that represents the rhs, it should look
  //   something like:
  //   <T>{lenght: number, map: <U>((T, number, Array<T>) => U) => Array<U>}
  //
  // What do we want to do about element access on arrays?
  // 1. return Maybe<T> (or T | undefined) and force people to check the result
  // 2. have a version that throws if we exceed the bounds of the array
  // 3. have an unsafe version that silently return undefined if we exceed the bounds
  //
  // Rescript does 2.
  // TypeScript does 3.

  const filteredTypes = [...primTypes, ...litTypes];

  if (filteredTypes.length === 1) {
    return filteredTypes[0];
  }

  return tb.tunion(filteredTypes, ctx);
};

const nubPrimTypes = (primTypes: readonly t.TPrim[]): t.TPrim[] => {
  const names: t.PrimName[] = [];
  return primTypes.filter((pt) => {
    if (!names.includes(pt.name)) {
      names.push(pt.name);
      return true;
    }
    return false;
  });
};

const nubLitTypes = (litTypes: readonly t.TLit[]): t.TLit[] => {
  const values: (number | string | boolean)[] = [];
  return litTypes.filter((lt) => {
    if (!values.includes(lt.value.value)) {
      values.push(lt.value.value);
      return true;
    }
    return false;
  });
};

// Eventually we'll want to be able to widen more than two at the same
// time if we need to widen types as part of pattern matching.
export const widenTypes = (t1: t.Type, t2: t.Type, ctx: Context): t.Subst => {
  assert(!t1.frozen, "t1 should not be frozen when calling widenTypes");
  assert(!t2.frozen, "t2 should not be frozen when calling widenTypes");

  const union = computeUnion(t1, t2, ctx);

  const result: t.Subst = Map([
    [t1.id, union],
    [t2.id, union],
  ]);

  return result;
};
