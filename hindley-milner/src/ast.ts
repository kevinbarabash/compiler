/**
 * Class definitions for the abstract syntax tree nodes
 * which comprise the little language for which types
 * will be inferred
 */

// TODO: update to support n-ary params
export class Lambda {
    v: string;
    body: Expression;

    constructor(v: string, body: Expression) {
        this.v = v;
        this.body = body;
    }

    toString(): string {
        const {v, body} = this;
        return `(fn ${v} => ${body})`;
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

// TODO: update to support n-ary args
export class Apply {
    fn: Expression;
    arg: Expression;

    constructor(fn: Expression, arg: Expression) {
        this.fn = fn;
        this.arg = arg;
    }

    toString(): string {
        const {fn, arg} = this;
        return `(${fn} ${arg})`;
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
        const {v, defn, body} = this;
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
        const {v, defn, body} = this;
        return `(letrec ${v} = ${defn} in ${body})`;
    }
}

export type Expression = Lambda | Identifier | Apply | Let | Letrec;
