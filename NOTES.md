# Notes

## Key Features

- Tight interop with TypeScript
  - Generate .js and .d.ts files
  - Comsume .d.ts for bindings
  - Should support mixed codebases with minimal effort
- Type system plugins
  - e.g. provide inference for GraphQL query results directly to the compiler (no codegen)
- Sourcemaps
- JSX
  - Support different JSX factories
- Pattern matching
- Type classes
- Codegen/Hygienic macros
  - Would like to support #deriving of various type class instances if possible
  - Not sure how difficult it will be to make hygienic macros typesafe
- Partial application
  - If not enough args are provided then we 
- Optional params
- Optional chaining
- Pipeline operator
  - Simplify the use of API's like WebGL that involve passing the same object around to a bunch of functions
- Async/Await
- Mutable data types (need to figure out how we want to handle this)
  - If a data type is mutable then we can't allow covariant calls since those are unsafe with mutable types
    - If a function expects a DOM Node we should be able to pass it an Element or even an HTMLDivElement
      because the those conform to the excepted interface
    - Also, there's not really a way to change the type of an instance (at least one that we care about)
      so we can't pass in an HTMLDivElement to something expecting a DOM Node and then have it be mutated
      to something that isn't an HTMLDivElement
  - Why bother?
    - Interop
    - But TS supports ReadonlySet, ReadonlyMap, etc.
    - What if we allow mutation of locally defined colllections?
    - What about all of the DOM classes which are all mutable?
      - They're more opaque than basic collections so maybe not a problem

## Differences from Haskell

Even though the type system is based on Hindley-Milner style type inference which is
what Haskell and other FP languages uses, there are a number of differences:

- JS/TS-style syntax
- Functions are not curried
  - Optional params (not currying is what allows us to support optional params)
- No type constructors (not a good match for TypeScript)
  - Could possibly provide syntatic sugar to make tagged union types behave more like variants/type constructors
- Structural sub-typing
  - TODO: investigate Haskell's extensible records to see how this differences from that
- Literal types
- Union types
- Intersection types

## Differences from TypeScript

- Better type inference
- No `any`
  - instead any param that doesn't have a specific type will be generic, e.g. `<A>(a: A): A`
- Expression rich language
  - TODO: throw expressions, do expressions
- Immutable by default
- Invalid member/index access will throw
  - It would be nice to make this configurable to also return `T | undefined`
- All literals are typed as if using `as const` in TS
- Covariance is only allowed for immutable collections
- Differentiate integers from floating point numbers
  - The motivation here is be able to allow functions expecting integers to enforce this constraint
