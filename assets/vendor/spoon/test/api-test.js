var spoon = require('..'),
    assert = require('assert'),
    vm = require('vm'),
    esprima = require('esprima'),
    escodegen = require('escodegen');

describe('Spoon', function() {
  describe('spoon() API function', function() {
    it('should work properly', function() {
      var code = spoon(function a(__$callback) {
        function async(callback) {
          callback(null, 1);
        }
        "enable spoon";
        return 1 + async();
      }.toString(), ['async'], {
        declaration: 'enable spoon'
      });

      var called = false;
      vm.runInNewContext(code + ';a(callback);', {
        callback: function(err, value) {
          called = true;
          assert.equal(value, 2);
        }
      });

      assert(called);
    });
  });
});
