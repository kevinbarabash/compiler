import { Map, Set } from "immutable";

import { Type, TCon, TVar, Subst, Constraint, Scheme, Env } from "./type-types";
import {
  isTCon,
  isTVar,
  isTFun,
  isTUnion,
  isTRec,
  isTTuple,
  isScheme,
  scheme,
} from "./type-types";

export function apply(s: Subst, type: Type): Type;
export function apply(s: Subst, scheme: Scheme): Scheme;
export function apply(s: Subst, types: readonly Type[]): readonly Type[];
export function apply(s: Subst, schemes: readonly Scheme[]): readonly Scheme[];
export function apply(s: Subst, constraint: Constraint): Constraint; // special case of Type[]
export function apply(
  s: Subst,
  constraint: readonly Constraint[]
): readonly Constraint[]; // this should just work
export function apply(s: Subst, env: Env): Env;
export function apply(s: Subst, a: any): any {
  // instance Substitutable Type
  if (isTVar(a)) {
    return s.get(a.id) ?? a;
  }
  if (isTCon(a)) {
    return (
      s.get(a.id) ?? {
        ...a,
        params: apply(s, a.params),
      }
    );
  }
  if (isTFun(a)) {
    return (
      s.get(a.id) ?? {
        ...a,
        args: apply(s, a.args),
        ret: apply(s, a.ret),
      }
    );
  }
  if (isTUnion(a)) {
    return (
      s.get(a.id) ?? {
        ...a,
        types: apply(s, a.types),
      }
    );
  }
  if (isTRec(a)) {
    throw new Error("STOPSHIP: implement TRec support");
  }
  if (isTTuple(a)) {
    return (
      s.get(a.id) ?? {
        ...a,
        types: apply(s, a.types),
      }
    );
  }

  // instance Substitutable Scheme
  if (isScheme(a)) {
    return scheme(
      a.qualifiers,
      apply(
        // remove all TVars from the Substitution mapping that appear in the scheme as
        // qualifiers.
        // TODO: should this be using reduceRight to match Infer.hs' use of foldr?
        a.qualifiers.reduceRight((accum, val) => accum.delete(val.id), s),
        a.type
      )
    );
  }

  // instance Substitutable Constraint
  // instance Substitutable a => Substitutable [a]
  if (Array.isArray(a)) {
    return a.map((t) => apply(s, t));
  }

  // instance Substitutable Env
  if (Map.isMap(a)) {
    return (a as Env).map((sc) => apply(s, sc));
  }

  throw new Error(`apply doesn't handle ${a}`);
}

export function ftv(type: Type): Set<TVar>;
export function ftv(scheme: Scheme): Set<TVar>;
export function ftv(types: readonly Type[]): Set<TVar>;
export function ftv(schemes: readonly Scheme[]): Set<TVar>;
export function ftv(constraint: Constraint): Set<TVar>; // special case of Type[]
export function ftv(env: Env): Set<TVar>;
export function ftv(a: any): any {
  // instance Substitutable Type
  if (isTCon(a)) {
    return Set.union(a.params.map(ftv));
  }
  if (isTVar(a)) {
    return Set([a]); // Set.singleton a
  }
  if (isTFun(a)) {
    return Set.union([...a.args.map(ftv), ftv(a.ret)]); // ftv t1 `Set.union` ftv t2
  }
  if (isTUnion(a)) {
    return ftv(a.types);
  }
  if (isTRec(a)) {
    throw new Error("STOPSHIP: implement TRec support");
  }
  if (isTTuple(a)) {
    return ftv(a.types);
  }

  // instance Substitutable Scheme
  if (isScheme(a)) {
    return ftv(a.type).subtract(a.qualifiers);
  }

  // instance Substitutable Constraint
  // instance Substitutable a => Substitutable [a]
  if (Array.isArray(a)) {
    return Set.union(a.map(ftv));
  }

  // instance Substitutable Env
  if (Map.isMap(a)) {
    const env = a as Env;
    return Set.union(env.valueSeq().map(ftv));
  }

  throw new Error(`ftv doesn't handle ${a}`);
}

export function zip<A, B>(as: readonly A[], bs: readonly B[]): [A, B][] {
  const length = Math.min(as.length, bs.length);
  const result: [A, B][] = [];
  for (let i = 0; i < length; i++) {
    result.push([as[i], bs[i]]);
  }
  return result;
}

export function assertUnreachable(x: never): never {
  throw new Error("Didn't expect to get here");
}
