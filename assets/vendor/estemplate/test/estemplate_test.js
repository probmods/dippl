'use strict';

var estemplate = require('../lib/estemplate.js');
var parse = require('esprima').parse;
var generate = require('escodegen').generate;
var readFile = require('fs').readFile;

var template = 'var <%= varName %> = <%= value %> + 1;';

exports.estemplate = {
  'default options': function (test) {
    var ast = estemplate(template, {
      varName: {type: 'Identifier', name: 'myVar'},
      value: {type: 'Literal', value: 123}
    });

    test.equal(generate(ast), 'var myVar = 123 + 1;');

    test.done();
  },

  'custom options': function (test) {
    var ast = estemplate('define(function () { <%= program %> });', {loc: true, source: 'template.jst'}, {
      program: {
        type: 'BlockStatement',
        body: parse('module.exports = require("./module").property;', {loc: true, source: 'source.js'}).body
      }
    });

    readFile(__dirname + '/custom_options.ast.json', 'utf-8', function (err, expectedAstJson) {
      if (err) {
        throw err;
      }

      var expectedAst = JSON.parse(expectedAstJson);

      test.deepEqual(ast, expectedAst);
      test.done();
    });
  }
};
