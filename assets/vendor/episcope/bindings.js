"use strict";

var tree = require("./tree")
var ast = require("./ast")

function getId(node) { return node.id }

module.exports = function bindings(scope) {
  /**
  Returns array of `Identifier` nodes for all the declared bindings available
  to the given scope, including named arguments if given scope is a function
  form.
  **/
  var initials = ast.isFunction(scope) ? scope.params.concat(scope.rest || []) :
                 ast.isCatch(scope) ? [scope.param] :
                 []
  var nodes = tree(scope.body, ast.isntScope, ast.children)
  var declarations = nodes.filter(ast.isDeclaration).map(getId)

  return initials.concat(declarations)
}
