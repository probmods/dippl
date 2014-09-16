---
layout: hidden
title: Coarse-to-Fine Inference
---

Let's think about how to build a coarse-to-fine model for a simple probabilistic program.

We would like to transform the model such that we sample in a coarse-to-fine manner without changing the overall distribution. If the model includes factors, we would like to apply coarsened versions of these factors early on when we sample at the coarse level, and cancel out these "heuristic" factors when we get to the fine-grained level.

## Abstract objects as distributions

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


## Abstract objects as symbols

Now let's think about how to build a coarse-to-fine program in a more direct style. Now, the values in the program are going to be the symbols returned by `abstractValue`, ERPs are split into a distribution on abstract values and a conditional distribution on concrete values given an abstract value, and deterministic primitives are lifted to stochastic functions on abstract values.

We start with an `abstractValue` map (previously, this was a function):

~~~~
var abstractValue = {
  1: "a",
  2: "a",
  3: "b",
  4: "b",
  5: "c",
  6: "c",
  7: "c",
  8: "c"
}
~~~~

Suppose we have a discrete ERP:

~~~~
var discreteSampler = function(vs, ps){
  return function(){
    var index = discrete(ps);
    return vs[index];
  };
};

var makeERP = function(ps, vs){
  return Enumerate(function(){return vs[discrete(ps)]});
}

var myERP = makeERP([.1, .2, .3, .4], [1, 2, 3, 4]);

print(myERP)
~~~~

Coarsening this ERP means splitting it into two parts: an unconditional sampler on abstract values and a conditional sampler on concrete values:

~~~~
///fold:
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

///

var indexOf = function(xs, x, j){
  var i = (j == undefined) ? 0 : j;
  if (xs[0] == x) {
    return i;
  } else {
    return indexOf(xs.slice(1), x, i+1);
  }
}

var coarsen = function(erp, abstractValue){

  // Get concrete values and probabilities
  
  var allVs = erp.support([]);
  var allPs = map(allVs, function(v){return Math.exp(erp.score([], v));});

  // Group distribution based on equivalence classes
  // implied by abstractValue function

  var groups = groupBy(
    function(vp1, vp2){
      return abstractValue[vp1[0]] == abstractValue[vp2[0]];
    },
    zip(allVs, allPs));
  
  var groupSymbols = map(
    groups,
    function(group){
      // group[0][0]: first value in group
      return abstractValue[group[0][0]]})

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
~~~~

We're now going to verify that chaining the two erps is equivalent to the original ERP.

Here is the original distribution:

~~~~
var myERP = makeERP([.1, .2, .3, .4], [1, 2, 3, 4]);

print(myERP)
~~~~

Here is the chained distribution:

~~~~
var abstractValue = {
  1: "a",
  2: "a",
  3: "b",
  4: "b",
  5: "c",
  6: "c",
  7: "c",
  8: "c"
}

var myERP = makeERP([.1, .2, .3, .4], [1, 2, 3, 4]);

var tmp = coarsen(myERP, abstractValue);

var myAbstractERP = tmp[0];
var getConcreteERP = tmp[1];

print(
  Enumerate(
    function(){
      var x = sample(myAbstractERP);
      var y = sample(getConcreteERP(x));
      return y
    }))
~~~~

Besides coarsening erps, we also need to lift primitive functions. 

We will face a choice here:

Suppose there are two erps with the same support, but different distributions. When we coarsened an erp, we used the erps particular distribution in the second step to concretize the abstract value.

When we get to a primitive function (which will now be lifted to a primitive function on abstract values), do we use this particular distribution, or do we associate with each abstract symbol a single distribution (e.g. maximum entropy) that we use at primitives?

Let's work out a particular example. Here is what our original (uncoarsened) program could look like:

~~~~
var abstractValue = {
  1: "a",
  2: "a",
  3: "b",
  4: "b",
  5: "c",
  6: "c",
  7: "c",
  8: "c"
}

var erp1 = makeERP([.1, .2, .3, .4], [1, 2, 3, 4]);
var erp2 = makeERP([.25, .25, .25, .25], [1, 2, 3, 4]);

var tmp1 = coarsen(erp1, abstractValue);
var abstractERP1 = tmp1[0];
var conditionalERP1 = tmp1[1];

var tmp2 = coarsen(erp2, abstractValue);
var abstractERP2 = tmp2[0];
var conditionalERP2 = tmp2[1];
~~~~

Now `abstractERP1` and `abstractERP2` operate on the same abstract values, but strictly speaking, they have different meanings, because they are going to be refined differently when they hit their corresponding conditional ERPs.

We could treat them differently at primitives as well, which would in effect mean that the two erps actually **don't** share abstract values.

This has the drawback that we need to learn the distributions for lifted primitives independently.

Let's think about a simpler, but more complete example:

~~~~
var erp1 = makeERP([.9, .1], [true, false]);
var erp2 = makeERP([.1, .9], [true, false]);

var newAbstractValue = {
  true: "a",
  false: "a"
}

var tmp1 = coarsen(erp1, newAbstractValue);
var abstractERP1 = tmp1[0];
var conditionalERP1 = tmp1[1];

var tmp2 = coarsen(erp2, newAbstractValue);
var abstractERP2 = tmp2[0];
var conditionalERP2 = tmp2[1];

var program = function(){

  var cX = abstractERP1();
  var cY = abstractERP2();  
  var cOut = cAnd(cX, cY);
  var cScore = cExpectation(cOut c? -1 : -2);
  factor(cScore);

  var x = conditionalERP1(cX);
  var y = conditionalERP2(cY);
  var out = and(x, y);
  var score = out ? -1 : -2;
  factor(score - cScore);

}
~~~~

At the point where we compute `cOut`, we need to get an abstract return value. This is easy because there is only a single abstract value, so the distribution is clear - this single value has probability 1.

At the point where we compute `cScore`, we need to turn `cOut` back into concrete Boolean values. What distribution do we use here? One option is to use a maximum entropy distribution (or other canonical choice). This will work fine, because we cancel out the coarse factor later on.

The example above doesn't address stochastic choice at primitive functions, so let's extend the example such that it does.

~~~~
var erp1 = makeERP([.9, .05, .05], [0, 1, 2]);
var erp2 = makeERP([.05, .05, .9], [0, 1, 2]);

var newAbstractValue = {
  0: "a",
  1: "b",
  2: "b"
}

var tmp1 = coarsen(erp1, newAbstractValue);
var abstractERP1 = tmp1[0];
var conditionalERP1 = tmp1[1];

var tmp2 = coarsen(erp2, newAbstractValue);
var abstractERP2 = tmp2[0];
var conditionalERP2 = tmp2[1];

var program = function(){

  var cX = abstractERP1();
  var cY = abstractERP2();  
  var cOut = cAnd(cX, cY);
  var cScore = cExpectation(cOut c? -1 : -2);
  factor(cScore);

  var x = conditionalERP1(cX);
  var y = conditionalERP2(cY);
  var out = and(x, y);
  var score = out ? -1 : -2;
  factor(score - cScore);

}
~~~~

Now it's less clear what should happen at `cAnd`. We get two abstract values (such as "a" and "b") and we need to stochastically sample an output value in the same domain. Actually, even here it is still relatively clear what should happen - we know that the first argument to `cAnd` is coming from `cX`, and that the second argument is coming from `cY`, and so we could concretize them according to their corresponding distributions. We could then apply the underlying concrete `and` functions to these concretized values, and go back to the abstract domain by grouping concrete values according to the abstraction function and choosing with the corresponding probabilities.

Let's briefly think about the question whether we should think about the same abstract symbols as denoting the same distributions on concrete values. My currently favored answer is: yes, for the purpose of running the abstract program, we should do exactly that. No, for the purpose of refining the abstract program to the concrete program, we should look at the actual conditional distributions.

Claim: If all the erps in the abstract program are independent, if the erps are factored such that we get back the original erps if chained together, and if we cancel out all abstract factors later on, we can do more or less whatever we want. In particular, we can associate fixed (e.g. maxent) distributions with abstract symbols for the purpose of lifting primitives. We can then independently solve the problem of what coarsenings (what `abstractValue` functions together with distributions on concrete symbols) work well.

(This may resolve the problem of what to do about images - if we can sample a coarse image, do whatever we want, including apply factors to it, and then later on refine and correct the factors.)

It may seem surprising that the particular choice of refinement distribution for the purpose of lifting doesn't matter for correctness. 

(Question for later: what about conditional erps in the concrete program?)

Let's make the example a little more complex, and then let's work it out in all detail.

~~~~
var erp1 = makeERP([.9, .05, .05], [0, 1, 2]);
var erp2 = makeERP([.05, .05, .9], [0, 1, 2]);
var erp3 = makeERP([.05, .2, .75], [0, 1, 2]);

var newAbstractValue = {
  0: "a",
  1: "b",
  2: "b"
}

var tmp1 = coarsen(erp1, newAbstractValue);
var abstractERP1 = tmp1[0];
var conditionalERP1 = tmp1[1];

var tmp2 = coarsen(erp2, newAbstractValue);
var abstractERP2 = tmp2[0];
var conditionalERP2 = tmp2[1];

var tmp3 = coarsen(erp3, newAbstractValue);
var abstractERP3 = tmp3[0];
var conditionalERP3 = tmp3[1];

var program = function(){

  var cX = abstractERP1();
  var cY = abstractERP2();  
  var cZ = abstractERP3();    

  var cOut1 = cOr(cX, cY);
  var cOut2 = cOr(cY, cZ);
  var cScore = cExpectation((cOut1 c& cOut2) c? -1 : -2);
  factor(cScore);

  var x = conditionalERP1(cX);
  var y = conditionalERP2(cY);
  var z = conditionalERP3(cZ);  
  var out1 = or(x, y);
  var out2 = or(y, z);  
  var score = (out1 & out2)  ? -1 : -2;
  factor(score - cScore);

}
~~~~

Now it's impossible for `cOr` to know the exact distribution its first argument was sampled from. All it knows is its abstract value, which is associated with a particular support on concrete values.

Okay, now that we have a sense for what the general approach should be, let's go back to the start and let's make it concrete.

Here is the program that we are going to try to coarsen:

~~~~
// Turn special operators into functions

var or = function(x, y){
  return x | y;
}

var and = function(x, y){
  return x & y;
}

var ternary = function(test, then, other){
  return test ? then : other;
}

// Construct random variables

var erp1 = makeERP([.9, .05, .05], [0, 1, 2]);
var erp2 = makeERP([.05, .05, .9], [0, 1, 2]);
var erp3 = makeERP([.05, .2, .75], [0, 1, 2]);

// Main program

var program = function(){

  var x = sample(erp1);
  var y = sample(erp2);
  var z = sample(erp3);
  var out1 = or(x, y);
  var out2 = or(y, z);  
  var score = ternary(and(out1, out2), -1, -2);
  factor(score);  
  return [x, y, z];
  
}

print(Enumerate(program));
~~~~

Let's write a lifting function that can make the primitives (`or`, `and`, `ternary`) operate on abstract values.

~~~~
var preImage = function(cV, allVs, abstractValue){
  if (allVs.length == 0) {
    return []
  } else {
    var remainder = preImage(cV, allVs.slice(1), abstractValue);
    if (cV == abstractValue[allVs[0]]) {
      return [allVs[0]].concat(remainder);
    } else {
      return remainder;
    }
  }
}

var maxEntERP = function(cV, abstractValue){
  var allVs = Object.keys(abstractValue);
  // get all values that map to cV
  var vs = preImage(cV, allVs, abstractValue);
  // return uniform distribution on these values
  return Enumerate(
    function(){
      return vs[randomInteger(vs.length)];
    });
}

// Do we really not need to marginalize here?

var lift1 = function(f, abstractValue){  
  return function(cX){
    var d1 = maxEntERP(cX, abstractValue); // could cache this
    var x = sample(d1);
    var out = f(x);
    return abstractValue[out];
  }
}

var lift2 = function(f, abstractValue){  
  return function(cX, cY){
    var d1 = maxEntERP(cX, abstractValue); // could cache this
    var d2 = maxEntERP(cY, abstractValue); // could cache this
    var x = sample(d1);
    var y = sample(d2);
    var out = f(x, y);
    return abstractValue[out];
  }
}

var lift3 = function(f, abstractValue){  
  return function(cX, cY, cZ){
    var d1 = maxEntERP(cX, abstractValue); // could cache this
    var d2 = maxEntERP(cY, abstractValue); // could cache this
    var d3 = maxEntERP(cZ, abstractValue); // could cache this
    var x = sample(d1);
    var y = sample(d2);
    var z = sample(d3);
    var out = f(x, y, z);
    return abstractValue[out];
  }
}

var abstractValue = {
  0: "a",
  1: "b",
  2: "b"
}

print(maxEntERP("b", abstractValue))
~~~~

Now we are ready to lift the primitives in the program above and build the coarse-to-fine model.

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

var coarsen = function(erp, abstractValue){

  // Get concrete values and probabilities
  
  var allVs = erp.support([]);
  var allPs = map(allVs, function(v){return Math.exp(erp.score([], v));});

  // Group distribution based on equivalence classes
  // implied by abstractValue function

  var groups = groupBy(
    function(vp1, vp2){
      return abstractValue[vp1[0]] == abstractValue[vp2[0]];
    },
    zip(allVs, allPs));
  
  var groupSymbols = map(
    groups,
    function(group){
      // group[0][0]: first value in group
      return abstractValue[group[0][0]]})

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

var preImage = function(cV, allVs, abstractValue){
  if (allVs.length == 0) {
    return []
  } else {
    var remainder = preImage(cV, allVs.slice(1), abstractValue);
    if (cV == abstractValue[allVs[0]]) {
      return [allVs[0]].concat(remainder);
    } else {
      return remainder;
    }
  }
}

var maxEntERP = function(cV, abstractValue){
  var allVs = Object.keys(abstractValue);
  // get all values that map to cV
  var vs = preImage(cV, allVs, abstractValue);
  // return uniform distribution on these values
  return Enumerate(
    function(){
      return vs[randomInteger(vs.length)];
    });
}

// Do we really not need to marginalize here?

var lift1 = function(f, abstractValue){  
  return function(cX){
    var d1 = maxEntERP(cX, abstractValue); // could cache this
    var x = sample(d1);
    var out = f(x);
    return abstractValue[out];
  }
}

var lift2 = function(f, abstractValue){  
  return function(cX, cY){
    var d1 = maxEntERP(cX, abstractValue); // could cache this
    var d2 = maxEntERP(cY, abstractValue); // could cache this
    var x = sample(d1);
    var y = sample(d2);
    var out = f(x, y);
    return abstractValue[out];
  }
}

var lift3 = function(f, abstractValue){  
  return function(cX, cY, cZ){
    var d1 = maxEntERP(cX, abstractValue); // could cache this
    var d2 = maxEntERP(cY, abstractValue); // could cache this
    var d3 = maxEntERP(cZ, abstractValue); // could cache this
    var x = sample(d1);
    var y = sample(d2);
    var z = sample(d3);
    var out = f(x, y, z);
    return abstractValue[out];
  }
}

///


// Abstraction map

var abstractValue = {
  "-2": -2,
  "-1": -1,    
  0: "a",
  1: "b",
  2: "b"
}


// Turn special operators into functions

var or = function(x, y){
  return (x | y) ? 1 : 0;
}

var and = function(x, y){
  return (x & y) ? 1 : 0;
}

var ternary = function(test, then, other){
  return test ? then : other;
}


// Coarsened primitives

var cOr = lift2(or, abstractValue);
var cAnd = lift2(and, abstractValue);
var cTernary = lift3(ternary, abstractValue);


// Random variables

var erp1 = makeERP([.9, .05, .05], [0, 1, 2]);
var erp2 = makeERP([.05, .05, .9], [0, 1, 2]);
var erp3 = makeERP([.05, .2, .75], [0, 1, 2]);


// Coarsened random variables

var tmp1 = coarsen(erp1, abstractValue);
var abstractERP1 = tmp1[0];
var conditionalERP1 = tmp1[1];

var tmp2 = coarsen(erp2, abstractValue);
var abstractERP2 = tmp2[0];
var conditionalERP2 = tmp2[1];

var tmp3 = coarsen(erp3, abstractValue);
var abstractERP3 = tmp3[0];
var conditionalERP3 = tmp3[1];


// Main program

var ctfProgram = function(){
  
  var cX = sample(abstractERP1);
  var cY = sample(abstractERP2);
  var cZ = sample(abstractERP3);  
  var cOut1 = cOr(cX, cY);
  var cOut2 = cOr(cY, cZ);  
  var cScore = cTernary(cAnd(cOut1, cOut2), 
                        abstractValue[-1], 
                        abstractValue[-2]);
  factor(cScore);

  var x = sample(conditionalERP1(cX));
  var y = sample(conditionalERP2(cY));
  var z = sample(conditionalERP3(cZ));
  var out1 = or(x, y);
  var out2 = or(y, z);  
  var score = ternary(and(out1, out2), -1, -2);
  factor(score - cScore);  
  return [x, y, z];

}

print(Enumerate(ctfProgram));
~~~~

This distribution is the same as the distribution induced by the concrete program.

Next steps:

- Think about what this approach looks like for programs with conditioned random variables
- Use hierarchical coarsening (more than two layers)
- Apply this approach to a image-based model (use downsampled images on coarse layers). Here, we likely won't be able to construct the maximum entropy distributions explicitly
- Write a program transform that automates the construction of the coarse-to-fine program. What does this look like for recursive programs such as the HMM?
