/**
 * Type inference machinery
 */
import assert from "assert";
import {Map, Set} from "immutable";

import {
  Identifier,
  Apply,
  Lambda,
  Let,
  Letrec,
  Expression,
  Literal,
  Int,
  Bool,
  Arr,
} from "./ast";
import {
  TVar,
  TFunction,
  TInteger,
  TLit,
  TCon,
  Type,
  equal,
  TBool,
} from "./types";
import { InferenceError, ParseError } from "./errors";
import { zip } from "./util";

/**
 * Computes the type of the expression given by node.
 * The type of the node is computed in the context of the
 * supplied type environment env. Data types can be introduced into the
 * language simply by having a predefined set of identifiers in the initial
 * environment. environment; this way there is no need to change the syntax or, more
 * importantly, the type-checking program when extending the language.
 *
 * @param node The root of the abstract syntax tree.
 * @param env The type environment is a mapping of expression identifier names
 *     to type assignments.
 *     to type assignments.
 * @param nonGeneric A set of non-generic variables, or None
 * @returns The computed type of the expression.
 * @throws
 *     InferenceError: The type of the expression could not be inferred, for example
 *         if it is not possible to unify two types such as Integer and Bool
 *     ParseError: The abstract syntax tree rooted at node could not be parsed
 */
export const analyze = (
  node: Expression,
  env: Map<string, Type>,
  nonGeneric?: Set<TVar>
): Type => {
  if (nonGeneric == null) {
    nonGeneric = Set();
  }

  if (node instanceof Identifier) {
    return getTypeForIdentifier(node.name, env, nonGeneric);
  } else if (node instanceof Literal) {
    return getTypeForLiteral(node);
  } else if (node instanceof Apply) {
    const funcType = analyze(node.fn, env, nonGeneric);
    const argTypes = node.args.map((arg) => analyze(arg, env, nonGeneric));
    const resultType = new TVar();

    // Check if funcType is a lambda
    if (funcType instanceof TCon && funcType.name === "->") {
      const paramTypes = funcType.types.slice(0, -1);
      const returnType = funcType.types[funcType.types.length - 1];

      // Partial Application
      if (argTypes.length < paramTypes.length) {
        // Create a new function type...
        const appFuncType = new TFunction(
          // ...that takes the same number of params as args being applied...
          paramTypes.slice(0, argTypes.length),
          // ...and returns a new function that accepts the remaining params.
          new TFunction(paramTypes.slice(argTypes.length), returnType)
        );

        unify(new TFunction(argTypes, resultType), appFuncType);
        return resultType;
      }

      // If there are more args than params...
      if (argTypes.length > paramTypes.length) {
        // ...ignore the extra ones.
        const truncatedArgTypes = argTypes.slice(0, paramTypes.length);

        unify(new TFunction(truncatedArgTypes, resultType), funcType);
        return resultType;
      }
    }

    unify(new TFunction(argTypes, resultType), funcType);
    return resultType;
  } else if (node instanceof Lambda) {
    const newEnv = env.asMutable();
    const newNonGeneric = nonGeneric.asMutable();
    const argTypes: TVar[] = [];
    for (const param of node.params) {
      const argType = new TVar();
      newEnv.set(param, argType);
      newNonGeneric.add(argType);
      argTypes.push(argType);
    }
    const resultType = analyze(
      node.body, newEnv.asImmutable(), newNonGeneric.asImmutable());
    return new TFunction(argTypes, resultType);
  } else if (node instanceof Let) {
    const defnType = analyze(node.defn, env, nonGeneric);
    const newEnv = env.set(node.v, defnType);
    return analyze(node.body, newEnv, nonGeneric);
  } else if (node instanceof Letrec) {
    const newType = new TVar();
    const newEnv = env.set(node.v, newType);
    const newNonGeneric = nonGeneric.add(newType);
    const defnType = analyze(node.defn, newEnv, newNonGeneric);
    unify(newType, defnType);
    return analyze(node.body, newEnv, nonGeneric);
  }
  throw new Error(`Unhandled syntax node ${node}`);
};

/**
 * Get the type of identifier name from the type environment env.
 *
 * @param {string} name The identifier name
 * @param {Map} env The type environment mapping from identifier names to types
 * @param {Set} nonGeneric A set of non-generic TypeVariables
 * @returns {Type}
 */
const getTypeForIdentifier = (
  name: string,
  env: Map<string, Type>,
  nonGeneric: Set<TVar>
): Type => {
  if (env.has(name)) {
    return fresh(env.get(name) as Type, nonGeneric);
  }

  throw new ParseError(`Undefined symbol ${name}`);
};

const getTypeForLiteral = (literal: Literal): Type => {
  if (literal instanceof Arr) {
    // When determining the type of an array literal with values on it,
    // compute the types of each element.  If we get back a bunch of
    // TIntegerLiterals, then the type would be TypeOperator("[]", TInteger).
    // We need a way to map between literal types and their corresponding
    // minimal containing type.

    // If we have a function like map: a[] -> a[] and we pass in an array
    // literal with type [5, 10], at that point we need to fine the least
    // general super type that allows for type unification.  In this case
    // it would int[].

    // Most of the time we want to maintain the literal type's value unless
    // unification requires something more general.
    throw new ParseError(`getTypeForLiteral doesn't handle array literals yet`);
  }
  return new TLit(literal);
};

/**
 * Makes a copy of a type expression.
 * The type t is copied. The the generic variables are duplicated and the
 * nonGeneric variables are shared.
 *
 * @param {Type} t a type to be copied
 * @param {Set} nonGeneric a set of non-generic TypeVariable
 * @returns the copied type expression
 */
const fresh = (t: Type, nonGeneric: Set<TVar>): Type => {
  let mappings = Map<TVar, TVar>();

  const freshRec = (tp: Type): Type => {
    const p = prune(tp);
    if (p instanceof TVar) {
      if (isGeneric(p, nonGeneric)) {
        if (!mappings.has(p)) {
          mappings = mappings.set(p, new TVar());
        }
        return mappings.get(p) as TVar;
      } else {
        return p;
      }
    } else if (p instanceof TCon) {
      return new TCon(p.name, p.types.map(freshRec));
    } else if (p instanceof TLit) {
      return p;
    }
    throw new Error("freshRec should never get here");
  };

  return freshRec(t);
};

/**
 * Unify the two types t1 and t2.
 * Makes the types t1 and t2 the same.
 *
 * @param t1 The first type to be made equivalent
 * @param t2 The second type to be be equivalent
 * @returns void
 * @throws InferenceError: Raised if the types cannot be unified.
 */
const unify = (t1: Type, t2: Type) => {
  const a = prune(t1);
  const b = prune(t2);
  if (a instanceof TVar) {
    if (!equal(a, b)) {
      if (occursInType(a, b)) {
        throw new InferenceError("recursive unification");
      }
      // TODO: is this where we should enforce polymorphic constraints?
      a.instance = b;
    }
  } else if (b instanceof TVar) {
    // We reverse the order here so that the previous `if` block can
    // handle `b` being a `TVar`.
    //
    // Is type unification actually symmetric?  We may want to introduce
    // behavior in the future that treats l-values and r-values different.
    unify(b, a);
  } else if (a instanceof TCon && b instanceof TCon) {
    if (a.name != b.name || a.types.length != b.types.length) {
      // When should we expand `int` to `int | bool`?
      throw new InferenceError(`Type mismatch: ${a} != ${b}`);
    }
    for (const [p, q] of zip(a.types, b.types)) {
      unify(p, q);
    }
  } else if (a instanceof TLit && b instanceof TLit) {
    // This could be more succinct if we were using a disjoint union instead
    // of instanceof and classes.
    if (a.value.value instanceof Int && b.value.value instanceof Int) {
      if (!equal(a, b)) {
        maybeWidenTypes(a, b);
      }
    } else if (a.value.value instanceof Bool && b.value.value instanceof Bool) {
      if (!equal(a, b)) {
        maybeWidenTypes(a, b);
      }
    } else {
      // No common super type
      throw new InferenceError(`Type mismatch: ${a} != ${b}`);
    }
  } else if (a instanceof TLit) {
    if (!isSubtype(a, b)) {
      throw new InferenceError(`Type mismatch: ${a} is not a subtype of ${b}`);
    }
  } else if (b instanceof TLit) {
    if (!isSubtype(b, a)) {
      throw new InferenceError(`Type mismatch: ${b} is not a subtype of ${a}`);
    }
  } else {
    assert.ok(0, "Not unified");
  }
};

/**
 * Returns true if `a` is a subtype of `b`.
 * 
 * @param {TLit} a
 * @param {Type} b 
 * @returns {boolean}
 */
const isSubtype = (a: TLit, b: Type): boolean => {
  if (a.value.value instanceof Int && equal(b, TInteger)) {
    return true;
  }
  if (a.value.value instanceof Bool && equal(b, TBool)) {
    return true;
  }
  return false;
}

// Are there any situations when only one of the types we're trying to unify
// needs widening?
/**
 * If neither `a` or `b` are frozen, it will get the immediate super
 * type of the literal and assign it to the .widening property of each.
 * This property indicates that a type literal has been widened to
 * another type.  For now this can only be a type constructor (TCon), but
 * in the future it could also be a union of type literals or other types.
 * 
 * @param {TLit} a 
 * @param {TLit} b 
 * @throws {InferenceError} if either `a` or `b` is frozen
 */
const maybeWidenTypes = (a: TLit, b: TLit) => {
  if (!a.frozen && !b.frozen) {
    // TODO: check the existing value of `widening` in case it needs
    // be widened further.

    // Once we have union types then the widening here should widen
    // the literals to the union of the two literals instead of using
    // the immediate super type.
    a.widening = getSuperType(a);
    b.widening = getSuperType(b);
  } else {
    // TODO: this will need to be subtype check once we have union types
    if (!equal(a, b)) {
      throw new InferenceError(`Type mismatch: ${a} != ${b}`);
    }
  }
}

const getSuperType = (t: TLit): TCon => {
  if (t.value.value instanceof Int) {
    return TInteger;
  }
  if (t.value.value instanceof Bool) {
    return TBool;
  }
  throw new Error(`No super type defined for ${t}`);
};

/**
 * Returns the currently defining instance of t.
 * As a side effect, collapses the list of type instances. The function Prune
 * is used whenever a type expression has to be inspected: it will always
 * return a type expression which is either an uninstantiated type variable or
 * a type operator; i.e. it will skip instantiated variables, and will
 * actually prune them from expressions to remove long chains of instantiated
 * variables.
 *
 * @param {Type} t the type to be pruned
 * @returns an uninstantiated TypeVariable or a TypeOperator
 */
const prune = (t: Type): Type => {
  if (t instanceof TVar) {
    if (t.instance != null) {
      // TODO: is this where we should enforce polymorphic constraints?
      t.instance = prune(t.instance);
      return t.instance;
    }
  }
  return t;
};

/**
 * Checks whether a given variable occurs in a list of non-generic variables
 * Note that a variables in such a list may be instantiated to a type term,
 * in which case the variables contained in the type term are considered
 * non-generic.
 * Note: Must be called with v pre-pruned
 *
 * @param {TVar} v the TypeVariable to be tested for genericity
 * @param {Set} nonGeneric a set of non-generic TypeVariables
 * @returns `true` if `v` is a generic variable, otherwise `false`
 */
const isGeneric = (v: TVar, nonGeneric: Set<TVar>): boolean => {
  return !occursIn(v, [...nonGeneric]);
};

/**
 * Checks whether a type variable occurs in a type expression.
 * Note: Must be called with v pre-pruned
 *
 * @param t the TypeVariable to be tested for
 * @param types the type in which to search
 * @returns `true` if v occurs in `type2`, otherwise `false`
 */
const occursInType = (v: Type, type2: Type): boolean => {
  const prunedType2 = prune(type2);
  if (equal(prunedType2, v)) {
    return true;
  } else if (prunedType2 instanceof TCon) {
    return occursIn(v, prunedType2.types);
  }
  return false;
};

/**
 * Checks whether a types variable occurs in any other types.
 *
 * @param t the TypeVariable to be tested for
 * @param types the sequence of types in which to search
 * @returns `true` if `t` occurs in any of types, otherwise `false`
 */
const occursIn = (t: Type, types: Type[]): boolean => {
  return types.some((t2) => occursInType(t, t2));
};
