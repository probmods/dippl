var spoon = require('..'),
    assert = require('assert'),
    vm = require('vm'),
    esprima = require('esprima'),
    escodegen = require('escodegen');

describe('Spoon', function() {
  function test(code, expected) {
    var ast = esprima.parse(code),
        cfg = spoon.construct(ast);

    var out = spoon.render(cfg);
    var code = escodegen.generate(out);

    assert.deepEqual(vm.runInNewContext(code), expected);
  }

  describe('constructing CFG from AST', function() {
    it('should work with function declarations and expressions', function() {
      test('var x = 1 + 2 * 3;\n' +
           'if (x > 1234) {\n' +
           '  log("yay");\n' +
           '} else {\n' +
           '  log(function() { return "yay" });\n' +
           '}\n' +
           'function log(x) {\n' +
           '  return typeof x === "function" ? x() : x;\n' +
           '}',
           'yay');
    });

    it('should work with sequences', function() {
      test('var a = 1;(a += 1),(a = 2 * a),a', 4);
    });

    // TODO: Fix esprima
    /*
    it('should work with sequences in assignment', function() {
      test('var a = 1;a = 1, 2, 3; a', 3);
    });
    */

    it('should work with member set', function() {
      test('var a = { d: 3 };a.b = 1;a.c = 2;a.b + a.c + a.d', 6);
    });

    it('should work with arrays', function() {
      test('var a = [ 1, 2, 3 ]; a[0] + a[1] + a[2]', 6);
    });

    it('should work with logical expressions', function() {
      test('var c = false;\n' +
           'function a() {\n' +
           '  if (c) return false;\n' +
           '  return 123;\n' +
           '}\n' +
           'function b() {\n' +
           '  c = true;\n' +
           '  return false;\n' +
           '}\n' +
           'a() || b()', 123);
    });

    it('should work with while loop', function() {
      test('var i = 0;\n' +
           'while (i < 10) {\n' +
           '  if (i == 9) {\n' +
           '    break;\n' +
           '  } else if (i > 10) {\n' +
           '    continue;\n' +
           '  }\n' +
           '  i++;\n' +
           '}\n' +
           'i',
           9);
    });

    it('should work with do while loop', function() {
      test('var i = 0;\n' +
           'do {\n' +
           '  if (i == 5) {\n' +
           '    break;\n' +
           '  } else if (i > 10) {\n' +
           '    continue;\n' +
           '  }\n' +
           '  i++;\n' +
           '} while (i < 10)\n' +
           'i',
           5);
    });

    it('should work with post-conditional for loop', function() {
      test('var x = false,\n' +
           '    i = 0,\n' +
           '    visited = false;\n' +
           'if (x) {\n' +
           '  for (var i = 0; i < 2; i++) {\n' +
           '    visited = true;\n' +
           '  }\n' +
           '}\n' +
           'visited',
           false);
    });

    it('should work with for loop', function() {
      test('for (var i = 0; i < 10; i++) {\n' +
           '  if (i == 9) {\n' +
           '    break;\n' +
           '  } else if (i % 2) {\n' +
           '    continue;\n' +
           '  }\n' +
           '}\n' +
           'i',
           9);
    });

    it('should work with for loop (w/o body)', function() {
      test('for (var i = 0; i < 10; i++) {\n' +
           '}\n' +
           'i',
           10);
    });

    it('should work with for in loop', function() {
      test('var obj = { 0: 1, 9: 1 };\n' +
           'for (var i in obj) {\n' +
           '  if (i == 9) {\n' +
           '    break;\n' +
           '  } else if (i > 10) {\n' +
           '    continue;\n' +
           '  }\n' +
           '}\n' +
           'i',
           9);
    });

    it('should work with for in loop (without declaration)', function() {
      test('var obj = { 0: 1, 9: 1 };\n' +
           'for (i in obj) {\n' +
           '  if (i == 9) {\n' +
           '    break;\n' +
           '  } else if (i > 10) {\n' +
           '    continue;\n' +
           '  }\n' +
           '}\n' +
           'i',
           9);
    });

    it('should work with try catch', function() {
      test('var a = 2;\n' +
           'try {\n' +
           '  throw 1;\n' +
           '} catch (e) {\n' +
           '  a = e;\n' +
           '}\n' +
           'a',
           1);
    });

    it('should work with this', function() {
      test('this.x = 1;this.x', 1);
    });

    it('should work with new', function() {
      test('new Object()', {});
    });

    it('should work with regr#1', function() {
      test('var x, y;\n' +
           'if (!(typeof x === "undefined" || !y) === false) {\n' +
           '  "true"\n' +
           '} else {\n' +
           '  "false"\n' +
           '}', "true");
    })

    it('should work with regr#2', function() {
      test('var a;\n' +
           'a || (a = true ? 1 : 2);\n' +
           'a + 2', 3);
    });

    // XXX Implement switch
    return;
    it('should work with switch', function() {
      test('var r;\n' +
           'switch (1 + 2) {\n' +
           ' case 1:\n' +
           '  r = r + 1;\n' +
           '  break;\n' +
           ' default:\n' +
           '  r = r + 2;\n' +
           ' case 2:\n' +
           '  r = r + 4;\n' +
           '}\n' +
           'r',
           6);
    });
  });
});
