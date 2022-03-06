import { Map } from "immutable";

import { Type, TVar, Subst, Constraint, Unifier, equal, TUnion } from "./type";
import { isTCon, isTVar, isTFun, isTUnion } from "./type";
import { InfiniteType, UnificationFail, UnificationMismatch } from "./errors";
import { apply, ftv } from "./util";

//
// Constraint Solver
//

const emptySubst: Subst = Map();

export const runSolve = (cs: readonly Constraint[]): Subst => {
  return solver([emptySubst, cs]);
};

const unifyMany = (ts1: readonly Type[], ts2: readonly Type[]): Subst => {
  if (ts1.length !== ts2.length) {
    throw new UnificationMismatch(ts1, ts2);
  }
  if (ts1.length === 0 && ts2.length === 0) {
    return emptySubst;
  }
  const [t1, ...rest1] = ts1;
  const [t2, ...rest2] = ts2;
  const su1 = unifies(t1, t2);
  const su2 = unifyMany(apply(su1, rest1), apply(su1, rest2));
  return composeSubs(su2, su1);
};

export const unifies = (t1: Type, t2: Type): Subst => {
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
        const t1_partial: Type = {
          tag: "TFun",
          args: t1.args.slice(0, t2.args.length),
          ret: {
            tag: "TFun",
            args: t1.args.slice(t2.args.length),
            ret: t1.ret,
          },
          src: t1.src,
        };
        return unifyMany(
          [...t1_partial.args, t1_partial.ret],
          [...t2.args, t2.ret]
        );
      }

      // subtyping: we ignore extra args
      // TODO: Create a `isSubType` helper function
      // TODO: update this once we support rest params
      if (t1.args.length < t2.args.length) {
        const t2_without_extra_args: Type = {
          tag: "TFun",
          args: t2.args.slice(0, t1.args.length),
          ret: t2.ret,
          src: t2.src,
        };
        return unifyMany(
          [...t1.args, t1.ret],
          [...t2_without_extra_args.args, t2_without_extra_args.ret]
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
          args: t1.args.slice(0, t2.args.length),
          ret: t1.ret,
          src: t1.src,
        };
        return unifyMany(
          [...t1_without_extra_args.args, t1_without_extra_args.ret],
          [...t2.args, t2.ret]
        );
      }
    }

    // TODO: add support for optional params
    // we can model optional params as union types, e.g. int | void

    return unifyMany([...t1.args, t1.ret], [...t2.args, t2.ret]);
  } else if (isTCon(t1) && isTCon(t2) && t1.name === t2.name) {
    return unifyMany(t1.params, t2.params);
  } else if (isTUnion(t1) && isTUnion(t2)) {
    // Assume that the union types have been normalized by this point
    // This only works if the types that make up the unions are ordered
    // consistently.  Is there a way to do this?
    return unifyMany(t1.types, t2.types);
  } else {
    // As long as the types haven't been frozen then this is okay
    // NOTE: We may need to add .src info in the future if we notice
    // any places where expected type widening is occurring.
    if ("id" in t1 && "id" in t2 && !t1.frozen && !t2.frozen) {
      const union: TUnion = {
        tag: "TUnion",
        types: [t1, t2],
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
const solver = (u: Unifier): Subst => {
  const [su, cs] = u;
  if (cs.length === 0) {
    return su;
  }
  const [[t1, t2], ...cs0] = cs;
  const su1 = unifies(t1, t2);
  return solver([composeSubs(su1, su), apply(su1, cs0)]);
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