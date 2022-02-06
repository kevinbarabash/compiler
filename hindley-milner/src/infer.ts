/**
 * Type inference machinery
 */
import assert from "assert";

import { Identifier, Apply, Lambda, Let, Letrec, Expression } from "./ast";
import { TypeVariable, TFunction, TInteger, TypeOperator, Type, equal } from "./types";
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
  nonGeneric?: Set<TypeVariable>
): Type => {
  if (nonGeneric == null) {
    nonGeneric = new Set();
  }

  if (node instanceof Identifier) {
    return getType(node.name, env, nonGeneric);
  } else if (node instanceof Apply) {
    const funcType = analyze(node.fn, env, nonGeneric);
    const argTypes = node.args.map(arg => analyze(arg, env, nonGeneric));
    const resultType = new TypeVariable();

    // Check if funcType is a lambda
    if (funcType instanceof TypeOperator && funcType.name === "->") {
      const paramTypes = funcType.types.slice(0, -1);
      const returnType = funcType.types[funcType.types.length - 1];

      // Partial Application
      if (argTypes.length < paramTypes.length) {
        // Create a new function type...
        const appFuncType = new TFunction(
          // ...that takes the same number of params as args being applied...
          paramTypes.slice(0, argTypes.length),
          // ...and returns a new function that accepts the remaining params.
          new TFunction(paramTypes.slice(argTypes.length), returnType),
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
    const newEnv = new Map(env);
    const newNonGeneric = new Set(nonGeneric);
    const argTypes: TypeVariable[] = [];
    for (const param of node.params) {
      const argType = new TypeVariable();
      newEnv.set(param, argType);
      newNonGeneric.add(argType);
      argTypes.push(argType);
    }
    const resultType = analyze(node.body, newEnv, newNonGeneric);
    return new TFunction(argTypes, resultType);
  } else if (node instanceof Let) {
    const defnType = analyze(node.defn, env, nonGeneric);
    const newEnv = new Map(env);
    newEnv.set(node.v, defnType);
    return analyze(node.body, newEnv, nonGeneric);
  } else if (node instanceof Letrec) {
    const newType = new TypeVariable();
    const newEnv = new Map(env);
    newEnv.set(node.v, newType);
    const newNonGeneric = new Set(nonGeneric);
    newNonGeneric.add(newType);
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
const getType = (
  name: string,
  env: Map<string, Type>,
  nonGeneric: Set<TypeVariable>
): Type => {
  if (env.has(name)) {
    return fresh(env.get(name) as Type, nonGeneric);
  } else if (isIntegerLiteral(name)) {
    return TInteger;
  } else {
    throw new ParseError(`Undefined symbol ${name}`);
  }
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
const fresh = (t: Type, nonGeneric: Set<TypeVariable>): Type => {
  const mappings = new Map<TypeVariable, TypeVariable>();

  const freshRec = (tp: Type): Type => {
    const p = prune(tp);
    if (p instanceof TypeVariable) {
      if (isGeneric(p, nonGeneric)) {
        if (!mappings.has(p)) {
          mappings.set(p, new TypeVariable());
        }
        return mappings.get(p) as TypeVariable;
      } else {
        return p;
      }
    } else if (p instanceof TypeOperator) {
      return new TypeOperator(p.name, p.types.map(freshRec));
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
  if (a instanceof TypeVariable) {
    if (!equal(a, b)) {
      if (occursInType(a, b)) {
        throw new InferenceError("recursive unification");
      }
      a.instance = b;
    }
  } else if (a instanceof TypeOperator && b instanceof TypeVariable) {
    unify(b, a);
  } else if (a instanceof TypeOperator && b instanceof TypeOperator) {
    if (a.name != b.name || a.types.length != b.types.length) {
      throw new InferenceError(`Type mismatch: ${a} != ${b}`);
    }
    for (const [p, q] of zip(a.types, b.types)) {
      unify(p, q);
    }
  } else {
    assert.ok(0, "Not unified");
  }
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
  if (t instanceof TypeVariable) {
    if (t.instance != null) {
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
 * @param {TypeVariable} v the TypeVariable to be tested for genericity
 * @param {Set} nonGeneric a set of non-generic TypeVariables
 * @returns `true` if `v` is a generic variable, otherwise `false`
 */
const isGeneric = (v: TypeVariable, nonGeneric: Set<TypeVariable>): boolean => {
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
  } else if (prunedType2 instanceof TypeOperator) {
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

/**
 * Checks whether name is an integer literal string.
 *
 * @param name the identifier to check
 * @returns `true` if `name` is an integer literal, otherwise `false`
 */
const isIntegerLiteral = (name: string): boolean => {
  return !Number.isNaN(parseInt(name, 10));
};
