# TODO

Port https://github.com/rob-smallshire/hindley-milner-python/blob/master/inference.py
to JavaScript.

## Language
- primitives: int, float, string, unit
- arrays, objects, and other collections
- top-level decls
- recursive let/decls
- JSX
- async/await
- comments
- unicode support

## Interop
- externals
- %raw escape hatch
  - there should be a way to specify the type when %raw is a function
- support different JSX factories
- embedding other languages (GraphQL, JavaScript, CSS, etc.)
  - we'd like make sure the embeds will result in parseable code
  - provide basic code completion and syntax highlight
  - basic typing information, e.g. how many params there are if %raw is a function

## Bindings
Having a way to generate bindings from IDL or TypeScript typings will be
super important in being able to quickly generate types for a "standard" library
along with other third-party libraries.
- core JS bindings
- DOM bindings
- node.js bindings
- React bindings

## Typing
- type inference
- explicity type annotations
- type declarations
- polymorphic types
- exception tracking
  - if an expression throws then we don't bother type checking
  - figure out a way to mark functions as sometimes throwing or always throwing

## Ecosystem
- syntax highligher for VSCode
- sourcemaps
- repl
