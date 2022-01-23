// Generated automatically by nearley, version 2.20.1
// http://github.com/Hardmath123/nearley
(function () {
function id(x) { return x[0]; }

const opNames = {
  '+': 'Add',
  '-': 'Sub',
  '*': 'Mul',
  '/': 'Div',
}
var grammar = {
    Lexer: undefined,
    ParserRules: [
    {"name": "input", "symbols": ["expr"], "postprocess": id},
    {"name": "expr$string$1", "symbols": [{"literal":"="}, {"literal":">"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "expr", "symbols": [{"literal":"("}, "identifier", {"literal":")"}, "_", "expr$string$1", "_", "expr"], "postprocess": 
        data => ({tag: "Lam", param: data[1], body: data[6]}) },
    {"name": "expr", "symbols": ["sum"], "postprocess": id},
    {"name": "sum", "symbols": ["sum", "_", /[+-]/, "_", "term"], "postprocess":  
        ([left, , op, , right]) => 
          ({tag: "Prim", op: opNames[op], args: [left, right]}) },
    {"name": "sum", "symbols": ["term"], "postprocess": id},
    {"name": "term", "symbols": ["term", "_", /[*/]/, "_", "fact"], "postprocess": 
        ([left, , op, , right]) =>
          ({tag: "Prim", op: opNames[op], args: [left, right]}) },
    {"name": "term", "symbols": ["fact"], "postprocess": id},
    {"name": "fact", "symbols": ["fact", {"literal":"("}, "expr", {"literal":")"}], "postprocess": data => ({tag: "App", func: data[0], arg: data[2]})},
    {"name": "fact", "symbols": ["atom"], "postprocess": id},
    {"name": "atom", "symbols": [{"literal":"("}, "expr", {"literal":")"}], "postprocess": data => data[1]},
    {"name": "atom", "symbols": ["number"], "postprocess": data => ({tag: "Lit", value: {tag: "LNum", value: data[0]}})},
    {"name": "atom", "symbols": ["identifier"], "postprocess": data => ({tag: "Var", name: data[0]})},
    {"name": "identifier$ebnf$1", "symbols": [/[a-zA-Z]/]},
    {"name": "identifier$ebnf$1", "symbols": ["identifier$ebnf$1", /[a-zA-Z]/], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "identifier", "symbols": ["identifier$ebnf$1"], "postprocess": data => data[0].join("")},
    {"name": "number", "symbols": ["digits", {"literal":"."}, "digits"], "postprocess": data => parseFloat(data.join(""))},
    {"name": "number", "symbols": ["digits"], "postprocess": data => parseInt(data[0])},
    {"name": "digits$ebnf$1", "symbols": [/[0-9]/]},
    {"name": "digits$ebnf$1", "symbols": ["digits$ebnf$1", /[0-9]/], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "digits", "symbols": ["digits$ebnf$1"], "postprocess": data => data[0].join("")},
    {"name": "_$ebnf$1", "symbols": []},
    {"name": "_$ebnf$1", "symbols": ["_$ebnf$1", /[ \t]/], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "_", "symbols": ["_$ebnf$1"]}
]
  , ParserStart: "input"
}
if (typeof module !== 'undefined'&& typeof module.exports !== 'undefined') {
   module.exports = grammar;
} else {
   window.grammar = grammar;
}
})();
