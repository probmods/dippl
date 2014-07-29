"use strict";

var assert = require('assert');
var util = require('./util.js');
var _ = require('../vendor/underscore/underscore.js');
var estraverse = require("../vendor/estraverse/estraverse.js");
var escodegen = require("../vendor/escodegen/escodegen.js");
var esprima = require("../vendor/esprima/esprima.js");
var estemplate = require("../vendor/estemplate/lib/estemplate.js");
var types = require("../vendor/ast-types/main.js");
var build = types.builders;
var Syntax = estraverse.Syntax;

function buildStatement(node){
    if (types.namedTypes.Statement.check(node)) {
        return node;
    } else if (types.namedTypes.Expression.check(node)) {
        return build.expressionStatement(node);
    } else {
        throw new Error("buildStatement: can't handle node type: " + node.type);
    }
}

function buildFunc(args, body){
    return build.functionExpression(null, args, build.blockStatement([buildReturn(body)]));
}

function buildSingletonFunc(stmt){
    return build.callExpression(buildFunc([], stmt), []);
}

function buildReturn(node){
    if (types.namedTypes.ExpressionStatement.check(node)) {
        return build.returnStatement(node.expression);
    } else if (types.namedTypes.Expression.check(node)) {
        return build.returnStatement(node);
    } else if (types.namedTypes.ReturnStatement.check(node)) {
        return node;
    } else if (types.namedTypes.Statement) {
        // Convert statement to expression
        return build.returnStatement(buildSingletonFunc(node))
    } else {
        throw new Error("buildReturn: can't handle node type: " + node.type);
    }
}

function cpsAtomic(node){    
    // console.log("ATOMIC", node.type);
    switch (node.type) {
    case Syntax.FunctionExpression:
        var newCont = build.identifier(util.gensym("_k"));
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

function cpsSequence(nodes, cont){
    assert.ok(nodes.length > 0);
    if (nodes.length == 1) {
        return cps(nodes[0], cont);
    } else {
        var temp = build.identifier(util.gensym("_x")); // we don't care about this variable
        return cps(nodes[0], 
                   buildFunc([temp], cpsSequence(nodes.slice(1), cont)));
    }
}

function isCallCc(node) {
    return (types.namedTypes.Identifier.check(node) && node.name == "callcc");
}

function cpsApplication(opNode, argNodes, argVars, cont){
    if (argNodes.length == 0) {
        if (isCallCc(opNode)) {
            var args = [cont].concat(argVars.slice(1)).concat(build.identifier("topK"));
            console.log(args);
            return build.callExpression(argVars[0], args);
        } else {
            var opVar = build.identifier(util.gensym("_f"));
            return cps(opNode,
                       buildFunc([opVar],
                                 build.callExpression(opVar, argVars.concat([cont]))))
        }
    } else {
        var nextArgVar = build.identifier(util.gensym("_arg"));
        return cps(argNodes[0],
                   buildFunc([nextArgVar],
                             cpsApplication(opNode, argNodes.slice(1), argVars.concat([nextArgVar]), cont)));
    }
}

function cps(node, cont){    

    var recurse = function(n){return cps(n, cont)};

    // console.log(node.type);
    switch (node.type) {

    case Syntax.BlockStatement: 
        return cpsSequence(node.body, cont)

    case Syntax.Program: 
        return build.program([buildStatement(cpsSequence(node.body, cont))]);

    case Syntax.ReturnStatement: 
        return build.returnStatement(recurse(node.argument));
      
    case Syntax.ExpressionStatement: 
        return build.expressionStatement(recurse(node.expression));

    case Syntax.Identifier:
    case Syntax.Literal:
    case Syntax.FunctionExpression:
        return build.callExpression(cont, [cpsAtomic(node)]);

    case Syntax.VariableDeclaration:
        assert.equal(node.declarations.length, 1);
        var declaration = node.declarations[0];
        var varName = util.gensym("_v");
        return cps(declaration.init, 
                   buildFunc([declaration.id], 
                             build.callExpression(cont, [build.identifier("undefined")])))

    case Syntax.CallExpression:
        return cpsApplication(node.callee, node.arguments, [], cont);

    case Syntax.EmptyStatement:
        return build.callExpression(cont, [build.identifier("undefined")]);

    case Syntax.ConditionalExpression:
        var contName = build.identifier(util.gensym("_cont"));
        var testName = build.identifier(util.gensym("_test"));
        return build.callExpression(
            buildFunc([contName],
                      cps(node.test,
                          buildFunc([testName],
                                    build.conditionalExpression(testName, 
                                                                cps(node.consequent, contName),
                                                                cps(node.alternate, contName))))),
            [cont]
        )
        return node;

    default:
        throw new Error("cps: unknown node type: " + node.type);
    }
}

module.exports = {
    cps: cps
}
