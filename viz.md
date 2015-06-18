---
layout: hidden
title: Visualizations demo
---

# MH Chains

If we wanted to make this nicer, we could change this line in (line 299 of `webppl/src/inference/mh.js`):

`var dist = erp.makeMarginalERP(this.returnHist);`

To also give `makeMarginalERP` the chain (`this.vals`), and then change `makeMarginalERP` (line 431 of `webppl/src/erp.js`) to store that chain information (and maybe the other analytics, e.g. acceptance rate and number of samples) if it's there.

~~~
var seq = function(n) {
  if (n==0) {
    return [];
  } else {
    return seq(n-1).concat([n]);
  }
}
var binomial = function(){
  var a = sample(bernoulliERP, [0.5])
  var b = sample(bernoulliERP, [0.5])
  var c = sample(bernoulliERP, [0.5])
  return a + b + c
}

var mh_return = MH(binomial, 100, 1, true);
line(seq(mh_return.chain.length), mh_return.chain);
print(mh_return.erp);
~~~