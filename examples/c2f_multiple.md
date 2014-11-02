---
layout: hidden
title: c2f multiple
---

In this document, we generalize the coarse-to-fine procedure presented [here](http://dippl.org/examples/coarsetofine2) to handle the coarsening of multiple random variables into single representations. For example, in the HMM setting, we might want to coarsen a sequence of successive latent state variables into a single (joint) variable predicting the corresponding sequence of observations. Note that the current procedure coarsens *within* variables, mapping occurrences of a single variable (e.g. "x1", "x2", or "x3") onto another single variable ("x"), but cannot clump multiple variables together.

First, we form a joint distribution of two variables by enumerating over them separately and then placing them together into a single container. Note that this can be generalized to an arbitrary number of variables by pulling erps from a list, sampling from them, and then appending them to a master list.

~~~~
///fold:
var makeERP = function(ps, vs){
  return Enumerate(function(){return vs[discrete(ps)]});
}

var compose = function(f, g){
  return function(x){
    return f(g(x));
  };
};

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
  var allPs = map(function(v){return Math.exp(erp.score([], v));}, allVs);

  // Group distribution based on equivalence classes
  // implied by coarsenValue function
  var groups = groupBy(
    function(vp1, vp2){
      return coarsenValue(vp1[0], erp) == coarsenValue(vp2[0], erp);
    },
    zip(allVs, allPs));

  var groupSymbols = map(
    function(group){
      // group[0][0]: first value in group
      return coarsenValue(group[0][0], erp)},
	groups)

  var groupedVs = map(
    function(group){ return map(first, group); },
	groups);

  var groupedPs = map(
    function(group){ return map(second, group); },
	groups);

  // Construct unconditional (abstract) sampler and
  // conditional (concrete) sampler
  var abstractPs = map(sum, groupedPs);
  var abstractSampler = makeERP(abstractPs, groupSymbols);

  var groupERPs = map2(makeERP, groupedPs, groupedVs);
  var getConcreteSampler = function(abstractSymbol){
    var i = indexOf(abstractSymbol, groupSymbols);
    return groupERPs[i];
  }

  return [abstractSampler, getConcreteSampler];
}

var isUniformList = function(xs,v) {
  return reduce(function(a,b){return a == b}, v, xs)
}

var printStates = function(states){
  if (isUniformList(states, "y")) {
    print("************ " + states + " *****************");
  } else {
    print(states);
  }
}

var logMeanExp = function(erp){
  return Math.log(expectation(erp, function(x){return Math.exp(x);}));
}

///

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

$\Omega \times \cdots \times \Omega \rightarrow \Omega$

This map is quite flexible. It could be a lookup table for every possible combination of values, or, more feasibly for large state spaces, a generic function assigning a pair of values to a coarsened value based on some property of the pair (e.g. containing an "x"). We then pass our joint ERP and the abstraction map to the same generic coarsenERP function used in the *within* variable case, which gives us a distribution over $\Omega'$. To show that the coarsened values map back to fine values correctly, we show both the original joint distribution and the two-step distribution given by mapping to $\Omega'$ and then back.


~~~~
var erp1 = makeERP([.25, .75],
                   ["x", "y"]);

var erp2 = makeERP([.5, .5],
                   ["x", "y"]);

var xyErp = erpProduct(
  function(){return sample(erp1)},
  function(){return sample(erp2)})

var coarsenValues = function(vars) {
  if (vars.length == 0) {
    return 'y0';
  } else if (vars[0] == 'x') {
    return 'x0';
  } else {
    coarsenValues(vars.slice(1))
  }
}

var tmp = coarsenERP(xyErp, coarsenValues);
var coarseTestERP = tmp[0];
var getFineTestERP = tmp[1];

print(xyErp)

print(coarseTestERP)

// Show marginal distribution of two-stage process
print(
  Enumerate(
    function(){
      var v1 = sample(coarseTestERP);
      var v2 = sample(getFineTestERP(v1));
      return v2
    }))
~~~~

Finally, we apply this process to the HMM example to do inference over multiple time steps simultaneously. If were doing inference over a 10 step hmm, for example, it may be more efficient to pair up each state, do inference over this set of 5 coarsened states, then use the likelihoods of these joint states to guide their individuation.

Note that as in the regular case, we must construct our coarse ERPs independent of the hmm model, based on knowledge about the component states.

~~~~
var abstractionMap = function(vars) {
  if (vars.length == 0) {
    return 'x0';
  } else if (vars[0] == 'y') {
    return 'y0';
  } else {
    abstractionMap(vars.slice(1))
  }
}

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

// x states almost always transition to another x state;
// the y state is somewhat more likely to the x state as well.
var transitionERPs = {
  "x" : makeERP([.99, epsilon], states),
  "y" : makeERP([.9,.1], states)
}

var transitionScore = function(fromState, toState){
  var transitionERP = transitionERPs[fromState];
  return transitionERP.score([], toState);
}

var observationScore = function(state, trueObservation){
  var observationERP = observationERPs[state]
  return observationERP.score([], trueObservation);
}

var uniformScore = function(state){
  return uniformStateERP.score([], state);
}

var transition = function(state){
  return transitionERPs[state];
}

// We have to pre-build the coarse erps for all possible combinations...?

var tmp1 = coarsenERP(erpProduct(
  function(){return sample(startStateERP)},
  function(){return sample(uniformStateERP)}),
                      abstractionMap);
var coarseStartToUnif = tmp1[0];
var getFineStartToUnif = tmp1[1];

var tmp2 = coarsenERP(erpProduct(
  function(){return sample(uniformStateERP)},
  function(){return sample(uniformStateERP)}),
                      abstractionMap);
var coarseUnifToUnif = tmp2[0];
var getFineUnifToUnif = tmp2[1];

var model = function(){
  var coarseS0_1 = sample(coarseStartToUnif);
  var coarseS2_3 = sample(coarseUnifToUnif);

  var s0_1 = sample(getFineStartToUnif(coarseS0_1));
  var s0 = s0_1[0]
  factor(observationScore(s0, "a"));
  printStates([s0])

  var s1 = s0_1[1]
  factor(transitionScore(s0, s1) - uniformScore(s1) + observationScore(s1, "a"));
  printStates([s0,s1])

  var s2_3 = sample(getFineUnifToUnif(coarseS2_3));
  var s2 = s2_3[0]
  factor(transitionScore(s1, s2) - uniformScore(s2) + observationScore(s2, "a"));
  printStates([s0,s1,s2])

  var s3 = s2_3[1]
  factor(transitionScore(s2, s3) - uniformScore(s3) + observationScore(s3, "b"));
  printStates([s0,s1,s2,s3])

  return [s2, s3];
};

print(Enumerate(model))
~~~~

Note that the marginal distribution stays the same, but the enumeration is no more efficient. This is because the score functions still only operate on the fine-grained states pulled out of the coarsened state.

To fix this, we must lift the score functions to the abstract domain. This requires several adjustments to the original procedure. First, since abstractions are not given as explicit lookup tables, we must write a function *invertFunc* to find the inverse image of values under the abstraction map. Second, since the inverse image depends on the domain (i.e. different combinations of ERPs could map onto the same image), we must pass the product erp into the output sampler. Third, to lift score functions that are built to operate on a single variable, we must allow for arrays of variables such that the score of a sequence is simply the product of the score of each variable (assuming the variables are independent, as we have assured in previous parts).

~~~~
// There are two kinds of states and two kinds of observations
var states = ["x", "y"];
var observations = ["a", "b"];
var concrete_domain = ["x","y",["x","x"],["x","y"],["y","x"],["y","y"]]
var abstract_domain = ["x0","y0","cx","cy"]

var startStateERP = makeERP([.9, .1], states);
var uniformStateERP = makeERP([.5,.5], states);

var epsilon = .000001;

var observationERPs = {
  "x" : makeERP([1 - epsilon, epsilon], observations),
  "y" : makeERP([.5, .5], observations)
}

// x states almost always transition to another x state;
// the y state is somewhat more likely to the x state as well.
var transitionERPs = {
  "x" : makeERP([.99, epsilon], states),
  "y" : makeERP([.9,.1], states)
}

var transitionScore = function(fromState, toState){
  var transitionERP = transitionERPs[fromState];
  return transitionERP.score([], toState);
}

var observationScore = function(state, trueObservation){
  var observationERP = observationERPs[state]
  return observationERP.score([], trueObservation);
}

var uniformScore = function(state){
  return uniformStateERP.score([], state);
}

var transition = function(state){
  return transitionERPs[state];
}

var abstractionMap = function(vars) {
  // if there's anything in there that's not in the state space, just return it
  var aliens = ((vars instanceof Array) ? filter(function(v){return !_.contains(states,v)}, vars) :
                (!_.contains(states,vars) ? [vars] : []))
  if (aliens.length > 0) {
    return vars;
    // if it's a string, then return the corresponding abstract value
  } else if (typeof(vars) == "string") {
    return "c" + vars;
    // if it's an array, map to "y0" if there are ANY 'y's
  } else {
    if (vars.length == 0) {
      return 'x0';
    } else if (vars[0] == 'y') {
      return 'y0';
    } else {
      abstractionMap(vars.slice(1))
    }
  }
}

// returns the inverse image of val under origFunction
var refinementMap = function(val, origFunction) {
  if (!_.contains(abstract_domain, val)) {
    return val
  } else {
    var map_obj = _.object(concrete_domain, map(origFunction, concrete_domain))
    var inv_map = invertMap(map_obj)
    var inv_set = inv_map[val]
    var parsed = map(function(v){return v.split(',')}, inv_set)
    return (parsed[0].length > 1 ? parsed : parsed[0])
  }
}

var lift1 = function(f, coarsenValue, refineValue, useMean){
  var getOutputSampler = cache(function(coarseArg){
    // Compute set of fine values corresponding to coarse argument value
    var fineArgs = refineValue(coarseArg, coarsenValue);
    return Enumerate(
      function(){
	var fineArg = fineArgs[randomInteger(fineArgs.length)];
	var fineOut = f(fineArg)
	//         print("fineOut:")
	//         print(fineOut)
	var coarseOut = coarsenValue(fineOut);
	//         print("courseOut:")
	//         print(coarseOut)
	return coarseOut;
      });
  });

  var samplerToValue = useMean ? logMeanExp : sample;

  return function(coarseArg){ // new
    var outputSampler = getOutputSampler(coarseArg); //new
    return samplerToValue(outputSampler);
  };
};

var lift2 = function(f, coarsenValue, refineValue, useMean){
  var getOutputSampler = cache(function(coarseArg1, coarseArg2){
    // Compute set of fine values corresponding to coarse argument value
    var fineArgs1 = refineValue(coarseArg1, coarsenValue);
    var fineArgs2 = refineValue(coarseArg2, coarsenValue);
    return Enumerate(
      function(){
	var fineArg1 = fineArgs1[randomInteger(fineArgs1.length)];
	var fineArg2 = fineArgs2[randomInteger(fineArgs2.length)];
	var fineOut = f(fineArg1,fineArg2)
	//         print("fineOut:")
	//         print(fineOut)

        var coarseOut = coarsenValue(fineOut);
	//         print("courseOut:")
	//         print(coarseOut)
	return coarseOut;
      });
  });

  var samplerToValue = useMean ? logMeanExp : sample;

  return function(coarseArg1, coarseArg2){ // new
    var outputSampler = getOutputSampler(coarseArg1, coarseArg2); //new
    return samplerToValue(outputSampler);
  };
};

var startToUnif = erpProduct(
  function(){return sample(startStateERP)},
  function(){return sample(uniformStateERP)}
)

var tmp1 = coarsenERP(startToUnif, abstractionMap);
var coarseStartToUnif = tmp1[0];
var getFineStartToUnif = tmp1[1];

var unifToUnif = erpProduct(
  function(){return sample(uniformStateERP)},
  function(){return sample(uniformStateERP)}
)

var tmp2 = coarsenERP(unifToUnif, abstractionMap);
var coarseUnifToUnif = tmp2[0];
var getFineUnifToUnif = tmp2[1];

var coarseFirst = lift1(first, abstractionMap, refinementMap, false)
var coarseSecond = lift1(second, abstractionMap, refinementMap, false)

// type of other score funcs is (abstract -> abstract)
var coarseObservationScore = lift2(observationScore, abstractionMap, refinementMap, true);
var coarseTransitionScore = lift2(transitionScore, abstractionMap, refinementMap, true);
var coarseUniformScore = lift1(uniformScore, abstractionMap, refinementMap, true);

var model = function(){

  // Coarse level

  var coarseS0_1 = sample(coarseStartToUnif);
  // s1 and s2 are distributions over concrete values corresponding to the given abstract value
  var s0 = coarseFirst(coarseS0_1)
  var s1 = coarseSecond(coarseS0_1)
  var score0_1 = (coarseObservationScore(s0, "a")
	          + coarseObservationScore(s1, "a")
		  + coarseTransitionScore(s0, s1)
		  - coarseUniformScore(s1))
  factor(score0_1)
  printStates([coarseS0_1])

  var coarseS2_3 = sample(coarseUnifToUnif);
  var s2 = coarseFirst(coarseS2_3)
  var s3 = coarseSecond(coarseS2_3)
  var score2_3 = (coarseObservationScore(s2, "a")
	          + coarseObservationScore(s3, "b")
		  + coarseTransitionScore(s2,s3)
		  - coarseUniformScore(s2)
		  - coarseUniformScore(s3)
		  + coarseTransitionScore(s1,s2))
  factor(score2_3)
  printStates([coarseS0_1, coarseS2_3])

  // Fine level

  var temp = sample(getFineStartToUnif(coarseS0_1));
  var s0 = first(temp)
  printStates([s0])
  factor(observationScore(s0, "a") - score0_1)

  var s1 = second(temp)
  printStates([s0,s1])
  factor(transitionScore(s0, s1) - uniformScore(s1));
  factor(observationScore(s1, "a"));

  var temp = sample(getFineUnifToUnif(coarseS2_3));
  var s2 = first(temp)
  printStates([s0,s1,s2])
  factor(observationScore(s2, "a") - score2_3);

  var s3 = second(temp)
  printStates([s0,s1,s2,s3])
  factor(transitionScore(s2, s3) + transitionScore(s1,s2)
         - uniformScore(s3) - uniformScore(s2));
  factor(observationScore(s3, "b"));

  return [s2,s3]
};

print(Enumerate(model))

//var coarseS0_1 = sample(coarseStartToUnif);
//var s1 = coarseSecond(coarseS0_1)
//print(coarseObservationScore("cx", "b"))
~~~~

Note that this gives us the same distribution over latent states as before coarse-graining

~~~~
///fold:

var makeERP = function(ps, vs){
  return Enumerate(function(){return vs[discrete(ps)]});
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
  if (isUniformList(states, "y")) {
    print(states.concat(["********************************"]));
  } else {
    print(states);
  }
}

///

// There are four kinds of states and two kinds of observations

var states = ["x", "y"];
var observations = ["a", "b"];

// We are more likely to start out in one of the "x" states

var startStateERP = makeERP([.9, .1], states);

// x states almost always result in observation "a";
// the y state is uniform on "a" and "b".

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
// the y state is somewhat more likely to transition to
// one of the x states as well.

var transitionERPs = {
  "x" : makeERP([.99, epsilon], states),
  "y" : makeERP([.9, .1], states)
}

var transition = function(state){
  return transitionERPs[state];
}

// The model sequentially samples four states and
// uses factor statements to indicate the observation
// we made for each state.

// We print out states as they are explored by inference,
// and highlight the best explanation ([y, y, y, y]).

var model = function(){

  var s0 = sample(startStateERP);
  printStates([s0]);
  factor(observationScore(s0, "a"));

  var s1 = sample(transition(s0));
  printStates([s0, s1]);
  factor(observationScore(s1, "a"));

  var s2 = sample(transition(s1));
  printStates([s0, s1, s2]);
  factor(observationScore(s2, "a"));

  var s3 = sample(transition(s2));
  printStates([s0, s1, s2, s3]);
  factor(observationScore(s3, "b"));

  // Return only the last two states for easier visualization
  return [s2, s3];
};

print(Enumerate(model))
~~~~

Now we check how this works with particle filter inference

~~~~
var hmm_sampler = ParticleFilter(
  model,
  1000)

print(Enumerate(function(){sample(hmm_sampler)}));
~~~~
