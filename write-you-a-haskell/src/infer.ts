import { Map } from "immutable";

import { UnboundVariable } from "./errors";
import { freeze, scheme, tBool, tInt } from "./type-types";
import { Constraint, Env, Scheme, Subst, TCon, TVar, Type, Context, State } from "./type-types";
import { Binop, Expr } from "./syntax-types";
import { zip, apply, ftv, assertUnreachable } from "./util";
import { runSolve } from "./constraint-solver";

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
function nub<T extends {id: number}>(array: readonly T[]): readonly T[] {
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

export const freshTCon = (ctx: Context, name: string, params: Type[] = []): TCon => {
  ctx.state.count++
  return {
    tag: "TCon",
    id: ctx.state.count,
    name,
    params,
  };
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

const infer = (
  expr: Expr,
  ctx: Context
): readonly [Type, readonly Constraint[]] => {
  switch (expr.tag) {
    case "Lit": {
      const lit = expr.value;
      switch (lit.tag) {
        case "LInt":
          return [freshTCon(ctx, "Int"), []];
        case "LBool":
          return [freshTCon(ctx, "Bool"), []];
        case "LStr":
          return [freshTCon(ctx, "Str"), []];
      }
    }

    case "Var": {
      const t = lookupEnv(expr.name, ctx);
      return [t, []];
    }

    case "Lam": {
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
      const [t, c] = infer(body, newCtx);
      // We wrap the return value in a promise if:
      // - the lambda is marked as async
      // - its inferred return value isn't already in a promise
      // TODO: add more general support for conditional types
      const ret = !expr.async || t.tag === "TCon" && t.name === "Promise"
        ? t : freshTCon(ctx, "Promise", [t]);

      ctx.state.count++;
      return [{ tag: "TFun", id: ctx.state.count, args: tvs, ret, src: "Lam" }, c];
    }

    case "App": {
      const { fn, args } = expr;
      const [t_fn, c_fn] = infer(fn, ctx);
      const t_args: Type[] = [];
      const c_args: (readonly Constraint[])[] = [];
      for (const arg of args) {
        const [t_arg, c_arg] = infer(arg, ctx);
        t_args.push(t_arg);
        c_args.push(c_arg);
      }
      const tv = fresh(ctx);
      ctx.state.count++;
      return [
        tv,
        [
          ...c_fn,
          ...c_args.flat(),
          // This is almost the reverse of what we return from the "Lam" case
          [t_fn, { tag: "TFun", id: ctx.state.count, args: t_args, ret: tv, src: "App" }],
        ],
      ];
    }

    case "Let": {
      const { name, value, body } = expr;
      const { env } = ctx;
      const [t1, c1] = infer(value, ctx);
      const subs = runSolve(c1, ctx);
      const sc = generalize(apply(subs, env), apply(subs, t1));
      // (t2, c2) <- inEnv (x, sc) $ local (apply sub) (infer e2)
      const newCtx = { ...ctx, env: ctx.env.set(name, sc) };
      const [in_t2, in_c2] = infer(body, newCtx);
      const [out_t2, out_c2] = [apply(subs, in_t2), apply(subs, in_c2)];
      // return (t2, c1 ++ c2)
      return [out_t2, [...c1, ...out_c2]];
    }

    case "Fix": {
      const { expr: e } = expr;
      let [t1, c1] = infer(e, ctx);
      const tv = fresh(ctx);
      ctx.state.count++;
      return [
        tv,
        [...c1, [{ tag: "TFun", id: ctx.state.count, args: [tv], ret: tv, src: "Fix" }, t1]],
      ];
    }

    case "Op": {
      const { op, left, right } = expr;
      const [lt, lc] = infer(left, ctx);
      const [rt, rc] = infer(right, ctx);
      const tv = fresh(ctx);
      ctx.state.count++;
      const u1: Type = {
        tag: "TFun",
        id: ctx.state.count,
        args: [lt, rt],
        ret: tv,
      };
      const u2 = ops(op);
      return [tv, [...lc, ...rc, [u1, u2]]];
    }

    case "If": {
      const { cond, th, el } = expr;
      const [t1, c1] = infer(cond, ctx);
      const [t2, c2] = infer(th, ctx);
      const [t3, c3] = infer(el, ctx);
      t1.id; // ?
      t2.id; // ?
      t3.id; // ?
      // This is similar how we'll handle n-ary apply
      const bool = freshTCon(ctx, "Bool");
      bool.id; // ?
      return [t2, [...c1, ...c2, ...c3, [t1, bool], [t2, t3]]];
    }

    case "Await": {
      if (!ctx.async) {
        throw new Error("Can't use `await` inside non-async lambda");
      }

      const [t, c] = infer(expr.expr, ctx);

      if (t.tag === "TCon" && t.name === "Promise") {
        if (t.params.length !== 1) {
          // TODO: How do we prevent people from overwriting built-in types
          // TODO: How do we allow local shadowing of other types within a module?
          //       Do we even want to?
          throw new Error("Invalid Promise type");
        }
        return [t.params[0], c];
      }

      // If the await expression isn't a promise then we return the inferred
      // type and constraints from the awaited expression.
      return [t, c];
    }

    default: 
      assertUnreachable(expr);
  }
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
