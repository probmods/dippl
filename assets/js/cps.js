"use strict";

var assert = require('assert');
var util = require('./util.js');
var freeVars = require('./freevars.js').freeVars;
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
  case Syntax.Literal:
    return node;
  default:
    throw new Error("cpsAtomic: unknown expression type: " + node.type);
  };
}

function cpsSequence(atFinalElement, getFinalElement, nodes, vars){
  vars = vars || [];
  if (atFinalElement(nodes)){
    return getFinalElement(nodes, vars);
  } else {
    var nextVar = makeGensymVariable("s");
    return cps(nodes[0],
               buildFunc([nextVar],
                         cpsSequence(atFinalElement, getFinalElement, nodes.slice(1), vars.concat([nextVar]))));
  }
}

function cpsBlock(nodes, cont){
  return cpsSequence(
    function (nodes){return (nodes.length == 1);},
    function(nodes, vars){return cps(nodes[0], cont);},
    nodes);
}

function cpsApplication(opNode, argNodes, cont){
  var nodes = [opNode].concat(argNodes);
  return cpsSequence(
    function (nodes){return (nodes.length == 0);},
    function(nodes, vars){
      var args = [cont].concat(vars.slice(1));
      return build.callExpression(vars[0], args);
    },
    nodes);
}

function cpsUnaryExpression(opNode, argNode, isPrefix, cont){
  var nodes = [argNode];
  return cpsSequence(
    function(nodes){return (nodes.length == 0);},
    function(nodes, vars){
      return build.callExpression(
        cont,
        [build.unaryExpression(opNode, vars[0], isPrefix)]);
    },
    nodes);
}

function cpsBinaryExpression(opNode, leftNode, rightNode, cont){
  var nodes = [leftNode, rightNode];
  return cpsSequence(
    function(nodes){return (nodes.length == 0);},
    function(nodes, vars){
      assert.ok(vars.length == 2);
      return build.callExpression(
        cont,
        [build.binaryExpression(opNode, vars[0], vars[1])]);
    },
    nodes);
}

function cpsConditional(test, consequent, alternate, cont){
  var contName = makeGensymVariable("cont");
  var testName = makeGensymVariable("test");
  return build.callExpression(
    buildFunc([contName],
      cps(test,
          buildFunc([testName],
                    build.conditionalExpression(testName,
                                                cps(consequent, contName),
                                                cps(alternate, contName))))),
    [cont]
  );
}

function cpsArrayExpression(elements, cont){
  return cpsSequence(
    function (nodes){return (nodes.length == 0);},
    function(nodes, vars){
      var arrayExpr = build.arrayExpression(vars);
      return build.callExpression(cont, [arrayExpr]);
    },
    elements);
}

function cpsMemberExpression(obj, prop, computed, cont){
  assert.ok(!computed);
  var objName = makeGensymVariable("obj");
  var memberExpr = build.memberExpression(objName, prop, false);
  return cps(obj,
    buildFunc([objName],
    build.callExpression(cont, [memberExpr])));
}

function cps(node, cont){

  var recurse = function(nodes){return cps(nodes, cont);};

  // console.log(node.type);
  switch (node.type) {

  case Syntax.BlockStatement:
    return cpsBlock(node.body, cont);

  case Syntax.Program:
    return build.program([convertToStatement(cpsBlock(node.body, cont))]);

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
    return cpsApplication(node.callee, node.arguments, cont);

  case Syntax.EmptyStatement:
    return build.callExpression(cont, [build.identifier("undefined")]);

  case Syntax.ConditionalExpression:
    return cpsConditional(node.test, node.consequent, node.alternate, cont);

  case Syntax.ArrayExpression:
    return cpsArrayExpression(node.elements, cont);

  case Syntax.MemberExpression:
    return cpsMemberExpression(node.object, node.property, node.computed, cont);

  case Syntax.UnaryExpression:
    return cpsUnaryExpression(node.operator, node.argument, node.prefix, cont);

  case Syntax.BinaryExpression:
    return cpsBinaryExpression(node.operator, node.left, node.right, cont);

  default:
    throw new Error("cps: unknown node type: " + node.type);
  }
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
    var oldPrimitiveNames = []; //TODO: turned off primitive wrapping until issues resolved.. //getPrimitiveNames(node);
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
