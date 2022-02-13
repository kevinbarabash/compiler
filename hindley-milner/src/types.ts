/**
 * Types and type constructors
 */
import {zip} from "./util";
import {Literal} from "./ast";

/**
 * A type variable standing for an arbitrary type.
 * 
 * All type variables have a unique id, but names are only assigned lazily,
 * when required.
 */
export class TVar {
  static nextVariableId = 0;
  static nextVariableName = 'a';

  id: number;
  instance: Type | null;
  __name: string | null; // only used when printing the types out

  constructor() {
    this.id = TVar.nextVariableId++;

    this.instance = null;
    this.__name = null;
  }

  toString(): string {
    if (this.instance != null) {
      return this.instance.toString();
    } else {
      // TODO: Eventually, we can have an `id` to `name` map
      if (this.__name == null) {
        this.__name = TVar.nextVariableName;
        TVar.nextVariableName = String.fromCharCode(
          TVar.nextVariableName.charCodeAt(0) + 1
        )
      }

      return this.__name;
    }
  }
}

export class TLit {
  value: Literal;
  // A type literal can be widened to a type constructor, e.g.
  // `5` can be widened to `int`.
  // Once the type system supports union types we'll be able
  // to widen type constructors as.  As example if inference
  // tells us a function needs to accept `int` or `string` then
  // either of those types may need to be widened to `int | string`.
  // There may even be cases in which a type ends up being widened
  // numerous times.
  widening: Type | null;
  frozen: boolean;

  constructor(value: Literal) {
    this.value = value;

    this.widening = null;
    this.frozen = false;
  }

  toString(): string {
    if (this.widening) {
      return this.widening.toString();
    }
    return this.value.toString();
  }
}

/**
 * An n-ary type constructor which builds a new type from old
 */
export class TCon {
  name: string;
  types: Type[];
  frozen: boolean;

  constructor(name: string, types: Type[]) {
    this.name = name;
    this.types = types;
    this.frozen = false;
  }

  toString(): string {
    switch (this.types.length) {
      case 0: return this.name;
      case 2: {
        const left = this.types[0];
        const right = this.types[1];
        return `(${left} ${this.name} ${right})`;
      }
      default: {
        const types = this.types.join(" ");
        return `${this.name} ${types}`;
      }
    }
  }
}

/**
 * A binary type constructor which builds function types
 */
export class TFunction extends TCon {
  constructor(fromType: Type[], toType: Type) {
    super("->", [...fromType, toType]);
  }

  toString(): string {
    const argTypes = this.types.slice(0, -1);
    const retType = this.types[this.types.length - 1];
    return `(${argTypes.map(a => a.toString()).join(" ")} -> ${retType})`;
  }
}

// Basic types are constructed with a nullary type constructor
export const TInteger = new TCon("int", []);  // Basic integer
export const TBool = new TCon("bool", []);  // Basic bool
export const TAny = new TCon("any", []);  // top type (all types are subtype of this)
export const TNever = new TCon("never", []);  // bottom type

// TODO: literal types and union (sum) types

// Right now all TypeOperators have an explicit name, but eventually
// we'd like to support TypeOperators where the name can instead by
// parameterized by another TypeOperator, e.g.
// Functor f => (a -> b) -> f a -> f b.
// TODO: model this as a Scheme, see http://dev.stephendiehl.com/fun/006_hindley_milner.html
export type Type = TVar | TCon | TLit;

// Union types
// - when should two types be considered the same for the purposes
//   of only storing unique types in the set of elements that defines
//   the union?
// 
// The `equal` function below is used durin type inference.  In this
// situation we may need to differentiate a -> a from b -> b in order
// to indicate the params passed to these two functions do not need to
// be the same type.
//
// In the context of a union type containing a function with type a -> a
// represents any function that returns the same type it was passed (of
// which there may be many concrete subtypes).

export const equal = (t1: Type, t2: Type): boolean => {
  if (t1 instanceof TCon && t2 instanceof TCon) {
    return t1.name === t2.name && t1.types.length === t2.types.length &&
      zip(t1.types, t2.types).every((value) => equal(...value));
  }
  if (t1 instanceof TVar && t2 instanceof TVar) {
    // We only need to check the `id` to see if they're the same.
    // The `__name` field is only used if the type variable ends
    // up being used in the inferred type.
    return t1.id === t2.id;
  }
  if (t1 instanceof TLit && t2 instanceof TLit) {
    // NOTE: This never gets called, should it?
    return t1.value === t2.value;
  }
  return false;
}

export const freezeType = (t: Type) => {
  if (t instanceof TCon) {
    if (!t.frozen) {
      t.frozen = true;
      t.types.forEach(freezeType);
    }
  } else if (t instanceof TLit) {
    t.frozen = true;
  }
}