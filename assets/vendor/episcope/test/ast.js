"use strict";

var fixtures = require("./fixtures/scope")
var ast = require("../ast")

exports["test isScope"] = function(assert) {
  assert.ok(ast.isScope(fixtures.program),
            "Program is a scope node")
  assert.ok(ast.isScope(fixtures.FunctionDeclaration),
            "FunctionDeclaration creates scope")
  assert.ok(ast.isScope(fixtures.FunctionExpression),
            "FunctionExpression creates scope")
  assert.ok(ast.isScope(fixtures.CatchClause),
            "CatchClause creates scope")
}
