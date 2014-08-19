---
layout: lecture
title: Early, incremental evidence
description: Inserting and commuting factor statements to get the right incremental sequencing.
---


# The basic HMM
 
All of the below assume that `transition` is a stochastic transition function from hidden states to hidden states, `observe` is an observation function from hidden to observed states, and `init` is an initial distribution.

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

First here is a fairly standard, 'direct', version that never explicitly represents the partial state sequences:

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

This version is equivalent, but recurses the other way, and passes along the partial state sequences more explicitly:

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

~~~
var binomial = function(){
    var a = sample(bernoulliERP, [0.1])
    var b = sample(bernoulliERP, [0.9])
    var c = sample(bernoulliERP, [0.1])
    factor( (a&b)?0:-Infinity)
    return a + b + c
}

print(Enumerate(binomial, 2))
~~~

First, we can move the factor up, to the point when it's first dependency is bound:

~~~
var binomial = function(){
    var a = sample(bernoulliERP, [0.1])
    var b = sample(bernoulliERP, [0.9])
    factor( (a&b)?0:-Infinity)
    var c = sample(bernoulliERP, [0.1])
    return a + b + c
}

print(Enumerate(binomial, 2))
~~~

Next we can break this factor into an equivalent two factors, and again move one of them up:

~~~
var binomial = function(){
    var a = sample(bernoulliERP, [0.1])
    factor( a?0:-Infinity)
    var b = sample(bernoulliERP, [0.9])
    factor( b?0:-Infinity)
    var c = sample(bernoulliERP, [0.1])
    return a + b + c
}

print(Enumerate(binomial, 2))
~~~

What if we can't decompose the factor into separate pieces? For instance in:

~~~
var binomial = function(){
    var a = sample(bernoulliERP, [0.1])
    var b = sample(bernoulliERP, [0.9])
    var c = sample(bernoulliERP, [0.1])
    factor( (a|b|c) ? 0:-10)
    return a + b + c
}

print(Enumerate(binomial, 2))
~~~

We can still insert 'heuristic' factors that will help the inference algorithm explore more usefully, as long as they cancel by the end. That is, `factor(s); factor(-s)` has no effect on the meaning of the model, and so is always allowed (even if the two factors are separated, as long as they aren't separated by a marginalization operator). For instance:

~~~
var binomial = function(){
    var a = sample(bernoulliERP, [0.1])
    factor(a?0:-1)
    var b = sample(bernoulliERP, [0.9])
    factor(  ((a|b)?0:-1) - (a?0:-1))
    var c = sample(bernoulliERP, [0.1])
    factor( ((a|b|c) ? 0:-10) - ((a|b)?0:-1))
    return a + b + c
}

print(Enumerate(binomial, 2))
~~~


