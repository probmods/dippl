---
layout: default
title: Hidden Markov Models
description: Various representations of the HMM, and the inference tricks that follow.
---

# The basic HMM
 
Below, we assume that `transition` is a stochastic transition function from hidden states to hidden states, `observe` is an observation function from hidden to observed states, and `init` is an initial distribution.

~~~
var transition = function(s) {
  return s ? flip(0.7) : flip(0.3)
}

var observe = function(s) {
  return s ? flip(0.9) : flip(0.1)
}

var init = function() {
  return flip(0.5)
}
~~~

And we will initially use this helper function to compare arrays:

~~~
var arrayEq = function(a, b){
  return a.length == 0 ? true : a[0]==b[0] & arrayEq(a.slice(1), b.slice(1))
}
~~~

First, this is a fairly standard, 'direct', version that never explicitly represents the partial state sequences:

~~~
var hmminit = function(){
  var s = init(); 
  return {states: [s], observations: [observe(s)]};
}

var hmm = function(n) {
  var prev = (n==1) ? hmminit() : hmm(n-1)
  var newstate = transition(prev.states[0])
  var newobs = observe(newstate)
  var next = {states: prev.states.concat([newstate]),
              observations: prev.observations.concat([newobs])}
  return next
}

hmm(4)
~~~

We can condition on some observed states:

~~~
//some true observations (the data we observe):
var trueobs = [true, true, true]

print(Enumerate(function(){
  var r = hmm(2)
  factor( arrayEq(r.observations, trueobs) ? 0 : -Infinity )
  return r.states
}, 100))
~~~

We could also do inference with a particle filter (or other method):

~~~
var trueobs = [true, true, true]

print(ParticleFilter(function(){
  var r = hmm(2)
  factor( arrayEq(r.observations, trueobs) ? 0 : -Infinity )
  return r.states
}, 500))
~~~

# Exposing the intermediate state

This version is equivalent, but recurses the other way, and more explicitly passes along the partial state sequences:

~~~
var hmm_recur = function(n, states, observations){
  var newstate = transition(states[0])
  var newobs = observe(newstate)
  var states = states.concat([newstate])
  var observations = observations.concat([newobs])
  return (n==1) ? {states: states, observations: observations} : 
                  hmm_recur(n-1,states,observations)
}

var hmm = function(n) {
  var s = init()
  return hmm_recur(n,[s],[observe(s)])
}

hmm(4)
~~~


# Decomposing and interleaving factors

We now explore different ways to optimize inference in the above models. First, we decompose the factor and push the pieces earlier in the computation. This gives us a better, more incremental particle filter and a better enumeration sequence.
 
First, notice that adding `factor(s); factor(-s);` anywhere in the program is equivalent to adding `factor(s-s)` which is `factor(0)`, which has no effect on the final distribution of the program. So we can insert these "intermediate factors" wherever we want:

~~~
var trueobs = [true, true, true];

var hmm_recur = function(n, states, observations){
  var newstate = transition(states[0])
  var newobs = observe(newstate)
  var states = states.concat([newstate])
  var observations = observations.concat([newobs])
  factor(arrayEq(observations, trueobs) ? 0 : -Infinity)
  factor(-(arrayEq(observations, trueobs) ? 0 : -Infinity)) //we'll push this one forward into the next recursion
  return (n==1) ? [states, observations] : hmm_recur(n-1,states,observations)
}

var hmm = function(n) {
  var s = init()
  var observations = [observe(s)]
  factor(arrayEq(observations, trueobs) ? 0 : -Infinity)
  factor(-(arrayEq(observations, trueobs) ? 0 : -Infinity)) //we'll push this one forward into hmm_recur
  return hmm_recur(n,[s],observations)
}

print(ParticleFilter(function(){
  var r = hmm(2)
  factor( arrayEq(r[1], trueobs) ? 0 : -Infinity )
  return r[0]
}, 100))
~~~

Notice that `arrayEq` will be true if all of `a` matches the prefix of `b`, even if `a` is shorter. Thus we've inserted a factor that checks if the observations so far match `trueobs`. However, these canceling pairs so far have no effect. But we can rearrange, by pushing the second factor through the return, into the next recursion (or function return). This means that the information from the factors accumulates more incrementally as choices are made:

~~~
var trueobs = [true, true, true];

var hmm_recur = function(n, states, observations){
  factor(-(arrayEq(observations, trueobs) ? 0 : -Infinity))
  var newstate = transition(states[0])
  var newobs = observe(newstate)
  var states = states.concat([newstate])
  var observations = observations.concat([newobs])
  factor(arrayEq(observations, trueobs) ? 0 : -Infinity)
  return (n==1) ? [states, observations] : hmm_recur(n-1,states,observations)
}

var hmm = function(n) {
  var s = init()
  var observations = [observe(s)]
  factor(arrayEq(observations, trueobs) ? 0 : -Infinity)
  return hmm_recur(n,[s],observations)
}

print(ParticleFilter(function(){
  var r = hmm(2)
  //factor(-(arrayEq(r[1], trueobs) ? 0 : -Infinity)) //these now cancel...
  //factor( arrayEq(r[1], trueobs) ? 0 : -Infinity )
  return r[0]
}, 100))
~~~

Finally, if `a' = a.slice(0,-1)`, then `arrayEq(a,b)` will be false if `arrayEq(a',b)` is false. This allows us to simplify the two factors in `hmm_recur`.

~~~
var trueobs = [true, true, true];

var hmm_recur = function(n, states, observations){
  var newstate = transition(states[0])
  var newobs = observe(newstate)
  factor( newobs == trueobs[observations.length] ? 0 : -Infinity) //simplify the two factors
  var states = states.concat([newstate])
  var observations = observations.concat([newobs])
  return (n==1) ? [states, observations] : hmm_recur(n-1,states,observations)
}

var hmm = function(n) {
  var s = init()
  var observations = [observe(s)]
  factor(observations[0] == trueobs[0] ? 0 : -Infinity) //simplify since we know that observations is length 1
  return hmm_recur(n,[s],observations)
}

print(ParticleFilter(function(){
  var r = hmm(2)
  return r[0]
}, 100))
~~~

Fun exercise: Use Enumeration with this most recent version that uses intermediate factors and with the first hmm above. Vary the number of executions explored, starting at 1. How do they differ?

Note: There's one more optimization we'd like to do: we'd like to incorporate the factor when we actually sample newobs, so that we only try observations consistent with trueobs. To do so we need to marginalize out observe(..) to get an immediate ERP sample and then use sampleWithFactor(..) to simultaneously sample and incorporate the factor. However, we haven't implemented sampleWithFactor yet.


# Dynamic programming

We then achieve dynamic programming by inserting additional marginal operators and caching them.

