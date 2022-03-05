import { Map, Set } from "immutable";

import {
  InfiniteType,
  UnboundVariable,
  UnificationFail,
  UnificationMismatch,
} from "./errors";
import {
  Type,
  TVar,
  Scheme,
  TApp,
  TCon,
  Subst,
  Env,
  Constraint,
  Unifier,
  equal,
  tInt,
  tBool,
  print,
} from "./type";
import { Binop, Expr } from "./syntax";
import { snd, zip } from "./util";

const scheme = (qualifiers: readonly TVar[], type: Type): Scheme => ({
  tag: "Forall",
  qualifiers,
  type,
});

const isTCon = (t: any): t is TCon => t.tag === "TCon";
const isTVar = (t: any): t is TVar => t.tag === "TVar";
const isTApp = (t: any): t is TApp => t.tag === "TApp";
const isScheme = (t: any): t is Scheme => t.tag === "Forall";

function apply(s: Subst, type: Type): Type;
function apply(s: Subst, scheme: Scheme): Scheme;
function apply(s: Subst, types: readonly Type[]): readonly Type[];
function apply(s: Subst, schemes: readonly Scheme[]): readonly Scheme[];
function apply(s: Subst, constraint: Constraint): Constraint; // special case of Type[]
function apply(s: Subst, constraint: readonly Constraint[]): readonly Constraint[]; // this should just work
function apply(s: Subst, env: Env): Env;
function apply(s: Subst, a: any): any {
  // instance Substitutable Type
  if (isTCon(a)) {
    return {
      tag: "TCon",
      name: a.name,
      params: apply(s, a.params),
    };
  }
  if (isTVar(a)) {
    return s.get(a.name) || a;
  }
  if (isTApp(a)) {
    return {
      tag: "TApp",
      args: apply(s, a.args),
      ret: apply(s, a.ret),
      src: a.src,
    };
  }

  // instance Substitutable Scheme
  if (isScheme(a)) {
    return scheme(
      a.qualifiers,
      apply(
        // remove all TVars from the Substitution mapping that appear in the scheme as
        // qualifiers.
        // TODO: should this be using reduceRight to match Infer.hs' use of foldr?
        a.qualifiers.reduceRight((accum, val) => accum.delete(val.name), s),
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

function ftv(type: Type): Set<TVar>;
function ftv(scheme: Scheme): Set<TVar>;
function ftv(types: readonly Type[]): Set<TVar>;
function ftv(schemes: readonly Scheme[]): Set<TVar>;
function ftv(constraint: Constraint): Set<TVar>; // special case of Type[]
function ftv(env: Env): Set<TVar>;
function ftv(a: any): any {
  // instance Substitutable Type
  if (isTCon(a)) {
    return Set.union(a.params.map(ftv));
  }
  if (isTVar(a)) {
    return Set([a]); // Set.singleton a
  }
  if (isTApp(a)) {
    return Set.union([...a.args.map(ftv), ftv(a.ret)]); // ftv t1 `Set.union` ftv t2
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

type State = {
  count: number;
};

type Context = {
  env: Env;
  state: State;
};

const emptyEnv: Env = Map();

export const inferExpr = (env: Env, expr: Expr): Scheme => {
  const initCtx: Context = {
    env: env,
    state: { count: 0 },
  };
  const [ty, cs] = infer(expr, initCtx);
  const subs = runSolve(cs);
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
  const subst = runSolve(cs);
  const sc = closeOver(apply(subst, ty));
  return [cs, subst, ty, sc];
};

// Canonicalize and return the polymorphic toplevel type
const closeOver = (t: Type): Scheme => {
  return normalize(generalize(emptyEnv, t));
};

const lookup = (a: TVar, entries: readonly [TVar, TVar][]): TVar | null => {
  for (const [k, v] of entries) {
    // TODO: replace with IDs and generate names when printin
    if (a.name === k.name) {
      return v;
    }
  }
  return null;
};

// remove duplicates from the array
function nub(array: readonly TVar[]): readonly TVar[] {
  const names: string[] = [];
  return array.filter((tv) => {
    if (!names.includes(tv.name)) {
      names.push(tv.name);
      return true;
    }
    return false;
  });
}

// TODO: switch to IDs for types and then simplify the normalization by
// generating names for type variables at print time.

// Renames type variables so that they start with 'a' and there are no gaps
const normalize = (sc: Scheme): Scheme => {
  // Returns the names of the free variables in a type
  const fv = (type: Type): readonly TVar[] => {
    switch (type.tag) {
      case "TVar":
        return [type];
      case "TApp":
        return [...type.args.flatMap(fv), ...fv(type.ret)];
      case "TCon":
        return [];
    }
  };

  const body = sc.type;
  const ord = zip(
    nub(fv(body)),
    letters.map((name) => ({ tag: "TVar", name } as TVar))
  );

  const normType = (type: Type): Type => {
    switch (type.tag) {
      case "TApp": {
        const { args, ret, src } = type;
        return {
          tag: "TApp",
          args: args.map(normType),
          ret: normType(ret),
          src,
        };
      }
      case "TCon":
        return type;
      case "TVar": {
        const replacement = lookup(type, ord);
        if (replacement) {
          return replacement;
        } else {
          throw new Error("type variable not in signature");
        }
      }
    }
  };

  return scheme(ord.map(snd), normType(body));
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

const letters = [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z",
];

// TODO: use IDs for TVar's and defer naming until print time
const fresh = (ctx: Context): TVar => {
  ctx.state.count++;
  return {
    tag: "TVar",
    name: letters[ctx.state.count],
  };
};

const instantiate = (sc: Scheme, ctx: Context): Type => {
  const freshQualifiers = sc.qualifiers.map(() => fresh(ctx));
  const subs = Map(
    zip(
      sc.qualifiers.map((qual) => qual.name),
      freshQualifiers
    )
  );
  return apply(subs, sc.type);
};

const generalize = (env: Env, type: Type): Scheme => {
  return scheme(ftv(type).subtract(ftv(env)).toArray(), type);
};

const ops = (op: Binop): Type => {
  switch (op) {
    case "Add":
      return {
        tag: "TApp",
        args: [tInt, tInt],
        ret: tInt,
      };
    case "Mul":
      return {
        tag: "TApp",
        args: [tInt, tInt],
        ret: tInt,
      };
    case "Sub":
      return {
        tag: "TApp",
        args: [tInt, tInt],
        ret: tInt,
      };
    case "Eql":
      return {
        tag: "TApp",
        args: [tInt, tInt],
        ret: tBool,
      };
  }
};

const infer = (expr: Expr, ctx: Context): readonly [Type, readonly Constraint[]] => {
  switch (expr.tag) {
    case "Lit": {
      const lit = expr.value;
      switch (lit.tag) {
        case "LInt":
          return [tInt, []];
        case "LBool":
          return [tBool, []];
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
      const newCtx = {
        ...ctx,
        env: ctx.env.withMutations((env) => {
          for (const [arg, tv] of zip(args, tvs)) {
            // scheme([], tv) is a type variable without any qualifiers
            env.set(arg, scheme([], tv));
          }
        }),
      };
      const [t, c] = infer(body, newCtx);
      return [{ tag: "TApp", args: tvs, ret: t, src: "Lam" }, c];
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
      return [
        tv,
        [
          ...c_fn,
          ...c_args.flat(),
          // This is almost the reverse of what we return from the "Lam" case
          [t_fn, { tag: "TApp", args: t_args, ret: tv, src: "App" }],
        ],
      ];
    }

    case "Let": {
      const { name, value, body } = expr;
      const { env } = ctx;
      const [t1, c1] = infer(value, ctx);
      const subs = runSolve(c1);
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
      return [
        tv,
        [...c1, [{ tag: "TApp", args: [tv], ret: tv, src: "Fix" }, t1]],
      ];
    }

    case "Op": {
      const { op, left, right } = expr;
      const [lt, lc] = infer(left, ctx);
      const [rt, rc] = infer(right, ctx);
      const tv = fresh(ctx);
      const u1: Type = {
        tag: "TApp",
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
      // This is similar how we'll handle n-ary apply
      return [t2, [...c1, ...c2, ...c3, [t1, tBool], [t2, t3]]];
    }
  }
};

//
// Constraint Solver
//

const emptySubst: Subst = Map();

const runSolve = (cs: readonly Constraint[]): Subst => {
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
  } else if (isTApp(t1) && isTApp(t2)) {
    // infer() only ever creates a Lam node on the left side of a constraint
    // and an App on the right side of a constraint so this check is sufficient.
    if (t1.src === "Lam" && t2.src === "App") {
      // partial application
      if (t1.args.length > t2.args.length) {
        const t1_partial: Type = {
          tag: "TApp",
          args: t1.args.slice(0, t2.args.length),
          ret: {
            tag: "TApp",
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
          tag: "TApp",
          args: t2.args.slice(0, t1.args.length),
          ret: t2.ret,
          src: t2.src,
        }
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
          tag: "TApp",
          args: t1.args.slice(0, t2.args.length),
          ret: t1.ret,
          src: t1.src,
        }
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
  } else {
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
  if (t.tag === "TVar" && t.name === tv.name) {
    return emptySubst;
  } else if (occursCheck(tv, t)) {
    throw new InfiniteType(tv, t);
  } else {
    return Map([[tv.name, t]]);
  }
};

const occursCheck = (tv: TVar, t: Type): boolean => {
  return ftv(t).includes(tv);
};
