
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
                    var weight = params//params[0]
                    var val = Math.random() < weight
                    return val
                   },
                   function flipscore(params, val) {
                    var weight = params//params[0]
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

//This global variable tracks the current coroutine, sample and factor use it to interface with the inference algorithm. It's default setting throws an error on sample or factor calls.
var coroutine =
{
sample: function(){throw "sample allowed only inside inference"},
factor: function(){throw "factor allowed only inside inference"}
}


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
    //put old coroutine back, and return the return value of the wppl fn as a delta erp, ignore scores for foward sampling...
    coroutine = this.old_coroutine
    dist=new ERP()
    this.cc(dist)
}



//////////////////
// Enumeration: enumerate all the paths through the computation based on a priority queue.

function Enumerate(cc, wpplFn) {
    this.cc = cc
    this.score = 0 //used to track the score of the path currently being explored
    this.queue = [] //queue of continuations and values that we have yet to explore
    this.marginal = {} //used to build marginal
    
    //move old coroutine out of the way and install this as the current handler
    this.old_coroutine = coroutine
    coroutine = this
    
    //enter the wppl computation, when the computation returns we want it to call this.exit so we pass that as the continuation.
    wpplFn(this.exit)
}

//the queue is a bunch of computation states. each state is a continuation, a value to apply it to, and a score.
Enumerate.nextInQueue = function() {
    if(this.queue.length > 0){
        var next_state = this.queue.pop()
        this.score = next_state.score
        next_state.continuation(next_state.value)
    }
    //otherwise nothing left to do, so return:
    return
}

Enumerate.sample = function(cc, dist, params) {
    //find support of this erp:
    var supp = dist.support(params) //TODO: catch undefined support
    
    //for each value in support, add the continuation paired with support value and score to queue:
    for(var s in supp){
        var state = {continuation: cc,
                    value: supp[s],
                    score: this.score + dist.score(params, supp[s])}
        this.queue.push(state)
    }
    
    //call the next state on the queue
    Enumerate.nextInQueue() //TODO: should be this. method?
}

Enumerate.factor = function(cc, score) {
    //update score and continue
    this.score += score
    cc()
}

Enumerate.exit = function(retval) {
    //have reached an exit of the computation. accumulate log-probability into retval bin.
    this.marginal[retval] += this.score
    
    //if anything is left in queue do it:
    Enumerate.nextInQueue() //TODO: should be this. method?
    
    //if nextInQueue returns it means queue is empty, so we're done. make an ERP and call the cc:
    coroutine = this.old_coroutine
    //make erp
    var dist = new ERP(...)
    this.cc(dist)
}


// particle filtering





module.exports = {
ERP: ERP,
bernoulli: bernoulli,
coroutine: coroutine,
Forward: Forward
}
