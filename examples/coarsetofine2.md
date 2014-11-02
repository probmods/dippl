---
layout: hidden
title: Coarse-to-Fine Inference (reprise)
---

## Introduction

Imagine the following situation: You are a prisoner in a windowless cell and you are trying to figure out what the weather is like today. You never observe the weather directly, but every day you see the clothes your captors wear. You also know that on subsequent days, the weather tends to be similar. When you reason about what the weather is like today, you could either start reasoning in a lot of detail immediately (*light rain? heavy rain? freezing rain? drizzle?*) or you could first reason about the general type of weather (*good weather, or bad weather?*) and then only reason about the more specific instances that fit your broad conclusion (e.g., if your broad conclusion is *good weather*, you might ask: *very sunny, or only a little sunny?*). The latter could be a lot more efficient, so we'd like to implement algorithms that operate in this fashion.

*Coarse-to-fine inference* is the idea of doing probabilistic inference in a way that exploits the (implicit or explicit) hierarchical structure of a probabilistic model: we reason first on an abstract (coarse) level, then refine our reasoning using the most promising avenues found when reasoning abstractly. This kind of refinement can be iterated, possibly starting from an extremely simple model, and refining down to a very detailed model, passing through multiple models of intermediate detail.

If we introduce hierarchical structure by partitioning the state space in a way that respects (approximate) similarity in terms of posterior probability, and if we reason about such abstract partitions first, we can quickly compute estimates of the posterior probability of many states at once. This can speed up inference methods guided by such estimates, a class that includes best-first enumeration and sequential Monte Carlo.

### Setup

This page describes how to build a coarse-to-fine model given a model and an abstraction function.

In the following, a *model* is a program that includes `sample` and `factor` statements, and that returns a value. We are interested in its distribution on return values (its *marginal distribution*). *Inference* is the process of (approximately) computing this distribution. This distribution is nontrivial to compute due to factor statements that directly modify the log probability of an execution and that thus make the model *unnormalized*.

In the following, we use a Hidden Markov Model specialized to a fixed number of transitions. This can be viewed as a simplified formalization of the example given in the first paragraph.

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
  if (isUniformList(states, "y1")) {
    print(states.concat(["********************************"]));
  } else {
    print(states);
  }
}

///

// There are four kinds of states and two kinds of observations

var states = ["x1", "x2", "x3", "y1"];
var observations = ["a", "b"];

// We are more likely to start out in one of the "x" states

var startStateERP = makeERP([.3, .3, .3, .1], states);

// x states almost always result in observation "a";
// the y state is uniform on "a" and "b".

var epsilon = .000001;

var observationERPs = {
  "x1" : makeERP([1 - epsilon, epsilon], observations),
  "x2" : makeERP([1 - epsilon, epsilon], observations),
  "x3" : makeERP([1 - epsilon, epsilon], observations),
  "y1" : makeERP([.5, .5], observations)
}

var observationScore = function(state, trueObservation){
  var observationERP = observationERPs[state]
  return observationERP.score([], trueObservation);
}

// x states almost always transition to another x state;
// the y state is somewhat more likely to transition to
// one of the x states as well.

var transitionERPs = {
  "x1" : makeERP([.33, .33, .33, epsilon], states),
  "x2" : makeERP([.33, .33, .33, epsilon], states),
  "x3" : makeERP([.33, .33, .33, epsilon], states),
  "y1" : makeERP([.3, .3, .3, .1], states)
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

An *abstraction map* associates values with abstract values. We will not address the (very interesting) problem of how to find a good abstraction map for a given model.

We use the following abstraction map:

~~~~
var abstractionMap = {
  "x1": "x",
  "x2": "x",
  "x3": "x",
  "y1": "y"
}
~~~~

A *coarse-to-fine model* is a transformed version of a model (henceforth the "original model") that contains both "fine" and "coarse" random variables. The "fine" random variables correspond to the variables in the original model in the sense that (marginalizing out all other variables) their joint distribution is the same as in the original model. In addition, the coarse-to-fine model contains "coarse" random variables that structure the sampling process for each "fine" variable: we first sample an abstract value from the coarse-grained variable, and later on sample a fine variable from the partition on fine values defined by the coarse-grained value. In the following, we assume (without loss of generality) a coarse-to-fine model with only one level of coarsening.

### When does coarse-to-fine inference help?

A typical inefficiency of fine-grained exploration looks as follows: There are a lot of choices that look similarly good in the beginning, but then turn out to be bad after a little bit of reasoning. Stochastic-search-style inference algorithms may spend a lot of time considering these choices individually instead of ruling them out in one go.

For the HMM above, there are two classes of states, which we are going to call the *large class* ("x1", "x2", "x3") and the *small class* ("y1"). In the beginning, the large class looks better, but the last observation rules it out. In this scenario, fine-grained reasoning has to go through a lot of explanations involving each member of the large class before it considers the explanation involving the small class.

The model above prints out partial states as best-first enumeration explores them. Notice how far down the list the best solution `["y1","y1","y1","y1"]` is.

### Overview

The remainder of the document describes a sequence of steps that turn a model into a coarse-to-fine model:

1. Decompose dependent random variables into independent random variables and factors
2. Split each random variable into a coarse and (dependent) fine variable.
3. Create a lifted version of each primitive function and factor that applies to coarse values
4. (Optional:) Merge random variables and factors

In section 3, we compare how best-first enumeration behaves when applied to the original model and to the coarse-to-fine model.

## Decomposing dependent random variables

It is easier to think about how to derive coarsened programs for programs that do not contain dependent random variables. For this reason, we first transform our program by decomposing all dependent variables into independent variables and factors that introduce dependencies. For discrete variables with fixed support, this is easy — we simply sample from a uniform distribution on the support, then use a factor to subtract the log probability of uniform sampling from the overall probability of an execution and instead add in the log probability of dependent sampling.

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
  if (isUniformList(states, "y1")) {
    print("************ " + states + " *****************");
  } else {
    print(states);
  }
}

var states = ["x1", "x2", "x3", "y1"];
var observations = ["a", "b"];

var startStateERP = makeERP([.3, .3, .3, .1], states);
var uniformStateERP = makeERP([.25, .25, .25, .25], states); // NEW

var epsilon = .000001;

var observationERPs = {
  "x1" : makeERP([1 - epsilon, epsilon], observations),
  "x2" : makeERP([1 - epsilon, epsilon], observations),
  "x3" : makeERP([1 - epsilon, epsilon], observations),
  "y1" : makeERP([.5, .5], observations)
}

var transitionERPs = {
  "x1" : makeERP([.33, .33, .33, epsilon], states),
  "x2" : makeERP([.33, .33, .33, epsilon], states),
  "x3" : makeERP([.33, .33, .33, epsilon], states),
  "y1" : makeERP([.3, .3, .3, .1], states)
}

var observationScore = function(state, trueObservation){
  var observationERP = observationERPs[state]
  return observationERP.score([], trueObservation);
}

var transition = function(state){
  return transitionERPs[state];
}

///

var model = function(){

  var s0 = sample(startStateERP);
  factor(observationScore(s0, "a"));

  var s1 = sample(uniformStateERP);
  factor(transition(s0).score([], s1) - uniformStateERP.score([], s1));
  factor(observationScore(s1, "a"));

  var s2 = sample(uniformStateERP);
  factor(transition(s1).score([], s2) - uniformStateERP.score([], s2));
  factor(observationScore(s2, "a"));

  var s3 = sample(uniformStateERP);
  factor(transition(s2).score([], s3) - uniformStateERP.score([], s3));
  factor(observationScore(s3, "b"));

  return [s2, s3];
};

print(Enumerate(model))
~~~~

Crucially, the marginal distribution of the model didn't change.

Let's simplify the added lines a bit so that they are easier to deal with later on:

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
  if (isUniformList(states, "y1")) {
    print("************ " + states + " *****************");
  } else {
    print(states);
  }
}

var states = ["x1", "x2", "x3", "y1"];
var observations = ["a", "b"];

var startStateERP = makeERP([.3, .3, .3, .1], states);
var uniformStateERP = makeERP([.25, .25, .25, .25], states); // NEW

var epsilon = .000001;

var observationERPs = {
  "x1" : makeERP([1 - epsilon, epsilon], observations),
  "x2" : makeERP([1 - epsilon, epsilon], observations),
  "x3" : makeERP([1 - epsilon, epsilon], observations),
  "y1" : makeERP([.5, .5], observations)
}

var transitionERPs = {
  "x1" : makeERP([.33, .33, .33, epsilon], states),
  "x2" : makeERP([.33, .33, .33, epsilon], states),
  "x3" : makeERP([.33, .33, .33, epsilon], states),
  "y1" : makeERP([.3, .3, .3, .1], states)
}

var observationScore = function(state, trueObservation){
  var observationERP = observationERPs[state]
  return observationERP.score([], trueObservation);
}

///

var transitionScore = function(fromState, toState){
  var transitionERP = transitionERPs[fromState];
  return transitionERP.score([], toState);
}

var uniformScore = function(state){
  return uniformStateERP.score([], state);
}

var model = function(){

  var s0 = sample(startStateERP);
  factor(observationScore(s0, "a"));

  var s1 = sample(uniformStateERP);
  factor(transitionScore(s0, s1) - uniformScore(s1) + observationScore(s1, "a")); // NEW

  var s2 = sample(uniformStateERP);
  factor(transitionScore(s1, s2) - uniformScore(s2) + observationScore(s2, "a")); // NEW

  var s3 = sample(uniformStateERP);
  factor(transitionScore(s2, s3) - uniformScore(s3) + observationScore(s3, "b")); // NEW

  return [s2, s3];
};

print(Enumerate(model))
~~~~

## Splitting random variables into coarse and fine

Now that all random variables are independent, we are going to sample each variable in a two-stage process: we first sample an equivalence class (based on the abstraction map mentioned above), then sample a value within this equivalence class.

Here is a particular distribution we can try this out on:



~~~~
///fold:

var makeERP = function(ps, vs){
  return Enumerate(function(){return vs[discrete(ps)]});
}

///

var testERP = makeERP([.1, .2, .3, .4],
                      ["x1", "x2", "x3", "y1"]);

print(testERP)
~~~~

Here is the corresponding two-stage sampling process, resulting in the same marginal distribution:

~~~~
///fold:
var compose = function(f, g){
  return function(x){
    return f(g(x));
  };
};

var coarsenERP = function(erp, coarsenValue){

  // Get concrete values and probabilities

  var allVs = erp.support([]);
  var allPs = map(function(v){return Math.exp(erp.score([], v));}, allVs);

  // Group distribution based on equivalence classes
  // implied by coarsenValue function

  var groups = groupBy(
    function(vp1, vp2){
      return coarsenValue(vp1[0]) == coarsenValue(vp2[0]);
    },
    zip(allVs, allPs));

  var groupSymbols = map(
    function(group){
      // group[0][0]: first value in group
      return coarsenValue(group[0][0])},
	groups)

  var groupedVs = map(
    function(group){
      return map(first, group);
      },
	groups);

  var groupedPs = map(
    function(group){
      return map(second, group);
      },
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

///

// Original random variable

var testERP = makeERP([.1, .2, .3, .4],
                      ["x1", "x2", "x3", "y1"]);

// Abstraction map for partitioning values

var abstractionMap = {
  "x1": "x",
  "x2": "x",
  "x3": "x",
  "y1": "y"
}

var coarsenValue = function(value){
  if (abstractionMap.hasOwnProperty(value)){
    return abstractionMap[value];
  } else {
    return value; // value is unchanged in abstract domain
  }
}

// Decomposed random variable

var tmp = coarsenERP(testERP, coarsenValue);
var coarseTestERP = tmp[0];
var getFineTestERP = tmp[1];

// Show coarsedistribution

print(coarseTestERP);

// Show marginal distribution of two-stage process

print(
  Enumerate(
    function(){
      var v1 = sample(coarseTestERP);
      var v2 = sample(getFineTestERP(v1));
      return v2
    }))

~~~~

The implementation of `coarsenERP` that we used above simply groups values and probabilities by their corresponding abstract values:

~~~~
///fold:
var compose = function(f, g){
  return function(x){
    return f(g(x));
  };
};

///

var coarsenERP = function(erp, coarsenValue){

  // Get concrete values and probabilities

  var allVs = erp.support([]);
  var allPs = map(function(v){return Math.exp(erp.score([], v));}, allVs);

  // Group distribution based on equivalence classes
  // implied by coarsenValue function

  var groups = groupBy(
    function(vp1, vp2){
      return coarsenValue(vp1[0]) == coarsenValue(vp2[0]);
    },
    zip(allVs, allPs));

  var groupSymbols = map(
    function(group){
      // group[0][0]: first value in group
      return coarsenValue(group[0][0])},
	groups)

  var groupedVs = map(
    function(group){
      return map(first, group);
      },
	groups);

  var groupedPs = map(
    function(group){
      return map(second, group);
      },
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

~~~~

Now let's apply this process to all random variables in our HMM example:

~~~~
///fold:
var compose = function(f, g){
  return function(x){
    return f(g(x));
  };
};

var coarsenERP = function(erp, coarsenValue){

  // Get concrete values and probabilities

  var allVs = erp.support([]);
  var allPs = map(function(v){return Math.exp(erp.score([], v));}, allVs);

  // Group distribution based on equivalence classes
  // implied by coarsenValue function

  var groups = groupBy(
    function(vp1, vp2){
      return coarsenValue(vp1[0]) == coarsenValue(vp2[0]);
    },
    zip(allVs, allPs));

  var groupSymbols = map(
    function(group){
      // group[0][0]: first value in group
      return coarsenValue(group[0][0])},
	groups)

  var groupedVs = map(
    function(group){
      return map(first, group);
      },
	groups);

  var groupedPs = map(
    function(group){
      return map(second, group);
      },
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
  if (isUniformList(states, "y1")) {
    print("************ " + states + " *****************");
  } else {
    print(states);
  }
}

var states = ["x1", "x2", "x3", "y1"];
var observations = ["a", "b"];

var startStateERP = makeERP([.3, .3, .3, .1], states);
var uniformStateERP = makeERP([.25, .25, .25, .25], states);

var epsilon = .000001;

var observationERPs = {
  "x1" : makeERP([1 - epsilon, epsilon], observations),
  "x2" : makeERP([1 - epsilon, epsilon], observations),
  "x3" : makeERP([1 - epsilon, epsilon], observations),
  "y1" : makeERP([.5, .5], observations)
}

var transitionERPs = {
  "x1" : makeERP([.33, .33, .33, epsilon], states),
  "x2" : makeERP([.33, .33, .33, epsilon], states),
  "x3" : makeERP([.33, .33, .33, epsilon], states),
  "y1" : makeERP([.3, .3, .3, .1], states)
}

var observationScore = function(state, trueObservation){
  var observationERP = observationERPs[state]
  return observationERP.score([], trueObservation);
}

var transitionScore = function(fromState, toState){
  var transitionERP = transitionERPs[fromState];
  return transitionERP.score([], toState);
}

var uniformScore = function(state){
  return uniformStateERP.score([], state);
}

///

var abstractionMap = {
  "x1": "x",
  "x2": "x",
  "x3": "x",
  "y1": "y"
}

var coarsenValue = function(value){
  if (abstractionMap.hasOwnProperty(value)){
    return abstractionMap[value];
  } else {
    return value; // value is unchanged in abstract domain
  }
}

// Coarsen ERP for initial state

var tmp0 = coarsenERP(startStateERP, coarsenValue);
var coarseStartStateERP = tmp0[0];
var getFineStartStateERP = tmp0[1];

// Coarsen (uniform) ERP for transitions

var tmp1 = coarsenERP(uniformStateERP, coarsenValue);
var coarseUniformStateERP = tmp1[0];
var getFineUniformStateERP = tmp1[1];


var model = function(){

  var coarseS0 = sample(coarseStartStateERP);
  var s0 = sample(getFineStartStateERP(coarseS0));
  factor(observationScore(s0, "a"));

  var coarseS1 = sample(coarseUniformStateERP);
  var s1 = sample(getFineUniformStateERP(coarseS1));
  factor(transitionScore(s0, s1) - uniformScore(s1) + observationScore(s1, "a"));

  var coarseS2 = sample(coarseUniformStateERP);
  var s2 = sample(getFineUniformStateERP(coarseS2));
  factor(transitionScore(s1, s2) - uniformScore(s2) + observationScore(s2, "a"));

  var coarseS3 = sample(coarseUniformStateERP);
  var s3 = sample(getFineUniformStateERP(coarseS3));
  factor(transitionScore(s2, s3) - uniformScore(s3) + observationScore(s3, "b"));

  return [s2, s3];
};

print(Enumerate(model))
~~~~

Note again that the marginal distribution of the model didn't change.

In preparation for the next step, let's rearrange the model by hoisting the (independent) coarse random choices to the top of the program:

~~~~
///fold:
var compose = function(f, g){
  return function(x){
    return f(g(x));
  };
};

var coarsenERP = function(erp, coarsenValue){

  // Get concrete values and probabilities

  var allVs = erp.support([]);
  var allPs = map(function(v){return Math.exp(erp.score([], v));}, allVs);

  // Group distribution based on equivalence classes
  // implied by coarsenValue function

  var groups = groupBy(
    function(vp1, vp2){
      return coarsenValue(vp1[0]) == coarsenValue(vp2[0]);
    },
    zip(allVs, allPs));

  var groupSymbols = map(
    function(group){
      // group[0][0]: first value in group
      return coarsenValue(group[0][0])},
	groups)

  var groupedVs = map(
    function(group){
      return map(first, group);
      },
	groups);

  var groupedPs = map(
    function(group){
      return map(second, group);
      },
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
  if (isUniformList(states, "y1")) {
    print("************ " + states + " *****************");
  } else {
    print(states);
  }
}

var states = ["x1", "x2", "x3", "y1"];
var observations = ["a", "b"];

var startStateERP = makeERP([.3, .3, .3, .1], states);
var uniformStateERP = makeERP([.25, .25, .25, .25], states);

var epsilon = .000001;

var observationERPs = {
  "x1" : makeERP([1 - epsilon, epsilon], observations),
  "x2" : makeERP([1 - epsilon, epsilon], observations),
  "x3" : makeERP([1 - epsilon, epsilon], observations),
  "y1" : makeERP([.5, .5], observations)
}

var transitionERPs = {
  "x1" : makeERP([.33, .33, .33, epsilon], states),
  "x2" : makeERP([.33, .33, .33, epsilon], states),
  "x3" : makeERP([.33, .33, .33, epsilon], states),
  "y1" : makeERP([.3, .3, .3, .1], states)
}

var observationScore = function(state, trueObservation){
  var observationERP = observationERPs[state]
  return observationERP.score([], trueObservation);
}

var transitionScore = function(fromState, toState){
  var transitionERP = transitionERPs[fromState];
  return transitionERP.score([], toState);
}

var uniformScore = function(state){
  return uniformStateERP.score([], state);
}

var abstractionMap = {
  "x1": "x",
  "x2": "x",
  "x3": "x",
  "y1": "y"
}

var coarsenValue = function(value){
  if (abstractionMap.hasOwnProperty(value)){
    return abstractionMap[value];
  } else {
    return value; // value is unchanged in abstract domain
  }
}

var tmp0 = coarsenERP(startStateERP, coarsenValue);
var coarseStartStateERP = tmp0[0];
var getFineStartStateERP = tmp0[1];

var tmp1 = coarsenERP(uniformStateERP, coarsenValue);
var coarseUniformStateERP = tmp1[0];
var getFineUniformStateERP = tmp1[1];

///


var model = function(){

  var coarseS0 = sample(coarseStartStateERP);
  var coarseS1 = sample(coarseUniformStateERP);
  var coarseS2 = sample(coarseUniformStateERP);
  var coarseS3 = sample(coarseUniformStateERP);

  var s0 = sample(getFineStartStateERP(coarseS0));
  factor(observationScore(s0, "a"));

  var s1 = sample(getFineUniformStateERP(coarseS1));
  factor(transitionScore(s0, s1) - uniformScore(s1) + observationScore(s1, "a"));

  var s2 = sample(getFineUniformStateERP(coarseS2));
  factor(transitionScore(s1, s2) - uniformScore(s2) + observationScore(s2, "a"));

  var s3 = sample(getFineUniformStateERP(coarseS3));
  factor(transitionScore(s2, s3) - uniformScore(s3) + observationScore(s3, "b"));

  return [s2, s3];
};

print(Enumerate(model))
~~~~

The marginal distribution of the program is still unchanged.

## Lifting primitive functions and factors

Moving coarse variables to the top changed the exploration order used by enumeration a bit, but it didn't improve things (add `printStates` functions to see this). The observation factors still only come in at the very end, so abstraction doesn't make inference more efficient. If anything, it made things worse, since the abstract level so far doesn't take into account dependencies between variables. To make coarse-to-fine sampling useful, we need to lift factors (and, indeed, all primitive functions and other program structure) to the abstract level.

A key concept for this construction will be that of *heuristic factors* — that is, factors that are introduced at some point and later on cancelled out completely, their only role being to direct inference.  All factors that we are going to apply to the coarsened random variables (and to functions thereof) are going to be such heuristic factors. This means that they will not change the marginal distribution of the program.

We are going to lift all factors and primitive functions to the abstract level. In our example, the primitive functions are `transitionScore`, `uniformScore`, and `observationScore`.

Primitive functions are lifted to functions that first uniformly sample an instantiation of their argument, then apply the original function, then coarsen the resulting value. We marginalize out and cache this process.

Factors are lifted simply by copying them to the abstract level, and subtracting them out at the fine level.

Let's try to lift the following deterministic function:

~~~~
var states = ["x1", "x2", "x3", "y1"];

var myFunc = function(a){
  if (a == "x1") {
    return "x2"
  } else if (a == "x2") {
    return "x3"
  } else if (a == "x3") {
    return "x1"
  } else {
    return "y1"
  }
}

myFunc("x1")
~~~~

We use the same value coarsening function as before. Now, we are also going to also need its inverse, `refineValue`:

~~~~
var abstractionMap = {
  "x1": "x",
  "x2": "x",
  "x3": "x",
  "y1": "y"
}

var refinementMap = invertMap(abstractionMap);

var coarsenValue = function(value){
  if (abstractionMap.hasOwnProperty(value)){
    return abstractionMap[value];
  } else {
    return value; // value is unchanged in abstract domain
  }
}

var refineValue = function(abstractValue){
  if (refinementMap.hasOwnProperty(abstractValue)){
    return refinementMap[abstractValue];
  } else {
    return abstractValue; // value is unchanged in concrete domain
  }
}

refineValue("x")
~~~~

With these pieces in place, we can define lifting, and lift our function:

~~~~
///fold:

var abstractionMap = {
  "x1": "x",
  "x2": "x",
  "x3": "x",
  "y1": "y"
}

var refinementMap = invertMap(abstractionMap);

var coarsenValue = function(value){
  if (abstractionMap.hasOwnProperty(value)){
    return abstractionMap[value];
  } else {
    return value; // value is unchanged in abstract domain
  }
}

var refineValue = function(abstractValue){
  if (refinementMap.hasOwnProperty(abstractValue)){
    return refinementMap[abstractValue];
  } else {
    return abstractValue; // value is unchanged in concrete domain
  }
}

var states = ["x1", "x2", "x3", "y1"];

var myFunc = function(a){
  if (a == "x1") {
    return "x2"
  } else if (a == "x2") {
    return "x3"
  } else if (a == "x3") {
    return "y1"
  } else {
    return "y1"
  }
}

///

var lift1 = function(f, coarsenValue, refineValue){

  var getOutputSampler = cache(function(coarseArg){
    // Compute set of fine values corresponding to coarse argument value
    var fineArgs = refineValue(coarseArg);
    return Enumerate(
      function(){
        // Uniformly sample argument instantiation
        var fineArg = fineArgs[randomInteger(fineArgs.length)];
        // Apply original function
        var fineOut = f(fineArg);
        // Coarsen return value
        var coarseOut = coarsenValue(fineOut);
        return coarseOut;
      });
  });

  return function(coarseArg){
    var outputSampler = getOutputSampler(coarseArg);
    return sample(outputSampler);
  };
};

var myLiftedFunc = lift1(myFunc, coarsenValue, refineValue);

print(Enumerate(function(){return myLiftedFunc("x")}))
~~~~

Note that the deterministic function `myFunc` turned into a stochastic function `myLiftedFunc`.

What about factors? Let's consider a simple example:

~~~~
var states = ["x1", "x2", "x3", "y1"];


// Assigns a log-score to a state

var myScoreFunc = function(state){
  if (state == "x1") {
    return -1;
  } else if (state == "x2") {
    return -1.5;
  } else if (state == "x3") {
    return -2;
  } else {
    return -1;
  }
}

// Uniformly sample state, then create factor with score

print(Enumerate(function(){
  var state = states[randomInteger(states.length)];
  var score = myScoreFunc(state);
  factor(score);
  return state;
}))
~~~~

In this example, the function we want to lift is `myScoreFunc`. Let's apply our lifting function and see what happens to `myScoreFunc`:

~~~~
///fold:

var makeERP = function(ps, vs){
  return Enumerate(function(){return vs[discrete(ps)]});
}

var abstractionMap = {
  "x1": "x",
  "x2": "x",
  "x3": "x",
  "y1": "y"
}

var refinementMap = invertMap(abstractionMap);

var coarsenValue = function(value){
  if (abstractionMap.hasOwnProperty(value)){
    return abstractionMap[value];
  } else {
    return value; // value is unchanged in abstract domain
  }
}

var refineValue = function(abstractValue){
  if (refinementMap.hasOwnProperty(abstractValue)){
    return refinementMap[abstractValue];
  } else {
    return abstractValue; // value is unchanged in concrete domain
  }
}

var states = ["x1", "x2", "x3", "y1"];

var myScoreFunc = function(state){
  if (state == "x1") {
    return -1;
  } else if (state == "x2") {
    return -1.5;
  } else if (state == "x3") {
    return -2;
  } else {
    return -1;
  }
}

var lift1 = function(f, coarsenValue, refineValue){

  var getOutputSampler = cache(function(coarseArg){
    var fineArgs = refineValue(coarseArg);
    return Enumerate(
      function(){
        var fineArg = fineArgs[randomInteger(fineArgs.length)];
        var fineOut = f(fineArg);
        var coarseOut = coarsenValue(fineOut);
        return coarseOut;
      });
  });

  return function(coarseArg){
    var outputSampler = getOutputSampler(coarseArg);
    return sample(outputSampler);
  };
};

///

var myLiftedScoreFunc = lift1(myScoreFunc, coarsenValue, refineValue);

print(Enumerate(function(){return myLiftedScoreFunc("x")}))
~~~~

As before, lifting to the coarse level turned a previously deterministic function into a stochastic function. In the case where the return value of the function is a score, this resulted in a distribution on scores. This defeats the purpose of abstraction, though — we want to judge abstract states in one go; if we have to sample a score (corresponding to the score of a concrete state), we are almost back to the setting where we have concrete states in the first place!

There is an easy remedy: instead of sampling scores, we simply return the expected score. This requires that we indicate for the lifting which functions compute scores (or, equivalently, which functions support means on the coarse level).

Let's write a modified lifting function that takes an extra argument that indicates whether to take the mean of its return distribution instead of sampling:

~~~~
///fold:

var makeERP = function(ps, vs){
  return Enumerate(function(){return vs[discrete(ps)]});
}

var abstractionMap = {
  "x1": "x",
  "x2": "x",
  "x3": "x",
  "y1": "y"
}

var refinementMap = invertMap(abstractionMap);

var coarsenValue = function(value){
  if (abstractionMap.hasOwnProperty(value)){
    return abstractionMap[value];
  } else {
    return value; // value is unchanged in abstract domain
  }
}

var refineValue = function(abstractValue){
  if (refinementMap.hasOwnProperty(abstractValue)){
    return refinementMap[abstractValue];
  } else {
    return abstractValue; // value is unchanged in concrete domain
  }
}

var states = ["x1", "x2", "x3", "y1"];

var myScoreFunc = function(a){
  if (a == "x1") {
    return -1;
  } else if (a == "x2") {
    return -1.5;
  } else if (a == "x3") {
    return -2;
  } else {
    return -1;
  }
}

var sum = function(xs){
  if (xs.length == 0) {
    return 0;
  } else {
    return xs[0] + sum(xs.slice(1));
  }
};

var expectation = function(erp, f){
  return sum(
    map(
      function(v){
        return Math.exp(erp.score([], v)) * f(v);
		},
	  erp.support([])
      ));
};

var logMeanExp = function(erp){
  return Math.log(expectation(erp, function(x){return Math.exp(x);}));
}

///

var lift1 = function(f, coarsenValue, refineValue, useMean){

  var getOutputSampler = cache(function(coarseArg){
    var fineArgs = refineValue(coarseArg);
    return Enumerate(
      function(){
        var fineArg = fineArgs[randomInteger(fineArgs.length)];
        var fineOut = f(fineArg);
        var coarseOut = coarsenValue(fineOut);
        return coarseOut;
      });
  });

  var samplerToValue = useMean ? logMeanExp : sample;

  return function(coarseArg){
    var outputSampler = getOutputSampler(coarseArg);
    return samplerToValue(outputSampler);
  };

};


var myLiftedScoreFunc = lift1(myScoreFunc, coarsenValue, refineValue, true);

print(myLiftedScoreFunc("x"))
~~~~

Now the abstract score function is deterministic and returns the expected score for the abstract state.

We are ready to apply lifting to our original HMM program:

~~~~
///fold:
var compose = function(f, g){
  return function(x){
    return f(g(x));
  };
};

var coarsenERP = function(erp, coarsenValue){

  // Get concrete values and probabilities

  var allVs = erp.support([]);
  var allPs = map(function(v){return Math.exp(erp.score([], v));}, allVs);

  // Group distribution based on equivalence classes
  // implied by coarsenValue function

  var groups = groupBy(
    function(vp1, vp2){
      return coarsenValue(vp1[0]) == coarsenValue(vp2[0]);
    },
    zip(allVs, allPs));

  var groupSymbols = map(
    function(group){
      // group[0][0]: first value in group
      return coarsenValue(group[0][0])},
	groups)

  var groupedVs = map(
    function(group){
      return map(first, group);
      },
	groups);

  var groupedPs = map(
    function(group){
      return map(second, group);
      },
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

var sum = function(xs){
  if (xs.length == 0) {
    return 0;
  } else {
    return xs[0] + sum(xs.slice(1));
  }
};

var expectation = function(erp, f){
  return sum(
    map(
      function(v){
        return Math.exp(erp.score([], v)) * f(v);
		},
	  erp.support([])
      ));
};

var logMeanExp = function(erp){
  return Math.log(expectation(erp, function(x){return Math.exp(x);}));
}

var lift1 = function(f, coarsenValue, refineValue, useMean){

  var getOutputSampler = cache(function(coarseArg){
    var fineArgs = refineValue(coarseArg);
    return Enumerate(
      function(){
        var fineArg = fineArgs[randomInteger(fineArgs.length)];
        var fineOut = f(fineArg);
        var coarseOut = coarsenValue(fineOut);
        return coarseOut;
      });
  });

  var samplerToValue = useMean ? logMeanExp : sample;

  return function(coarseArg){
    var outputSampler = getOutputSampler(coarseArg);
    return samplerToValue(outputSampler);
  };

};

var lift2 = function(f, coarsenValue, refineValue, useMean){

  var getOutputSampler = cache(function(coarseArg1, coarseArg2){
    var fineArgs1 = refineValue(coarseArg1);
    var fineArgs2 = refineValue(coarseArg2);
    return Enumerate(
      function(){
        var fineArg1 = fineArgs1[randomInteger(fineArgs1.length)];
        var fineArg2 = fineArgs2[randomInteger(fineArgs2.length)];
        var fineOut = f(fineArg1, fineArg2);
        var coarseOut = coarsenValue(fineOut);
        return coarseOut;
      });
  });

  var samplerToValue = useMean ? logMeanExp : sample;

  return function(coarseArg1, coarseArg2){
    var outputSampler = getOutputSampler(coarseArg1, coarseArg2);
    return samplerToValue(outputSampler);
  };

};

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
  if (isUniformList(states, "y1")) {
    print(states.concat(["********************************"]));
  } else {
    print(states);
  }
}

var states = ["x1", "x2", "x3", "y1"];
var observations = ["a", "b"];

var startStateERP = makeERP([.3, .3, .3, .1], states);
var uniformStateERP = makeERP([.25, .25, .25, .25], states);

var epsilon = .000001;

var observationERPs = {
  "x1" : makeERP([1 - epsilon, epsilon], observations),
  "x2" : makeERP([1 - epsilon, epsilon], observations),
  "x3" : makeERP([1 - epsilon, epsilon], observations),
  "y1" : makeERP([.5, .5], observations)
}

var transitionERPs = {
  "x1" : makeERP([.33, .33, .33, epsilon], states),
  "x2" : makeERP([.33, .33, .33, epsilon], states),
  "x3" : makeERP([.33, .33, .33, epsilon], states),
  "y1" : makeERP([.3, .3, .3, .1], states)
}

var observationScore = function(state, trueObservation){
  var observationERP = observationERPs[state]
  return observationERP.score([], trueObservation);
}

var transitionScore = function(fromState, toState){
  var transitionERP = transitionERPs[fromState];
  return transitionERP.score([], toState);
}

var uniformScore = function(state){
  return uniformStateERP.score([], state);
}

var abstractionMap = {
  "x1": "x",
  "x2": "x",
  "x3": "x",
  "y1": "y"
}

var refinementMap = invertMap(abstractionMap);

var coarsenValue = function(value){
  if (abstractionMap.hasOwnProperty(value)){
    return abstractionMap[value];
  } else {
    return value; // value is unchanged in abstract domain
  }
}

var refineValue = function(abstractValue){
  if (refinementMap.hasOwnProperty(abstractValue)){
    return refinementMap[abstractValue];
  } else {
    return abstractValue; // value is unchanged in concrete domain
  }
}

var tmp0 = coarsenERP(startStateERP, coarsenValue);
var coarseStartStateERP = tmp0[0];
var getFineStartStateERP = tmp0[1];

var tmp1 = coarsenERP(uniformStateERP, coarsenValue);
var coarseUniformStateERP = tmp1[0];
var getFineUniformStateERP = tmp1[1];

///

// Lift scoring functions to coarse level

var coarseObservationScore = lift2(observationScore, coarsenValue, refineValue, true);
var coarseTransitionScore = lift2(transitionScore, coarsenValue, refineValue, true);
var coarseUniformScore = lift1(uniformScore, coarsenValue, refineValue, true);


// We add score computations and factors on the coarse level,
// print out all (coarse and fine) states as they are
// explored by inference, and subtract out the coarse scores
// on the fine level in order to leave the marginal distribution
// invariant.

var model = function(){

  // Coarse level

  var coarseS0 = sample(coarseStartStateERP);
  printStates([coarseS0]);
  var score0 = coarseObservationScore(coarseS0, "a")
  factor(score0);

  var coarseS1 = sample(coarseUniformStateERP);
  printStates([coarseS0, coarseS1]);
  var score1 = (coarseTransitionScore(coarseS0, coarseS1)
                - coarseUniformScore(coarseS1)
                + coarseObservationScore(coarseS1, "a"));
  factor(score1);

  var coarseS2 = sample(coarseUniformStateERP);
  printStates([coarseS0, coarseS1, coarseS2]);
  var score2 = (coarseTransitionScore(coarseS1, coarseS2)
                - coarseUniformScore(coarseS2)
                + coarseObservationScore(coarseS2, "a"));
  factor(score2);

  var coarseS3 = sample(coarseUniformStateERP);
  printStates([coarseS0, coarseS1, coarseS2, coarseS3]);
  var score3 = (coarseTransitionScore(coarseS2, coarseS3)
                - coarseUniformScore(coarseS3)
                + coarseObservationScore(coarseS3, "b"));
  factor(score3);


  // Fine level

  var s0 = sample(getFineStartStateERP(coarseS0));
  printStates([s0]);
  factor(observationScore(s0, "a") - score0);

  var s1 = sample(getFineUniformStateERP(coarseS1));
  factor(transitionScore(s0, s1) - uniformScore(s1));
  printStates([s0, s1]);
  factor(observationScore(s1, "a") - score1);

  var s2 = sample(getFineUniformStateERP(coarseS2));
  factor(transitionScore(s1, s2) - uniformScore(s2));
  printStates([s0, s1, s2]);
  factor(observationScore(s2, "a") - score2);

  var s3 = sample(getFineUniformStateERP(coarseS3));
  factor(transitionScore(s2, s3) - uniformScore(s3));
  printStates([s0, s1, s2, s3]);
  factor(observationScore(s3, "b") - score3);

  return [s2, s3];
};

print(Enumerate(model))
~~~~

The order in which the inference algorithm explores different executions has changed dramatically: once all coarse execution orders have been considered (the first 20 lines), inference directly hones in on the best possible parse. In other words, the very first fine execution we consider is the best solution. The final marginal distribution is left unchanged.

## Merging random variables and factors

The generated program could be improved by merging sample and factor statements that appear directly in sequence: instead of sampling and then scoring, we could adjust the sampling process directly.

## Future work

In our next steps, we would like to work out more realistic applications. Here are a few candidates:

- **Computer vision**. In this application, we want to infer latent structure from real-world images such as those used in the [Tiny Images dataset](http://groups.csail.mit.edu/vision/TinyImages/). Imagine a fine-grained model that has a dependent random choice for each pixel. In the simplest version of this example, we simply learn a category for each images based on a mixture model with image prototypes, and each pixel variable is a noisy version of a prototype's corresponding pixel value. In more advanced versions, we could learn more latent structure and use more interesting generative processes (involving, e.g., the placement of parts). Components:

    - Coarsening of multiple variables into a single variable
    - Approximating/learning the conditional distributions of coarsened primitives
    - Multi-stage coarsening

- **Probabilistic Context-Free Grammars**. This is a structurally more interesting version of the HMM. For this application, we could find an existing (trained) PCFG such as the one used in the Stanford parser, write is as a probabilistic program, define a coarsening on nonterminal symbols, and use that to generate a coarse-to-fine model that can conditioned on coarsened sentences. More interesting versions of this application could use extensions of the PCFG such as the Infinite PCFG (using HDPs). Components:

    - Understand coarsening in the setting where variables are not directly dependent, but influence the existence of other variables
    - Automate the coarsening of recursive functions
    - Understand how our approach to coarsening relates to existing coarse-to-fine NLP approaches (mainly [Petrov's work](http://www.petrovi.de/data/dissertation.pdf)).
    - Multi-stage coarsening

- **Language understanding**. We would like to apply coarse-to-fine to natural language understanding applications such as pragmatic inference and semantic parsing (and combinations of these). What this looks like depends on whether we can figure out coarsening for nested-query models. If yes, then a first version could simply coarsen a listener/speaker pragmatics model with a relatively large state space; if not, then semantic parsing may be a better fit. Components:

    - Understand coarse-to-fine for models with nested conditioning

Taken together, these applications suggest the following steps, not necessarily in this order:

- Work out how to coarsen multiple variables into a single variable. How should we specify such coarsenings?

- Work out how to efficiently approximate coarsened primitives for a fixed coarsening.

- Automate the transform from a fine-grained model to a coarse-to-fine model. We can automate this first for single-stage coarsening for "flat" models (as in the restricted HMM example shown above), then for recursive models, and finally for multi-stage coarsening applied to recursive models. As part of this process, we may want to automatically merge sampling statements and factors.

- Understand coarsening in the setting where variables are not directly dependent, but influence the existence of other variables.

- Work out coarsening for nested-query models.

- Learn good coarsenings (e.g. using a particle filter lattice, re-weighting paths based on average importance weights). This could initially be explored in the flat HMM setting.

- Understand how our approach relates to Galois Connections.


## Coarsening multiple variables into a single variable

Let's think about an example of coarsening multiple random variables into a single one:

~~~~
var model = function(){
  var x = sample(erp1);
  var y = sample(erp2);
  var z = f(x, y);
  var d = g(x);
  var e = h(y);
}
~~~~

What does the coarsened model look like in this case?

As a first step, we merge the variables so that there is a single pair-valued variable:

~~~~
// primitives

var first = function(xs){
  return xs[0]
}

var second = function(xs){
  return xs[1]
}


var model = function(){
  var xy = [sample(erp1), sample(erp2)];
  var z = f(first(xy), second(xy));
  var d = g(first(xy));
  var e = h(second(xy));
}
~~~~

Note that this didn't change the model's distribution. We can now merge the two erps into a single one:

~~~~
///fold:
var first = function(xs){
  return xs[0]
}

var second = function(xs){
  return xs[1]
}
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
  function(){return sample(erp2)}}

var model = function(){
  var xy = sample(xyErp);
  var z = f(first(xy), second(xy));
  var d = g(first(xy));
  var e = h(second(xy));
}
~~~~

Then, in the next step, we coarsen `xyErp` as usual, and lift `first` and `second` to the abstract domain, also as usual.

~~~~
var coarseModel = function(){
  var xy = sample(coarseXyErp);
  var z = coarseF(coarseFirst(xy), coarseSecond(xy));
  var d = coarseG(coarseFirst(xy));
  var e = coarseH(coarseSecond(xy));
}
~~~~

The requirement for merging of multiple variables is that the first step is possible. This requires in turn that `x` and `y` are sampled "close enough" together. In particular, this is possible (and easy enough to automate) if `x` and `y` are defined and named within the same block.
