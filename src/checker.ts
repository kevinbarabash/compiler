// Check that the follow things are correct:
// - variables that being used are defined and in-scope
// - variables are the correct type for the function call being made
import { Stack, Map } from "immutable";
import { parse } from "./parser";

import type { Expr } from "./syntax";

const expr3 = parse(`
((x:number, y:number, z:number) => {
  let sum = x + y + q
  sum
})(1, 2, 3)`);

type Scope = Map<string, Type>;

// TODO: consider using a RecordFactory for this
type Context = {
  scopes: Stack<Scope>; // A series of nested scopes
};

const context: Context = { scopes: Stack() };
context.scopes.push(Map<string, Type>());

// types of types
// - simple: number, string, boolean, etc.
// - functions: (t0, t1, ..., tn) -> tn+1, ('a) -> 'a
// - parameterized types: Promise<number>, Option<'a>, etc.
type TCon = { tag: "TCon"; name: string };
type TVar = { tag: "TVar"; name: string };
type TLam = { tag: "TLam"; args: Type[]; ret: Type };
type TApp = { tag: "TApp"; name: string; args: Type[] }; // parameterized types

const TCon = (name: string): TCon => ({ tag: "TCon", name });
const TVar = (name: string): TVar => ({ tag: "TVar", name });
const TLam = (args: Type[], ret: Type): TLam => ({ tag: "TLam", args, ret });
const TApp = (name: string, args: Type[]): TApp => ({ tag: "TApp", name, args });

type Type = TCon | TVar | TLam | TApp;

const tNumber = TCon("number");
const tBool = TCon("bool");
const tString = TCon("string");

const tArray = TApp("array", [TVar("a")]);

const typesMap: Record<string, Type> = {
  number: tNumber,
  bool: tBool,
  string: tString,
};

// How do we use TApp to model:
// - functions
// - arrays
// - tuples
// - etc.

// TODO: don't use stringify for this check since the order of keys can
// cause the check to fail.
const equal = <T>(a: T, b: T): boolean => JSON.stringify(a) === JSON.stringify(b);

export const check = (expr: Expr, context: Context): Type => {
  // whenever we see a 'let', we add (or overwrite) an entry to the top scope
  // whenever we enter a 'lam', we create a new top scope and all
  //   entries for all of the variables
  // whenever we exit a 'lam', we pop the top scope from the context
  // whenever we see a 'var', we need to look through all of the scopes
  //   from last to first to see if any of them contain the variable we're
  //   looking for

  // What do we do for type checking App where the args are expressions and
  // not variables?  We need a way to determine the type of an expression.
  // This is one part of type inference.

  switch (expr.tag) {
    case "Let": {
      // The variable introduced by `let` won't be in scope for the expression
      // being assigned to it.
      const valueType = check(expr.value, context);
      const scope = context.scopes.peek();
      if (!scope) {
        throw new Error("no scope available in current context");
      }
      // Set the type for this variable to the type of the expr.value
      const newScope = scope.set(expr.name, valueType);
      const newContext = {
        // replace the top-level scope with the new scope
        scopes: context.scopes.splice(-1, 1, newScope),
      };
      // Now that we've updated the context to include the variable defined by
      // the `let`, we can continue by checking the body of the `let`, i.e.
      // the stuff that comes after the `in`.
      // Maybe we should rename `body` to `inBody` so that that's a bit clearer.
      // TODO: check if the variable declared is unused in the body.
      check(expr.body, newContext);

      return valueType;
    }
    case "Var": {
      const scope = context.scopes.findLast((scope) => scope.has(expr.name));
      if (!scope) {
        throw new Error(`Variable ${expr.name} is not in scope`);
      }

      // we've already verified that an entry exists for the variable in this scope
      return scope.get(expr.name) as Type;
    }
    case "Lam": {
      const emptyScope = Map<string, Type>();
      const newScope = emptyScope.withMutations((scope) => {
        for (const param of expr.params) {
          // TODO: If a param is untyped, provide a way to mark it a untyped and
          // then fill in that type as we check the body of the lambda.
          // What happens if there are multiple places using the variable as 
          // different types?  Can the types be unified?  If not, then we need
          // to raise an error.
          const t = typesMap[param.type];
          if (!t) {
            throw new Error(`Type with name ${param.type} is not in scope`);
          }
          scope.set(param.name, t);
        }
      });
      const newContext = {
        scopes: context.scopes.push(newScope),
      };

      // The type of the body is the same as the return type.
      // TODO: if the lambda has an annotated return type, check
      // that it matches the value of the body expression.
      const retType = check(expr.body, newContext);

      // TODO: check if any of the params are unused in the body
      const paramsTypes = expr.params.map(param => {
        const t = typesMap[param.type];
        if (!t) {
          throw new Error(`Type with name ${param.type} is not in scope`);
        }
        return t;
      })
      return {
        tag: "TLam",
        args: paramsTypes, // TODO
        ret: retType,
      };
    }
    case "App": {
      // TODO: If there's a function typed as a' -> a' and we apply a number
      // then the return type should also be number.

      // Check that what we're trying to apply is actually a lambda
      // TODO: rename `func` to `lam`
      const funcType = check(expr.func, context);
      if (funcType.tag !== "TLam") {
        throw new Error("Cannot apply non-lambda expression");
      }

      // Check that the number of args match the number of params
      // TODO: handle partial application
      // TODO: rename `args` to `params` since that's more accurate
      const argTypes = expr.args.map((arg) => check(arg, context));
      if (funcType.args.length !== argTypes.length) {
        console.log(`funcType.args.length = ${funcType.args.length}`);
        console.log(`argTypes.length = ${argTypes.length}`);
        throw new Error("The number of args doesn't match required number")
      }

      // Check that the type of each arg matches the type of each param
      for (let i = 0; i < argTypes.length; i++) {
        if (!equal(argTypes[i], funcType.args[i])) {
          throw new Error(`Incorrect type for arg #${i}`);
        }
      }

      // TODO: if a param expects a callback and it's passed a lambda,
      // we can infer the param types of the lambda based on the expected
      // type of the callback.
      // TODO: it should be okay to call a function with more params then
      // it expects.  This is so that we can do things like: array.map(x => x * x);
      // Normally, array.map takes a callback with three params, i.e. (elem, index, array)
      // (elem) => ... is a subtype of (elem, index, array) => ... since it can be
      // used in place of a function of that type.

      return funcType.ret;
    }
    case "Lit": {
      const lit = expr.value;
      switch (lit.tag) {
        case "LBool": return tBool;
        case "LNum": return tNumber;
        case "LStr": return tString;
        // TODO: look at the values in the array so that we can infer the type
        case "LArr": {
          const types = lit.value.map(elem => check(elem, context));
          // TODO: unify all of the types in types to determine if this
          // is a valid array literal.  If there's strings and numbers
          // in it together then that's a no-go.
          return tArray;
        }
      }
    }
    case "Prim": {
      switch (expr.op) {
        case "Add": return tNumber;
        case "Sub": return tNumber;
        case "Mul": return tNumber;
        case "Div": return tNumber;
      }
    }
  }
};
