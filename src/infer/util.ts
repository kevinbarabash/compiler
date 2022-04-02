import { Map, OrderedSet } from "immutable";

import { Context, Env, newId } from "./context";
import { UnboundVariable } from "./errors";
import * as tt from "./type-types";
import * as tb from "./type-builders";

export function apply(s: tt.Subst, type: tt.Type): tt.Type;
export function apply(s: tt.Subst, scheme: tt.Scheme): tt.Scheme;
export function apply(
  s: tt.Subst,
  types: readonly tt.Type[]
): readonly tt.Type[];
export function apply(
  s: tt.Subst,
  schemes: readonly tt.Scheme[]
): readonly tt.Scheme[];
export function apply(s: tt.Subst, constraint: tt.Constraint): tt.Constraint; // special case of tt.Type[]
export function apply(
  s: tt.Subst,
  constraint: readonly tt.Constraint[]
): readonly tt.Constraint[];
export function apply(
  s: tt.Subst,
  constraint: readonly tt.Constraint[]
): readonly tt.Constraint[]; // this should just work
export function apply(s: tt.Subst, env: Env): Env;
export function apply(s: tt.Subst, a: any): any {
  // instance tt.Substitutable tt.Type
  if (tt.isTVar(a)) {
    return s.get(a.id) ?? a;
  }
  if (tt.isTPrim(a)) {
    return s.get(a.id) ?? a;
  }
  if (tt.isTLit(a)) {
    return s.get(a.id) ?? a;
  }
  if (tt.isTGen(a)) {
    return (
      s.get(a.id) ?? {
        ...a,
        params: apply(s, a.params),
      }
    );
  }
  if (tt.isTFun(a)) {
    return (
      s.get(a.id) ?? {
        ...a,
        args: apply(s, a.args),
        ret: apply(s, a.ret),
      }
    );
  }
  if (tt.isTUnion(a)) {
    return (
      s.get(a.id) ?? {
        ...a,
        types: apply(s, a.types),
      }
    );
  }
  if (tt.isTRec(a)) {
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
  if (tt.isTTuple(a)) {
    return (
      s.get(a.id) ?? {
        ...a,
        types: apply(s, a.types),
      }
    );
  }
  if (tt.isTMem(a)) {
    return (
      s.get(a.id) ?? {
        ...a,
        object: apply(s, a.object),
      }
    );
  }

  // instance tt.Substitutable tt.Scheme
  if (tt.isScheme(a)) {
    return tt.scheme(
      a.qualifiers,
      apply(
        // remove all TVars from the tt.Substitution mapping that appear in the scheme as
        // qualifiers.
        // TODO: should this be using reduceRight to match Infer.hs' use of foldr?
        a.qualifiers.reduceRight((accum, val) => accum.delete(val.id), s),
        a.type
      )
    );
  }

  // instance tt.Substitutable tt.Constraint
  // instance tt.Substitutable a => tt.Substitutable [a]
  if (Array.isArray(a)) {
    return a.map((t) => apply(s, t));
  }

  // instance tt.Substitutable Env
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

export function ftv(type: tt.Type): OrderedSet<tt.TVar>;
export function ftv(scheme: tt.Scheme): OrderedSet<tt.TVar>;
export function ftv(types: readonly tt.Type[]): OrderedSet<tt.TVar>;
export function ftv(schemes: readonly tt.Scheme[]): OrderedSet<tt.TVar>;
export function ftv(constraint: tt.Constraint): OrderedSet<tt.TVar>; // special case of tt.Type[]
export function ftv(constraint: readonly tt.Constraint[]): OrderedSet<tt.TVar>; // special case of tt.Type[]
export function ftv(env: Env): OrderedSet<tt.TVar>;
export function ftv(a: any): any {
  // instance tt.Substitutable tt.Type
  if (tt.isTGen(a)) {
    return OrderedSet(a.params).flatMap(ftv);
  }
  if (tt.isTVar(a)) {
    return OrderedSet([a]);
  }
  if (tt.isTPrim(a)) {
    return OrderedSet([]);
  }
  if (tt.isTLit(a)) {
    return OrderedSet([]);
  }
  if (tt.isTFun(a)) {
    return OrderedSet([...a.args, a.ret]).flatMap(ftv);
  }
  if (tt.isTUnion(a)) {
    return ftv(a.types);
  }
  if (tt.isTRec(a)) {
    const types = a.properties.map((prop) => prop.type);
    return ftv(types);
  }
  if (tt.isTTuple(a)) {
    return ftv(a.types);
  }
  if (tt.isTMem(a)) {
    return ftv(a.object);
  }

  // instance tt.Substitutable tt.Scheme
  if (tt.isScheme(a)) {
    return ftv(a.type).subtract(a.qualifiers);
  }

  // instance tt.Substitutable tt.Constraint
  // instance tt.Substitutable a => tt.Substitutable [a]
  if (Array.isArray(a)) {
    return OrderedSet(a).flatMap(ftv);
  }

  // instance tt.Substitutable Env
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
  ts1: readonly tt.Type[],
  ts2: readonly tt.Type[],
  subtype: boolean,
  funcArgs?: boolean
): readonly tt.Constraint[] {
  const length = Math.min(ts1.length, ts2.length);
  const result: tt.Constraint[] = [];
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
export const fresh = (ctx: Context): tt.TVar => {
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
  params: tt.Type[] = []
): tt.TGen => {
  return tb.tgen(name, params, ctx);
};

// Lookup type in the environment
export const lookupEnv = (name: string, ctx: Context): tt.Type => {
  const value = ctx.env.get(name);
  if (!value) {
    // TODO: keep track of all unbound variables in a decl
    // we can return `unknown` as the type so that unifcation
    // can continue.
    throw new UnboundVariable(name);
  }
  return instantiate(value, ctx);
};

const instantiate = (sc: tt.Scheme, ctx: Context): tt.Type => {
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
  // TODO: handle more types in the future
  const funTypes = nubTypes(types.filter(tt.isTFun));
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
  const filteredTypes = [...funTypes, ...primTypes, ...litTypes];

  if (filteredTypes.length === 1) {
    return filteredTypes[0];
  }

  return tb.tunion(filteredTypes, ctx);
};

const mem = (haystack: readonly tt.Type[], needle: tt.Type): boolean => {
  return haystack.some(type => equal(type, needle));
}

const nubTypes = (types: readonly tt.TFun[]): tt.TFun[] => {
  const uniqueTypes: tt.Type[] = [];
  return types.filter((pt) => {
    if (!mem(uniqueTypes, pt)) {
      uniqueTypes.push(pt);
      return true;
    }
    return false;
  });
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
  ctx: Context
): tt.Type => {
  // Creates a bunch of tt.Substitutions from qualifier ids to type params
  const subs1: tt.Subst = Map(
    zip(scheme.qualifiers, typeArgs).map(([q, param]) => {
      // We need a fresh copy of the params so we don't accidentally end
      // sharing state between the type params.
      const freshParam = { ...param, id: newId(ctx) };
      return [q.id, freshParam];
    })
  );

  // Applies the tt.Substitutions to get a type matches the type alias we looked up
  return apply(subs1, scheme.type);
};

const equal = (t1: tt.Type, t2: tt.Type): boolean => {
  switch (t1.__type) {
    case "TFun": {
      if (!tt.isTFun(t2)) {
        return false;
      }
      if (t1.args.length !== t2.args.length) {
        return false;
      }
      return (
        zip(t1.args, t2.args).every((pair) => equal(...pair)) &&
        equal(t1.ret, t2.ret)
      );
    }
    case "TGen": {
      if (!tt.isTGen(t2)) {
        return false;
      }
      if (t1.params.length !== t2.params.length) {
        return false;
      }
      return (
        t1.name === t2.name &&
        zip(t1.params, t2.params).every((pair) => equal(...pair))
      );
    }
    case "TLit": {
      throw new Error("TODO: implement");
    }
    case "TPrim": {
      if (!tt.isTPrim(t2)) {
        return false;
      }
      return t1.name === t2.name;
    }
    case "TMem": {
      throw new Error("TODO: implement");
    }
    case "TRec": {
      throw new Error("TODO: implement");
    }
    case "TTuple": {
      throw new Error("TODO: implement");
    }
    case "TUnion": {
      throw new Error("TODO: implement");
    }
    case "TVar": {
      return true;
    }
  }
};
