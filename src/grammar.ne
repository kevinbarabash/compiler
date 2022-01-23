@{%
const opNames = {
  '+': 'Add',
  '-': 'Sub',
  '*': 'Mul',
  '/': 'Div',
}
%}

input
  ->expr {% id %}

expr
  ->"(" params ")" _ "=>" _ expr {%
    data => ({tag: "Lam", params: data[1], body: data[6]}) %}
  | sum {% id %}

params
  ->params _ "," _ identifier {% data => [...data[0], data[4]] %}
  | identifier {% data => [data[0]] %}

sum  
  ->sum _ [+-] _ term {% 
    ([left, , op, , right]) => 
      ({tag: "Prim", op: opNames[op], args: [left, right]}) %}
  | term {% id %}

term
  ->term _ [*/] _ fact {%
    ([left, , op, , right]) =>
      ({tag: "Prim", op: opNames[op], args: [left, right]}) %}
  | fact {% id %}

fact
  ->fact "(" args ")" {% data => ({tag: "App", func: data[0], args: data[2]}) %}
  | atom {% id %}

args
  ->args _ "," _ expr {% data => [...data[0], data[4]] %}
  | expr {% data => [data[0]] %}

atom
  ->"(" expr ")" {% data => data[1] %}
  | number {% data => ({tag: "Lit", value: {tag: "LNum", value: data[0]}}) %}
  | identifier {% data => ({tag: "Var", name: data[0]}) %}

identifier
  ->[a-zA-Z]:+ {% data => data[0].join("") %}

number
  ->digits "." digits {% data => parseFloat(data.join("")) %}
  | digits {% data => parseInt(data[0]) %}

digits -> [0-9]:+ {% data => data[0].join("") %} 

_ -> [ \t]:*

