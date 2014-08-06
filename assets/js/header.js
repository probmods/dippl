"use strict";

// Elementary Random Primitives (ERPs) are the representation of
// distributions. They can have sampling, scoring, and support
// functions. A single ERP need not hve all three, but some inference
// functions will complain if they're missing one.
//
// The main thing we can do with ERPs in WebPPL is feed them into the
// "sample" primitive to get a sample. At top level we will also have
// some "inspection" functions to visualize them?
//
// erp.sample(params) returns a value sampled from the distribution.
// erp.score(params, val) returns the log-probability of val under the distribution.
// erp.support(params) gives an array of support elements.

function ERP(sampler, scorer, supporter) {
  this.sample = sampler;
  this.score = scorer;
  this.support = supporter;
}

var bernoulli = new ERP(
  function flipSample(params) {
    var weight = params[0];
    var val = Math.random() < weight;
    return val;
  },
  function flipScore(params, val) {
    var weight = params[0];
    return val ? Math.log(weight) : Math.log(1 - weight);
  },
  function flipSupport(params) {
    return [true, false];
  }
);

function multinomial_sample(theta) {
  var k = theta.length;
  var thetaSum = 0;
  for (var i = 0; i < k; i++) {
    thetaSum += theta[i];
  };
  var x = Math.random() * thetaSum;
  var probAccum = 0;
  for (var i = 0; i < k; i++) {
    probAccum += theta[i];
    if (probAccum >= x) {
      return i;
    } //FIXME: if x=0 returns i=0, but this isn't right if theta[0]==0...
  }
  return k;
}


// Inference interface: an inference function takes the current
// continuation and a WebPPL thunk (which itself has been transformed
// to take a continuation). It does some kind of inference and returns
// an ERP representing the nromalized marginal distribution on return
// values.
//
// The inference function should install a coroutine object that
// provides sample, factor, and exit.
//
// sample and factor are the co-routine handlers: they get call/cc'ed
// from the wppl code to handle random stuff.
//
// The inference function passes exit to the wppl fn, so that it gets
// called when the fn is exited, it can call the inference cc when
// inference is done to contintue the program.


// This global variable tracks the current coroutine, sample and
// factor use it to interface with the inference algorithm. Default
// setting throws an error on factor calls.
var coroutine = {
  sample: function(cc, erp, params) {
    cc(erp.sample(params));
  }, //sample and keep going
  factor: function() {
    throw "factor allowed only inside inference.";
  },
  exit: function(r) {
    return r;
  }
};

// Functions that call methods of whatever the coroutine is set to
// when called, we do it like this so that 'this' will be set
// correctly to the coroutine object.
function sample(k, dist, params) {
  coroutine.sample(k, dist, params);
}

function factor(k, score) {
  coroutine.factor(k, score);
}

function exit(retval) {
  coroutine.exit(retval);
}


////////////////////////////////////////////////////////////////////
// Forward sampling
//
// Simply samples at each random choice. throws an error on factor,
// since we aren't doing any normalization / inference.

function Forward(cc, wpplFn) {
  this.cc = cc;

  // Move old coroutine out of the way and install this as the
  // current handler.
  this.old_coroutine = coroutine;
  coroutine = this;

  // Run the wppl computation, when the computation returns we want
  // it to call the exit method of this coroutine so we pass that as
  // the continuation.
  wpplFn(exit);
}

Forward.prototype.sample = function(cc, erp, params) {
  cc(erp.sample(params)); //sample and keep going
};

Forward.prototype.factor = function(cc, score) {
  throw "'factor' is not allowed inside Forward.";
};

Forward.prototype.exit = function(retval) {
  // Return value of the wppl fn as a delta erp
  var dist = new ERP(
    function() {
      return retval;
    },
    function(p, v) {
      return (v == retval) ? 0 : -Infinity;
    });

  // Put old coroutine back, and return dist
  coroutine = this.old_coroutine;
  this.cc(dist);
}

// Helper wraps with 'new' to make a new copy of Forward and set
// 'this' correctly..
function fw(cc, wpplFn) {
  return new Forward(cc, wpplFn);
}


////////////////////////////////////////////////////////////////////
// Enumeration
//
// Depth-first enumeration of all the paths through the computation.

function Enumerate(k, wpplFn) {

  this.score = 0; //used to track the score of the path currently being explored
  this.queue = []; //queue of states that we have yet to explore
  this.marginal = {}; //we will accumulate the marginal distribution here

  //move old coroutine out of the way and install this as the current handler
  this.k = k;
  this.old_coroutine = coroutine;
  coroutine = this;

  //run the wppl computation, when the computation returns we want it to call the exit method of this coroutine so we pass that as the continuation.
  wpplFn(exit);
}


// The queue is a bunch of computation states. each state is a
// continuation, a value to apply it to, and a score.
//
// This function simply runs the state on the top of the queue. could
// make this a priority / random / etc queue.
Enumerate.prototype.nextInQueue = function() {
  var next_state = this.queue.pop();
  this.score = next_state.score;
  next_state.continuation(next_state.value);
}

Enumerate.prototype.sample = function(cc, dist, params) {

  // Find support of this erp:
  if (!dist.support) {
    throw "Enumerate can only be used with ERPs that have support function.";
  }
  var supp = dist.support(params);

  // For each value in support, add the continuation paired with
  // support value and score to queue:
  for (var s in supp) {
    var state = {
      continuation: cc,
      value: supp[s],
      score: this.score + dist.score(params, supp[s])
    };
    this.queue.push(state);
  }

  // Call the next state on the queue
  this.nextInQueue();
};

Enumerate.prototype.factor = function(cc, score) {
  //update score and continue
  this.score += score;
  cc();
};

Enumerate.prototype.exit = function(retval) {

  //have reached an exit of the computation. accumulate probability into retval bin.
  if (this.marginal[retval] == undefined) {
    this.marginal[retval] = 0;
  }
  this.marginal[retval] += Math.exp(this.score);

  //if anything is left in queue do it:
  if (this.queue.length > 0) {
    this.nextInQueue();
  } else {
    var marginal = this.marginal;
    var dist = makeMarginalERP(marginal);
    //reinstate previous coroutine:
    coroutine = this.old_coroutine;
    //return from enumeration by calling original continuation:
    this.k(dist);
  }
};

function makeMarginalERP(marginal) {
  //normalize distribution:
  var norm = 0,
  supp = [];
  for (var v in marginal) {
    norm += marginal[v];
    supp.push(v);
  }
  for (var v in marginal) {
    marginal[v] = marginal[v] / norm;
  }
  console.log("Enumerated distribution: ");
  console.log(marginal);
  //make an ERP from marginal:
  var dist = new ERP(
    function(params) {
      var k = marginal.length;
      var x = Math.random();
      var probAccum = 0;
      for (var i in marginal) {
        probAccum += marginal[i];
        if (probAccum >= x) {
          return i;
        } //FIXME: if x=0 returns i=0, but this isn't right if theta[0]==0...
      }
      return i;
    },
    function(params, val) {
      return Math.log(marginal[val]);
    },
    function(params) {
      return supp;
    });
  return dist;
}


//helper wraps with 'new' to make a new copy of Enumerate and set 'this' correctly..
function enu(cc, wpplFn) {
  return new Enumerate(cc, wpplFn);
}

////////////////////////////////////////////////////////////////////
// Particle filtering
//
// Sequential importance re-sampling, which treats 'factor' calls as
// the synchronization / intermediate distribution points.

function ParticleFilter(k, wpplFn, numP) {

  //initialize the filter by adding numP states to the set of "previous" particles

  //move old coroutine out of the way and install this as the current handler
  this.k = k;
  this.old_coroutine = coroutine;
  coroutine = this;

  //run the wppl computation, when the computation returns we want it to call the exit method of this coroutine so we pass that as the continuation.
  wpplFn(exit);
}

ParticleFilter.prototype.sample = function(cc, dist, params) {

};

ParticleFilter.prototype.factor = function(cc, score) {

};

ParticleFilter.prototype.exit = function(retval) {

  //... clean up

  //reinstate previous coroutine:
  coroutine = this.old_coroutine;
  //return from enumeration by calling original continuation:
  this.k(dist);
};


////////////////////////////////////////////////////////////////////
// Some primitive functions to make things simpler

function display(k, x) {
  k(console.log(x));
}

function callPrimitive(k, f) {
  var args = Array.prototype.slice.call(arguments, 2);
  k(f.apply(f, args));
}

// Caching for a wppl function f. caution: if f isn't deterministic
// weird stuff can happen, since caching is across all uses of f, even
// in different execuation paths.
function cache(k, f) {
  var c = {};
  var cf = function(k) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (args in c) {
      k(c[args]);
    } else {
      var newk = function(r) {
        c[args] = r;
        k(r);
      };
      f.apply(this, [newk].concat(args));
    }
  };
  k(cf);
}

function plus(k, x, y) {
  k(x + y);
};

function minus(k, x, y) {
  k(x - y);
};

function times(k, x, y) {
  k(x * y);
};

function and(k, x, y) {
  k(x && y);
};


////////////////////////////////////////////////////////////////////

module.exports = {
  ERP: ERP,
  bernoulli: bernoulli,
  Forward: fw,
  Enumerate: enu,
  //coroutine: coroutine,
  sample: sample,
  factor: factor,
  display: display,
  callPrimitive: callPrimitive,
  cache: cache,
  plus: plus,
  minus: minus,
  times: times,
  and: and
}