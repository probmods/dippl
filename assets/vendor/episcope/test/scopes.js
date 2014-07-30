"use strict";

var fixtures = require("./fixtures/scope")
var scopes = require("../scopes")

exports["test program scopes"] = function(assert) {
  var actual = scopes(fixtures.program)
  assert.equal(actual.length, 1, "single scope found")
  assert.deepEqual(actual[0].id, { type: 'Identifier', name: 'fixture' },
                   "top function is found")
}

exports["test FunctionExpression"] = function(assert) {
  assert.deepEqual(scopes(fixtures.FunctionExpression), [],
                   "function expression has no nested scopes")
}

exports["test FunctionDeclaration"] = function(assert) {
  var actual = scopes(fixtures.FunctionDeclaration)
  assert.equal(actual.length, 3, "three nested scopes discovered")
  assert.deepEqual(actual[0].id, {
    type: 'Identifier',
    name: 'nestedExpression'
  }, "nested function expression")
  assert.deepEqual(actual[1].id, {
    type: 'Identifier',
    name: 'nested_skip'
  })
  assert.deepEqual(actual[2].param, { type: 'Identifier', name: 'error' },
                   "last nested scopes is catch clause")
}
