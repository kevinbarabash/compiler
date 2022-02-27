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
  TArr,
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
import { Expr } from "./syntax";

const isTCon = (t: any): t is TCon => t.tag === "TCon";
const isTVar = (t: any): t is TVar => t.tag === "TVar";
const isTArr = (t: any): t is TArr => t.tag === "TArr";
const isScheme = (t: any): t is Scheme => t.tag === "Forall";

function apply(s: Subst, type: Type): Type;
function apply(s: Subst, scheme: Scheme): Scheme;
function apply(s: Subst, types: Type[]): Type[];
function apply(s: Subst, schemes: Scheme[]): Scheme[];
function apply(s: Subst, constraint: Constraint): Constraint; // special case of Type[]
function apply(s: Subst, constraint: Constraint[]): Constraint[]; // this should just work
function apply(s: Subst, env: Env): Env;
function apply(s: Subst, a: any): any {
  // instance Substitutable Type
  if (isTCon(a)) {
    return a;
  }
  if (isTVar(a)) {
    return s.get(a.name) || a;
  }
  if (isTArr(a)) {
    return {
      tag: "TArr",
      arg: apply(s, a.arg),
      ret: apply(s, a.ret),
    };
  }

  // instance Substitutable Scheme
  if (isScheme(a)) {
    return {
      tag: "Forall",
      qualifiers: a.qualifiers,
      type: apply(
        // remove all TVars from the Substitution mapping that appear in the scheme as
        // qualifiers.
        // TODO: should this be using reduceRight to match Infer.hs' use of foldr?
        a.qualifiers.reduce((accum, val) => accum.delete(val.name), s),
        a.type
      ),
    };
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
function ftv(types: Type[]): Set<TVar>;
function ftv(schemes: Scheme[]): Set<TVar>;
function ftv(constraint: Constraint): Set<TVar>; // special case of Type[]
function ftv(env: Env): Set<TVar>;
function ftv(a: any): any {
  // instance Substitutable Type
  if (isTCon(a)) {
    return Set(); // Set.empty
  }
  if (isTVar(a)) {
    return Set([a]); // Set.singleton a
  }
  if (isTArr(a)) {
    return Set.union([ftv(a.arg), ftv(a.ret)]); // ftv t1 `Set.union` ftv t2
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
    state: {count: 0},
  };
  const [ty, cs] = infer(expr, initCtx);
  const subs = runSolve(cs);
  return closeOver(apply(subs, ty));
}

//  Return the internal constraints used in solving for the type of an expression
export const constraintsExpr = (
  env: Env,
  expr: Expr,
): [Constraint[], Subst, Type, Scheme] => {
  const initCtx: Context = {
    env: env,
    state: {count: 0},
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

const generalize = (env: Env, t: Type): Scheme => {
  return {
    tag: "Forall",
    qualifiers: ftv(t).subtract(ftv(env)).toArray(),
    type: t,
  };
};

const lookup = (a: TVar, entries: [TVar, TVar][]): TVar | null => {
  for (const [k, v] of entries) {
    // TODO: replace with IDs and generate names when printin
    if (a.name === k.name) {
      return v;
    }
  }
  return null;
}

function fst<A, B>(tuple: [A, B]): A {
  return tuple[0];
}
function snd<A, B>(tuple: [A, B]): B {
  return tuple[1];
}

// remove duplicates from the array
function nub(array: TVar[]): TVar[] {
  const names: string[] = []
  return array.filter(tv => {
    if (!names.includes(tv.name)) {
      names.push(tv.name);
      return true;
    }
    return false;
  });
}

// Renames type variables so that they start with 'a' and there are no gaps
const normalize = (sc: Scheme): Scheme => {
  // Returns the names of the free variables in a type
  const fv = (type: Type): TVar[] => {
    switch (type.tag) {
      case "TVar": return [type];
      // TODO: extend to handle n-ary lambdas
      case "TArr": return [...fv(type.arg), ...fv(type.ret)];
      case "TCon": return [];
    }
  }

  const body = sc.type;
  const ord = zip(
    nub(fv(body)),
    letters.map(name => ({tag:"TVar", name} as TVar)),
  );

  const normType = (type: Type): Type => {
    switch (type.tag) {
      case "TArr": {
        // TODO: extend to handle n-ary lambdas
        const {arg, ret} = type;
        return {tag: "TArr", arg: normType(arg), ret: normType(ret)};
      }
      case "TCon": return type;
      case "TVar": {
        const replacement = lookup(type, ord);
        if (replacement) {
          return replacement;
        } else {
          throw new Error("type variable not in signature")
        }
      }
    }
  }

  return {
    tag: "Forall",
    qualifiers: ord.map(snd),
    type: normType(body),
  }
};

// // Extend type environment
// // From the usage in Infer.hs, it looks like this executes some code using the
// // new Context, in particular we run infer with a new Context object
// const inEnv = (x: string, sc: Scheme, ctx: Context): [Type, Constraint[]] => {
//   // let scope e = (remove e x) `extend` (x, sc)
//   // local scope m
//   // TODO: how do we make this change to env local?
//   // TODO: it looks like `x` gets remove from the current (local?) environment
//   ctx.env = ctx.env.set(x, sc);
// };

// Lookup type in the environment
const lookupEnv = (name: string, ctx: Context): Type => {
  const value = ctx.env.get(name);
  if (!value) {
    throw new UnboundVariable(name);
  }
  return instantiate(value, ctx);
};

function zip<A, B>(as: readonly A[], bs: readonly B[]): [A, B][] {
  const length = Math.min(as.length, bs.length);
  const result: [A, B][] = [];
  for (let i = 0; i < length; i++) {
    result.push([as[i], bs[i]]);
  }
  return result;
}

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
const fresh = (ctx: Context): Type => {
  ctx.state.count++;
  return {
    tag: "TVar",
    name: letters[ctx.state.count],
  };
};

const instantiate = (sc: Scheme, ctx: Context): Type => {
  const freshQualifiers = sc.qualifiers.map(() => fresh(ctx));
  const subs = Map(zip(sc.qualifiers.map(qual => qual.name), freshQualifiers));
  return apply(subs, sc.type);
};

const infer = (expr: Expr, ctx: Context): [Type, Constraint[]] => {
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
      const { arg, body } = expr;
      const tv = fresh(ctx);
      const sc: Scheme = { tag: "Forall", qualifiers: [], type: tv };
      // What happens with ctx.count?  Is there overlap between variable
      // names in different contexts?
      // TODO: just use unique IDs for type vars
      const newCtx = { ...ctx, env: ctx.env.set(arg, sc) }; // inEnv (x, Forall [] tv)
      // newCtx introduces a new scope
      const [t, c] = infer(body, newCtx);
      return [{ tag: "TArr", arg: tv, ret: t }, c];
    }

    case "App": {
      const { fn, arg } = expr; // TODO: expand to handle multiple args
      const [t_fn, c_fn] = infer(fn, ctx);
      const [t_arg, c_arg] = infer(arg, ctx);
      const tv = fresh(ctx);
      return [
        tv,
        [
          ...c_fn,
          ...c_arg,
          // This is almost the reverse of what we return from the "Lam" case
          [t_fn, { tag: "TArr", arg: t_arg, ret: tv }],
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
      return [tv, [...c1, [{ tag: "TArr", arg: tv, ret: tv }, t1]]];
    }

    case "Op":
      throw new Error("TODO: handle Op");

    case "If":
      throw new Error("TODO: handle If");
  }
};

//
// Constraint Solver
//

const emptySubst: Subst = Map();

const runSolve = (cs: Constraint[]): Subst => {
  return solver([emptySubst, cs]);
};

const unifyMany = (ts1: Type[], ts2: Type[]): Subst => {
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

const unifies = (t1: Type, t2: Type): Subst => {
  if (equal(t1, t2)) {
    return emptySubst;
  } else if (isTVar(t1)) {
    return bind(t1, t2);
  } else if (isTVar(t2)) {
    return bind(t2, t1);
  } else if (isTArr(t1) && isTArr(t2)) {
    return unifyMany([t1.arg, t1.ret], [t2.arg, t2.ret]);
  } else {
    throw new UnificationFail(t1, t2);
  }
};

const composeSubs = (s1: Subst, s2: Subst): Subst => {
  return s2.map(t => apply(s1, t)).merge(s1);
}

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
