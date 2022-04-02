import { Map, OrderedSet } from "immutable";

import { Context, Env, newId } from "./context";
import { UnboundVariable } from "./errors";
import {
  Type,
  TGen,
  TVar,
  Subst,
  Constraint,
  Scheme,
  isTLit,
  isTMem,
} from "./type-types";
import {
  isTGen,
  isTVar,
  isTFun,
  isTUnion,
  isTRec,
  isTTuple,
  isTPrim,
  isScheme,
  scheme,
} from "./type-types";
import * as tt from "./type-types";
import * as tb from "./type-builders";

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
  if (isTGen(a)) {
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
  if (isTGen(a)) {
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
  subtype: boolean,
  funcArgs?: boolean
): readonly Constraint[] {
  const length = Math.min(ts1.length, ts2.length);
  const result: Constraint[] = [];
  for (let i = 0; i < length; i++) {
    if (funcArgs && ts1[i].__type === "TFun" && ts2[i].__type === "TFun") {
      // Reverses the order of the types so that the TFun is first.
      // This can happen when a function is passed as a callback.
      // The callback passed should be a subtype of the expected param
      // type.  We always want to type that is a subtype to be first
      // when `subtype` is set to true.
      result.push({ types: [ts2[i], ts1[i]], subtype: true });
    } else {
      result.push({ types: [ts1[i], ts2[i]], subtype });
    }
  }
  return result;
}

export function assertUnreachable(x: never): never {
  throw new Error("Didn't expect to get here");
}

export const letterFromIndex = (index: number): string =>
  String.fromCharCode(97 + index);

// TODO: defer naming until print time
export const fresh = (ctx: Context): TVar => {
  const id = newId(ctx);
  return {
    __type: "TVar",
    id: id,
    name: letterFromIndex(id),
  };
};

export const freshTCon = (
  ctx: Context,
  name: string,
  params: Type[] = []
): TGen => {
  return tb.tgen(name, params, ctx);
};

// Lookup type in the environment
export const lookupEnv = (name: string, ctx: Context): Type => {
  const value = ctx.env.get(name);
  if (!value) {
    // TODO: keep track of all unbound variables in a decl
    // we can return `unknown` as the type so that unifcation
    // can continue.
    throw new UnboundVariable(name);
  }
  return instantiate(value, ctx);
};

const instantiate = (sc: Scheme, ctx: Context): Type => {
  const freshQualifiers = sc.qualifiers.map(() => fresh(ctx));
  const subs = Map(
    zip(
      sc.qualifiers.map((qual) => qual.id),
      freshQualifiers
    )
  );
  return apply(subs, sc.type);
};

export const simplifyUnion = (union: tt.TUnion, ctx: Context): tt.Type => {
  const { types } = union;
  // Splits by type of type
  const primTypes = nubPrimTypes(types.filter(tt.isTPrim));
  let litTypes = nubLitTypes(types.filter(tt.isTLit));

  // Subsumes literals into primitives
  for (const primType of primTypes) {
    if (primType.name === "number") {
      litTypes = litTypes.filter((type) => type.value.__type !== "LNum");
    } else if (primType.name === "boolean") {
      litTypes = litTypes.filter((type) => type.value.__type !== "LBool");
    } else if (primType.name === "string") {
      litTypes = litTypes.filter((type) => type.value.__type !== "LStr");
    }
  }

  // Replaces `true | false` with `boolean`
  const boolTypes = litTypes.filter((type) => type.value.__type === "LBool");
  if (boolTypes.length === 2) {
    litTypes = litTypes.filter((type) => type.value.__type !== "LBool");
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

const nubPrimTypes = (primTypes: readonly tt.TPrim[]): tt.TPrim[] => {
  const names: tt.PrimName[] = [];
  return primTypes.filter((pt) => {
    if (!names.includes(pt.name)) {
      names.push(pt.name);
      return true;
    }
    return false;
  });
};

const nubLitTypes = (litTypes: readonly tt.TLit[]): tt.TLit[] => {
  const values: (number | string | boolean | null | undefined)[] = [];
  return litTypes.filter((lt) => {
    if (lt.value.__type === "LNull") {
      if (!values.includes(null)) {
        values.push(null);
        return true;
      }
      return false;
    }
    if (lt.value.__type === "LUndefined") {
      if (!values.includes(undefined)) {
        values.push(undefined);
        return true;
      }
      return false;
    }
    if (!values.includes(lt.value.value)) {
      values.push(lt.value.value);
      return true;
    }
    return false;
  });
};

export const replaceQualifiers = (
  scheme: tt.Scheme,
  typeArgs: readonly tt.Type[],
  ctx: Context,
): tt.Type => {
  // Creates a bunch of substitutions from qualifier ids to type params
  const subs1: tt.Subst = Map(
    zip(scheme.qualifiers, typeArgs).map(([q, param]) => {
      // We need a fresh copy of the params so we don't accidentally end
      // sharing state between the type params.
      const freshParam = { ...param, id: newId(ctx) };
      return [q.id, freshParam];
    })
  );

  // Applies the substitutions to get a type matches the type alias we looked up
  return apply(subs1, scheme.type);
};
