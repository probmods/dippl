var cps = require("../assets/js/cps.js");
var util = require("../assets/js/util.js");
var esprima = require("../assets/vendor/esprima/esprima.js");
var escodegen = require("../assets/vendor/escodegen/escodegen.js");
var types = require("../assets/vendor/ast-types/main.js");
var build = types.builders;

var plus = function(x, y, k) {return k(x + y)};
var minus = function(x, y, k) {return k(x - y)};
var times = function(x, y, k) {return k(x * y)};
var and = function(x, y, k) {return k(x && y)};
var plusTwo = function(x, k) {return k(x + 2)};

var runCpsTest = function(test, code, expected){
    var ast = esprima.parse(code);
    var newAst = cps.cps(ast, build.identifier("topK"));
    var topKAst = esprima.parse("var topK = function(x){return x};");
    newAst.body = topKAst.body.concat(newAst.body);
    var newCode = escodegen.generate(newAst);
    // console.log(newCode);
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
    },

    testBinaryFuncPlus: function (test) {
        var code = "plus(3, 5)";
        var expected = 8;
        return runCpsTest(test, code, expected);        
    },

    testBinaryFuncMinus: function (test) {
        var code = "minus(3, 5)";
        var expected = -2;
        return runCpsTest(test, code, expected);        
    },

    testBinaryFuncAnd: function (test) {
        var code = "and(true, false)";
        var expected = false;
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
    },

    testBool1: function (test) {
        var code = "true"
        var expected = true;
        return runCpsTest(test, code, expected);
    },

    testBool2: function (test) {
        var code = "false"
        var expected = false;
        return runCpsTest(test, code, expected);
    }

}

exports.testEmptyStatement = {

    testEmptyAlone: function (test) {
        var code = ";"
        var expected = undefined;
        return runCpsTest(test, code, expected);
    },

    testEmptyInBlock: function (test) {
        var code = "plusTwo(3); ; plusTwo(5);";
        var expected = 7;
        return runCpsTest(test, code, expected);        
    }

}

exports.testblockStatement = {

    testProgram: function (test) {
        var code = "plusTwo(3); plusTwo(4); plusTwo(5);";
        var expected = 7;
        return runCpsTest(test, code, expected);
    },

    testBlock1: function (test) {
        var code = "{ plusTwo(3) }; plusTwo(5);";
        var expected = 7;
        return runCpsTest(test, code, expected);
    },

    testBlock2: function (test) {
        var code = "plusTwo(1); { plusTwo(3) }; plusTwo(5);";
        var expected = 7;
        return runCpsTest(test, code, expected);
    },

    testBlock3: function (test) {
        var code = "plusTwo(1); { plusTwo(3); plusTwo(4); }; plusTwo(5);";
        var expected = 7;
        return runCpsTest(test, code, expected);
    },

    testBlock4: function (test) {
        var code = "plusTwo(1); { plusTwo(3); plusTwo(4); }";
        var expected = 6;
        return runCpsTest(test, code, expected);
    }

}

exports.testVariableDeclaration = {
    testVar1: function (test) {
        var code = "var x = 1; x";
        var expected = 1;
        return runCpsTest(test, code, expected);        
    },
    testVar2: function (test) {
        var code = "var x = plus(1, 2); var y = times(x, 4); y";
        var expected = 12;
        return runCpsTest(test, code, expected);        
    },
}


// exports.testCallCc = {

//     testCallCc1: function (test) {
//         var code = "var foo = function(k){1}; callcc(foo); plusTwo(3);";
//         var expected = 1;
//         return runCpsTest(test, code, expected);        
//     }

// }
