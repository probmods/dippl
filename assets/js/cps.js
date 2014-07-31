"use strict";

var assert = require('assert');
var util = require('./util.js');
var _ = require('../vendor/underscore/underscore.js');
var estraverse = require("../vendor/estraverse/estraverse.js");
var escodegen = require("../vendor/escodegen/escodegen.js");
var esprima = require("../vendor/esprima/esprima.js");
var estemplate = require("../vendor/estemplate/lib/estemplate.js");
var types = require("../vendor/ast-types/main.js");
var difference = require("../vendor/interset/difference.js");
var build = types.builders;
var Syntax = estraverse.Syntax;

function makeGensymVariable(name){
  return build.identifier("_".concat(util.gensym(name)));
}

var getName = function(x){
  return x.name;
};

function convertToStatement(node){
  if (types.namedTypes.Statement.check(node)) {
    return node;
  } else if (types.namedTypes.Expression.check(node)) {
    return build.expressionStatement(node);
  } else {
    throw new Error("convertToStatement: can't handle node type: " + node.type);
  }
}

// Generates function(){ stmt }()
function buildAppliedClosure(stmt){
  return build.callExpression(buildFunc([], stmt), []);
}

// FIXME: We don't always want to add a return statement
function buildFunc(args, body){
  if (types.namedTypes.BlockStatement.check(body)) {
    return build.functionExpression(null, args, body);
  } else {
    return build.functionExpression(null, args, build.blockStatement([buildReturn(body)]));
  }
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
    return build.returnStatement(buildAppliedClosure(node));
  } else {
    throw new Error("buildReturn: can't handle node type: " + node.type);
  }
}

function cpsAtomic(node){
  // console.log("ATOMIC", node.type);
  switch (node.type) {
  case Syntax.FunctionExpression:
    var newCont = makeGensymVariable("k");
    var newParams = [newCont].concat(node.params);
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
    var temp = makeGensymVariable("x"); // we don't care about this variable
    return cps(nodes[0],
               buildFunc([temp], cpsSequence(nodes.slice(1), cont)));
  }
}

function cpsApplication(opNode, argNodes, argVars, cont){
  if (argNodes.length == 0) {
    var opVar = makeGensymVariable("f");
    return cps(opNode,
               buildFunc([opVar],
                         build.callExpression(opVar, [cont].concat(argVars))));
  } else {
    var nextArgVar = makeGensymVariable("arg");
    return cps(argNodes[0],
               buildFunc([nextArgVar],
                         cpsApplication(opNode, argNodes.slice(1), argVars.concat([nextArgVar]), cont)));
  }
}

function cps(node, cont){

  var recurse = function(nodes){return cps(nodes, cont);};

  // console.log(node.type);
  switch (node.type) {

  case Syntax.BlockStatement:
    return cpsSequence(node.body, cont);

  case Syntax.Program:
    return build.program([convertToStatement(cpsSequence(node.body, cont))]);

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
                         build.callExpression(cont, [build.identifier("undefined")])));

  case Syntax.CallExpression:
    return cpsApplication(node.callee, node.arguments, [], cont);

  case Syntax.EmptyStatement:
    return build.callExpression(cont, [build.identifier("undefined")]);

  case Syntax.ConditionalExpression:
    var contName = makeGensymVariable("cont");
    var testName = makeGensymVariable("test");
    return build.callExpression(
      buildFunc([contName],
        cps(node.test,
            buildFunc([testName],
              build.conditionalExpression(testName,
                cps(node.consequent, contName),
                cps(node.alternate, contName))))),
      [cont]
    );
    return node;

  default:
    throw new Error("cps: unknown node type: " + node.type);
  }
}

var freeVarsSeq = function(nodes, bound){
  var boundInSeq = bound.slice();
  var freeInSeq = [];
  _.each(nodes, function(node){
           freeInSeq = freeInSeq.concat(_freeVars(node, boundInSeq));
           if (types.namedTypes.VariableDeclaration.check(node)) {
             boundInSeq.push(node.declarations[0].id);
           }
         });
  return freeInSeq;
};

function _freeVars(node, bound){

  switch (node.type){

  case Syntax.BlockStatement:
  case Syntax.Program:
    return freeVarsSeq(node.body, bound);

  case Syntax.ReturnStatement:
    return _freeVars(node.argument, bound);

  case Syntax.ExpressionStatement:
    return _freeVars(node.expression, bound);

  case Syntax.Identifier:
    return [node.name];

  case Syntax.Literal:
  case Syntax.EmptyStatement:
    return [];

  case Syntax.FunctionExpression:
    return _freeVars(node.body, bound.concat(_.map(node.params, getName)));

  case Syntax.VariableDeclaration:
    return _freeVars(node.declarations[0].init, bound.concat([node.declarations[0].id]));

  case Syntax.CallExpression:
    return _.flatten(
      [_freeVars(node.callee, bound)].concat(
        _.map(node.arguments,
              function(n){return _freeVars(n, bound);})),
      true);

  case Syntax.ConditionalExpression:
    return _.flatten(
      _.map([node.test, node.consequent, node.alternate],
            function(n){return _freeVars(n, bound);}),
      true);

  default:
    throw new Error("freeVars: unknown node type: " + node.type);
  }
};

function freeVars(node){
  return _freeVars(node, []);
}

function visitContinuationPrimitives(node, func){
  types.visit(node,
    {
      visitCallExpression: function(path) {
        var node = path.node;
        var callee = node.callee;
        var args = node.arguments;
        if (types.namedTypes.Identifier.check(callee) &&
            callee.name === "withContinuation") {
          if (args.length == 1) {
            if (types.namedTypes.Identifier.check(args[0])) {
              func(path);
            } else {
              throw new Error("withContinuation can only be applied to names of primitives, got " + args[0].type);
            }
          } else {
            throw new Error("withContinuation requires exactly 1 argument, got " + args.length);
          }
        }
        this.traverse(path);
      }
    });
}

function getContinuationPrimitives(node){
  var contVars = [];
  visitContinuationPrimitives(node,
    function(path){
      contVars.push(path.node.arguments[0].name);
    });
  return _.uniq(contVars);
}

function removeContinuationPrimitiveWrapper(node){
  visitContinuationPrimitives(node,
    function(path){
      path.node.type = "Identifier";
      path.node.name = path.node.arguments[0].name;
      delete path.node.callee;
      delete path.node.arguments;
    });
}

function getPrimitiveNames(node){
  return difference(
    freeVars(node),
    getContinuationPrimitives(node),
    ["withContinuation"]);
}

function topCps(node, cont){
  var cpsPrimitiveAsts = [];
  var oldPrimitiveNames = getPrimitiveNames(node);
  var newPrimitiveNames = [];
  _.each(oldPrimitiveNames,
    function(oldPrimitiveName){
      // Generate names for CPS primitives
      var newPrimitiveName = "_cps".concat(oldPrimitiveName);
      newPrimitiveNames.push(newPrimitiveName);
      // Add CPS definition of primitives to code
      var cpsPrimDef = estemplate(
        ('var <%= newPrimName %> = function(<%= contName %>){ ' +
         'return <%= contName %>(<%= oldPrimName %>.apply(' +
         'null, Array.prototype.slice.call(arguments, 1))) };'),
        { oldPrimName: build.identifier(oldPrimitiveName),
          newPrimName: build.identifier(newPrimitiveName),
          contName: makeGensymVariable("cont") }
      );
      cpsPrimitiveAsts.push(cpsPrimDef);
    });
  removeContinuationPrimitiveWrapper(node);

  // Rename primitives to CPS primitives
  estraverse.replace(node, {
    enter: function (nodes) {
      if (types.namedTypes.Identifier.check(nodes)) {
        var replacement = undefined;
        _.each(_.zip(oldPrimitiveNames, newPrimitiveNames),
               function (oldToNew){
                 var oldName = oldToNew[0];
                 var newName = oldToNew[1];
                 if (nodes.name === oldName) {
                   replacement = build.identifier(newName);
                 }
               });
        // console.log(nodes.name, replacement);
        return replacement;
      }
    }
  });

  var cpsCode = cps(node, cont);
  _.each(cpsPrimitiveAsts,
    function(primitiveAst){
      cpsCode.body = primitiveAst.body.concat(cpsCode.body);
    });

  return cpsCode;
}

module.exports = {
  cps: topCps
};
