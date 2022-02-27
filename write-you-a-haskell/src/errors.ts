import { print, TVar, Type, Constraint } from "./type";

export class UnificationFail extends Error {
  constructor(a: Type, b: Type) {
    const message = `Couldn't unify ${print(a)} with ${print(b)}`;
    super(message);
    this.name = "UnificationFail";
  }
}

export class InfiniteType extends Error {
  constructor(a: TVar, b: Type) {
    const message = `${print(a)} appears in ${print(b)}`;
    super(message);
    this.name = "InfiniteType";
  }
}

export class UnboundVariable extends Error {
  constructor(name: string) {
    const message = `${name} is unbound`;
    super(message);
    this.name = "UnboundVariable";
  }
}

export class Ambiguous extends Error {
  constructor(constraints: Constraint[]) {
    const message = constraints
      .map(([a, b]) => `${print(a)} = ${print(b)}`)
      .join(", ");
    super(message);
    this.name = "Ambiguous";
  }
}

export class UnificationMismatch extends Error {
  constructor(as: Type[], bs: Type[]) {
    super("UnificationMismatch");
    this.name = "UnificationMismatch";
  }
}
