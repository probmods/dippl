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
var compose = function(f, g){
  return function(x){
    return f(g(x));
  };
};
~~~~

We'll also need expectations (for erps) and delta distributions:

~~~~
var expectation = function(erp, f){
  return sum(
    map(function(v){ return Math.exp(erp.score([], v)) * f(v); },
        erp.support([])));
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
  var allPs = map(function(v){return Math.exp(erp.score([], v))}, allVs);

  // Group distribution based on equivalence classes
  // implied by abstractValue function

  var groups = groupBy(
    function(vp1, vp2){
      return abstractValue(vp1[0]) == abstractValue(vp2[0]);
    },
    zip(allVs, allPs));

  var groupedVs = map(function(group){return map(group, first)}, groups);

  var groupedPs = map(function(group){return map(group, second)}, groups);

  // Construct hierarchical sampler

  var samplers = map2(discreteSampler, groupedVs, groupedPs);
  var samplerPs = map(sum, groupedPs);

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
var compose = function(f, g){
  return function(x){
    return f(g(x));
  };
};
///

var coarsen = function(erp, abstractValue){

  // Get concrete values and probabilities

  var allVs = erp.support([]);
  var allPs = map(function(v){return Math.exp(erp.score([], v));}, allVs);

  // Group distribution based on equivalence classes
  // implied by abstractValue function

  var groups = groupBy(
    function(vp1, vp2){
      return abstractValue[vp1[0]] == abstractValue[vp2[0]];
    },
    zip(allVs, allPs));

  var groupSymbols = map(
    function(group){
      // group[0][0]: first value in group
      return abstractValue[group[0][0]]},
    groups);

  var groupedVs = map(
    function(group){
      return map(group, first);},
	groups);

  var groupedPs = map(
    function(group){
      return map(group, second);},
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

var compose = function(f, g){
  return function(x){
    return f(g(x));
  };
};

var coarsen = function(erp, abstractValue){

  // Get concrete values and probabilities

  var allVs = erp.support([]);
  var allPs = map(function(v){return Math.exp(erp.score([], v));}, allVs);

  // Group distribution based on equivalence classes
  // implied by abstractValue function

  var groups = groupBy(
    function(vp1, vp2){
      return abstractValue[vp1[0]] == abstractValue[vp2[0]];
    },
    zip(allVs, allPs));

  var groupSymbols = map(
    function(group){
      // group[0][0]: first value in group
      return abstractValue[group[0][0]]},
	groups)

  var groupedVs = map(function(group){return map(group, first);}, groups);

  var groupedPs = map(function(group){return map(group, second);}, groups);

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

## Dependent random variables

### Direct dependencies

For direct dependencies, I think I can work out what the distribution for the final dependent random variable must look like (basically, the abstract value constrains the concrete value to a set, and the concrete independent parameter determines the distribution on this set).

Let's do this first, since we are going to need it for the more complex case of indirect dependencies where deterministic functions can transform parameters before they hit the next random variable.

Here is a simple program with conditioned random variables:

~~~~
///fold:
var ternary = function(test, then, other){
  return test ? then : other;
}

var plus = function(x, y){
  return x + y;
}

var makeERP = function(ps, vs){
  return Enumerate(function(){return vs[discrete(ps)]});
}
///

var chooseP = makeERP([.25, .25, .25, .25], [.1, .2, .4, .7])

var program = function(){
  var p0 = sample(chooseP);
  var y = flip(p0);
  var score = ternary(y, -1, -2);
  factor(score);
  return y;
}

print(Enumerate(program))
~~~~

Coarsening for dependent ERPs:

~~~~
var instantiate = function(cV, abstractValue){
  var allVs = Object.keys(abstractValue);
  var vs = preImage(cV, allVs, abstractValue);
  return vs[randomInteger(vs.length)];
}

var coarsenDependentERP = function(depERP, abstractValue){

  // The params are coarse-grained values. However,
  // we need fine-grained parameter values to construct
  // a real ERP. This can be achieved through sampling or
  // marginalizing. We'll marginalize.
  var getCoarseERP = function(params){
    return Enumerate(
      function(){
        var fineParams = map(
          function(cV){return instantiate(cV, abstractValue);},
		  params);
        return abstractValue[sample(depERP, fineParams)];
      });
  };

  // Now params are fine-grained values, so we can build a
  // concrete independent erp; we just need to restrict the
  // support to values in the support of coarseValue.
  var getFineERP = function(params, coarseValue){
    return Enumerate(
      function(){
        var value = sample(depERP, params);
        factor((abstractValue[value] == coarseValue) ? 0 : -Infinity);
        return value;
      });
  };

  return [getCoarseERP, getFineERP];
}
~~~~

Now let's try to write the corresponding coarse-to-fine program.

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

var coarsen = function(erp, abstractValue){

  // Get concrete values and probabilities

  var allVs = erp.support([]);
  var allPs = map(function(v){return Math.exp(erp.score([], v));}, allVs);

  // Group distribution based on equivalence classes
  // implied by abstractValue function

  var groups = groupBy(
    function(vp1, vp2){
      return abstractValue[vp1[0]] == abstractValue[vp2[0]];
    },
    zip(allVs, allPs));

  var groupSymbols = map(
    function(group){
      // group[0][0]: first value in group
      return abstractValue[group[0][0]]},
	groups)

  var groupedVs = map(
    function(group){
      return map(group, first);},
	groups);

  var groupedPs = map(
    function(group){
      return map(group, second);},
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


// Coarsening for dependent ERPs

var instantiate = function(cV, abstractValue){
  var allVs = Object.keys(abstractValue);
  var vs = preImage(cV, allVs, abstractValue);
  return vs[randomInteger(vs.length)];
}

var coarsenDependentERP = function(depERP, abstractValue){

  // The params are coarse-grained values. However,
  // we need fine-grained parameter values to construct
  // a real ERP. This can be achieved through sampling or
  // marginalizing. We'll marginalize.
  var getCoarseERP = function(params){
    return Enumerate(
      function(){
        var fineParams = map(
          function(cV){return instantiate(cV, abstractValue);},
		  params);
        return abstractValue[sample(depERP, fineParams)];
      });
  };

  // Now params are fine-grained values, so we can build a
  // concrete independent erp; we just need to restrict the
  // support to values in support of coarseValue.
  var getFineERP = function(params, coarseValue){
    return Enumerate(
      function(){
        var value = sample(depERP, params);
        factor((abstractValue[value] == coarseValue) ? 0 : -Infinity);
        return value;
      });
  };

  return [getCoarseERP, getFineERP];
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

// Turn special operators into functions

var ternary = function(test, then, other){
  return test ? then : other;
}


///


// Abstraction map

var abstractValue = {
  .1: "a",
  .2: "a",
  .3: "a",
  .4: "a",
  .5: "b",
  .6: "b",
  .7: "b",
  .8: "b",
  true: "c",
  false: "c",
  "-1": -1,
  "-2": -2
}


// Coarsened primitives

var cTernary = lift3(ternary, abstractValue);


// Random variables

var chooseP = makeERP([.25, .25, .25, .25], [.1, .2, .4, .7])
var coin = bernoulliERP;


// Coarsened random variables

var tmp1 = coarsen(chooseP, abstractValue);
var coarseChooseP = tmp1[0];
var fineChooseP = tmp1[1];

var tmp2 = coarsenDependentERP(coin, abstractValue);
var getCoarseCoin = tmp2[0];
var getFineCoin = tmp2[1];


// Main program

var ctfProgram = function(){

  // Coarse program

  var cP0 = sample(coarseChooseP);
  var coarseCoin = getCoarseCoin([cP0]);
  var cY = sample(coarseCoin);
  var cScore = cTernary(cY, abstractValue[-1], abstractValue[-2]);
  factor(cScore);

  // Fine program

  var p0 = sample(fineChooseP(cP0));
  var fineCoin = getFineCoin([p0], cY);
  var y = sample(fineCoin);
  var score = ternary(y, -1, -2);
  factor(score - cScore);
  return y;
}

print(Enumerate(ctfProgram))
~~~~

Next steps:

- Prove that this is always correct
- Indirect dependencies (where the erp parameter is transformed by a deterministic function first)


## Dependent random variables, revisited

I believe that the approach described in the previous section doesn't work in general. However, so far, I don't know yet why exactly that is. So, let's proceed as follows:

1. Create a new fine-grained program
2. Apply previous approach, see where it fails
3. Apply new factor decomposition approach
4. Consider optimizations for factor decomposition approach

### The fine-grained program

I think the previous fine-grained program was too simplistic to thoroughly test coarsening of dependent erps. In particular, on the coarse level, the dependent erp was a delta distribution. Let's try to write a more complex program, maybe reminiscent of how HMM states are sampled depending on the previous state.

~~~~
///fold:
var ternary = function(test, then, other){
  return test ? then : other;
}

var plus = function(x, y){
  return x + y;
}

var makeERP = function(ps, vs){
  return Enumerate(function(){return vs[discrete(ps)]});
}
///


var erp0 = makeERP([.1, .2, .3, .4], ["a", "b", "c", "d"]);

// could replace this with a real dependent erp
var erp1 = function(x){
  var dists = {
    "a" : [.25, .25, .25, .25],
    "b" : [.1, .2, .3, .4],
    "c" : [.2, .2, .3, .3],
    "d" : [.01, .1, .5, .39]
  };
  var vs = ["e", "f", "g", "h"];
  var dist = dists[x];
  var i = discrete(dist);
  return vs[i];
}

var scores = {
  "e" : -1,
  "f" : -1.5,
  "g" : -2,
  "h" : -2.5
}

var getScore = function(x){
  return scores[x];
}

var program = function(){
  var x = sample(erp0);
  var y = erp1(x);
  var score = getScore(y);
  factor(score);
  return y;
}

print(Enumerate(program))

~~~~

### Coarsening using the previous approach

Now let's coarsen this program using the previous approach. Recall that the previous approach worked as follows:

~~~~
var instantiate = function(cV, abstractValue){
  var allVs = Object.keys(abstractValue);
  var vs = preImage(cV, allVs, abstractValue);
  return vs[randomInteger(vs.length)];
}

var coarsenDependentERP = function(depERP, abstractValue){

  // The params are coarse-grained values. However,
  // we need fine-grained parameter values to construct
  // a real ERP. This can be achieved through sampling or
  // marginalizing. We'll marginalize.
  var getCoarseERP = function(params){
    return Enumerate(
      function(){
        var fineParams = map(
          function(cV){return instantiate(cV, abstractValue);},
		  params);
        return abstractValue[sample(depERP, fineParams)];
      });
  };

  // Now params are fine-grained values, so we can build a
  // concrete independent erp; we just need to restrict the
  // support to values in the support of coarseValue.
  var getFineERP = function(params, coarseValue){
    return Enumerate(
      function(){
        var value = sample(depERP, params);
        factor((abstractValue[value] == coarseValue) ? 0 : -Infinity);
        return value;
      });
  };

  return [getCoarseERP, getFineERP];
}
~~~~

In words:

1. Take the dependent ERP and a value partitioning function
2. Compute the coarse erp for an abstract (parameter) value V by:
    1. sampling uniformly from the possible fine-grained instantiations of V
    2. sampling from the fine-grained dependent erp using the sampled instantiation
    3. returning the abstract value corresponding to the sampled instantiation
3. Compute the fine-grained erp for a concrete (parameter) value v, and coarse return value X by:
    1. sampling from the fine-grained dependent erp given parameter v
    2. conditioning on the abstraction of this sampled value being equal to X

Where is the problem (if any)?

My guess is that the problem comes in when we uniformly sample an instantiation for the abstract value V at the coarse ERP.

~~~~
// static
// p(fine1, fine2)
// = p(coarse1)p(fine1|coarse1) p(fine2|fine1) // so far so good
// = p(coarse1)p(fine1|coarse1) p(coarse2|coarse1) p(fine2|coarse2, fine1)
~~~~

In other words, the problem comes in when we sample `coarse2|coarse1`. My hunch is that we would need to know which erp `coarse1` comes from, so that we can use the "true" instantiation probabilities instead of the uniform instantiation probabilities.

Let's verify whether this is actually a problem by applying this approach to the model above.

~~~~
///fold:
var ternary = function(test, then, other){
  return test ? then : other;
}

var plus = function(x, y){
  return x + y;
}

var makeERP = function(ps, vs){
  return Enumerate(function(){return vs[discrete(ps)]});
}


// Utils

var compose = function(f, g){
  return function(x){
    return f(g(x));
  };
};

// Coarsening

var coarsen = function(erp, abstractValue){

  // Get concrete values and probabilities

  var allVs = erp.support([]);
  var allPs = map(function(v){return Math.exp(erp.score([], v));}, allVs);

  // Group distribution based on equivalence classes
  // implied by abstractValue function

  var groups = groupBy(
    function(vp1, vp2){
      return abstractValue[vp1[0]] == abstractValue[vp2[0]];
    },
    zip(allVs, allPs));

  var groupSymbols = map(
    function(group){
      // group[0][0]: first value in group
      return abstractValue[group[0][0]]},
	groups)

  var groupedVs = map(
    function(group){
      return map(group, first);
      },
	groups);

  var groupedPs = map(
    function(group){
      return map(group, second);
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


// Coarsening for dependent erps

var instantiate = function(cV, abstractValue){
  var allVs = Object.keys(abstractValue);
  var vs = preImage(cV, allVs, abstractValue);
  console.log(cV);
  return vs[randomInteger(vs.length)];
}

var coarsenDependentERP = function(depERPfunc, abstractValue){

  // The params are coarse-grained values. However,
  // we need fine-grained parameter values to construct
  // a real ERP. This can be achieved through sampling or
  // marginalizing. We'll marginalize.
  var getCoarseERP = function(cV){
    return Enumerate(
      function(){
        var fineParams = instantiate(cV, abstractValue);
        return abstractValue[depERPfunc(fineParams)];
      });
  };

  // Now params are fine-grained values, so we can build a
  // concrete independent erp; we just need to restrict the
  // support to values in the support of coarseValue.
  var getFineERP = function(params, coarseValue){
    return Enumerate(
      function(){
        var value = depERPfunc(params);
        factor((abstractValue[value] == coarseValue) ? 0 : -Infinity);
        return value;
      });
  };

  return [getCoarseERP, getFineERP];
}



// Lifting

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



// Base-level erps

var erp0 = makeERP([.1, .2, .3, .4], ["a", "b", "c", "d"]);

var erp1 = function(x){
  var dists = {
    "a" : [.25, .25, .25, .25],
    "b" : [.1, .2, .3, .4],
    "c" : [.2, .2, .3, .3],
    "d" : [.01, .1, .5, .39]
  };
  var vs = ["e", "f", "g", "h"];
  var dist = dists[x];
  var i = discrete(dist);
  return vs[i];
}

// Base-level functions

var scores = {
  "e" : -1,
  "f" : -1.5,
  "g" : -2,
  "h" : -2.5
}

var getScore = function(x){
  return scores[x];
}


// Abstraction map

var abstractValue = {
  "a": 1,
  "b": 1,
  "c": 2,
  "d": 2,
  "e": 3,
  "f": 3,
  "g": 4,
  "h": 4,
  "-1": -1,
  "-1.5": -1.5,
  "-2": -2,
  "-2.5": -2.5
}


// Coarse erps

var tmp1 = coarsen(erp0, abstractValue);
var cErp0 = tmp1[0];
var fErp0 = tmp1[1];

var tmp2 = coarsenDependentERP(erp1, abstractValue);
var cErp1 = tmp2[0];
var fErp1 = tmp2[1];

// Lift primitive

var cGetScore = lift1(getScore, abstractValue);


var program = function(){

  var cX = sample(cErp0);
  var cY = sample(cErp1(cX));
  var cScore = cGetScore(cY);
  factor(cScore);

  var x = sample(fErp0(cX));
  var y = sample(fErp1(x, cY));
  var score = getScore(y);
  factor(score - cScore);
  return y;
}

print(Enumerate(program))

~~~~

Yep, the distribution is in fact different from the distribution we would expect.

### Coarsening using factor decomposition

To make the distributions work out, we'll now apply a different approach:

1. Rewrite the (fine-grained) program such that all erps are independent, and such that dependencies are only introduced using factors.
2. Coarsen the decomposed program using the coarsening for independent erps that we know works.

Here is the fine-grained program in factor decomposition form:

~~~~
///fold:
var ternary = function(test, then, other){
  return test ? then : other;
}

var plus = function(x, y){
  return x + y;
}

var makeERP = function(ps, vs){
  return Enumerate(function(){return vs[discrete(ps)]});
}
///


// Random variables

var erp0 = makeERP([.1, .2, .3, .4], ["a", "b", "c", "d"]);
var erp1maxent = makeERP([.25, .25, .25, .25], ["e", "f", "g", "h"]);


// Primitive functions

var getErp1MaxEntScore = function(y){
  return erp1maxent.score([], y);
}

var erp1 = function(x){
  var dists = {
    "a" : [.25, .25, .25, .25],
    "b" : [.1, .2, .3, .4],
    "c" : [.2, .2, .3, .3],
    "d" : [.01, .1, .5, .39]
  };
  var vs = ["e", "f", "g", "h"];
  var dist = dists[x];
  return makeERP(dist, vs);
}

var getErp1Score = function(x, y){
  return erp1(x).score([], y);
}

var getFactorScore = function(y){
  var scores = {
    "e" : -1,
    "f" : -1.5,
    "g" : -2,
    "h" : -2.5
  }
  return scores[y];
}


// Model

var program = function(){
  var x = sample(erp0);
  var y = sample(erp1maxent);
  var score1 = getErp1Score(x, y) - getErp1MaxEntScore(y);
  factor(score1);
  var score2 = getFactorScore(y);
  factor(score2);
  return y;
}

print(Enumerate(program))
~~~~

Note that the distribution is the same as for the original program.

Now that the program only contains independent erps and factors, we can compute the corresponding coarse-to-fine program:

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

var coarsen = function(erp, abstractValue){

  // Get concrete values and probabilities

  var allVs = erp.support([]);
  var allPs = map(function(v){return Math.exp(erp.score([], v));}, allVs);

  // Group distribution based on equivalence classes
  // implied by abstractValue function

  var groups = groupBy(
    function(vp1, vp2){
      return abstractValue[vp1[0]] == abstractValue[vp2[0]];
    },
    zip(allVs, allPs));

  var groupSymbols = map(
    function(group){
      // group[0][0]: first value in group
      return abstractValue[group[0][0]]},
	groups)

  var groupedVs = map(
    function(group){
      return map(group, first);
      },
	groups);

  var groupedPs = map(
    function(group){
      return map(group, second);
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

var contains = function(lst, val){
  if (lst.length == 0) {
    return false;
  } else {
    if (lst[0] == val){
      return true;
    } else {
      return contains(lst.slice(1), val)
    }
  }
}

// Do we really not need to marginalize here?

var lift1 = function(f, abstractValue){
  return function(cX){
    var d1 = maxEntERP(cX, abstractValue); // could cache this
    var x = sample(d1);
    var out = f(x);
    if (contains(Object.keys(abstractValue), out)){
      return abstractValue[out];
    } else {
      return out
    }
  }
}

var lift2 = function(f, abstractValue){
  return function(cX, cY){
    var d1 = maxEntERP(cX, abstractValue); // could cache this
    var d2 = maxEntERP(cY, abstractValue); // could cache this
    var x = sample(d1);
    var y = sample(d2);
    var out = f(x, y);
    if (contains(Object.keys(abstractValue), out)){
      return abstractValue[out];
    } else {
      return out
    }
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
  "a": 1,
  "b": 1,
  "c": 2,
  "d": 2,
  "e": 3,
  "f": 3,
  "g": 4,
  "h": 4,
  "-1": -1,
  "-1.5": -1.5,
  "-2": -2,
  "-2.5": -2.5
}


// Random variables

var erp0 = makeERP([.1, .2, .3, .4], ["a", "b", "c", "d"]);
var erp1maxent = makeERP([.25, .25, .25, .25], ["e", "f", "g", "h"]);


// Coarsened random variables

var tmp0 = coarsen(erp0, abstractValue);
var cErp0 = tmp0[0];
var fErp0 = tmp0[1];

var tmp1 = coarsen(erp1maxent, abstractValue);
var cErp1 = tmp1[0];
var fErp1 = tmp1[1];


// Primitive functions

var getErp1MaxEntScore = function(y){
  return erp1maxent.score([], y);
}

var erp1 = function(x){
  var dists = {
    "a" : [.25, .25, .25, .25],
    "b" : [.1, .2, .3, .4],
    "c" : [.2, .2, .3, .3],
    "d" : [.01, .1, .5, .39]
  };
  var vs = ["e", "f", "g", "h"];
  var dist = dists[x];
  return makeERP(dist, vs);
}

var getErp1Score = function(x, y){
  return erp1(x).score([], y);
}

var getFactorScore = function(y){
  var scores = {
    "e" : -1,
    "f" : -1.5,
    "g" : -2,
    "h" : -2.5
  }
  return scores[y];
}


// Coarsened primitives

var cGetErp1MaxEntScore = lift1(getErp1MaxEntScore, abstractValue);
var cGetErp1Score = lift2(getErp1Score, abstractValue);
var cGetFactorScore = lift1(getFactorScore, abstractValue);


// Model

var program = function(){
  var cX = sample(cErp0);
  var cY = sample(cErp1);
  var cScore1 = cGetErp1Score(cX, cY) - cGetErp1MaxEntScore(cY);
  factor(cScore1);
  var cScore2 = cGetFactorScore(cY);
  factor(cScore2);

  var x = sample(fErp0(cX));
  var y = sample(fErp1(cY));
  var score1 = getErp1Score(x, y) - getErp1MaxEntScore(y);
  factor(score1 - cScore1);
  var score2 = getFactorScore(y);
  factor(score2 - cScore2);
  return y;
}

print(Enumerate(program))
~~~~

FIXME: The abstraction for lifting is currently the identity for values that are not in the `abstractValue` table; this could easily lead to problems. We might want to consider special-casing scores.

The approach above will also work for indirect dependencies (i.e. dependencies that go through some intermediate function), since such programs can be desugared to independent random variables + factors in the same way.

Next steps:

- Consider optimizing the resulting program using `sampleWithFactor`
- Think about whether clustering values (independent of distribution) will be useful in practice
