"use strict";

var util = require("../assets/js/util.js");
var _ = require('../assets/vendor/underscore/underscore.js');
var runWebPPL = require('../assets/js/run-wppl.js');
var compileWebPPLProgram = runWebPPL.compileWebPPLProgram;
var topK = runWebPPL.topK;

var testHistsApproxEqual = function(test, hist, expectedHist, tolerance){
  var normHist = util.normalize(hist);
  _.each(expectedHist,
         function(expectedValue, key){
           var value = normHist[key];
           test.ok(Math.abs(value - expectedValue) <= tolerance);
         });
};

var runInferenceTest = function(test, code, expectedHist, numSamples, tolerance){
  var hist = {};
  topK = function(value){
        hist[value] = hist[value] || 0;
        hist[value] += 1;
  };
  var compiledProgram = compileWebPPLProgram(code);
  for (var i=0; i<numSamples; i++){
    eval(compiledProgram);
  }
  testHistsApproxEqual(test, hist, expectedHist, tolerance);
  test.done();
};

exports.testDeterministic = {
  testApplication: function (test) {
    var code = "plus(3, 4)";
    var expectedHist = {7: 1};
    var tolerance = 0.0001; // just in case of floating point errors
    return runInferenceTest(test, code, expectedHist, 1, tolerance);
  }
}

exports.testForwardSampling = {
  testApplication: function (test) {
    var code = "and(flip(.5), flip(.5))";
    var expectedHist = {
      "true": .25,
      "false": .75
    };
    var tolerance = .05;
    var numSamples = 1000;
    return runInferenceTest(test, code, expectedHist, numSamples, tolerance);
  }
}