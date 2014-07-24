"use strict";

var fs = require('fs');
var assert = require('assert');
var _ = require('../vendor/underscore/underscore.js');
var estraverse = require("../vendor/estraverse/estraverse.js");
var escodegen = require("../vendor/escodegen/escodegen.js");
var esprima = require("../vendor/esprima/esprima.js");
var estemplate = require("../vendor/estemplate/lib/estemplate.js");
var types = require("../vendor/ast-types/main.js");
var build = types.builders;
var Syntax = estraverse.Syntax;

function makeGensym() {
    var seq = 0;
    return function(prefix){
        var result = prefix + seq;
        seq += 1;
        return result;
    }
}

var gensym = makeGensym();

function prettyJSON(obj) {
    console.log(JSON.stringify(obj, null, 2));
}

function buildFunc(args, body){
    if (types.namedTypes.Statement.check(body)) {
        return build.functionExpression(null, args, build.blockStatement([body]));
    } else if (types.namedTypes.Expression.check(body)) {
        return build.functionExpression(null, args, build.blockStatement([build.expressionStatement(body)]));
    } else {
        throw new Error("buildFunc: unknown body type: " + body.type);
    }
}

function cpsAtomic(node){    
    console.log("ATOMIC", node.type);
    switch (node.type) {
    case Syntax.FunctionExpression:
        var newCont = build.identifier(gensym("_k"));
        var newParams = node.params.slice();
        newParams.push(newCont);
        return buildFunc(newParams, cps(node.body, newCont));
    case Syntax.Identifier:
        return node;
    case Syntax.Literal:
        return node;
    default:
        throw new Error("cpsAtomic: unknown expression type: " + node.type);
    };
}

function cps(node, cont){    

    var recurse = function(n){return cps(n, cont)};

    console.log(node.type);
    switch (node.type) {

   // Wrapper statements

    case Syntax.BlockStatement: 
        assert.equal(node.body.length, 1);
        // TODO: extend to multiple statements, sequentialize (see "begin" in Scheme)
        return build.blockStatement(_.map(node.body, recurse));

    case Syntax.Program: 
        assert.equal(node.body.length, 1);
        // TODO: extend to multiple statements, sequentialize (see "begin" in Scheme)
        return build.program(_.map(node.body, recurse));

    case Syntax.ReturnStatement: 
        return build.returnStatement(recurse(node.argument));
      
    case Syntax.ExpressionStatement: 
        return build.expressionStatement(recurse(node.expression));

    // Atomic expressions

    case Syntax.Identifier:
    case Syntax.Literal:
    case Syntax.FunctionExpression:
        return build.callExpression(cont, [cpsAtomic(node)]);

    // Variable declaration

    case Syntax.VariableDeclaration:
        assert.equal(node.declarations.length, 1);
        var dec = node.declarations[0];
        return build.variableDeclaration(node.kind, 
                                         [build.variableDeclarator(dec.id, recurse(dec.init))])

    // Function calls

    case Syntax.CallExpression:
        var f = build.identifier(gensym("_f"));
        var e = build.identifier(gensym("_e"));
        assert.equal(node.arguments.length, 1);
        // TODO: extend to multiple arguments
        var x = cps(node.callee,
                    buildFunc([f],
                              cps(node.arguments[0], 
                                  buildFunc([e], 
                                            build.callExpression(f, [e, cont])))));
        return x;

    // case Syntax.IfStatement:
    //     return node;

    // case Syntax.BinaryExpression: 
    //   return node;

    // case Syntax.MemberExpression: 
    //  return node;

    // FactorStatement

    // SampleStatement

    default:
        throw new Error("cps: unknown node type: " + node.type);
    }
}

function main(){
    var filename = process.argv[2];
    console.log('Processing', filename);
    var ast = esprima.parse(fs.readFileSync(filename));
    var newAst = cps(ast, build.identifier("topK"));
    // prettyJSON(newAst);
    var newCode = escodegen.generate(newAst);
    var originalCode = escodegen.generate(ast);
    console.log("\n* Original code:\n");
    console.log(originalCode);
    console.log("\n* CPS code:\n");
    console.log(newCode);
}

main();
