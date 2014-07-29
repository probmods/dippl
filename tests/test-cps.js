var cps = require("../assets/js/cps.js");
var util = require("../assets/js/util.js");
var esprima = require("../assets/vendor/esprima/esprima.js");
var escodegen = require("../assets/vendor/escodegen/escodegen.js");
var types = require("../assets/vendor/ast-types/main.js");
var build = types.builders;

var plus = function(x, y) {return x + y};
var times = function(x, y) {return x * y};
var and = function(x, y) {return x && y};
var plusTwo = function(x) {return x + 2};

var runCpsTest = function(test, code, expected){
    var ast = esprima.parse(code);
    var newAst = cps.cps(ast, build.identifier("topK"));
    var topKAst = esprima.parse("var topK = function(x){return x};");
    newAst.body = topKAst.body.concat(newAst.body);
    var newCode = escodegen.generate(newAst);
    test.equal(eval(newCode), expected);
    test.done();
}

exports.testFunctionExpression = function (test) {
    // function expressions are not allowed as statements, so can't
    // directly test this (but the call tests cover this)
    test.done();
}

exports.testCallExpression = {
    
    testPrimitive: function (test) {    
        var code = "plusTwo(3)";
        var expected = 5;
        return runCpsTest(test, code, expected);
    },

    testCompound1: function (test) {    
        var code = "(function(y){return plusTwo(y)})(123)"
        var expected = 125;
        return runCpsTest(test, code, expected);
    },

    testCompound2: function (test) {    
        var code = "(function(y){return y})(plusTwo(123))"
        var expected = 125;
        return runCpsTest(test, code, expected);
    }


}

exports.testLiteral = {

    testNumber: function (test) {
        var code = "456"
        var expected = 456;
        return runCpsTest(test, code, expected);
    },

    testString: function (test) {
        var code = "'foobar'"
        var expected = 'foobar';
        return runCpsTest(test, code, expected);
    }

}

