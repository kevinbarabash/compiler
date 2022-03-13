import { Map } from "immutable";

import { UnboundVariable } from "./errors";
import { freeze, scheme, tBool, tInt } from "./type-types";
import {
  Constraint,
  Env,
  Scheme,
  Subst,
  TCon,
  TVar,
  Type,
  Context,
  State,
  TProp,
  print,
} from "./type-types";
import {
  Binop,
  Expr,
  ELam,
  EProp,
  EApp,
  ELit,
  ELet,
  ERec,
  ETuple,
  EFix,
  EAwait,
  EOp,
  EIf,
  EVar,
  Pattern,
} from "./syntax-types";
import { zip, apply, ftv, assertUnreachable } from "./util";
import { runSolve } from "./constraint-solver";
import * as tb from "./type-builders";

const emptyEnv: Env = Map();

export const inferExpr = (env: Env, expr: Expr, state?: State): Scheme => {
  const initCtx: Context = {
    env: env,
    state: state || { count: 0 },
  };
  const [ty, cs] = infer(expr, initCtx);
  const subs = runSolve(cs, initCtx);
  return closeOver(apply(subs, ty));
};

//  Return the internal constraints used in solving for the type of an expression
export const constraintsExpr = (
  env: Env,
  expr: Expr
): readonly [readonly Constraint[], Subst, Type, Scheme] => {
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
const closeOver = (t: Type): Scheme => {
  const result = normalize(generalize(emptyEnv, t));
  // We freeze the result type before returning it so that it
  // can't be widened when used in subsequent top-level decls.
  freeze(result.type);
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
const normalize = (sc: Scheme): Scheme => {
  // Returns the names of the free variables in a type
  const fv = (type: Type): readonly TVar[] => {
    switch (type.tag) {
      case "TVar":
        return [type];
      case "TFun":
        return [...type.args.flatMap(fv), ...fv(type.ret)];
      case "TCon":
        return [];
      case "TUnion":
        return type.types.flatMap(fv);
      case "TRec":
        return type.properties.flatMap((prop) => fv(prop.type));
      case "TTuple":
        return type.types.flatMap(fv);
      default:
        assertUnreachable(type);
    }
  };

  const body = sc.type;
  const keys = nub(fv(body)).map((tv) => tv.id);
  const values: TVar[] = keys.map((key, index) => {
    return { tag: "TVar", id: key, name: letterFromIndex(index) };
  });
  const mapping: Record<number, TVar> = Object.fromEntries(zip(keys, values));

  const normType = (type: Type): Type => {
    switch (type.tag) {
      case "TFun": {
        const { args, ret } = type;
        return {
          ...type,
          args: args.map(normType),
          ret: normType(ret),
        };
      }
      case "TCon":
        return {
          ...type,
          params: type.params.map(normType),
        };
      case "TVar": {
        const replacement = mapping[type.id];
        if (replacement) {
          return replacement;
        } else {
          throw new Error("type variable not in signature");
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
      default:
        assertUnreachable(type);
    }
  };

  return scheme(values, normType(body));
};

// Lookup type in the environment
const lookupEnv = (name: string, ctx: Context): Type => {
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
export const fresh = (ctx: Context): TVar => {
  ctx.state.count++;
  return {
    tag: "TVar",
    id: ctx.state.count,
    name: letterFromIndex(ctx.state.count),
  };
};

export const freshTCon = (
  ctx: Context,
  name: string,
  params: Type[] = []
): TCon => {
  return tb.tcon(name, params, ctx);
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

const generalize = (env: Env, type: Type): Scheme => {
  return scheme(ftv(type).subtract(ftv(env)).toArray(), type);
};

type InferResult = readonly [Type, readonly Constraint[]];

const infer = (expr: Expr, ctx: Context): InferResult => {
  // prettier-ignore
  switch (expr.tag) {
    case "Lit":   return inferLit  (expr, ctx);
    case "Var":   return inferVar  (expr, ctx);
    case "Lam":   return inferLam  (expr, ctx);
    case "App":   return inferApp  (expr, ctx);
    case "Let":   return inferLet  (expr, ctx);
    case "Fix":   return inferFix  (expr, ctx);
    case "Op":    return inferOp   (expr, ctx);
    case "If":    return inferIf   (expr, ctx);
    case "Await": return inferAwait(expr, ctx);
    case "Rec":   return inferRec  (expr, ctx);
    case "Tuple": return inferTuple(expr, ctx);
    default: assertUnreachable(expr);
  }
};

const inferApp = (expr: EApp, ctx: Context): InferResult => {
  const { fn, args } = expr;
  const [t_fn, cs_fn] = infer(fn, ctx);
  const [t_args, cs_args] = inferMany(args, ctx);
  const tv = fresh(ctx);
  // This is almost the reverse of what we return from the "Lam" case
  return [tv, [...cs_fn, ...cs_args, [t_fn, tb.tfun(t_args, tv, ctx, "App")]]];
};

const inferAwait = (expr: EAwait, ctx: Context): InferResult => {
  if (!ctx.async) {
    throw new Error("Can't use `await` inside non-async lambda");
  }

  const [t, cs] = infer(expr.expr, ctx);

  // TODO: convert Promise from TCon to TAbs/TGen
  if (t.tag === "TCon" && t.name === "Promise") {
    if (t.params.length !== 1) {
      // TODO: How do we prevent people from overwriting built-in types
      // TODO: How do we allow local shadowing of other types within a module?
      //       Do we even want to?
      throw new Error("Invalid Promise type");
    }
    return [t.params[0], cs];
  }

  // If the await expression isn't a promise then we return the inferred
  // type and constraints from the awaited expression.
  return [t, cs];
};

const inferFix = (expr: EFix, ctx: Context): InferResult => {
  const { expr: e } = expr;
  const [t, cs] = infer(e, ctx);
  const tv = fresh(ctx);
  return [tv, [...cs, [tb.tfun([tv], tv, ctx, "Fix"), t]]];
};

const inferIf = (expr: EIf, ctx: Context): InferResult => {
  const { cond, th, el } = expr;
  const [t1, cs1] = infer(cond, ctx);
  const [t2, cs2] = infer(th, ctx);
  const [t3, cs3] = infer(el, ctx);
  // This is similar how we'll handle n-ary apply
  const bool = freshTCon(ctx, "Bool");
  return [t2, [...cs1, ...cs2, ...cs3, [t1, bool], [t2, t3]]];
};

const inferLam = (expr: ELam, ctx: Context): InferResult => {
  const { args, body } = expr;
  // newCtx introduces a new scope
  const tvs = args.map(() => fresh(ctx));
  const newCtx: Context = {
    ...ctx,
    env: ctx.env.withMutations((env) => {
      for (const [arg, tv] of zip(args, tvs)) {
        // scheme([], tv) is a type variable without any qualifiers
        env.set(arg, scheme([], tv));
      }
    }),
    async: expr.async,
  };
  const [t, cs] = infer(body, newCtx);
  // We wrap the return value in a promise if:
  // - the lambda is marked as async
  // - its inferred return value isn't already in a promise
  // TODO: add more general support for conditional types
  const ret =
    !expr.async || (t.tag === "TCon" && t.name === "Promise")
      ? t
      : freshTCon(ctx, "Promise", [t]);

  return [tb.tfun(tvs, ret, ctx, "Lam"), cs];
};

const inferLet = (expr: ELet, ctx: Context): InferResult => {
  const { pattern, value, body } = expr;
  const [t1, cs1] = infer(value, ctx);
  const subs = runSolve(cs1, ctx);

  const [newCtx, newCs] = inferPattern(pattern, t1, subs, ctx);
  const [t2, cs2] = infer(body, newCtx);

  // We apply subs from let's `value` to its `body`, namely t2 and cs2
  return [apply(subs, t2), [...cs1, ...newCs, ...apply(subs, cs2)]];
};

const inferPattern = (
  pattern: Pattern,
  type: Type, // expected to already be inferred by caller
  subs: Subst,
  ctx: Context
): [Context, readonly Constraint[]] => {
  // TODO:
  // - Disallow reusing the same variable when destructuring a value

  const sc = generalize(apply(subs, ctx.env), apply(subs, type));

  switch (pattern.tag) {
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
      const [t, cs] = infer(pattern.value, ctx);
      freeze(t); // prevents widening of inferred type
      return [ctx, [...cs, [t, type]]]; // doesn't affect binding
    }
    case "PRec": {
      if (type.tag !== "TRec") {
        throw new Error("type doesn't match pattern");
      }
      const cs: Constraint[] = [];
      let newCtx = ctx;
      for (const pprop of pattern.properties) {
        const tprop = type.properties.find((p) => p.name === pprop.name);
        if (!tprop) {
          throw new Error(
            `${print(type)} doesn't contain ${pprop.name} property`
          );
        }
        const result = inferPattern(pprop.pattern, tprop.type, subs, newCtx);
        cs.push(...result[1]);
        newCtx = result[0];
      }
      return [newCtx, cs];
    }
    case "PTuple": {
      if (type.tag !== "TTuple") {
        throw new Error("type doesn't match pattern");
      }
      if (pattern.patterns.length !== type.types.length) {
        throw new Error("element count mismatch");
      }
      const cs: Constraint[] = [];
      let newCtx = ctx;
      for (const [p, t] of zip(pattern.patterns, type.types)) {
        const result = inferPattern(p, t, subs, newCtx);
        cs.push(...result[1]);
        newCtx = result[0];
      }
      return [newCtx, cs];
    }
    default:
      assertUnreachable(pattern);
  }
};

const inferLit = (expr: ELit, ctx: Context): InferResult => {
  const lit = expr.value;
  // prettier-ignore
  switch (lit.tag) {
    case "LNum":       return [freshTCon(ctx, "Int" ), []];
    case "LBool":      return [freshTCon(ctx, "Bool"), []];
    case "LStr":       return [freshTCon(ctx, "Str" ), []];
  }
};

const inferOp = (expr: EOp, ctx: Context): InferResult => {
  const { op, left, right } = expr;
  const [ts, cs] = inferMany([left, right], ctx);
  const tv = fresh(ctx);
  return [tv, [...cs, [tb.tfun(ts, tv, ctx), ops(op)]]];
};

const inferRec = (expr: ERec, ctx: Context): InferResult => {
  const all_cs: Constraint[] = [];
  const properties = expr.properties.map((prop: EProp): TProp => {
    const [t, cs] = infer(prop.value, ctx);
    all_cs.push(...cs);
    return tb.tprop(prop.name, t);
  });
  return [tb.trec(properties, ctx), all_cs];
};

const inferTuple = (expr: ETuple, ctx: Context): InferResult => {
  const [ts, cs] = inferMany(expr.elements, ctx);
  return [tb.ttuple(ts, ctx), cs];
};

const inferVar = (expr: EVar, ctx: Context): InferResult => {
  const t = lookupEnv(expr.name, ctx);
  return [t, []];
};

const inferMany = (
  exprs: readonly Expr[],
  ctx: Context
): [readonly Type[], readonly Constraint[]] => {
  const ts: Type[] = [];
  const all_cs: Constraint[] = [];
  for (const elem of exprs) {
    const [t, cs] = infer(elem, ctx);
    ts.push(t);
    all_cs.push(...cs);
  }
  return [ts, all_cs];
};

const ops = (op: Binop): Type => {
  switch (op) {
    case "Add":
      return {
        tag: "TFun",
        id: -10,
        args: [tInt, tInt],
        ret: tInt,
      };
    case "Mul":
      return {
        tag: "TFun",
        id: -11,
        args: [tInt, tInt],
        ret: tInt,
      };
    case "Sub":
      return {
        tag: "TFun",
        id: -12,
        args: [tInt, tInt],
        ret: tInt,
      };
    case "Eql":
      return {
        tag: "TFun",
        id: -13,
        args: [tInt, tInt],
        ret: tBool,
      };
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
