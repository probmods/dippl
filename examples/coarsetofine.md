---
layout: hidden
title: Coarse-to-Fine Inference
---

Let's think about how to build a coarse-to-fine model for a simple probabilistic program.

We would like to transform the model such that we sample in a coarse-to-fine manner without changing the overall distribution. If the model includes factors, we would like to apply coarsened versions of these factors early on when we sample at the coarse level, and cancel out these "heuristic" factors when we get to the fine-grained level.

Here is our (fine-grained) program:

~~~~
// Wrap arithmetic primitives so that they are real functions

var times = function(x, y) {
  return x * y;
};

var minus = function(x) {
  return -x;
};


// A simple discrete random variable

var discreteSampler = function(vs, ps){
  return function(){
    var index = discrete(ps);
    return vs[index];
  };
};

var values = [1, 2, 3, 4];
var probs  = [.1, .2, .3, .4];
var fooSampler = discreteSampler(values, probs);


// Main program

var foo = function() {
  var x = fooSampler();
  var score = minus(times(x, 2));
  factor(score);
  return x;
};

print(Enumerate(foo));
~~~~

Let's first write some general-purpose functions that will come in handy later on. These are standard functional programming tools.

~~~~
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
~~~~

We'll also need expectations (for erps) and delta distributions:

~~~~
var expectation = function(erp, f){
  return sum(
    map(
      erp.support([]),
      function(v){
        return Math.exp(erp.score([], v)) * f(v);
      }));
};

var mean = function(erp){
  return expectation(erp, function(x){return x;});
}

var delta = function(x) {
  return discreteSampler([x], [1]);
};
~~~~

Now let's think about how to coarsen a sampler given a value abstraction function. 

A value abstraction function sorts values into equivalence classes and looks like this:

~~~~
// static

var abstractValue = function(v){
  return {
    1: "a",
    2: "a",
    3: "b",
    4: "b"
  }[v];
};
~~~~

The function `coarsen` will take a sampler (a thunk that probabilistically returns a value) and will turn it into a hierarchical sampler (a thunk that probabilistically returns a sampler) by grouping values as determined by the value abstraction function.

The hierarchical sampler first chooses a base-level sampler (according to the sum of the probabilities of all elements that are in the corresponding group), then samples from the values in the group (with renormalized) probabilities:

~~~~
var coarsen = function(sampler, abstractValue){

  // Get sampler's distribution in explicit form
  
  var erp = Enumerate(sampler);
  var allVs = erp.support([]);
  var allPs = map(allVs, function(v){return Math.exp(erp.score([], v));});
  
  // Group distribution based on equivalence classes
  // implied by abstractValue function

  var groups = groupBy(
    function(vp1, vp2){
      return abstractValue(vp1[0]) == abstractValue(vp2[0]);
    },
    zip(allVs, allPs));

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

  // Construct hierarchical sampler
  
  var samplers = map2(groupedVs, groupedPs, discreteSampler);
  var samplerPs = map(groupedPs, sum);

  return discreteSampler(samplers, samplerPs);
};
~~~~

Given a coarsening function, we can now lift primitive functions to operate on coarsened (i.e. hierarchical) samplers.

The general principle is as follows:

1. Compute the fine-grained distribution on return values that results when the primitive function is applied to the distribution on fine-grained values that corresponds to the coarsened input value.
2. Coarsen this return distribution.

*However*, note that, in the implementation, we have to "flatten" the coarse input twice to get a concrete value. This is the case because, in our coarsened program, values will have been lifted to *distributions on distributions on values*.

To see why this is necessary, look at the return type for the lifting function: if we simply returned a sampler for `outputMarginal`, the return type would be a distribution on concrete values---there wouldn't be any clustering based on the abstraction function. If we coarsen this distribution, then the return value is of type "distribution on distributions [on concrete values]". In other words, the type is "distributions on abstract values".

It is worth thinking about whether this is the right type for the coarsened program, but it seems that this type plays nicer with lossy coarsenings (which aren't addressed in this note).

We'll write two separate versions of the lifting function here, one for primitives of one argument, and one for primitives that take two arguments.

~~~~
var lift1 = function(f, abstractValue){
  return function(coarseInput){
    var outputMarginal = Enumerate(
      function(){
        var d = coarseInput();
        var v = d();
        return f(v);
      });
    return coarsen(
      function(){ return sample(outputMarginal); },
      abstractValue);
  };
};

var lift2 = function(f, abstractValue){
  return function(coarseInput1, coarseInput2){
    var outputMarginal = Enumerate(
      function(){
        var d1 = coarseInput1();
        var d2 = coarseInput2();
        var v1 = d1();
        var v2 = d2();
        return f(v1, v2);
      });
    return coarsen(
      function(){ return sample(outputMarginal); },
      abstractValue);
  };
};
~~~~

Now let's wrap up our expectation function so that it can apply to coarse values (i.e. to distributions on distributions on concrete values):

~~~~
var cExpectation = function(cSampler, f){
  return expectation(
    Enumerate(function(){
                var d = cSampler();
                var x = d();
                return x;
              }),
    f);
};

var cMean = function(cSampler){
  return cExpectation(cSampler, function(x){return x;});
}
~~~~

With these preliminaries out of the way, we can now pick an abstraction function and write our coarse-to-fine model.

The abstraction function simply groups values into equivalence classes. We arbitrarily pick this one:

~~~~
var abstractValue = function(v){
  return {
    1: "a",
    2: "a",
    3: "b",
    4: "b",
    5: "c",
    6: "c",
    7: "c",
    8: "c"
  }[v];
};
~~~~

The coarse-to-fine model consists of two parts, a coarse part and a fine part. We first sample and score (using factors) on the coarse level, then refine to the concrete level and adjusts the score.

The coarse part operates on distributions on distributions on concrete values. We coarsen random variables (here: `fooSampler` becomes `cFooSampler`) and lift primitive functions (`times`, `minus`) to operate on coarse values.

~~~~
// Data from original program

var values = [1, 2, 3, 4];
var probs  = [.1, .2, .3, .4];
var fooSampler = discreteSampler(values, probs);


// Coarse-to-fine program

var cFooSampler = coarsen(fooSampler, abstractValue);
var cTimes = lift2(times, abstractValue);
var cMinus = lift1(minus, abstractValue);

var ctfFoo = function() {

  var cX = delta(cFooSampler());
  var cY = cMinus(cTimes(cX, delta(delta(2))));
  var cScore = cMean(cY);
  factor(cScore);

  var x = cX()();
  var score = minus(times(x, 2));
  factor(score - cScore);
  return x;

};

print(Enumerate(ctfFoo));
~~~~

Note that the distribution on return values is exactly the same as for the original program.

Open questions:

- Is "distributions on distributions on fine-grained values" a good type for the coarse program?
- How can we apply this approach to images and similar settings where (a) it is difficult to keep track of distributions on objects and (b) we might therefore want to just use coarse-grained objects (such as downsampled images) directly, and apply primitive operations directly?
- What does a program transform look that makes it feasible to apply this approach to more complex programs? For example, think of recursive programs like the HMM.
- How can we extend this approach to play nicely with hierarchical coarsening?
- How useful/efficient is this in general? In this example, we use enumeration and don't use any caching. In real-world examples, we might have to use sampling, and most likely would need to use caching in various places.
