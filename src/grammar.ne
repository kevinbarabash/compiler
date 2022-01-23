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
  ->"(" identifier ")" _ "=>" _ expr {%
    data => ({tag: "Lam", param: data[1], body: data[6]}) %}
  | sum {% id %}

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
  ->fact "(" expr ")" {% data => ({tag: "App", func: data[0], arg: data[2]}) %}
  | atom {% id %}

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

