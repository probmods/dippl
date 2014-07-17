var spoon = require('..'),
    assert = require('assert'),
    vm = require('vm'),
    esprima = require('esprima'),
    escodegen = require('escodegen');

describe('Spoon', function() {
  describe('asyncify', function() {
    function test(code, what) {
      var ast = esprima.parse(code.toString()),
          cfg = spoon.construct(ast);

      cfg.asyncify([esprima.parse(what || 'async')], {
        declaration: 'enable spoon'
      });

      var out = spoon.render(cfg);
      var code = escodegen.generate(out);

      var res,
          once = false;
      vm.runInNewContext(code + ';\nfn(callback)', {
        callback: function(err, r) {
          assert.equal(err, null);
          if (once) throw new Error('Called twice');
          once = true;

          res = r;
        }
      });
      return res;
    }

    it('should asyncify two-fold operation', function() {
      var r = test(function fn(__$callback) {
        "enable spoon";
        function async(a, callback) {
          callback(null, a * a);
        }

        return async(3) + async(4);
      }, 'async');
      assert.equal(r, 25);
    });

    it('should asyncify method', function() {
      var r = test(function fn(__$callback) {
        "enable spoon";
        var obj = {
          async: function async(a, callback) {
            callback(null, a);
          }
        };
        return obj.async(1);
      }, 'obj.async');
      assert.equal(r, 1);
    });

    it('should asyncify call in sequence', function() {
      var r = test(function fn(__$callback) {
        "enable spoon";
        function async(a, callback) {
          callback(null, 1);
        }
        return 1, async(1), 2;
      });
      assert.equal(r, 2);
    });

    it('should asyncify call in if', function() {
      var r = test(function fn(__$callback) {
        "enable spoon";
        function async(a, callback) {
          callback(null, a);
        }

        if (1 + 2 > 2) {
          var x = async(123);
        } else {
          x = 2;
        }

        return x + 1;
      });

      r = assert.equal(r, 124);
    });

    it('should asyncify call in for loop', function() {
      var r = test(function fn(__$callback) {
        "enable spoon";
        function async(a, b, callback) {
          callback(null, a + b);
        }

        for (var i = 0; i < 10; i++) {
          var x = async(i, x || 0);
        }

        return x + 1;
      });

      r = assert.equal(r, 46);
    });

    it('should asyncify call in for loop #2', function() {
      var r = test(function fn(__$callback) {
        "enable spoon";
        function async(a, b, callback) {
          callback(null, a + b);
        }

        for (var i = async(0, 0); i < async(5, 5); i = async(i, 1)) {
          var x = async(x || 0, 1);
        }

        return x + 1;
      });

      r = assert.equal(r, 11);
    });

    it('should asyncify call in property', function() {
      var r = test(function fn(__$callback) {
        "enable spoon";
        function async(a, callback) {
          callback(null, a);
        }

        var obj = { a: 123, b: 456, c: 789 },
            x = 1;

        for (var i in obj) {
          x = async(obj[async(i)]) * async(x);
        }

        return x;
      });

      r = assert.equal(r, 44253432);
    });

    it('should asyncify call in while loop', function() {
      var r = test(function fn(__$callback) {
        "enable spoon";
        function async(a, b, callback) {
          callback(null, a + b);
        }

        var x = 0,
            p = false,
            i;

        if (p) {
          i = 11;
          while (i) {
            i--;
            x = async(i, x);
          }
        }

        if (!p) {
          i = 11;
          while (i) {
            i--;
            x = async(i, x);
          }
        }

        return x + 1;
      });

      r = assert.equal(r, 56);
    });

    it('should asyncify call in post-conditional for loop', function() {
      var r = test(function fn(__$callback) {
        "enable spoon";
        function async(a, callback) {
          callback(null, a);
        }

        var x = async(false),
            i = 0,
            visited = false;

        if (x) {
          for (var i = 0; i < 2; i++) {
            visited = true;
          }
        }

        return visited;
      });

      r = assert.equal(r, false);
    });

    it('should asyncify call in do while loop', function() {
      var r = test(function fn(__$callback) {
        "enable spoon";
        function async(a, b, callback) {
          callback(null, a + b);
        }

        var x = 0,
            i = 0;
        do {
          i++;
          x = async(i, x);
        } while (i < 10);

        return x + 1;
      });

      r = assert.equal(r, 56);
    });

    it('should asyncify call in for in loop', function() {
      var r = test(function fn(__$callback) {
        "enable spoon";
        function async(a, b, callback) {
          callback(null, a + b);
        }

        var obj = { a : 1, b : 2 };

        for (var i in obj) {
          var x = async(obj[i], x || 0);
        }

        return x + 1;
      });

      r = assert.equal(r, 4);
    });
  });

  describe('marker', function() {
    function test(code, what) {
      var ast = esprima.parse(code.toString()),
          cfg = spoon.construct(ast);

      cfg.asyncify([esprima.parse(what || 'async')], {
        declaration: 'enable spoon',
        marker: '_'
      });

      var out = spoon.render(cfg);
      var code = escodegen.generate(out);

      var res,
          once = false;
      vm.runInNewContext(code + ';\nfn(callback)', {
        callback: function(err, r) {
          assert.equal(err, null);
          if (once) throw new Error('Called twice');
          once = true;

          res = r;
        }
      });
      return res;
    }

    it('should replace marker in property', function() {
      var r = test(function fn(_) {
        "enable spoon";
        function async(_, a) {
          "enable spoon";
          return a;
        }

        var obj = { a: 123, b: 456, c: 789 },
            x = 1;

        for (var i in obj) {
          x = async(_, obj[async(_, i)]) * async(_, x);
        }

        return x;
      });

      r = assert.equal(r, 44253432);
    });
  });
});
