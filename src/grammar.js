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
    {"name": "input", "symbols": ["_", "expr", "_"], "postprocess": data => data[1]},
    {"name": "expr$string$1", "symbols": [{"literal":"="}, {"literal":">"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "expr", "symbols": [{"literal":"("}, "params", {"literal":")"}, "_", "expr$string$1", "_", {"literal":"{"}, "_", "body", "_", {"literal":"}"}], "postprocess": 
        data => ({tag: "Lam", params: data[1], body: data[8]}) },
    {"name": "expr$string$2", "symbols": [{"literal":"="}, {"literal":">"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "expr", "symbols": [{"literal":"("}, "params", {"literal":")"}, "_", "expr$string$2", "_", "expr"], "postprocess": 
        data => ({tag: "Lam", params: data[1], body: data[6]}) },
    {"name": "expr", "symbols": ["sum"], "postprocess": id},
    {"name": "body$string$1", "symbols": [{"literal":"l"}, {"literal":"e"}, {"literal":"t"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "body", "symbols": ["body$string$1", "_", "identifier", "_", {"literal":"="}, "_", "expr", "_", /[;\n]/, "_", "body"], "postprocess":  data =>
        ({tag: "Let", name: data[2], value: data[6], body: data[10]})
          },
    {"name": "body", "symbols": ["expr"], "postprocess": id},
    {"name": "params", "symbols": ["params", "_", {"literal":","}, "_", "identifier"], "postprocess": data => [...data[0], data[4]]},
    {"name": "params", "symbols": ["identifier"], "postprocess": data => [data[0]]},
    {"name": "sum", "symbols": ["sum", "_", /[+-]/, "_", "term"], "postprocess":  
        ([left, , op, , right]) => 
          ({tag: "Prim", op: opNames[op], args: [left, right]}) },
    {"name": "sum", "symbols": ["term"], "postprocess": id},
    {"name": "term", "symbols": ["term", "_", /[*/]/, "_", "fact"], "postprocess": 
        ([left, , op, , right]) =>
          ({tag: "Prim", op: opNames[op], args: [left, right]}) },
    {"name": "term", "symbols": ["fact"], "postprocess": id},
    {"name": "fact", "symbols": ["fact", {"literal":"("}, "args", {"literal":")"}], "postprocess": data => ({tag: "App", func: data[0], args: data[2]})},
    {"name": "fact", "symbols": ["atom"], "postprocess": id},
    {"name": "args", "symbols": ["args", "_", {"literal":","}, "_", "expr"], "postprocess": data => [...data[0], data[4]]},
    {"name": "args", "symbols": ["expr"], "postprocess": data => [data[0]]},
    {"name": "atom", "symbols": [{"literal":"("}, "expr", {"literal":")"}], "postprocess": data => data[1]},
    {"name": "atom$string$1", "symbols": [{"literal":"t"}, {"literal":"r"}, {"literal":"u"}, {"literal":"e"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "atom", "symbols": ["atom$string$1"], "postprocess": data => ({tag: "Lit", value: {tag: "LBool", value: true}})},
    {"name": "atom$string$2", "symbols": [{"literal":"f"}, {"literal":"a"}, {"literal":"l"}, {"literal":"s"}, {"literal":"e"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "atom", "symbols": ["atom$string$2"], "postprocess": data => ({tag: "Lit", value: {tag: "LBool", value: false}})},
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
    {"name": "_$ebnf$1", "symbols": ["_$ebnf$1", /[ \t\r\n]/], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
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
