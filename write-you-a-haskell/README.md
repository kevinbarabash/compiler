# Write You A Haskell

- http://dev.stephendiehl.com/fun/index.html

Start of simple by porting:
https://github.com/sdiehl/write-you-a-haskell/blob/master/chapter7/poly_constraints

281 lines (not including helper files)

After that, tackle thih.


## Notes

Destructuring:
- `let Promise<a> = foo()`, should this desugar to `const a = await foo()`?
- What about other type constructors, e.g. `Maybe<a>` or `Pair<a, b>`?
  - `Maybe<a>` can be either `Some<a>` or `None` so `Maybe<a>` is not a
    type constructor, but actually a parametric type
    - How do we differentiate `Maybe<a>` from `Some<a>`?
    - It seems like `Promise<a>` is also a pametric type and not a type
      constructor
- We should probably introduce tuple and record types to support destructuring
  

## TODO

Evaluate fantasy-land and static-land specs:
- haskell's type classes seem more a more consistent way of consuming
  typeclassopedia
- static-land curries all its functions, less of an issue with fantasy-
  land which uses methods
- fantasy-land's use of methods is bad because it limits with params can
  be partially applied
