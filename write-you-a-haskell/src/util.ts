import { Map, OrderedSet } from "immutable";

import { Env } from "./context";
import {
  Type,
  TVar,
  Subst,
  Constraint,
  Scheme,
  isTLit,
  isTMem,
} from "./type-types";
import {
  isTCon,
  isTVar,
  isTFun,
  isTUnion,
  isTRec,
  isTTuple,
  isTPrim,
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
): readonly Constraint[];
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
  if (isTPrim(a)) {
    return s.get(a.id) ?? a;
  }
  if (isTLit(a)) {
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
    return (
      s.get(a.id) ?? {
        ...a,
        properties: a.properties.map((prop) => ({
          ...prop,
          type: apply(s, prop.type),
        })),
      }
    );
  }
  if (isTTuple(a)) {
    return (
      s.get(a.id) ?? {
        ...a,
        types: apply(s, a.types),
      }
    );
  }
  if (isTMem(a)) {
    return (
      s.get(a.id) ?? {
        ...a,
        object: apply(s, a.object),
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

  if (Array.isArray(a.types)) {
    return {
      ...a,
      types: apply(s, a.types),
    };
  }

  throw new Error(`apply doesn't handle ${a}`);
}

export function ftv(type: Type): OrderedSet<TVar>;
export function ftv(scheme: Scheme): OrderedSet<TVar>;
export function ftv(types: readonly Type[]): OrderedSet<TVar>;
export function ftv(schemes: readonly Scheme[]): OrderedSet<TVar>;
export function ftv(constraint: Constraint): OrderedSet<TVar>; // special case of Type[]
export function ftv(constraint: readonly Constraint[]): OrderedSet<TVar>; // special case of Type[]
export function ftv(env: Env): OrderedSet<TVar>;
export function ftv(a: any): any {
  // instance Substitutable Type
  if (isTCon(a)) {
    return OrderedSet(a.params).flatMap(ftv);
  }
  if (isTVar(a)) {
    return OrderedSet([a]);
  }
  if (isTPrim(a)) {
    return OrderedSet([]);
  }
  if (isTLit(a)) {
    return OrderedSet([]);
  }
  if (isTFun(a)) {
    return OrderedSet([...a.args, a.ret]).flatMap(ftv);
  }
  if (isTUnion(a)) {
    return ftv(a.types);
  }
  if (isTRec(a)) {
    const types = a.properties.map((prop) => prop.type);
    return ftv(types);
  }
  if (isTTuple(a)) {
    return ftv(a.types);
  }
  if (isTMem(a)) {
    return ftv(a.object);
  }

  // instance Substitutable Scheme
  if (isScheme(a)) {
    return ftv(a.type).subtract(a.qualifiers);
  }

  // instance Substitutable Constraint
  // instance Substitutable a => Substitutable [a]
  if (Array.isArray(a)) {
    return OrderedSet(a).flatMap(ftv);
  }

  // instance Substitutable Env
  if (Map.isMap(a)) {
    const env = a as Env;
    return OrderedSet(env.valueSeq()).flatMap(ftv);
  }

  throw new Error(`ftv doesn't handle ${a}`);
}

export function zip<A, B>(
  as: readonly A[],
  bs: readonly B[]
): readonly [A, B][] {
  const length = Math.min(as.length, bs.length);
  const result: [A, B][] = [];
  for (let i = 0; i < length; i++) {
    result.push([as[i], bs[i]]);
  }
  return result;
}

export function zipTypes(
  ts1: readonly Type[],
  ts2: readonly Type[],
  subtype: "Left" | "Right" | null,
  funcArgs?: boolean
): readonly Constraint[] {
  const length = Math.min(ts1.length, ts2.length);
  const result: Constraint[] = [];
  for (let i = 0; i < length; i++) {
    // If the types that we're zipping are args passed to a function
    // then we need to set the `subtype` direction correctly.
    if (funcArgs && ts1[i].tag === "TFun") {
      result.push({ types: [ts1[i], ts2[i]], subtype: "Left" });
    } else if (funcArgs && ts2[i].tag === "TFun") {
      result.push({ types: [ts1[i], ts2[i]], subtype: "Right" });
    } else {
      result.push({ types: [ts1[i], ts2[i]], subtype });
    }
  }
  return result;
}

export function assertUnreachable(x: never): never {
  throw new Error("Didn't expect to get here");
}
