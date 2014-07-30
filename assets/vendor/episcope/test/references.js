"use strict";

var fixtures = require("./fixtures/scope")
var references = require("../references")

exports["test FunctionExpression"] = function(assert) {
  assert.deepEqual(references(fixtures.FunctionExpression), [
    { type: "Identifier", name: "c" },
    { type: "Identifier", name: "d" },
  ], "all references are returned")
}

exports["test CatchClause"] = function(assert) {
  assert.deepEqual(references(fixtures.CatchClause), [
    { type: "Identifier", name: "console" },
    { type: "Identifier", name: "error" }
  ], "Both references identified")
}

exports["test FunctionDeclaration"] = function(assert) {
  assert.deepEqual(references(fixtures.FunctionDeclaration), [
    { type: "Identifier", name: "d" },
    { type: "Identifier", name: "a" },
    { type: "Identifier", name: "i" },
    { type: "Identifier", name: "l" },
    { type: "Identifier", name: "i" },
    { type: "Identifier", name: "i" },
    { type: "Identifier", name: "d" },
    { type: "Identifier", name: "b" },
    { type: "Identifier", name: "Error" },
    { type: "Identifier", name: "error" },
    { type: "Identifier", name: "a" },
    { type: "Identifier", name: "b" },
    { type: "Identifier", name: "c" }
  ], "Same named references may appear several times if refered several times")
}
