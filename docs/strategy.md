# Strategy

1. update parser to support specifying types
2. type-checking
3. type-inference


## Hindley-Milner

Γ          = type context
σ          = type schema metavariable
e : τ      = type judgetment
P |- Q     = implication
τ_1 ~ τ_2  = unification constraint
[τ/α]      = substitution
s          = substitution metavariable
[s]τ       = substitution application
τ_1 -> τ_2 = function type
C => τ     = qualified type

NOTE: The horizontal lines are bidirectional implications

### T-Var
x:σ ∈ Γ
--------
Γ |- x:σ

T-App
Γ |- e_1 : τ_1 -> τ_2    Γ |- e_2 : τ_1
---------------------------------------
         Γ |- e_1 e_2 : τ_2

Notes:
This is pretty straight forward.  Our language supports lambdas 
of n-arity which means that τ_1 is a tuple of some sort.

If we want to support partial application, we'll need an
additional rule that explains what happens when only some
of the necessary params have been provided.

### T-PartialApp (extension)
TODO: basically this rule can be applied when:
- there are fewer args than params
- the types of the args that are passed match those of the params
The result of which will be a new function which takes the remaining
params and has the same return type as the original function.

### T-Lam
Γ, x : τ_1 |- e : τ_2
----------------------
Γ |- λx.e : τ_1 -> τ_2 

Notes:
If a variable x of type τ_1 produces an expression e of τ_2
then the type of λx.e is τ_1 -> τ_2.

What if multiple different types could be passed to a function?

### T-Let
Γ |- e_1:σ     Γ, x:σ |- e_2:τ
------------------------------
   Γ |- let x = e_1 in e_2:τ

check(bottom-up): Given the `let` expression below, if the
current type context implies that e_1 has type σ, then x also
has type σ.
infer(top-down): ...

### T-Gen
TODO



### T-Inst
Γ |- e:σ_1         σ_1 ⊑ σ_2
----------------------------
          Γ |- e:σ_2

check(bottom-up): ...
infer(top-down): Given e is of type σ_1 and σ_1 is a subtype
of σ_2 then e also satisfies σ_2.


## Unification

Start with assumptions of the types that a variable might be, e.g. a param type
might be `any` to being with and then later we spot that it's being used with a `+`
which means that for that use we can assume the variable is a `number`.

Given the two assumptions: `any`, `number`, can we find a type that satisfies both,
i.e. a type that is a subtype of both.  In this case `number` works.  One could say
that `5` is subtype of both.

Instead of using a the top type `any` at the start, for params we can assume them
to have the constraint of `forall a` to start with.  These kinds of qualifications
act as filters on the inferred types.  If the paramter isn't used at all in the 
funciton the it stays as `forall a`.  If the param is used as a string in one place
and a number in another place, we'll be unable unify those types.

If we have a number of returns from a function, e.g. `0`, a number resulting from
addition, and a call to the function itself we need a way to unify these.  The last
return type can be modelled as a fix point.  In this case the unifiying type is
`number`.

https://www.cs.cornell.edu/courses/cs3110/2011sp/Lectures/lec26-type-inference/type-inference.htm
