"use strict";

var tree = require("./tree")
// var difference = require("interset/difference")
var difference = require("../interset/difference.js") // modified by AST
var ast = require("./ast")
var bindings = require("./bindings")
var properties = require("./properties")

module.exports = function references(scope) {
  /**
  Returns array of `Identifier` nodes for all the free references that are not
  part of declarations or members access identifiers.
  **/
  var nodes = tree(scope.body, ast.isntScope, ast.children)
  // Get all the identifier nodes.
  var ids = ast.select(nodes, "Identifier")
  // Return all identifiers excluding ones that are part of definition
  // or property names.
  return difference(ids, bindings(scope), properties(scope))
}
