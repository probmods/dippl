"use strict";

var tree = require("./tree")
var ast = require("./ast")

module.exports = function properties(scope) {
  /**
  Returns array of `Identifier` nodes for all the property references with
  in the given scope. Mainly useful for filtering out non property references
  **/
  var nodes = tree(scope.body, ast.isntScope, ast.children)
  return ast.select(nodes, "MemberExpression").map(function(node) {
    return node.property
  })
}
