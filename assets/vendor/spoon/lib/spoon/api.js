var api = exports,
    esprima = require('esprima'),
    escodegen = require('escodegen'),
    estraverse = require('estraverse');

api.construct = function construct(ast) {
  var cfg = api.spoon.cfg.create();

  cfg.translate(ast);

  return cfg;
};

api.render = function render(cfg) {
  var r = api.spoon.renderer.create(cfg);

  return r.render();
};

function patch(ast, decl, callback) {
  var fn = {},
      body = null,
      stack = [];

  estraverse.traverse(ast, {
    enter: function(ast) {
      if (ast.type === 'Literal') {
        if (ast.value === decl && fn) {
          body = callback(fn).body;
        }
        return;
      } else if (ast.type === 'FunctionDeclaration' ||
                 ast.type === 'FunctionExpression') {
        stack.push({
          fn: fn,
          body: body
        });
        fn = ast;
      }
    },
    leave: function(ast) {
      if (ast === fn) {
        if (body) ast.body = body;

        // Restore previous position
        var onstack = stack.pop();
        if (onstack) {
          fn = onstack.fn;
          body = onstack.body;
        }
      }
    }
  });

  return ast;
};

api.preprocess = function preprocess(code, options, callback) {
  if (!options) options = {};

  var ast = esprima.parse(code, options.esprima);

  if (options.declaration) {
    ast = patch(ast, options.declaration, function replace(ast) {
      var cfg = api.spoon.construct(ast);

      if (callback) callback(cfg);

      ast = api.spoon.render(cfg).body[0];

      // Get function out of expression
      if (ast.type === 'ExpressionStatement') {
        ast = ast.expression;
      }

      return ast;
    });
  } else {
    var cfg = api.spoon.construct(ast);

    if (callback) callback(cfg);

    ast = api.spoon.render(cfg);
  }
  return escodegen.generate(ast);
};

api.spoon = function spoon(code, fns, options) {
  if (!options) options = {};

  return api.preprocess(code, options, function(cfg) {
    cfg.asyncify(fns.map(function(fn) {
      return esprima.parse(fn, options.esprima);
    }), options);
  });
};
