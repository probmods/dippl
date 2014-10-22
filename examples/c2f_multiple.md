In this document, we generalize the coarse-to-fine procedure presented [here](http://dippl.org/examples/coarsetofine2) to handle the coarsening of multiple random variables into single representations. For example, in the HMM setting, we might want to coarsen a sequence of successive latent state variables into a single (joint) variable predicting the corresponding sequence of observations. Note that the current procedure coarsens *within* variables, mapping occurrences of a single variable (e.g. "x1", "x2", or "x3") onto another single variable ("x"), but cannot clump multiple variables together.

First, we set up a simple hmm with two kinds of latent states and two kinds of observations.

~~~~
///fold:
var makeERP = function(ps, vs){
  return Enumerate(function(){return vs[discrete(ps)]});
  }
  ///

// There are two kinds of states and two kinds of observations
var states = ["x", "y"];
var observations = ["a", "b"];

// Original random variable
var testERP = makeERP([.3, .7],
                      ["x", "y"]);

var epsilon = .000001;

var observationERPs = {
  "x" : makeERP([1 - epsilon, epsilon], observations),
    "y" : makeERP([.5, .5], observations)
    }

var observationScore = function(state, trueObservation){
  var observationERP = observationERPs[state]
    return observationERP.score([], trueObservation);
    }

// x states almost always transition to another x state;
// the y state is somewhat more likely to the x state as well.

var transitionERPs = {
  "x" : makeERP([.99, epsilon], states),
    "y" : makeERP([.9,.1], states)
    }

var transition = function(state){
  return transitionERPs[state];
  }
  ~~~~

We will make some simplifying assumptions to get off the ground. First, assume there are only four observations. Also, suppose that you want to coarsen the first pair of states and the final pair of states. These decisions should eventually be made flexible.

We need to specify a map from a tuple of variables to a single variable:

$\Omega \times \cdots \times \Omega \rightarrow \Omega'$

~~~~
// concatenate var names to make key for tuple
var abstractionMap = {
  "xx": "y1",
    "xy": "x1",
      "yx": "x1",
        "yy": "y1"
	}
	~~~~

~~~~
///fold:
var first = function(xs){return xs[0];};

var second = function(xs){return xs[1];};

var compose = function(f, g){
  return function(x){
      return f(g(x));
        };
	};

var zip = function(xs, ys){
  if (xs.length == 0) {
      return [];
        } else {
	    return [[xs[0], ys[0]]].concat(zip(xs.slice(1), ys.slice(1)));
	      }
	      };

var map2 = function(ar1,ar2,fn) {
  if (ar1.length==0 | ar2.length==0) {
      return [];
        } else {
	    return append([fn(ar1[0], ar2[0])], map2(ar1.slice(1), ar2.slice(1), fn));
	      }
	      };

var sum = function(xs){
  if (xs.length == 0) {
      return 0;
        } else {
	    return xs[0] + sum(xs.slice(1));
	      }
	      };

// span, applied to a predicate pred and a list xs, returns a tuple
// of elements that satisfy pred, and of the remainder of elements
// that don't satisfy pred.

var span = function(pred, xs, _xsY, _xsN){
  var xsY = _xsY ? _xsY : [];
    var xsN = _xsN ? _xsN : [];
      if (xs.length == 0) {
          return [xsY, xsN];
	    } else {
	        if (pred(xs[0])){
		      return span(pred, xs.slice(1), xsY.concat([xs[0]]), xsN);
		          } else {
			        return span(pred, xs.slice(1), xsY, xsN.concat([xs[0]]));
				    }
				      }
				      };

// groupBy takes an equivalenece function and a list, and returns
// a list of lists that, when concatenated, contains all elements in
// the original list and that is grouped by equivalence.

var groupBy = function(eq, vs){
  if (vs.length == 0) {
      return [];
        } else {
	    var x = vs[0];
	        var xs = vs.slice(1);
		    var tmp = span(function(b){return eq(x, b);}, xs);
		        var ys = tmp[0];
			    var zs = tmp[1];
			        return [[x].concat(ys)].concat(groupBy(eq, zs));
				  }
				  };

var indexOf = function(xs, x, j){
  var i = (j == undefined) ? 0 : j;
    if (xs[0] == x) {
        return i;
	  } else {
	      return indexOf(xs.slice(1), x, i+1);
	        }
		}

var coarsenERP = function(erp, coarsenValue){

  // Get concrete values and probabilities

  var allVs = erp.support([]);
    var allPs = map(allVs, function(v){return Math.exp(erp.score([], v));});

  // Group distribution based on equivalence classes
    // implied by coarsenValue function

  var groups = groupBy(
      function(vp1, vp2){
            return coarsenValue(vp1[0]) == coarsenValue(vp2[0]);
	        },
		    zip(allVs, allPs));

  var groupSymbols = map(
      groups,
          function(group){
	        // group[0][0]: first value in group
		      return coarsenValue(group[0][0])})

  var groupedVs = map(
      groups,
          function(group){
	        return map(group, first);
		    });

  var groupedPs = map(
      groups,
          function(group){
	        return map(group, second);
		    });

  // Construct unconditional (abstract) sampler and
    // conditional (concrete) sampler

  var abstractPs = map(groupedPs, sum);
    var abstractSampler = makeERP(abstractPs, groupSymbols);

  var groupERPs = map2(groupedPs, groupedVs, makeERP);
    var getConcreteSampler = function(abstractSymbol){
        var i = indexOf(groupSymbols, abstractSymbol);
	    return groupERPs[i];
	      }

  return [abstractSampler, getConcreteSampler];

}

///

var coarsenValue = function(value1, value2){
  comp_val = value1 + value2
    if (abstractionMap.hasOwnProperty(comp_val)){
        return abstractionMap[comp_val];
	  } else {
	      // This is wrong
	          return value;
		    }
		    }

// Decomposed random variable

var tmp = coarsenERP(testERP, coarsenValue);
var coarseTestERP = tmp[0];
var getFineTestERP = tmp[1];
~~~~