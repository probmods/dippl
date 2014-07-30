"use strict";

var tree = require("./tree")
var ast = require("./ast")

module.exports = function scopes(scope) {
  /**
  Returns array of nested scope forms for the given one. Note the nested scopes
  of those nested scopes are not included, but this function can be used to
  do the walk through them too.
  **/
  var forms = tree(scope.body, ast.isntScope, ast.children)
  return forms.filter(ast.isScope)
}
