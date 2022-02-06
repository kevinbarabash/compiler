/**
 * Class definitions for the abstract syntax tree nodes
 * which comprise the little language for which types
 * will be inferred
 */

// TODO: update to support n-ary params
export class Lambda {
  params: string[];
  body: Expression;

  constructor(params: string[] | string, body: Expression) {
    this.params = Array.isArray(params) ? params : [params];
    this.body = body;
  }

  toString(): string {
    const { params, body } = this;
    return `(fn ${params.map((p) => p.toString()).join(" ")} => ${body})`;
  }
}

export class Identifier {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  toString(): string {
    return this.name;
  }
}

export class Int {
  value: number;

  constructor(value: number) {
    this.value = value;
  }

  toString(): string {
    return this.value.toString();
  }
}

export class Bool {
  value: boolean;

  constructor(value: boolean) {
    this.value = value;
  }

  toString(): string {
    return this.value.toString();
  }
}

export class Arr {
  // The AST allows for array literals to contain a mix of values.
  // TODO: How will type inference handle a mix of values?
  // - option 1: determine a type that encompases all types in the mix
  // - option 2: disallow the mix unless we specify a type for the array
  //             in the source, then check that this type works given the
  //             values in the array
  values: Expression[];

  constructor(values: Expression[]) {
    this.values = values;
  }

  toString(): string {
    return `[${this.values.map((v) => v.toString()).join(", ")}]`;
  }
}

export class Literal {
  value: Int | Bool | Arr;

  constructor(value: Int | Bool | Arr) {
    this.value = value;
  }

  toString(): string {
    return this.value.toString();
  }
}

// TODO: update to support n-ary args
export class Apply {
  fn: Expression;
  args: Expression[];

  constructor(fn: Expression, args: Expression[] | Expression) {
    this.fn = fn;
    this.args = Array.isArray(args) ? args : [args];
  }

  toString(): string {
    const { fn, args } = this;
    return `(${fn} ${args.map((a) => a.toString()).join(" ")})`;
  }
}

export class Let {
  v: string;
  defn: Expression;
  body: Expression;

  constructor(v: string, defn: Expression, body: Expression) {
    this.v = v;
    this.defn = defn;
    this.body = body;
  }

  toString() {
    const { v, defn, body } = this;
    return `(let ${v} = ${defn} in ${body})`;
  }
}

export class Letrec {
  v: string;
  defn: Expression;
  body: Expression;

  constructor(v: string, defn: Expression, body: Expression) {
    this.v = v;
    this.defn = defn;
    this.body = body;
  }

  toString() {
    const { v, defn, body } = this;
    return `(letrec ${v} = ${defn} in ${body})`;
  }
}

export type Expression = Lambda | Identifier | Apply | Let | Letrec | Literal;
