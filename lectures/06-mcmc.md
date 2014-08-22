---
layout: lecture
title: Markov Chain Monte Carlo
description: Trace-based implementation of MCMC.
---

A popular way to estimate a difficult distribution is to sample from it by constructing a random walk that will visit each state in proportion to it's probability -- this is called [Markov chain Monte Carlo](http://en.wikipedia.org/wiki/Markov_chain_Monte_Carlo). 

## A random walk over executions

Imagine doing a random walk around the space of execution traces of a computation. Before we worry about getting the right distribution, let's just make *any* random walk. To do so we will record the continuation at each `sample` call, making a trace of the computation. We can then generate a next computation by randomly choosing a choice and re-generating the computation from that point. Adapting the code we used for [enumeration](03-enumeration.html):

~~~
// language: javascript

///fold:
function cpsBinomial(k){
  _sample(
    function(a){
      _sample(
        function(b){
          _sample(
            function(c){
              k(a + b + c);
            },
            bernoulliERP, [0.5])
        },
        bernoulliERP, [0.5])
    }, 
    bernoulliERP, [0.5])
}
///

trace = []
iterations = 1000

//function _factor(s) { currScore += s}

function _sample(cont, erp, params) {
  var val = erp.sample(params)
  trace.push({k: cont, val: val,
              erp: erp, params: params})
  cont(val)
}

returnHist = {}

function exit(val) {
  returnHist[val] = (returnHist[val] || 0) + 1
  if( iterations > 0 ) {
    iterations -= 1
        
    //make a new proposal:
    var regenFrom = Math.floor(Math.random() * trace.length)
    var regen = trace[regenFrom]
    trace = trace.slice(0,regenFrom)
    
    _sample(regen.k, regen.erp, regen.params)
  }
}

function RandomWalk(cpsComp) {
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

RandomWalk(cpsBinomial)
~~~

We have successfully done a random walk around the space of executions... and it even matches the desired binomial distribution. However, we have not handled `factor` statements (or used the computation scores in any way). This will not match the desired distribution when the computation contains factors (or when the number of random choices may change across executions). The [Metropolis Hastings](http://en.wikipedia.org/wiki/Metropolis-Hastings_algorithm) algorithm gives a way to 'patch up' this random walk to get the right distribution.

Before we give the code, here's an example we'd like to compute:

~~~
var skewBinomial = function(){
  var a = sample(bernoulliERP, [0.5])
  var b = sample(bernoulliERP, [0.5])
  var c = sample(bernoulliERP, [0.5])
  factor( (a|b)?0:-1 )
  return a + b + c
}

print(Enumerate(skewBinomial))
~~~

Now the Metropolis-Hastings sampler: we add to the earlier algorithm a step which accepts or rejects the new state. The probability of acceptance is given by:

~~~
function MHacceptProb(trace, oldTrace, regenFrom){
  var fw = -Math.log(oldTrace.length)
  trace.slice(regenFrom).map(function(s){fw += s.choiceScore})
  var bw = -Math.log(trace.length)
  oldTrace.slice(regenFrom).map(function(s){bw += s.choiceScore})
  var acceptance = Math.min(1, Math.exp(currScore - oldScore + bw - fw))
  return acceptance
}
~~~

This somewhat opaque probability is constructed to guarantee that, in the limit, the random walk will sample from the desired distribution. The full algorithm:

~~~
// language: javascript

///fold:
function cpsSkewBinomial(k){
  _sample(
    function(a){
      _sample(
        function(b){
          _sample(
            function(c){
              _factor(
                function(){
                  k(a + b + c);
                },
                (a|b)?0:-1)
            },
            bernoulliERP, [0.5])
        },
        bernoulliERP, [0.5])
    }, 
    bernoulliERP, [0.5])
}
///

trace = []
oldTrace = []
currScore = 0
oldScore = -Infinity
oldVal = undefined
regenFrom = 0

iterations = 1000

function _factor(k,s) { 
  currScore += s
  k()
}

function _sample(cont, erp, params) {
  var val = erp.sample(params)
  var choiceScore = erp.score(params,val)
  trace.push({k: cont, score: currScore, choiceScore: choiceScore, val: val,
              erp: erp, params: params})
  currScore += choiceScore
  cont(val)
}

returnHist = {}

function MHacceptProb(trace, oldTrace, regenFrom){
  var fw = -Math.log(oldTrace.length)
  trace.slice(regenFrom).map(function(s){fw += s.choiceScore})
  var bw = -Math.log(trace.length)
  oldTrace.slice(regenFrom).map(function(s){bw += s.choiceScore})
  var acceptance = Math.min(1, Math.exp(currScore - oldScore + bw - fw))
  return acceptance
}

function exit(val) {
  if( iterations > 0 ) {
    iterations -= 1
    
    //did we like this proposal?
    var acceptance = MHacceptProb(trace, oldTrace, regenFrom)
    acceptance = oldVal==undefined ?1:acceptance //just for init
    if(!(Math.random()<acceptance)){
      //if rejected, roll back trace, etc:
      trace = oldTrace
      currScore = oldScore
      val = oldVal
    }
    
    //now add val to hist:
    returnHist[val] = (returnHist[val] || 0) + 1
        
    //make a new proposal:
    regenFrom = Math.floor(Math.random() * trace.length)
    var regen = trace[regenFrom]
    oldTrace = trace
    trace = trace.slice(0,regenFrom)
    oldScore = currScore
    currScore = regen.score
    oldVal = val
    
    _sample(regen.k, regen.erp, regen.params)
  }
}

function MH(cpsComp) {
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

MH(cpsSkewBinomial)
~~~


## Reusing more of the trace

Above we only reused the random choices made before the point of regeneration. It is generally better to make 'smaller' steps, reusing as many choices as possible. If we knew which sampled value was which, then we could look into the previous trace as the execution runs and reuse its values. That is, imagine that each call to `sample` was passed a (unique) name: `sample(name, erp, params)`. Then the sample function could try to look-up and reuse values:

~~~
function _sample(cont, name, erp, params, forceSample) {
  var prev = findChoice(oldTrace, name)
  var reuse = ! (prev==undefined | forceSample)
  var val = reuse ? prev.val : erp.sample(params) 
  var choiceScore = erp.score(params,val)
  trace.push({k: cont, score: currScore, choiceScore: choiceScore, val: val,
              erp: erp, params: params, name: name, reused: reuse})
  currScore += choiceScore
  cont(val)
}
~~~

Notice that, in addition to reusing existing sampled choices, we add the name and mark whether this choice has been sampled fresh. We must account for this in the MH acceptance calculation:

~~~
function MHacceptProb(trace, oldTrace, regenFrom){
  var fw = -Math.log(oldTrace.length)
  trace.slice(regenFrom).map(function(s){fw += s.reused?0:s.choiceScore})
  var bw = -Math.log(trace.length)
  oldTrace.slice(regenFrom).map(function(s){
    var nc = findChoice(trace, s.name)
    bw += (!nc || !nc.reused) ? s.choiceScore : 0  })
  var acceptance = Math.min(1, Math.exp(currScore - oldScore + bw - fw))
  return acceptance
}
~~~

Putting these pieces together (and adding names to the `_sample` calls in `cpsSkewBinomial`, under the fold):

~~~
// language: javascript

///fold:
function cpsSkewBinomial(k){
  _sample(
    function(a){
      _sample(
        function(b){
          _sample(
            function(c){
              _factor(
                function(){
                  k(a + b + c);
                },
                (a|b)?0:-1)
            }, 'alice',
            bernoulliERP, [0.5])
        }, 'bob',
        bernoulliERP, [0.5])
    }, 'andreas',
    bernoulliERP, [0.5])
}
///

trace = []
oldTrace = []
currScore = 0
oldScore = -Infinity
oldVal = undefined
regenFrom = 0

iterations = 1000

function _factor(k,s) { 
  currScore += s
  k()
}

function _sample(cont, name, erp, params, forceSample) {
  var prev = findChoice(oldTrace, name)
  var reuse = ! (prev==undefined | forceSample)
  var val = reuse ? prev.val : erp.sample(params) 
  var choiceScore = erp.score(params,val)
  trace.push({k: cont, score: currScore, choiceScore: choiceScore, val: val,
              erp: erp, params: params, name: name, reused: reuse})
  currScore += choiceScore
  cont(val)
}

function findChoice(trace, name) {
  for(var i = 0; i < trace.length; i++){
    if(trace[i].name == name){return trace[i]}
  }
  return undefined  
}

returnHist = {}

function MHacceptProb(trace, oldTrace, regenFrom){
  var fw = -Math.log(oldTrace.length)
  trace.slice(regenFrom).map(function(s){fw += s.reused?0:s.choiceScore})
  var bw = -Math.log(trace.length)
  oldTrace.slice(regenFrom).map(function(s){
    var nc = findChoice(trace, s.name)
    bw += (!nc || !nc.reused) ? s.choiceScore : 0  })
  var acceptance = Math.min(1, Math.exp(currScore - oldScore + bw - fw))
  return acceptance
}

function exit(val) {
  if( iterations > 0 ) {
    iterations -= 1
    
    //did we like this proposal?
    var acceptance = MHacceptProb(trace, oldTrace, regenFrom)
    acceptance = oldVal==undefined ?1:acceptance //just for init
    if(!(Math.random()<acceptance)){
      //if rejected, roll back trace, etc:
      trace = oldTrace
      currScore = oldScore
      val = oldVal
    }
    
    //now add val to hist:
    returnHist[val] = (returnHist[val] || 0) + 1
        
    //make a new proposal:
    regenFrom = Math.floor(Math.random() * trace.length)
    var regen = trace[regenFrom]
    oldTrace = trace
    trace = trace.slice(0,regenFrom)
    oldScore = currScore
    currScore = regen.score
    oldVal = val
    
    _sample(regen.k, regen.name, regen.erp, regen.params, true)
  }
}

function MH(cpsComp) {
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

MH(cpsSkewBinomial)
~~~

This version will now reuse most of the choices from the old trace in making a proposal. 

Unfortunately it is impractical to add names by hand to distinguish calls to sample; fortunately there is a way to do this automatically!


### The addressing transform

We can automatically transform programs such that a *stack address* is available at each point in the computation (Wingate, Stuhlmueller, Goodman, 2011). This is simple -- all we need to do is add a global initialization `var address = ""` to our program, and transform function applications and function calls:

Function expressions get an additional `address` argument:

~~~
// Before Addressing
function(x, y, ...){
  // body
}

// After Addressing
function(address, x, y, ...){
  AddressingTransform(body)
}
~~~

Function calls extend the address argument (without mutation):

~~~
// Before Addressing
f(x)

// After Addressing
f(address.concat('_1'), x);
~~~

Note that `'_1'` is an example of a unique symbol; we generate a different one for each syntactic function application.

The auto-updating form below shows the addressing transform that we actually use for WebPPL programs. Try it out:

<div id="namingTransform">
    <textarea id="namingInput">f(x)</textarea>
    <textarea id="namingOutput"></textarea>
</div>

WebPPL uses this addressing transform to make names available for MH. Overall, two transformations happen to the original program, in order to make information available to the probabilistic primitives: the naming transform makes stack-addresses available, and the CPS transform then makes continuations available. 

