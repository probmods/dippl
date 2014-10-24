In this document, we generalize the coarse-to-fine procedure presented [here](http://dippl.org/examples/coarsetofine2) to handle the coarsening of multiple random variables into single representations. For example, in the HMM setting, we might want to coarsen a sequence of successive latent state variables into a single (joint) variable predicting the corresponding sequence of observations. Note that the current procedure coarsens *within* variables, mapping occurrences of a single variable (e.g. "x1", "x2", or "x3") onto another single variable ("x"), but cannot clump multiple variables together.

First, we form a joint distribution of two variables by enumerating over them separately and then placing them together into a single container. Note that this can be generalized to an arbitrary number of variables by pulling erps from a list, sampling from them, and then appending them to a master list.

~~~~
var makeERP = function(ps, vs){
  return Enumerate(function(){return vs[discrete(ps)]});
  }

var erp1 = makeERP([.5, .5],
                   ["x", "y"]);

var erp2 = makeERP([.5, .5],
                   ["x", "y"]);

var model = function(){
  var x = sample(erp1);
    var y = sample(erp2);
      return [x,y]
      }

print(Enumerate(model))
~~~~

Now, instead of sampling from separate erps and conjoining values together at the end, we form a single erp representing the joint distribution. Note that the resulting distribution is the same.



~~~~
///fold:
var makeERP = function(ps, vs){
  return Enumerate(function(){return vs[discrete(ps)]});
  }

var erp1 = makeERP([.5, .5],
                   ["x", "y"]);

var erp2 = makeERP([.5, .5],
                   ["x", "y"]);
		   ///

var erpProduct = function(thunk1, thunk2){
  return Enumerate(
      function(){
            var x = thunk1();
	          var y = thunk2();
		        return [x, y];
			    });
			    };

var xyErp = erpProduct(
  function(){return sample(erp1)},
    function(){return sample(erp2)})

var model = function(){
  var xy = sample(xyErp);
    return xy
    }

print(Enumerate(model))
~~~~

To run coarse-to-fine inference over the We now need to specify a map from a tuple of variables to a single variable:

$\Omega \times \cdots \times \Omega \rightarrow \Omega'$

This map is quite flexible. It could be a lookup table for every possible combination of values, or, more feasibly for large state spaces, a generic function assigning a pair of values to a coarsened value based on some property of the pair (e.g. containing an "x"). We then pass our joint ERP and the abstraction map to the same generic coarsenERP function used in the *within* variable case, which gives us a distribution over $\Omega'$. To show that the coarsened values map back to fine values correctly, we show both the original joint distribution and the two-step distribution given by mapping to $\Omega'$ and then back.





~~~~
///fold:
var makeERP = function(ps, vs){
  return Enumerate(function(){return vs[discrete(ps)]});
  }

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


var erpProduct = function(thunk1, thunk2){
  return Enumerate(
      function(){
            var x = thunk1();
	          var y = thunk2();
		        return [x, y];
			    });
			    };

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
var erp1 = makeERP([.5, .5],
                   ["x", "y"]);

var erp2 = makeERP([.5, .5],
                   ["x", "y"]);

var xyErp = erpProduct(
  function(){return sample(erp1)},
    function(){return sample(erp2)})

var abstractionMap = function(vars) {
  if (vars.length == 0) {
      return 'y0';
        } else if (vars[0] == 'x') {
	    return 'x0';
	      } else {
	          abstractionMap(vars.slice(1))
		    }
		    }

var tmp = coarsenERP(xyErp, abstractionMap);
var coarseTestERP = tmp[0];
var getFineTestERP = tmp[1];

// Show coarse distribution
print(coarseTestERP);

// Show original fine distribution
print(xyErp);

// Show marginal distribution of two-stage process
print(
  Enumerate(
      function(){
            var v1 = sample(coarseTestERP);
	          var v2 = sample(getFineTestERP(v1));
		        return v2
			    }))
			    ~~~~

Finally, we apply this process to the HMM example to do inference over multiple time steps simultaneously.

(in progress)

~~~~
///fold:
var makeERP = function(ps, vs){
  return Enumerate(function(){return vs[discrete(ps)]});
  }

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


var erpProduct = function(thunk1, thunk2){
  return Enumerate(
      function(){
            var x = thunk1();
	          var y = thunk2();
		        return [x, y];
			    });
			    };

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

var isUniformList = function(xs, value){
  if (!xs.length) {
      return true;
        } else {
	    if (xs[0] == value) {
	          return isUniformList(xs.slice(1), value);
		      } else {
		            return false;
			        }
				  }
				  }

var printStates = function(states){
  if (isUniformList(states, "y1")) {
      print("************ " + states + " *****************");
        } else {
	    print(states);
	      }
	      }
	      ///

// There are two kinds of states and two kinds of observations
var states = ["x", "y"];
var observations = ["a", "b"];

var startStateERP = makeERP([.9, .1], states);
var uniformStateERP = makeERP([.5,.5], states);

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

var uniformScore = function(state){
  return uniformStateERP.score([], state);
  }

var tmp0 = coarsenERP(startStateERP, coarsenValue);
var coarseStartStateERP = tmp0[0];
var getFineStartStateERP = tmp0[1];

// Coarsen (uniform) ERP for transitions

var tmp1 = coarsenERP(uniformStateERP, coarsenValue);
var coarseUniformStateERP = tmp1[0];
var getFineUniformStateERP = tmp1[1];
~~~~

asdf