"use strict";

var esprima = require("esprima")

var program = esprima.parse(function fixture() {
  function foo(a, b) {
    var c = 3,
        d

    var e = []
    d = {}

    for (var i = 0, l = a.length; i < l; i++) {
      var f = i - 1
      d["foo"] = b[i]
    }

    function nestedExpression(f, r) {
      var nestedVariable
    }

    var nestedDeclaration = function nested_skip() {
    }

    try {
      var error = Error("boom")
      throw error
    } catch (error) {
      var message = error.message
      console.log(message)
    } finally {
      var final = true
    }

    return a + b + c
  }

  var bar = function(c, d) {
    return c.concat(d)
  }

  try {
    throw Error("boom!")
  } catch (error) {
    console.log(error)
  }
})

var expressions = program.body[0].body.body

exports.program = program
exports.expressions = expressions
exports.FunctionDeclaration = expressions[0]
exports.FunctionExpression = expressions[1].declarations[0].init
exports.CatchClause = expressions[2].handlers[0]
