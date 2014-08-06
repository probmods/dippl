var _ = require('../assets/vendor/underscore/underscore.js');
var runWebPPLProgram = require('../assets/js/run-wppl.js').runWebPPLProgram;

var makeTestCont = function(test, expected){
  return function(value){
    // console.log(value);
    test.ok(_.isEqual(value, expected));
    test.done();
  };
};

var runInferenceTest = function(test, code, expected){
  runWebPPLProgram(code, makeTestCont(test, expected), false);
};

exports.testDeterministic = {
  testApplication: function (test) {
    var code = "plus(3, 4)";
    var expected = 7;
    return runInferenceTest(test, code, expected);
  }
}