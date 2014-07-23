"use strict";

var fs = require('fs');

var estraverse = require("../vendor/estraverse/estraverse.js");
var escodegen = require("../vendor/escodegen/escodegen.js");
var esprima = require("../vendor/esprima/esprima.js");
var estemplate = require("../vendor/estemplate/lib/estemplate.js");

// Load code from file (in the future, load from text boxes)
var filename = process.argv[2];
console.log('Processing', filename);

// Parse code
var ast = esprima.parse(fs.readFileSync(filename));

function cps(ast, toplevelCont){

  var cont = toplevelCont;

  estraverse.replace(ast, {
                       enter: function (node, parent) {
                         console.log(node.type);
                         if (node.type === 'ArrowFunctionExpression') {
                           return rewriteArrowFunctionExpressionNode(node);
                         }
                       },
                       leave: function(node, parent) {}
                     });
}

var code = escodegen.generate(ast);

console.log(code);

// var spoon = require("assets/vendor/spoon/lib/spoon.js");

// function main(__$callback) {
//     function async(callback) {
//         callback(null, 1);
//     }
//     "enable spoon";
//     return 1 + async();
// }

// var code = spoon(main.toString(), ['async'], {
//     declaration: 'enable spoon'
// });

// console.log(code);
// eval(code);

// function toplevelCont(err, value) {
//     console.log("done!");
//     console.log(value);
// }

// main(toplevelCont);

// console.log("hi");