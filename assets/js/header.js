// forward sampling

// enumeration

// particle filtering

// query

var thisIsTheJavascriptHeader = function(){
    return 1;
}


//Co-Routine interface: an object that provides init, sample, factor, and exit.
//init gets called when the co-routine is installed and can provide whatever setup it wants.
//sample and factor are the co-routine handlers: they get call/cc'ed from the sppl code to handle random stuff.
//exit gets called when the query scope is exited, it returns a representation of the marginal distribution which becomes the value of the query statement.

//this global variable tracks the current coroutine, sample and factor use it to interface with the inference algorithm.
var coroutine



//forward sampling simply samples at each random choice. we track the score as well, to extend to simple importance sampling (likelihood weighting).
function Forward(spplFn) {
    this.score = 0
    
    //move old coroutine out of the way and install this as the current handler
    var old_coroutine = coroutine
    coroutine = this
    
    //run the sppl computation
    var returnval = spplFn()
    
    //put old coroutine back, and return the return value of the sppl fn, ignore scores for foward sampling...
    coroutine = old_coroutine
    
    return returnval
}

//dist can be either a name or an ERP package.
Forward.sample = function(cc, dist, params) {
    switch(dist) {
        case "flip":
            var weight = params[0]
            var val = Math.random() < weight
            this.score += val ? Math.log(weight) : Math.log(1-weight)
            cc(val) //go back to sppl code...
            break
            
        default: //assume dist is an ERP object
            //TODO: implement
    }
}

Forward.factor = function(cc, score) {
    this.score += score
    cc() //go back to sppl code...
}

forward.exit = function() {
    return distribution
}


