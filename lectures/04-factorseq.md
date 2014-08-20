---
layout: lecture
title: Early, incremental evidence
description: Inserting and commuting factor statements to get the right incremental sequencing.
---

Many models that are important in applications have very large state spaces such that, when the model is naively written, no information becomes available to guide inference until the very end on the computation. This makes it very hard for sequential exploration strategies (such as enumeration and particle filtering) to work. Two common examples are the hidden Markov model (HMM) and the probabilistic context free grammar (PCFG). We first introduce these models, then describe techniques to transform them into a form that makes sequential inference more efficient. Finally we will consider a harder class of models with 'global' conditions.

## Unfolding data structures

### The HMM
 
All of the below assume that `transition` is a stochastic transition function from hidden states to hidden states, `observe` is an observation function from hidden to observed states, and `init` is an initial distribution.

~~~
var transition = function(s) {
  return s ? flip(0.7) : flip(0.3)
}

var observe = function(s) {
  return s ? flip(0.9) : flip(0.1)
}
~~~

Here is a fairly standard version of the HMM:

~~~
var hmm = function(n) {
  var prev = (n==1) ? {states: [true], observations:[]} : hmm(n-1)
  var newstate = transition(prev.states[0])
  var newobs = observe(newstate)
  return {states: prev.states.concat([newstate]),
          observations: prev.observations.concat([newobs])}
}

hmm(4)
~~~

We can condition on some observed states:

~~~
//some true observations (the data we observe):
var trueobs = [false, false, false]

var arrayEq = function(a, b){
  return a.length == 0 ? true : a[0]==b[0] & arrayEq(a.slice(1), b.slice(1))
}

print(Enumerate(function(){
  var r = hmm(3)
  factor( arrayEq(r.observations, trueobs) ? 0 : -Infinity )
  return r.states
}, 100))
~~~

Notice that if we allow `Enumerate` only a few executions (the last argument) it will not find the correct state: it doesn't realize until 'the end' that the observations must match the `trueobs` and hence the hidden state is likely to have been `[false, false, false]`.

### The PCFG

The PCFG is very similar to the HMM, except it has an underlying tree (instead of linear) structure.

~~~
var transition = function(symbol) {
  var rules = {'start': {rhs: [['NP', 'V', 'NP'], ['NP', 'V']], probs: [0.4, 0.6]},
               'NP': {rhs: [['A', 'NP'], ['N']], probs: [0.4, 0.6]} }
  return rules[symbol].rhs[ discrete(rules[symbol].probs) ]
}

var preTerminal = function(symbol) {
  return symbol=='N' | symbol=='V' | symbol=='A'
}

var terminal = function(symbol) {
  var rules = {'N': {words: ['John', 'soup'], probs: [0.6, 0.4]},
               'V': {words: ['loves', 'hates', 'runs'], probs: [0.3, 0.3, 0.4]},
               'A': {words: ['tall', 'salty'], probs: [0.6, 0.4]} }
  return rules[symbol].words[ discrete(rules[symbol].probs) ]
}


var pcfg = function(symbol) {
  preTerminal(symbol) ? [terminal(symbol)] : expand(transition(symbol))
}

var expand = function(symbols) {
  if(symbols.length==0) {
    return []
  } else {
    var f = pcfg(symbols[0])
    return f.concat(expand(symbols.slice(1)))
  }
}


var arrayEq = function(a, b){
  return a.length == 0 ? true : a[0]==b[0] & arrayEq(a.slice(1), b.slice(1))
}

print(Enumerate(function(){
            var y = pcfg("start")
            factor(arrayEq(y.slice(0,2), ["tall", "John"]) ?0:-Infinity) //yield starts with "hi there"
            return y[2]?y[2]:"" //distribution on next word?
          }, 20))
~~~

This program computes the probability distribution on the next word of a sentence that starts 'tall John...'. It finds a few parses that start this way... but this grammar was specially chosen to place the highest probability on such sentences. Try looking for completions of 'salty soup...' and you will be less happy.


## Decomposing and interleaving factors

To see how we can provide evidence earlier in the execution for models such as the above, first consider a simpler model:

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

It is clear first of all that we can move the factor up, to the point when it's first dependency is bound. In general factor statements can be moved anywhere in the same control scope as they started (i.e. they must be reached in the same program executions and not cross a marginalization boundary). In this case:

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

But we can do much better by noticing that this factor can be broken into an equivalent two factors, and again one can be moves up:

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

Notice that this version will find the best execution very early!


### Exposing the intermediate state for HMM and PCFG

In order to apply the above tricks (decomposing and moving up factors) for the more complex models it helps to put them into a form that explicitly constructs the intermediate states.
This version of the HMM is equivalent to the earlier one, but recurses the other way, passing along the partial state sequences:

~~~
var hmmRecur = function(n, states, observations){
  var newstate = transition(states[0])
  var newobs = observe(newstate)
  var states = states.concat([newstate])
  var observations = observations.concat([newobs])
  return (n==1) ? {states: states, observations: observations} : 
                  hmmRecur(n-1,states,observations)
}

var hmm = function(n) {
  return hmmRecur(n,[true],[])
}

var trueobs = [false, false, false]

var arrayEq = function(a, b){
  return a.length == 0 ? true : a[0]==b[0] & arrayEq(a.slice(1), b.slice(1))
}

print(Enumerate(function(){
  var r = hmm(3)
  factor( arrayEq(r.observations, trueobs) ? 0 : -Infinity )
  return r.states
}, 100))
~~~

Similarly the PCFG can be written as:

~~~
var pcfg = function(symbol, yieldsofar) {
  return preTerminal(symbol) ? yieldsofar.concat([terminal(symbol)]) : expand(transition(symbol), yieldsofar)
}

var expand = function(symbols, yieldsofar) {
  return symbols.length==0 ? yieldsofar : expand(symbols.slice(1), pcfg(symbols[0], yieldsofar))
}


var arrayEq = function(a, b){
  return a.length == 0 ? true : a[0]==b[0] & arrayEq(a.slice(1), b.slice(1))
}

print(Enumerate(function(){
            var y = pcfg("start",[])
            factor(arrayEq(y.slice(0,2), ["tall", "John"]) ?0:-Infinity) //yield starts with "hi there"
            return y[2]?y[2]:"" //distribution on next word?
          }, 20))
~~~



### Incrementalizing the HMM and PCFG

We can now decompose and move factors. In the HMM we first observe that the factor `factor( arrayEq(r.observations, trueobs) ? 0 : -Infinity )` can be seen as `factor(r.observations[0]==trueobs[0] ? 0 : -Infinity); factor(r.observations[1]==trueobs[1] ? 0 : -Infinity); ...`. Then we observe that these factors can be moved 'up' into the recursion to give:

~~~
var trueobs = [false, false, false]

var hmmRecur = function(n, states, observations){
  var newstate = transition(states[0])
  var newobs = observe(newstate)
  factor(newobs==trueobs[observations.length] ? 0 : -Infinity)
  var states = states.concat([newstate])
  var observations = observations.concat([newobs])
  return (n==1) ? {states: states, observations: observations} : 
                  hmmRecur(n-1,states,observations)
}

var hmm = function(n) {
  return hmmRecur(n,[true],[])
}

print(Enumerate(function(){
  var r = hmm(3)
  return r.states
}, 100))
~~~

Try varying the number of executions explored, in this version and the original version, starting with just 1 and increasing... how do they differ?

(There are two more optimizations we could do: If we incorporate the factor when we actually sample newobs, then we would only try observations consistent with trueobs. To do so we need to marginalize out `observe(..)` (to get an immediate ERP sample) and then use `sampleWithFactor(..)` to simultaneously sample and incorporate the factor -- but we haven't implemented `sampleWithFactor` yet in WebPPL. Second, we could achieve dynamic programming by inserting additional marginal operators at the boundary of `hmmRecur`, and caching them.)


Similarly for the PCFG:

~~~
var pcfg = function(symbol, yieldsofar, trueyield) {
  if(preTerminal(symbol)){
    var t = terminal(symbol)
    if(yieldsofar.length < trueyield.length){
      factor(t==trueyield[yieldsofar.length] ?0:-Infinity)
    }
    return yieldsofar.concat([t])
  } else {
    return expand(transition(symbol), yieldsofar, trueyield) }
}

var expand = function(symbols, yieldsofar, trueyield) {
  return symbols.length==0 ? yieldsofar : expand(symbols.slice(1), pcfg(symbols[0], yieldsofar, trueyield), trueyield)
}

print(Enumerate(function(){
            var y = pcfg('start', [], ['tall', 'John'])
            return y[2]?y[2]:"" //distribution on next word?
          }, 20))
~~~



## Global factors: inserting canceling heuristic factors


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

This will work pretty much any time you have 'guesses' about what the final factor will be, while you are executing your program. Especially if these guesses improve incrementally and steadily. For an example of this technique, see the [vision example](vision.html).


