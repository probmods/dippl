"use strict";

var fixtures = require("./fixtures/scope")
var properties = require("../properties")

exports["test FunctionExpression"] = function(assert) {
  assert.deepEqual(properties(fixtures.FunctionExpression), [
    { type: "Identifier", name: "concat" }
  ], "all properties are returned")
}

exports["test CatchClause"] = function(assert) {
  assert.deepEqual(properties(fixtures.CatchClause), [
    { type: "Identifier", name: "log" }
  ], "console properties is logged")
}

exports["test FunctionDeclaration"] = function(assert) {
  assert.deepEqual(properties(fixtures.FunctionDeclaration), [
    { type: "Identifier", name: "length" },
    { type: "Literal", value: "foo", raw: '"foo"' },
    { type: "Identifier", name: "i" }
  ], "All properties including non identifiers are returned")
}
