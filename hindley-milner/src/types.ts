/**
 * Types and type constructors
 */
import {zip} from "./util";

/**
 * A type variable standing for an arbitrary type.
 * 
 * All type variables have a unique id, but names are only assigned lazily,
 * when required.
 */
export class TypeVariable {
  static nextVariableId = 0;
  static nextVariableName = 'a';

  id: number;
  instance: Type | null;
  __name: string | null;

  constructor() {
    this.id = TypeVariable.nextVariableId++;

    this.instance = null;
    this.__name = null;
  }

  // NOTE: we only increment nextVariableName if a type variable's name is used.
  get name(): string {
    if (this.__name == null) {
      this.__name = TypeVariable.nextVariableName;
      TypeVariable.nextVariableName = String.fromCharCode(
        TypeVariable.nextVariableName.charCodeAt(0) + 1
      )
    }
    return this.__name;
  }

  toString(): string {
    if (this.instance != null) {
      return this.instance.toString();
    } else {
      return this.name;
    }
  }
}

/**
 * An n-ary type constructor which builds a new type from old
 */
// TODO: rename to TypeConstructor or TCon so that it fits better
// with common terminology
export class TypeOperator {
  name: string;
  types: Type[];

  constructor(name: string, types: Type[]) {
    this.name = name;
    this.types = types;
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
export class TFunction extends TypeOperator {
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
export const TInteger = new TypeOperator("int", []);  // Basic integer
export const TBool = new TypeOperator("bool", []);  // Basic bool
export const TAny = new TypeOperator("any", []);  // top type (all types are subtype of this)
export const TNever = new TypeOperator("never", []);  // bottom type

// TODO: literal types and union (sum) types

// Right now all TypeOperators have an explicit name, but eventually
// we'd like to support TypeOperators where the name can instead by
// parameterized by another TypeOperator, e.g.
// Functor f => (a -> b) -> f a -> f b.
// TODO: model this as a Scheme, see http://dev.stephendiehl.com/fun/006_hindley_milner.html
export type Type = TypeVariable | TypeOperator;

export const equal = (t1: Type, t2: Type): boolean => {
  if (t1 instanceof TypeOperator && t2 instanceof TypeOperator) {
    return t1.name === t2.name && t1.types.length === t2.types.length &&
      zip(t1.types, t2.types).every((value) => equal(...value));
  }
  if (t1 instanceof TypeVariable && t2 instanceof TypeVariable) {
    // We only need to check the `id` to see if they're the same.
    // The `__name` field is only used if the type variable ends
    // up being used in the inferred type.
    return t1.id === t2.id;
  }
  return false;
}
