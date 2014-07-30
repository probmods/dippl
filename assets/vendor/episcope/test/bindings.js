"use strict";

var fixtures = require("./fixtures/scope")
var bindings = require("../bindings")

exports["test FunctionExpression"] = function(assert) {
  assert.deepEqual(bindings(fixtures.FunctionExpression), [
    { type: "Identifier", name: "c" },
    { type: "Identifier", name: "d" }
  ], "both argumentss are included")
}

exports["test CatchClause"] = function(assert) {
  assert.deepEqual(bindings(fixtures.CatchClause), [
    { type: "Identifier", name: "error" }
  ], "error name in catch is included")
}

exports["test FunctionDeclaration"] = function(assert) {
  assert.deepEqual(bindings(fixtures.FunctionDeclaration), [
    { type: "Identifier", name: "a" },
    { type: "Identifier", name: "b" },
    { type: "Identifier", name: "c" },
    { type: "Identifier", name: "d" },
    { type: "Identifier", name: "e" },
    { type: "Identifier", name: "i" },
    { type: "Identifier", name: "l" },
    { type: "Identifier", name: "f" },
    { type: "Identifier", name: "nestedExpression" },
    { type: "Identifier", name: "nestedDeclaration" },
    { type: "Identifier", name: "error" },
    { type: "Identifier", name: "final" }
  ], "All declarations except ones from nested scopes")
}
