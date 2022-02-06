# hindley-milner

Learning example based on https://github.com/rob-smallshire/hindley-milner-python/blob/master/inference.py

## Extensions

- n-ary lambdas
  - partial application
  - ignore excess args (this is to support function subtyping in the future)

## TODO
- mutually recursive functions
- unit
- subtyping
- bottom/top types
- type-checking/inference when some types are explicitly specified
- arrays
- promise
- syntax for introducing new types
- sum types
- product types
- pattern matching (how does this affect the extensions we made to h-m?)
  - we need to convert pattern matching to the lambda calculus
- holes
- algebraic effects (this probably only makes sense to do if targetting wasm)
  - https://gist.github.com/yelouafi/57825fdd223e5337ba0cd2b6ed757f53
  - https://overreacted.io/algebraic-effects-for-the-rest-of-us/
  - https://www.microsoft.com/en-us/research/wp-content/uploads/2016/08/algeff-tr-2016-v3.pdf
- higher kinded types are like Apply at the type-level, e.g. f a -> f b
  - class Functor f where 
    fmap :: (a -> b) -> f a -> f b
  - `fmap` takes a function and a value wrapped in a functor, unwraps the
    value, applies the function, and rewraps it for us.
  - use schemes to represent contraints on higher kinded types
  - `pure` wraps data in given applicative (in PureScript)
  - e.g. `pure x = Just x` in the case of the Maybe applicative
