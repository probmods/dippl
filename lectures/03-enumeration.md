---
layout: lecture
title: Exploring the executions of a random computation
description: Coroutines, continuations, CPS, etc.
---

All inference techniques involve exploring the space of executions of a random computation in one way or another.

# Exploring a random computation

~~~
var binomial = function(){
    var a = sample(bernoulliERP, [0.5])
    var b = sample(bernoulliERP, [0.5])
    var c = sample(bernoulliERP, [0.5])
    return a + b + c
}

Enumerate(binomial)
~~~

We can view `sample` and `factor` as coroutines for exploring a computation, which are installed by an inference operator.

~~~
// language: javascript

function sample(erp, params) {
  return erp.support()[0]
}

function ExploreFirst(comp) {
  return comp()
}

var binomial = function(){
    var a = sample(bernoulliERP, [0.5])
    var b = sample(bernoulliERP, [0.5])
    var c = sample(bernoulliERP, [0.5])
    return a + b + c
}

ExploreFirst(binomial)
~~~

This set of functions does indeed coroutine back and forth between the binomial computation and the 'randomness handling' functions. 
However, it is only able to explore a single path through the computation.... What we would like to be able to do is 'return' from the `sample` function *multiple times* with different values, to se what will happen. We can't do this by an ordinary function return; we need an explicit handle to the return context, that is we need to reify the *future of the computation* from the return point. Such a reified computation future is called a **continuation**.

# Continuations

A continuation is a function that expresses "what to do next" with the value of a computation. In the following, we give a few examples of continuations in use and describe what continuation-passing style is. This exposition is partly based on the articles [By example: Continuation-passing style in JavaScript](http://matt.might.net/articles/by-example-continuation-passing-style/) and [How to compile with continuations](http://matt.might.net/articles/cps-conversion/) by Matt Might.

Consider a function `square` that takes a number and returns its square. We call this function with the number 3 and print the result:

~~~~
var square = function(x) {
  return x * x;
}

print(square(3))
~~~~

At the point in the computation where the function returns `3 * 3`, what is it that the computation "does next" with this value? In this case, we print it to the screen. When a computer executes this program, it knows this (has it stored on the stack), but this information is not explicitly available during the execution of the program. The continuation is a function that represents this information explicitly. **Continuation-passing style** (CPS) is a way of writing programs such that the current continuation is always explicitly available.

Let's rewrite the program above with an explicit continuation function `k`:

~~~~
var cpsSquare = function(k, x) {
  k(x * x);
}

cpsSquare(print, 3)
~~~~

Now, when we get to `return k(x * x)`, the variable `k` contains the function `print`, which is "what happens next" in the sense that we pass the value of `x * x` to this function instead of returning.

It is helpful to think that, in continuation-passing style, functions never return -- they only ever call continuations with the values that they would otherwise have returned.

Let's look at another example, the factorial function:

~~~~
var factorial = function(n) {
  if (n == 0) {
    return 1;
  } else {
    return factorial(n-1) * n;
  }
}

print(factorial(5))
~~~~

And in continuation-passing style:

~~~~
var cpsFactorial = function(k, n) {
  if (n == 0) {
    k(1);
  } else {
    cpsFactorial(
      function(x){ k(x * n) },
      n - 1);
  }
}

cpsFactorial(print, 5)
~~~~

Look at the `else` branch and note how continuation-passing style turns nested function applications "inside-out": in standard style, the product is on the outside and the result of the call to `factorial` is one of its arguments. In CPS, the call to `cpsFactorial` is on the outside, and it is its continuation argument that contains the information that the result of this function will be multiplied with `n`.

Compare to another way of writing the factorial function, the **tail-recursive** form. In this form, standard style and continuation-passing style are basically identical:

~~~~
// Standard version:

var factorial2 = function(n, a) {
  if (n == 0) {
    return a;
  } else {
    return factorial2(n-1, n*a);
  }
}


// CPS version:

var cpsFactorial2 = function(k, n, a) {
  if (n == 0) {
    k(a);
  } else {
    cpsFactorial2(k, n-1, n*a);
  }
}


print(factorial2(5, 1))

cpsFactorial2(print, 5, 1)
~~~~

A function is **tail-recursive** when the recursive call happens as the final action in a function, in which case it can happen without the function call stack growing. In continuation-passing style, there is no stack -- all functions are tail-recursive.

Continuation-passing style is useful because it allows us to manipulate the execution of the program in ways that would otherwise be difficult. For example, we can use CPS to implement exception handling.

Let's look at `cpsFactorial` again. Suppose we want to throw an error when `n < 0`. By "throw an error", we mean that we stop whatever computations we would have done next and instead pass control to an error handler. This is easy in continuation-passing style: since there is no implicit stack -- i.e. no computations waiting to be performed -- all we have to do is call an error continuation.

~~~~
var totalCpsFactorial = function(k, err, n) {
  if (n < 0) {
    err("cpsFactorial: n < 0!")
  } else if (n == 0) {
    k(1);
  } else {
    totalCpsFactorial(
      function(x){ k(x * n) },
      err,
      n - 1);
  }
}

var printError = function(x){
  print("Error: " + x);
}

totalCpsFactorial(print, printError, 5)
totalCpsFactorial(print, printError, -1)
~~~~

As a final example, let's write our earlier binomial function in CPS:

~~~
var CPSbinomial = function(){...}//TODO
~~~


# Coroutines: functions that receive continuations

Now we'll re-write the marginalization code above so that the `sample` coroutine gets the continuation of the point where it is called, and keeps going by calling this continuation (perhaps several times), rather than by returning in the usual way.

~~~
// language: javascript

unexploredFutures = []

function sample(cont, erp, params) {
  var sup = erp.support(params)
  sup.forEach(function(s){unexploredFutures.push(function(){cont(s)})})
  unexploredFutures.pop()()
}

returnVals = []

function exit(val) {
  returnVals.push(val)
  if( unexploredFutures.length > 0 ) {
    unexploredFutures.pop()()
  } 
}

function Explore(cpsComp) {
  cpsComp(exit)
  return returnVals
}

var CPSbinomial = function (k) {
  sample(function (a) {k(a);}, bernoulliERP, [0.5]);
} //FIXME
    
Explore(CPSbinomial)
~~~

The above code explores all the executions of the computation, but it doesn't keep track of probabilities. We can extend it by simply adding scores to the futures, and keeping track of the score of the execution we are currently working on. Because we only care about the total probability of all paths with a given return value, we combine them into a 'histogram' mapping return values to (un-normalized) probabilities.

~~~
// language: javascript

unexploredFutures = []
currScore = 0

function sample(cont, erp, params) {
  var sup = erp.support(params)
  sup.forEach(function(s){
  var newscore = currScore + erp.score(s,params);
  unexploredFutures.push({k: function(){cont(s)}, score: newscore})})
  runNext()
}

function runNext(){
  var next = unexploredFutures.pop()
  currscore = next.score
  next.k()}

returnHist = {}

function exit(val) {
  returnHist[val] = (returnHist[val] || 0) + Math.exp(currScore)
  if( unexploredFutures.length > 0 ) {runNext()}
}

function ExploreWeighted(cpsComp) {
  cpsComp(exit)
  return returnHist
}

var CPSbinomial = function (k) {
  sample(function (a) {k(a);}, bernoulliERP, [0.5]);
} //FIXME

ExploreWeighted(CPSbinomial)
~~~

Finally we need to deal with factor statements -- easy because they simply add a number to the current score -- and renormalize the final distribution.

~~~
// language: javascript

unexploredFutures = []
currScore = 0

function factor(s) { currScore += s}

function sample(cont, erp, params) {
  var sup = erp.support(params)
  sup.forEach(function(s){
    var newscore = currScore + erp.score(s,params);
    unexploredFutures.push({k: function(){cont(s)}, score: newscore})})
  runNext()
}

function runNext(){
  var next = unexploredFutures.pop()
  currscore = next.score
  next.k()}

returnHist = {}

function exit(val) {
  returnHist[val] = (returnHist[val] || 0) + Math.exp(currScore)
  if( unexploredFutures.length > 0 ) {runNext()}
}

function Marginalize(cpsComp) {
  cpsComp(exit)
  
  //normalize:
  var norm = 0
  for (var v in returnHist) {
    norm += returnHist[v];
  }
  for (var v in returnHist) {
    returnHist[v] = returnHist[v] / norm;
  }
  return returnHist
}

var CPSbinomial = function (k) {
  sample(function (a) {k(a);}, bernoulliERP, [0.5]);
} //FIXME

Marginalize(CPSbinomial)
~~~


## Continuation-passing transform

Program can automatically be transformed into continuation-passing style. Let's look at what a naive transformation looks like for function expressions, function application, and constants:

Function expressions take an additional argument, the continuation `k`:

~~~~
// Before CPS
function(x, y, ...){
  // body
}

// After CPS
function(k, x, y, ...){
  // cpsTransform(body, "k")
}
~~~~

Function applications are sequentialized---we first evaluate the (cps-transformed) operator and pass it to a (continuation) function; this function evaluates the (cps-transformed) argument and passes it to a (continuation) function; that function applies operator to operands, passing the current top-level continuation as an additional continuation argument `k`:

~~~~
// Before CPS
f(x)

// After CPS (when f and x are variables):
f(k, x)

// After CPS (when f and x are compound expressions):
cpsTransform(f, function(_f){
  cpsTransform(x, function(_x){
    _f(k, _x)
  })
})
~~~~

Constant values get passed to the current continuation:

~~~~
// Before CPS:
12

// After CPS (with top-level continuation k)
k(12)
~~~~

This is only a sketch. For a more detailed exposition, see [How to compile with continuations](http://matt.might.net/articles/cps-conversion/).


## CPS transform in action

The auto-updating form below shows the transform that we actually use for WebPPL programs. Try it out:

<div id="cpsTransform">
    <textarea id="cpsInput">1 + 2</textarea>
    <textarea id="cpsOutput"></textarea>
</div>



<!--
from notes: say that marginalization requires exploring the possible executions of the computation, draw an execution tree to give the idea that we can abstract away the deterministic parts (leaving those to the host language) and just focus on sample and factor. then give the idea of inference as a coroutine, where the computation calls the coroutine and then the coroutine returns back into the computation -- but if we want to explore multiple paths from a choice point we need to 'return' more than once. this leads us to continuations -- reifications of the future of a computation that let us 'return' to the choice point multiple times. then i'll show (a sketch of?) the forward sampling code to give an idea. this is the point where we then need to say something about how we make continuations available (CPS).
-->
