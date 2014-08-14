---
layout: lecture
title: Co-routines 
description: Co-routines, CPS, etc.
---

All inference techniques involve exploring the space of executions of a random computation in one way or another.

# Coroutines

~~~
var binomial = function(){
    var a = sample(bernoulliERP, [0.5])
    var b = sample(bernoulliERP, [0.5])
    var c = sample(bernoulliERP, [0.5])
    return a + b + c}

Enumerate(binomial)
~~~

We can view `sample` and `factor` as coroutines for exploring a computation, which are installed by an inference operator.

~~~.js

function sample(erp, params) {
  return erp.support()[0]
}

function Marginalize(comp) {
  return comp()
}

var binomial = function(){
    var a = sample(bernoulliERP, [0.5])
    var b = sample(bernoulliERP, [0.5])
    var c = sample(bernoulliERP, [0.5])
    return a + b + c}

Marginalize(binomial)
~~~

This set of functions does indeed coroutine back and forth between the binomial computation and the 'randomness handling' functions. 
However, it is only able to explore a single path through the computation.... What we would like to be able to do is 'return' from the `sample` function *multiple times* with different values, to se what will happen. We can't do this by an ordinary function return; we need an explicit handle to the return context, that is we need to reify the *future of the computation* from the return point. Such a reified computation future is called a **continuation**.

# Continuations

Before we use continuations to implement inference, let's get some intuition for continuations.


# Coroutines that receive continuations

Now we'll re-write the marginalization code above so that the `sample` coroutine gets the continuation of the point where it is called, and keeps going by calling this continuation (perhaps several times), rather than by returning in the usual way.

~~~.js

futures_unexplored = []

function sample(cont, erp, params) {
  var sup = erp.support()
  sup.foreach(function(s){futures_unexplored.push(function(){cont(s)})})
  futures_unexplored.pop()()
}

return_vals = []
function exit(val) {
  return_vals.push(val)
  if( futures_unexplored.length > 0 ) {
    futures_unexplored.pop()()
  } 
}

function Marginalize(comp) {
  exit(comp())
  return return_vals
}

var binomial = function(){
    var a = callcc(sample, bernoulliERP, [0.5])
    var b = callcc(sample, bernoulliERP, [0.5])
    var c = callcc(sample, bernoulliERP, [0.5])
    return a + b + c}

Marginalize(binomial)
~~~


from notes: say that marginalization requires exploring the possible executions of the computation, draw an execution tree to give the idea that we can abstract away the deterministic parts (leaving those to the host language) and just focus on sample and factor. then give the idea of inference as a coroutine, where the computation calls the coroutine and then the coroutine returns back into the computation -- but if we want to explore multiple paths from a choice point we need to 'return' more than once. this leads us to continuations -- reifications of the future of a computation that let us 'return' to the choice point multiple times. then i'll show (a sketch of?) the forward sampling code to give an idea. this is the point where we then need to say something about how we make continuations available (CPS).
