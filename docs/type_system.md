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

### literal types

Literal types are almost the basis of the type system.  This is because
they can be used for a variety of purposes:
- tags to discriminate between a union of object/records
- representing enums
- typing overloaded functions, e.g. `createElement()`

Literals have an immediate super type, e.g.
- the type literal for `5` has the immediate super type `int`
- the type literal for `true` has teh immediate super type `bool`

Union types can be used to represent a type that can take on multiple
distinct values, e.g. `5 | 10` can be either `5` or `10`.  In the case
of `true | false`, the union type is equiavlent to `boolean`.

Since union types are essential sets, we can define the normal set
operations on them:
- union
- intersection (don't use this for record/object since it doesn't make sense)
  given `5 | 10 | 15` and `2 | 3 | 5`, the intersection of the types is `5`.
  the intersection of `5 | 10 | 15` and `int` is `int` since `int` is a super
  type of all type literals.
- difference
  given `5 | 10 | 15` and `2 | 3 | 5`, the set difference is `10 | 15`
  the difference of `int` and `5 | 10 | 15` is all integers except for `5 | 10 | 15`.
- what about complement?
  depends on the universe of discorse... what happens if we define it to be all
  types that are representable by the type system?  Does support "complement" offer
  anything beyond a fancy way of representing set difference?

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

Representing function args as tuples could help support features like:
- function overloading (how does this work with function sub-typing)
  e.g. `createElement('div')` return an `HTMLDivElement`
  How do we include the return type?
- rest args (pass multiple args from a tuple)
  `let args = [5, true] in foo(...args)`

### objects

- if an object `foo` has all of the fields as `bar` does but `foo` has additional
  fields then `foo` is a subtype of `bar`.
- if both `foo` and `bar` have the same fields, but the types of some of some
  of the fields in `foo` are are subtypes of those in `bar` then `foo` is a subtype
  of bar, e.g. the type `{x: 5, y: 10}` is a subtype of `{x: number, y: number}`

### arrays/tuples

Array literals can be inferred as tuples.  Tuples will allow a mix of types, e.g.
`[1, 2, 3]`, `[5, true, "hello"]`.  These will be typed based on the literal that
they contain.

If the immediate super type of each literal is the same, e.g. `[1, 2, 3]` has the
following super types: `[int, int, int]` then the tuple can be considered a subtype
of `int[]`.

### enums

Enums can be either a subtype of strings or a subtype of numbers (depending on
what values are used to define them).  This means that if there's a function that
takes a string we can pass and enum to it.  This could be useful in printing out
enums (or using them from a select dropdown).

e.g. `enum Color = Red | Green | Blue` is a subtype of `'Red' | 'Green' | 'Blue'`.
Further more a union of string literals is a subtype of `string` which means any
function accepting a string could be passed an enum.

### refs

What about `ref`s?  We can't just pass a `ref<5>` to a function excepting
a `ref<number>` since the function could mutate the contents to be something
other than `5`.  As a result the only allowed subtype of `ref<'a>` is `ref<'a>`
itself.

### classes/instances

TODO: fill this out

How would we define nomminal subtyping, e.g. `HTMLDivElement` is a subtype of
`HTMLElement` which is a subtype of `Element` which is a subtype of `Node`?  Can
we define these subclasses in terms of interfaces (object/record) types describe
the hierarchy in this way?

## Partial Application

Two approaches:
- bind
- wrapper function

The former is easier to implement, but has the draw back of not allowing
flexibility in which params are partially applied.  With `bind` they must
be applied from left to right with now gaps in between.

## utility types

- keys is union of all property names as string literal types
- operators on unions (drop elements, add elements)
- use modified union types to modify object/record types (omit/pick?)
- if a union type P is a subset of a object/record's keys then we can define
  a new record from the old one that contains only the entries with keys in P
  - this new object/record will also be a subtype of the original object/record

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
