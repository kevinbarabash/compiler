# Type System

## Basic Types

- number
- string
- boolean
- lambda: (a, b, c) => d
- array<'a>
- object: {a: number, b: string, c: boolean}
- ref<'a>
- promise<'a>
- literals: e.g. `5`, `'foo'`, `true`, etc.
- union types: a | b | ...
- product types, i.e. tuple: (a, b, c)
- classes?

## Mutability

All types other than `ref`s are immutable.  Arrays and objects are "modified"
by creating new ones.  This is supported by spread syntax, `...`, e.g.
- a = [1, 2, 3]; b = [...a, 4];
- p = {x: 5, y: 10}; q = {...p, y: 20};

## Subtyping

A subtype can be used any place the original type is used.  This is safe
because all types except for `ref`s are immutable and the only allowed subtypes
of `ref<a'>` are `ref<a'>` itself.

### primitives

- a type literal is a subtype for type it's contained within, e.g.
  `5` is a subtype of number since any function that accepts a number
  will accept `5`.

### functions

- given foo = (a, b) => d, and bar = (a') => d', `bar` is
  a subtype of `foo` if:
  - a is a subtype of a' (if `foo` only accepts particular numbers,
    then `bar` accepting any number is valid)
  - d' is a subtype of d (if `foo` return any number, it's fine for
    `bar` to return one particular number)
  - it's okay for `bar` to have fewer params than since if we call
    `bar` with extra args, it will just ignore those extra args

What does this mean for partial application?

If a function is passed a callback with fewer than expected params, then
any partial application of the callback in the function should be done
as if the callback had the expected number of params even though it
doesn't.

### objects

- if an object `foo` has all of the fields as `bar` does but `foo` has additional
  fields then `foo` is a subtype of `bar`.
- if both `foo` and `bar` have the same fields, but the types of some of some
  of the fields in `foo` are are subtypes of those in `bar` then `foo` is a subtype
  of bar, e.g. the type `{x: 5, y: 10}` is a subtype of `{x: number, y: number}`

### arrays/tuples

TODO: fill this out

### refs

What about `ref`s?  We can't just pass a `ref<5>` to a function excepting
a `ref<number>` since the function could mutate the contents to be something
other than `5`.  As a result the only allowed subtype of `ref<'a>` is `ref<'a>`
itself.

### classes/instances

TODO: fill this out

## Partial Application

Two approaches:
- bind
- wrapper function

The former is easier to implement, but has the draw back of not allowing
flexibility in which params are partially applied.  With `bind` they must
be applied from left to right with now gaps in between.

## Other topics

- bounded generics/parametric types
- conditional types
- recursive types
- optionality/nullability
- open objects (e.g. {[string]: number})
- bottom/top types
- pattern matching
- utility types
- classes and OOP: Are the following constraints sufficient?
  - disallowing instances to change their type
  - treating object literals and class instances as non-fungible
- default function parameters
