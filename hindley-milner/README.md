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
