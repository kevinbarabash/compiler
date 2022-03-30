declare var Foo: FooConstructor;

interface Foo {
    valueOf(): boolean;
}

interface FooConstructor {
    new(value?: any): Foo;
    <T>(value?: T): boolean;
    readonly prototype: Foo;
}