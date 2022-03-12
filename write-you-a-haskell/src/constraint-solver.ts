import { Map, Set } from "immutable";

import {
  Type,
  TVar,
  Subst,
  Constraint,
  Unifier,
  equal,
  TUnion,
  Context,
  isTTuple,
  isTRec,
  print,
} from "./type-types";
import { isTCon, isTVar, isTFun, isTUnion } from "./type-types";
import { InfiniteType, UnificationFail, UnificationMismatch } from "./errors";
import { apply, ftv } from "./util";

//
// Constraint Solver
//

const emptySubst: Subst = Map();

export const runSolve = (cs: readonly Constraint[], ctx: Context): Subst => {
  return solver([emptySubst, cs], ctx);
};

const unifyMany = (
  ts1: readonly Type[],
  ts2: readonly Type[],
  ctx: Context
): Subst => {
  if (ts1.length !== ts2.length) {
    throw new UnificationMismatch(ts1, ts2);
  }
  if (ts1.length === 0 && ts2.length === 0) {
    return emptySubst;
  }
  const [t1, ...rest1] = ts1;
  const [t2, ...rest2] = ts2;
  const su1 = unifies(t1, t2, ctx);
  // TODO: figure out how to make this step non recursive
  const su2 = unifyMany(apply(su1, rest1), apply(su1, rest2), ctx);
  return composeSubs(su2, su1);
};

export const unifies = (t1: Type, t2: Type, ctx: Context): Subst => {
  if (equal(t1, t2)) {
    return emptySubst;
  } else if (isTVar(t1)) {
    return bind(t1, t2);
  } else if (isTVar(t2)) {
    return bind(t2, t1);
  } else if (isTFun(t1) && isTFun(t2)) {
    // infer() only ever creates a Lam node on the left side of a constraint
    // and an App on the right side of a constraint so this check is sufficient.
    if (t1.src === "Lam" && t2.src === "App") {
      // partial application
      if (t1.args.length > t2.args.length) {
        ctx.state.count++;
        const t1_partial: Type = {
          tag: "TFun",
          id: t1.id, // is it safe to reuse `id` here?
          args: t1.args.slice(0, t2.args.length),
          ret: {
            tag: "TFun",
            id: ctx.state.count,
            args: t1.args.slice(t2.args.length),
            ret: t1.ret,
          },
          src: t1.src,
        };
        return unifyMany(
          [...t1_partial.args, t1_partial.ret],
          [...t2.args, t2.ret],
          ctx
        );
      }

      // subtyping: we ignore extra args
      // TODO: Create a `isSubType` helper function
      // TODO: update this once we support rest params
      if (t1.args.length < t2.args.length) {
        const t2_without_extra_args: Type = {
          tag: "TFun",
          id: t2.id, // is it safe to reuse `id` here?
          args: t2.args.slice(0, t1.args.length),
          ret: t2.ret,
          src: t2.src,
        };
        return unifyMany(
          [...t1.args, t1.ret],
          [...t2_without_extra_args.args, t2_without_extra_args.ret],
          ctx
        );
      }
    }

    // The reverse can happen when a callback is passed as an arg
    if (t1.src === "App" && t2.src === "Lam") {
      // Can partial application happen in this situation?

      // subtyping: we ignore extra args
      // TODO: Create a `isSubType` helper function
      // TODO: update this once we support rest params
      if (t1.args.length > t2.args.length) {
        const t1_without_extra_args: Type = {
          tag: "TFun",
          id: t1.id, // is it safe to reuse `id` here?
          args: t1.args.slice(0, t2.args.length),
          ret: t1.ret,
          src: t1.src,
        };
        return unifyMany(
          [...t1_without_extra_args.args, t1_without_extra_args.ret],
          [...t2.args, t2.ret],
          ctx
        );
      }
    }

    // TODO: add support for optional params
    // we can model optional params as union types, e.g. int | void
    return unifyMany([...t1.args, t1.ret], [...t2.args, t2.ret], ctx);
  } else if (isTCon(t1) && isTCon(t2) && t1.name === t2.name) {
    return unifyMany(t1.params, t2.params, ctx);
  } else if (isTUnion(t1) && isTUnion(t2)) {
    // Assume that the union types have been normalized by this point
    // This only works if the types that make up the unions are ordered
    // consistently.  Is there a way to do this?
    return unifyMany(t1.types, t2.types, ctx);
  } else if (
    isTTuple(t1) &&
    isTTuple(t2) &&
    t1.types.length === t2.types.length
  ) {
    // TODO: create a custom fork unifyMany() that can report which elements
    // failed to unify within t1 and t2
    return unifyMany(t1.types, t2.types, ctx);
  } else if (isTRec(t1) && isTRec(t2)) {
    const keys1 = t1.properties.map((prop) => prop.name);
    const keys2 = t2.properties.map((prop) => prop.name);

    let missingKeys: Set<string>;

    missingKeys = Set(keys1).subtract(keys2);
    if (missingKeys.size > 0) {
      if (t2.frozen) {
        throw new Error(
          `${print(t1)} has the following extra keys: ${missingKeys.join(", ")}`
        );
      } else {
        throw new Error(
          `${print(t2)} is missing the following keys: ${missingKeys.join(
            ", "
          )}`
        );
      }
    }

    missingKeys = Set(keys2).subtract(keys1);
    if (missingKeys.size > 0) {
      if (t1.frozen) {
        throw new Error(
          `${print(t2)} has following extra keys: ${missingKeys.join(", ")}`
        );
      } else {
        throw new Error(
          `${print(t1)} is missing the following keys: ${missingKeys.join(
            ", "
          )}`
        );
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
    return unifyMany(ot1, ot2, ctx);
  } else {
    // As long as the types haven't been frozen then this is okay
    // NOTE: We may need to add .src info in the future if we notice
    // any places where expected type widening is occurring.
    if ("id" in t1 && "id" in t2 && !t1.frozen && !t2.frozen) {
      ctx.state.count++;
      const names: string[] = [];
      // Flattens types
      const types = [
        ...(isTUnion(t1) ? t1.types : [t1]),
        ...(isTUnion(t2) ? t2.types : [t2]),
      ].filter((type) => {
        // Removes duplicate TCons
        // TODO: handle TCons with params
        if (isTCon(type) && type.params.length === 0) {
          if (names.includes(type.name)) {
            return false;
          }
          names.push(type.name);
        }
        return true;
      });
      const union: TUnion = {
        tag: "TUnion",
        id: ctx.state.count,
        types,
      };
      const result: Subst = Map([
        [t1.id, union],
        [t2.id, union],
      ]);
      return result;
    }

    throw new UnificationFail(t1, t2);
  }
};

const composeSubs = (s1: Subst, s2: Subst): Subst => {
  return s2.map((t) => apply(s1, t)).merge(s1);
};

// Unification solver
const solver = (u: Unifier, ctx: Context): Subst => {
  const [su, cs] = u;
  if (cs.length === 0) {
    return su;
  }
  const [[t1, t2], ...cs0] = cs;
  const su1 = unifies(t1, t2, ctx);
  return solver([composeSubs(su1, su), apply(su1, cs0)], ctx);
};

const bind = (tv: TVar, t: Type): Subst => {
  if (t.tag === "TVar" && t.id === tv.id) {
    return emptySubst;
  } else if (occursCheck(tv, t)) {
    throw new InfiniteType(tv, t);
  } else {
    return Map([[tv.id, t]]);
  }
};

const occursCheck = (tv: TVar, t: Type): boolean => {
  return ftv(t).includes(tv);
};
