import { Map } from "immutable";

import { Env, Context, State, newId } from "./context";
import { UnboundVariable } from "./errors";
import * as tt from "./type-types";
import * as st from "./syntax-types";
import { zip, apply, ftv, assertUnreachable } from "./util";
import { runSolve } from "./constraint-solver";
import * as tb from "./type-builders";
import { getResultType } from "./graphql";

const emptyEnv: Env = Map();

export const inferExpr = (
  env: Env,
  expr: st.Expr,
  state?: State
): tt.Scheme => {
  const initCtx: Context = {
    env: env,
    state: state || { count: 0 },
  };
  const [type, cs] = infer(expr, initCtx);
  const subs = runSolve(cs, initCtx);
  return closeOver(apply(subs, type));
};

//  Return the internal constraints used in solving for the type of an expression
export const constraintsExpr = (
  env: Env,
  expr: st.Expr
): readonly [readonly tt.Constraint[], tt.Subst, tt.Type, tt.Scheme] => {
  const initCtx: Context = {
    env: env,
    state: { count: 0 },
  };
  const [ty, cs] = infer(expr, initCtx);
  const subst = runSolve(cs, initCtx);
  const sc = closeOver(apply(subst, ty));
  return [cs, subst, ty, sc];
};

// Canonicalize and return the polymorphic toplevel type
const closeOver = (type: tt.Type): tt.Scheme => {
  const result = normalize(generalize(emptyEnv, type));
  // We freeze the result type before returning it so that it
  // can't be widened when used in subsequent top-level decls.
  tt.freeze(result.type);
  return result;
};

// remove duplicates from the array
function nub<T extends { id: number }>(array: readonly T[]): readonly T[] {
  const ids: number[] = [];
  return array.filter((tv) => {
    if (!ids.includes(tv.id)) {
      ids.push(tv.id);
      return true;
    }
    return false;
  });
}

// TODO: simplify the normalization by generating names for type variables at print time.
// Renames type variables so that they start with 'a' and there are no gaps
const normalize = (sc: tt.Scheme): tt.Scheme => {
  const body = sc.type;
  const keys = nub([...ftv(body)]).map((tv) => tv.id);
  const values: tt.TVar[] = keys.map((key, index) => {
    return { __type: "TVar", id: key, name: letterFromIndex(index) };
  });
  const mapping: Record<number, tt.TVar> = Object.fromEntries(
    zip(keys, values)
  );

  const normType = (type: tt.Type): tt.Type => {
    switch (type.__type) {
      case "TFun": {
        const { args, ret } = type;
        return {
          ...type,
          args: args.map(normType),
          ret: normType(ret),
        };
      }
      case "TGen":
        // TODO: Lookup the definition of Array, Promise, etc.
        // TODO: fix - type variable s not in signature Array<s>
        // s is clearly in Array<s>
        return {
          ...type,
          params: type.params.map(normType),
        };
      case "TVar": {
        const replacement = mapping[type.id];
        if (replacement) {
          return replacement;
        } else {
          throw new Error(
            `type variable ${tt.print(type)} not in signature ${tt.print(body)}`
          );
        }
      }
      case "TUnion": {
        return {
          ...type,
          types: type.types.map(normType),
        };
      }
      case "TRec": {
        return {
          ...type,
          properties: type.properties.map((prop) => ({
            ...prop,
            type: normType(prop.type),
          })),
        };
      }
      case "TTuple": {
        return {
          ...type,
          types: type.types.map(normType),
        };
      }
      case "TPrim": {
        return type;
      }
      case "TLit": {
        return type;
      }
      case "TMem": {
        return {
          ...type,
          object: normType(type.object),
        };
      }
      default:
        assertUnreachable(type);
    }
  };

  return tt.scheme(values, normType(body));
};

// Lookup type in the environment
const lookupEnv = (name: string, ctx: Context): tt.Type => {
  const value = ctx.env.get(name);
  if (!value) {
    // TODO: keep track of all unbound variables in a decl
    // we can return `unknown` as the type so that unifcation
    // can continue.
    throw new UnboundVariable(name);
  }
  return instantiate(value, ctx);
};

const letterFromIndex = (index: number): string =>
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

const generalize = (env: Env, type: tt.Type): tt.Scheme => {
  return tt.scheme(ftv(type).subtract(ftv(env)).toArray(), type);
};

type InferResult<T extends tt.Type = tt.Type> = readonly [
  T,
  readonly tt.Constraint[]
];

const infer = (expr: st.Expr, ctx: Context): InferResult => {
  // prettier-ignore
  switch (expr.__type) {
    case "ELit":     return inferLit    (expr, ctx);
    case "EIdent":   return inferIdent  (expr, ctx);
    case "ELam":     return inferLam    (expr, ctx);
    case "EApp":     return inferApp    (expr, ctx);
    case "ELet":     return inferLet    (expr, ctx);
    case "EFix":     return inferFix    (expr, ctx);
    case "EOp":      return inferOp     (expr, ctx);
    case "EIf":      return inferIf     (expr, ctx);
    case "EAwait":   return inferAwait  (expr, ctx);
    case "ERec":     return inferRec    (expr, ctx);
    case "ETuple":   return inferTuple  (expr, ctx);
    case "EMem":     return inferMem    (expr, ctx);
    case "ERest":    return inferRest   (expr, ctx);
    case "ETagTemp": return inferTagTemp(expr, ctx);
    default: assertUnreachable(expr);
  }
};

const inferApp = (expr: st.EApp, ctx: Context): InferResult => {
  const { fn, args } = expr;
  const [t_fn, cs_fn] = infer(fn, ctx);
  const [t_args, cs_args] = inferMany(args, ctx);
  const tv = fresh(ctx);
  // This is almost the reverse of what we return from the "Lam" case
  return [
    tv,
    [
      ...cs_fn,
      ...cs_args,
      { types: [tb.tfun(t_args, tv, ctx), t_fn], subtype: true },
    ],
  ];
};

const inferAwait = (expr: st.EAwait, ctx: Context): InferResult => {
  if (!ctx.async) {
    throw new Error("Can't use `await` inside non-async lambda");
  }

  const [type, cs] = infer(expr.expr, ctx);

  // TODO: convert Promise from t.TCon to TAbs/TGen
  if (tt.isTGen(type) && type.name === "Promise") {
    if (type.params.length !== 1) {
      // TODO: How do we prevent people from overwriting built-in types
      // TODO: How do we allow local shadowing of other types within a module?
      //       Do we even want to?
      throw new Error("Invalid Promise type");
    }
    return [type.params[0], cs];
  }

  // If the await expression isn't a promise then we return the inferred
  // type and constraints from the awaited expression.
  return [type, cs];
};

const inferFix = (expr: st.EFix, ctx: Context): InferResult => {
  const { expr: e } = expr;
  const [t, cs] = infer(e, ctx);
  const tv = fresh(ctx);
  return [tv, [...cs, { types: [tb.tfun([tv], tv, ctx), t], subtype: false }]];
};

const inferIf = (expr: st.EIf, ctx: Context): InferResult => {
  const { cond, th, el } = expr;
  const [t1, cs1] = infer(cond, ctx);
  const [t2, cs2] = infer(th, ctx);
  const [t3, cs3] = infer(el, ctx);
  // This is similar how we'll handle n-ary apply
  const bool = tb.tprim("boolean", ctx);
  return [
    t2,
    [
      ...cs1,
      ...cs2,
      ...cs3,
      { types: [t1, bool], subtype: false },
      { types: [t2, t3], subtype: false },
    ],
  ];
};

const inferLam = (expr: st.ELam, ctx: Context): InferResult => {
  const { args, body } = expr;
  let variadic = false;
  const argCount = args.length;
  const tvs = args.map((arg, index) => {
    if (arg.__type === "EIdent") {
      return fresh(ctx);
    } else {
      if (index !== argCount - 1) {
        throw new Error("Rest param must come last.");
      }
      variadic = true;
      return tb.tgen("Array", [fresh(ctx)], ctx);
    }
  });
  // newCtx introduces a new scope
  const newCtx: Context = {
    ...ctx,
    env: ctx.env.withMutations((env) => {
      for (const [arg, tv] of zip(args, tvs)) {
        // t.scheme([], tv) is a type variable without any qualifiers
        switch (arg.__type) {
          case "EIdent": {
            env.set(arg.name, tt.scheme([], tv));
            break;
          }
          case "ERest": {
            env.set(arg.identifier.name, tt.scheme([], tv));
            break;
          }
          default:
            assertUnreachable(arg);
        }
      }
    }),
    async: expr.async,
  };
  const [type, cs] = infer(body, newCtx);
  // We wrap the return value in a promise if:
  // - the lambda is marked as async
  // - its inferred return value isn't already in a promise
  // TODO: add more general support for conditional types
  const ret =
    !expr.async || (tt.isTGen(type) && type.name === "Promise")
      ? type
      : freshTCon(ctx, "Promise", [type]);

  return [tb.tfun(tvs, ret, ctx, variadic), cs];
};

const inferLet = (expr: st.ELet, ctx: Context): InferResult => {
  const { pattern, value, body } = expr;
  const [t1, cs1] = infer(value, ctx);
  const subs = runSolve(cs1, ctx);

  const [newCtx, newCs] = inferPattern(pattern, t1, subs, ctx);
  const [t2, cs2] = infer(body, newCtx);

  // We apply subs from let's `value` to its `body`, namely t2 and cs2
  return [apply(subs, t2), [...cs1, ...newCs, ...apply(subs, cs2)]];
};

const inferPattern = (
  pattern: st.Pattern,
  type: tt.Type, // expected to already be inferred by caller
  subs: tt.Subst,
  ctx: Context
): [Context, readonly tt.Constraint[]] => {
  // TODO:
  // - Disallow reusing the same variable when destructuring a value

  const sc = generalize(apply(subs, ctx.env), apply(subs, type));

  switch (pattern.__type) {
    case "PVar": {
      // TODO: throw if the same name is used more than once in a pattern
      // we can have a separate function that traverses a pattern to collect
      // all of the used names before we call inferPattern().
      const newCtx = { ...ctx, env: ctx.env.set(pattern.name, sc) };
      return [newCtx, []];
    }
    case "PWild":
      return [ctx, []]; // doesn't affect binding
    case "PLit": {
      const litType = tb.tlit(pattern.value, ctx);
      tt.freeze(litType); // prevents widening of inferred type
      return [ctx, [{ types: [litType, type], subtype: false }]]; // doesn't affect binding
    }
    // NOTE: it only makes sense to infer PPrim patterns as part of pattern matching
    // since destructuring number | string to number isn't sound
    case "PPrim": {
      let primType: tt.TPrim;
      if (pattern.primName === "boolean") {
        primType = tb.tBool(ctx);
      } else if (pattern.primName === "number") {
        primType = tb.tNum(ctx);
      } else if (pattern.primName === "string") {
        primType = tb.tStr(ctx);
      } else {
        throw new Error(
          `TODO: handle ${pattern.primName} when inferring type from PPrim`
        );
      }
      tt.freeze(primType);
      return [ctx, [{ types: [primType, type], subtype: false }]];
    }
    case "PRec": {
      if (!tt.isTRec(type)) {
        throw new Error("type doesn't match pattern");
      }
      const cs: tt.Constraint[] = [];
      let newCtx = ctx;
      for (const pprop of pattern.properties) {
        const tprop = type.properties.find((p) => p.name === pprop.name);
        if (!tprop) {
          throw new Error(
            `${tt.print(type)} doesn't contain ${pprop.name} property`
          );
        }
        const result = inferPattern(pprop.pattern, tprop.type, subs, newCtx);
        newCtx = result[0];
        cs.push(...result[1]);
      }
      return [newCtx, cs];
    }
    case "PTuple": {
      if (!tt.isTTuple(type)) {
        throw new Error("type doesn't match pattern");
      }
      if (pattern.patterns.length !== type.types.length) {
        throw new Error("element count mismatch");
      }
      const cs: tt.Constraint[] = [];
      let newCtx = ctx;
      for (const [p, t] of zip(pattern.patterns, type.types)) {
        const result = inferPattern(p, t, subs, newCtx);
        newCtx = result[0];
        cs.push(...result[1]);
      }
      return [newCtx, cs];
    }
    default:
      assertUnreachable(pattern);
  }
};

const inferLit = (expr: st.ELit, ctx: Context): InferResult => {
  const lit = expr.value;
  return [tb.tlit(lit, ctx), []];
};

const inferOp = (expr: st.EOp, ctx: Context): InferResult => {
  const { op, left, right } = expr;
  const [ts, cs] = inferMany([left, right], ctx);
  const tv = fresh(ctx);
  return [
    tv,
    [...cs, { types: [tb.tfun(ts, tv, ctx), ops(op, ctx)], subtype: true }],
  ];
};

const inferRec = (expr: st.ERec, ctx: Context): InferResult<tt.TRec> => {
  const all_cs: tt.Constraint[] = [];
  const properties = expr.properties.map((prop: st.EProp): tt.TProp => {
    const [type, cs] = infer(prop.value, ctx);
    all_cs.push(...cs);
    return tb.tprop(prop.name, type);
  });
  return [tb.trec(properties, ctx), all_cs];
};

const inferTuple = (expr: st.ETuple, ctx: Context): InferResult<tt.TTuple> => {
  const [ts, cs] = inferMany(expr.elements, ctx);
  return [tb.ttuple(ts, ctx), cs];
};

const inferIdent = (expr: st.EIdent, ctx: Context): InferResult => {
  const type = lookupEnv(expr.name, ctx);
  return [type, []];
};

const unwrapProperty = (property: st.Expr): number | string => {
  if (property.__type === "EIdent") {
    return property.name;
  } else if (property.__type === "ELit" && property.value.__type === "LNum") {
    return property.value.value;
  } else {
    throw new Error("Not a valid property");
  }
};

const inferMem = (expr: st.EMem, ctx: Context): InferResult => {
  // TODO: handle nested property access, e.g. foo.bar.baz.
  const { object, property } = expr;

  // Handles member access on object literals
  if (object.__type === "ERec") {
    if (property.__type !== "EIdent") {
      throw new Error("property must be a variable when accessing a member");
    }

    const tobj = fresh(ctx);
    const [type, cs] = inferRec(object, ctx);
    const tMem1 = tb.tmem(tobj, unwrapProperty(property), ctx);
    const tMem2 = tb.tmem(type, unwrapProperty(property), ctx);
    const prop = type.properties.find((prop) => property.name === prop.name);
    if (!prop) {
      throw new Error(
        `Record literal doesn't contain property '${property.name}'`
      );
    }
    // This is sufficient since infer() will unify `tobj` with `type`.
    return [prop.type, [...cs, { types: [tMem1, tMem2], subtype: false }]];
  } else if (object.__type === "ETuple") {
    if (property.__type !== "ELit" || property.value.__type !== "LNum") {
      throw new Error(
        "property must be a number when accessing an index on a tuple"
      );
    }

    const tobj = fresh(ctx);
    const [type, cs] = inferTuple(object, ctx);
    const tMem1 = tb.tmem(tobj, unwrapProperty(property), ctx);
    const tMem2 = tb.tmem(type, unwrapProperty(property), ctx);

    if (property.value.value >= type.types.length) {
      throw new Error("index is greater than the size of the tuple");
    }

    const elemType = type.types[property.value.value];
    return [elemType, [...cs, { types: [tMem1, tMem2], subtype: false }]];
  } else if (object.__type !== "EIdent" && object.__type !== "EMem") {
    throw new Error("object must be a variable when accessing a member");
  }

  // TODO: have separate namespaces for types and values so that we can
  // support TypeScript's ability to use the same identifier for both.
  const [type, cs] =
    object.__type === "EIdent"
      ? inferIdent(object, ctx)
      : inferMem(object, ctx);

  if (tt.isTVar(type)) {
    const tobj = fresh(ctx);
    const tMem1 = tb.tmem(tobj, unwrapProperty(property), ctx);
    const tMem2 = tb.tmem(type, unwrapProperty(property), ctx);
    // This is sufficient since inferTMem() will unify `tobj` with `type`.
    return [tMem2, [{ types: [tMem1, tMem2], subtype: false }]];
  } else if (tt.isTRec(type)) {
    if (property.__type !== "EIdent") {
      throw new Error(
        "property must be a variable when accessing a member on a record"
      );
    }

    const prop = type.properties.find((prop) => prop.name === property.name);
    if (!prop) {
      throw new Error(
        `${tt.print(type)} doesn't contain property ${property.name}`
      );
    }
    return [prop.type, cs];
  } else if (tt.isTTuple(type)) {
    if (property.__type !== "ELit" || property.value.__type !== "LNum") {
      throw new Error(
        "property must be a number when accessing an index on a tuple"
      );
    }

    if (property.value.value >= type.types.length) {
      throw new Error("index is greater than the size of the tuple");
    }

    const elemType = type.types[property.value.value];
    return [elemType, cs];
  } else if (!tt.isTGen(type)) {
    throw new Error(`Can't use member access on ${type.__type}`);
  }

  if (object.__type === "EMem") {
    throw new Error("Didn't expect member access here");
  }

  const aliasedScheme = ctx.env.get(type.name);
  if (!aliasedScheme) {
    throw new Error(`No type named ${type.name} in environment`);
  }

  if (aliasedScheme.qualifiers.length !== type.params.length) {
    throw new Error(
      `number of type params in ${object.name} doesn't match those in ${type.name}`
    );
  }

  // Creates a bunch of substitutions from qualifier ids to type params
  const subs1: tt.Subst = Map(
    zip(aliasedScheme.qualifiers, type.params).map(([q, param]) => {
      // We need a fresh copy of the params so we don't accidentally end
      // sharing state between the type params.
      const freshParam = { ...param, id: newId(ctx) };
      return [q.id, freshParam];
    })
  );
  // Applies the substitutions to get a type matches the type alias we looked up
  const aliasedType = apply(subs1, aliasedScheme.type);

  if (
    type.name === "Array" &&
    property.__type === "ELit" &&
    property.value.__type === "LNum"
  ) {
    const resultType = tb.tunion(
      [type.params[0], tb.tlit({ __type: "LUndefined" }, ctx)],
      ctx
    );
    return [resultType, cs];
  }

  // TODO: handle aliased tuple types (not common so we can punt on it for now)
  if (!tt.isTRec(aliasedType)) {
    throw new Error(`Can't use member access on ${aliasedType.__type}`);
  }

  if (property.__type !== "EIdent") {
    throw new Error(
      "property must be a variable when accessing a member on a record"
    );
  }

  const prop = aliasedType.properties.find(
    (prop) => prop.name === property.name
  );

  if (!prop) {
    throw new Error(
      `${property.name} property doesn't exist on ${tt.print(aliasedType)}`
    );
  }

  // Replaces all free variables with fresh ones
  const subs2: tt.Subst = Map(
    [...ftv(prop.type)].map((v) => [v.id, fresh(ctx)])
  );
  const resultType = apply(subs2, prop.type);

  return [resultType, cs];
};

const inferRest = (expr: st.ERest, ctx: Context): InferResult => {
  throw new Error("TODO: impelment inferRest()");
};

const inferTagTemp = (expr: st.ETagTemp, ctx: Context): InferResult => {
  // from: sql`SELECT * FROM ${table} WHERE id = ${id}`;
  // to: sql(["SELECT * FROM ", " WHERE ID ", ""], table, id);
  const { tag, strings, expressions } = expr;

  const [t_tag, cs_tag] = infer(tag, ctx);
  const [t_strs, cs_strs] = inferMany(strings, ctx);
  const [t_exprs, cs_exprs] = inferMany(expressions, ctx);

  const tv = fresh(ctx);
  const stringArray = tb.tgen("Array", [tb.tprim("string", ctx)], ctx);

  if (tag.name === "gql") {
    // TODO:
    // - check that there expressions is empty (variables are passed separately)
    // - check that there is only a single string
    // In the future we could replace expressions with $ variables automatically
    const result = getResultType(strings[0].value.value, ctx);

    return [result, [...cs_tag, ...cs_strs, ...cs_exprs]];
  }

  return [
    tv,
    [
      ...cs_tag,
      ...cs_strs,
      ...cs_exprs,
      {
        types: [tb.tfun([stringArray, ...t_exprs], tv, ctx), t_tag],
        subtype: true,
      },
    ],
  ];
};

const inferMany = (
  exprs: readonly st.Expr[],
  ctx: Context
): [readonly tt.Type[], readonly tt.Constraint[]] => {
  const ts: tt.Type[] = [];
  const all_cs: tt.Constraint[] = [];
  for (const elem of exprs) {
    const [type, cs] = infer(elem, ctx);
    ts.push(type);
    all_cs.push(...cs);
  }
  return [ts, all_cs];
};

// NOTE: It's okay to reuse tNum here because the type is frozen.
const tNum: tt.TPrim = {
  __type: "TPrim",
  id: -1,
  name: "number",
  frozen: true,
};

// NOTES:
// - The params are frozen and should only unify if the args are sub-types.
// - The return type is not frozen to allow for easy widening if need be.

const ops = (op: st.EBinop, ctx: Context): tt.Type => {
  switch (op) {
    case "Add":
      return tb.tfun([tNum, tNum], tb.tprim("number", ctx), ctx);
    case "Mul":
      return tb.tfun([tNum, tNum], tb.tprim("number", ctx), ctx);
    case "Sub":
      return tb.tfun([tNum, tNum], tb.tprim("number", ctx), ctx);
    case "Eql":
      return tb.tfun([tNum, tNum], tb.tprim("boolean", ctx), ctx);
  }
};

// Destructuring from scratch
// - RHS should be a sub-type of the LHS
//   - e.g. let {x} = point2d in ...
//     where point2d is of the type {x: number, y: number}
// - destructuring a tuple is safe, because we know how big it is
//   - it's okay to destructure fewer items, remainder are ignored
//   - more items can be destructured, but extras end up
// - destructuring an array is unsafe
//   - must be pattern matched

// Notes on Algebraic Data Types
// - could be represented by union types
// - need a way to define type aliases
//   - e.g. Option<T> = Some<T> | None
// - How do we differentiate between Option<T> and Some<T>?
//   - does there need to be a difference, a function could
//     return either an Option<T> or a Some<T>
//   - what about destructuring?
//     - we can extract the `T` from `Some<T>`, but not `Option<T>`
//     - because it's a union
// - Promise<T> isn't a union, but we still want to prevent
//   destructuring
