import * as b from "./builders";
import * as t from "./types";
import * as builtins from "./builtins";

// Flattens nested union types and removes duplicates.  Subtypes of other
// elements in the union will be removed.  If there is only a single element
// remaining, then that type will be return instead of a union type.
// e.g. flatten(number | (5 | 10)) -> number
export const flatten = (union: t.TUnion): t.Type => {
  const types = union.types.flatMap((t) => {
    if (t.t === "TUnion") {
      const flattened = flatten(t);
      return flattened.t === "TUnion" ? flattened.types : [flattened];
    }
    return [t];
  });
  // TODO: remove duplicates
  // TODO: rewrite this using immutable.js so we're not so memory inefficient
  const uniqueTypes: t.Type[] = [];
  types.forEach((t, i) => {
    const remainingTypes = [...types.slice(0, i), ...types.slice(i + 1)];
    if (!remainingTypes.some((rt) => isSubtypeOf(t, rt))) {
      uniqueTypes.push(t);
    }
  });
  // TODO: assert uniqueTypes.length > 0
  return uniqueTypes.length === 1 ? uniqueTypes[0] : b.tUnion(...uniqueTypes);
};

// TODO: How do report errors if we wrap types like this to do comparisons?
const makeOptional = (x: t.Type): t.Type => {
  return flatten(b.tUnion(x, builtins.tUndefined()));
};

export const getPropType = (x: t.TProp): t.Type =>
  x.optional ? makeOptional(x.type) : x.type;

export const getParamType = (x: t.TParam): t.Type =>
  x.optional ? makeOptional(x.type) : x.type;

const propsEqual = (x: t.TProp, y: t.TProp): boolean => {
  if (x.name !== y.name) {
    return false;
  }
  return equal(getPropType(x), getPropType(y));
};

// NOTE: this function should only be used by isSubtypeOf since
// it treats a -> a the same as b -> b.
export const equal = (x: t.Type, y: t.Type): boolean => {
  if (x.t === "TCon" && y.t === "TCon") {
    return (
      x.name === y.name &&
      x.typeArgs.length === y.typeArgs.length &&
      zip(x.typeArgs, y.typeArgs).every((pair) => equal(...pair))
    );
  } else if (x.t === "TLit" && y.t === "TLit") {
    return x.literal.value === y.literal.value;
  } else if (x.t === "TUnion" && y.t === "TUnion") {
    return (
      x.types.every((elem) => isSubtypeOf(elem, y)) &&
      y.types.every((elem) => isSubtypeOf(elem, x))
    );
  } else if (x.t === "TVar" && y.t === "TVar") {
    return x.id === y.id;
  } else if (x.t === "TFun" && y.t === "TFun") {
    // TODO: treat a -> a as being equivalent to b -> b
    return (
      x.paramTypes.length === y.paramTypes.length &&
      zip(x.paramTypes, y.paramTypes).every(([xArg, yArg]) =>
        equal(getParamType(xArg), getParamType(yArg))
      ) &&
      equal(x.retType, y.retType)
    );
  } else if (x.t === "TRec" && y.t === "TRec") {
    return (
      x.properties.length === y.properties.length &&
      // we can't use zip here because order is not enforced
      x.properties.every((aProp) =>
        y.properties.some((bProp) => propsEqual(aProp, bProp))
      )
    );
  }

  return false;
};

// We need ways to determine if one type is a subtype or not.
// A type `foo` is a subtype of `bar` if any value of type `foo`
// can be used where a `bar` is expected.
// A result of this definition is that any type is a subtype of
// itself.

/**
 * Returns true if `x` is a subtype of `y`.
 */
export const isSubtypeOf = (x: t.Type, y: t.Type): boolean => {
  if (equal(x, y)) {
    return true;
  }

  if (y.t === "TUnion") {
    return y.types.some((elem) => isSubtypeOf(x, elem));
  }

  switch (x.t) {
    case "TLit": {
      const l = x.literal;
      switch (l.t) {
        case "LBool":
          return y.t === "TCon" && y.name === "boolean";
        case "LNum":
          return y.t === "TCon" && y.name === "number";
        case "LStr":
          return y.t === "TCon" && y.name === "string";
      }
    }
    case "TCon": {
      if (y.t === "TCon") {
        return (
          x.name === y.name &&
          y.typeArgs.every((yTypeArg) =>
            x.typeArgs.every((xTypeArg) => isSubtypeOf(xTypeArg, yTypeArg))
          )
        );
      }
      return false;
    }
    case "TRec": {
      if (y.t === "TRec") {
        return y.properties.every((yProp) =>
          x.properties.find((xProp) =>
            isSubtypeOf(getPropType(xProp), getPropType(yProp))
          )
        );
      }
      return false;
    }
    case "TTuple": {
      if (y.t === "TTuple") {
        return (
          // do we want to allow x to be shorter if the elements at the end
          // of y are T | undefined?
          x.types.length === y.types.length &&
          y.types.every((yElem) =>
            x.types.find((xElem) => isSubtypeOf(xElem, yElem))
          )
        );
      }
      if (y.t === "TCon" && y.name === "Array") {
        return x.types.every((xElem) => isSubtypeOf(xElem, y.typeArgs[0]));
      }
      return false;
    }
    case "TFun": {
      // How do optional params fit into function subtyping and partial application?
      // When we do partial application check, we just need to see if all of the params
      // after the ones that have args are option.  If they are all option, then we
      // do full application of the function.  When applying args to optional params
      // we have to type check them.  Typescript allows applying `undefined` as an
      // arg to an optional param.

      // Partial application and function subtyping:
      // Normally we do partial application if we pass fewer params than is required,
      // by a function.  Function subtyping says that it's okay to use a function with
      // fewer params where one with more params is expected, e.g.
      // if we have map((elem, index) => ...) then we can pass map((elem) => ...)
      // if `map` partially applies the callback passed in with a single arg, then
      // if we passed a single arg to a callback that only takes a single arg, we'd
      // expect the function to just get called.  That means in order for function
      // subtyping to work, we need to base our decision about whether to do partial
      // application on the type of the callback param and not the callback arg we're
      // passed.  This means than we will also be partially applying the callback that
      // takes a single param.
      // In this example `let map = (fn : (a, int) -> b, arr) => { fn(x)(0) }` should
      // work with both `map((elem, index) => ...)` and `map((elem) => ...)`.  In the
      // second situation the code generated for `fn(x)(0)` would be:
      // fn.bind(null, x).bind(null, 0).  In both case .bind() returns a new function
      // even if `fn` doesn't have enough params to begin with accept args for each
      // .bind() call.
      // TODO: write some evaluation tests to make sure this works as expected
      if (y.t === "TFun") {
        if (x.paramTypes.length > y.paramTypes.length) {
          // We can't use `x` wherever `y` is used, because it needs more args,
          // unless all the unfulfilled args are all optional (aka, `undefined`
          // is a subtype the param).
          const remainingParamTypes = x.paramTypes.slice(y.paramTypes.length);
          const isOptional = (p: t.TParam): boolean =>
            isSubtypeOf(builtins.tUndefined(), getParamType(p));
          if (!remainingParamTypes.every(isOptional)) {
            return false;
          }
        }
        return (
          zip(x.paramTypes, y.paramTypes).every(
            // The direct of the subtype relation is reverse here.  We want
            // to allow `x` to be used anywhere `y` is used, so any arg we
            // pass to `y` should be accepted by `x`.  If the first arg of
            // `y` only accepts `5`, it's okay if the first arg of `x` to
            // accept numbers.
            ([xArg, yArg]) =>
              isSubtypeOf(getParamType(yArg), getParamType(xArg))
          ) && isSubtypeOf(x.retType, y.retType)
        );
      }
      return false;
    }
  }

  return false;
};

// Type Constructor subtyping:
// Array<3 | 5> is a subtype of Array<int> becuase
// `3 | 5` is a subtype of `int`.

export const zip = <T>(xs: readonly T[], ys: readonly T[]): [T, T][] => {
  const length = Math.min(xs.length, ys.length);
  const result: [T, T][] = [];
  for (let i = 0; i < length; i++) {
    result[i] = [xs[i], ys[i]];
  }
  return result;
};

export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
