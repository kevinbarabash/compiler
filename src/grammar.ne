@{%
const opNames = {
  '+': 'Add',
  '-': 'Sub',
  '*': 'Mul',
  '/': 'Div',
}

const moo = require("moo");
const lexer = moo.compile({
  // whitespace
  cr: {match: '\r', lineBreaks: true},
  nl: {match: '\n', lineBreaks: true},
  tab: '\t',
  space: ' ',

  num: /0|[1-9][0-9]*(?:\.[0-9]*)?|\.[0-9]+/,
  string: /"(?:\\"|\\r|\\n|\\t|.)*?"/,   // non-greedy quantifier '*?'
  ident: {
    match: /[a-zA-Z]+/,

    // keywords
    type: moo.keywords({
      let: 'let',
      true: 'true',
      false: 'false',
    }),
  },

  // delimiters
  lparen: '(',
  rparen: ')',
  lbrace: '{',
  rbrace: '}',
  lbracket: '[',
  rbracket: ']',

  // other symbols
  arrow: '=>',
  equal: '=',
  plus: '+',
  minus: '-',
  times: '*',
  divide: '/',
  comma: ',',
  colon: ':',
  semi: ';',
  dot: '.',
});
%}

@lexer lexer

input
  -> _ expr _ {% data => data[1] %}

expr
  ->%lparen params:? %rparen _ %arrow _ %lbrace _ body _ %rbrace {%
      data => ({tag: "Lam", params: data[1] || [], body: data[8]}) %}
  | %lparen params:? %rparen _ %arrow _ expr {%
      data => ({tag: "Lam", params: data[1] || [], body: data[6]}) %}
  | sum {% id %}

body
  ->%let _ identifier _ %equal _ expr _ (%semi | %nl) _ body {%
      data => ({tag: "Let", name: data[2], value: data[6], body: data[10]}) %}
  | expr {% id %}

params
  ->params _ %comma _ param {% data => [...data[0], data[4]] %}
  | param {% data => [data[0]] %}

# TODO: parse more complex types
param -> identifier %colon identifier {% data => ({name: data[0], type: data[2]}) %}

sum
  ->sum _ (%plus | %minus) _ prod {% 
    ([left, , op, , right]) => 
      ({tag: "Prim", op: opNames[op], args: [left, right]}) %}
  | prod {% id %}

prod
  ->prod _ (%times | %divide) _ fact {%
    ([left, , op, , right]) => {
      return ({tag: "Prim", op: opNames[op], args: [left, right]}) 
    }  
  %}
  | fact {% id %}

fact
  ->fact %lparen args:? %rparen {% 
      data => ({tag: "App", func: data[0], args: data[2] || []}) %}
  | atom {% id %}

args
  ->args _ %comma _ expr {% data => [...data[0], data[4]] %}
  | expr {% data => [data[0]] %}

atom
  ->%lparen expr %rparen {% data => data[1] %}
  | %lbracket args %rbracket {%
      data => ({tag: "Lit", value: {tag: "LArr", value: data[1]}}) %}
  | %true {% data => ({tag: "Lit", value: {tag: "LBool", value: true}}) %}
  | %false {% data => ({tag: "Lit", value: {tag: "LBool", value: false}}) %}
  | number {% data => ({tag: "Lit", value: {tag: "LNum", value: data[0]}}) %}
  | %string {%
      data => ({tag: "Lit", value: {tag: "LStr", value: data[0].text.slice(1, -1)}}) %}
  | identifier {% data => ({tag: "Var", name: data[0]}) %}

identifier
  ->%ident {% data => data[0].value %}

number
  ->%num {% data => parseFloat(data[0].value) %}

_ -> (%cr | %nl | %space | %tab):* {% null %}
