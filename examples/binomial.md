---
layout: hidden
title: Inferring a binomial rate
---

Observe 4 heads in 8 coin flips:

~~~~
///fold:
var sum = function(xs){
  if (xs.length == 0) {
    return 0;
  } else {
    return xs[0] + sum(xs.slice(1));
  }
};

var makeBinomial = function(n, p){
  return Enumerate(
    function(){
      return sum(repeat(n, function(){return flip(p)}));
    });
}

var uniformChoice = function(xs){
  return xs[randomInteger(xs.length)];
}

var observe = function(erp, value){
  erpFactor(erp, [], value);
}
///

var model1 = function(){
  var p = uniformChoice([.3, .5, .7]);
  var binomial = makeBinomial(8, p);
  observe(binomial, 4);
  return p;
}

print(Enumerate(model1))
~~~~

Observe 2 heads in 4 coin flips, twice:

~~~~
///fold:
var sum = function(xs){
  if (xs.length == 0) {
    return 0;
  } else {
    return xs[0] + sum(xs.slice(1));
  }
};

var makeBinomial = function(n, p){
  return Enumerate(
    function(){
      return sum(repeat(n, function(){return flip(p)}));
    });
}

var uniformChoice = function(xs){
  return xs[randomInteger(xs.length)];
}

var observe = function(erp, value){
  erpFactor(erp, [], value);
}
///

var model2 = function(){
  var p = uniformChoice([.3, .5, .7]);
  var binomial1 = makeBinomial(4, p);
  var binomial2 = makeBinomial(4, p);
  observe(binomial1, 2);
  observe(binomial2, 2);
  return p;
}


print(Enumerate(model2))
~~~~
