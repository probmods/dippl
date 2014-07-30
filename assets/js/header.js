

var thisIsTheJavascriptHeader = function(){
    return 1;
}

//Elementary Random Primitives (ERPs) are the representation of distributions. They can have sampling, scoring, and support functions. A single ERP need not hve all three, but some inference functions will complain if they're missing one.
//The main thing we can do with ERPs in WebPPL is feed them into the "sample" primitive to get a sample. At top level we will also have some "inspection" functions to visualize them?
//
//erp.sample(params) returns a value sampled from the distribution.
//erp.score(params, val) returns the log-probability of val under the distribution.
//erp.support(params) gives an array of support elements.

function ERP(sampler, scorer, supporter) {
    this.sample = sampler
    this.score = scorer
    this.support = supporter
}

var bernoulli = new ERP(
                   function flipsample(params) {
                    var weight = params[0]
                    var val = Math.random() < weight
                    return val
                   },
                   function flipscore(params, val) {
                    var weight = params[0]
                    return val ? Math.log(weight) : Math.log(1-weight)
                   },
                   function flipsupport(params) {
                    return [true, false]
                   }
)


//Inference interface: an infrence function takes the current continuation and a WebPPL thunk (which itself has been transformed to take a continuation). It does some kind of inference and returns an ERP representing the nromalized marginal distribution on return values.
//The inference function should install a coroutine object that provides sample, factor, and exit.
//  sample and factor are the co-routine handlers: they get call/cc'ed from the wppl code to handle random stuff.
//  the inference function passes exit to the wppl fn, so that it gets called when the fn is exited, it can call the inference cc when inference is done to contintue the program.

//This global variable tracks the current coroutine, sample and factor use it to interface with the inference algorithm.
var coroutine


//////////////////
//Forward sampling: simply samples at each random choice. we track the score as well, to extend to simple importance sampling (likelihood weighting).
function Forward(cc, wpplFn) {
    this.score = 0
    this.cc = cc
    
    //move old coroutine out of the way and install this as the current handler
    this.old_coroutine = coroutine
    coroutine = this
    
    //run the wppl computation, when the computation returns we want it to call this.exit so we pass that as the continuation.
    wpplFn(this.exit)
}

Forward.sample = function(cc, erp, params) {
    cc(erp.sample(params)) //sample and keep going
}

Forward.factor = function(cc, score) {
    this.score += score
    cc() //keep going
}

Forward.exit = function(retval) {
    //put old coroutine back, and return the return value of the wppl fn, ignore scores for foward sampling...
    coroutine = this.old_coroutine
    this.cc(retval)
}


// enumeration

// particle filtering





module.exports = {
ERP: ERP,
bernoulli: bernoulli,
Forward: Forward
}
