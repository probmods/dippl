---
layout: example
title: Semantic parsing
description: A Bayesian literal listener who conditions on the meaning of a sentence. The meaning is computed by direct composition in a categorial grammar.
---

We implement a Bayesian language comprehender on top of a syntactic-semantic parsing system based on (combinatory) categorial grammar.

## The world and the listener

The literal listener simply infers likely worlds assuming the meaning is true in the world:

~~~
var literalListener = function(utterance) {
  Enumerate(function(){
    var world = worldPrior()
    var m = meaning(utterance, world)
    factor(m?0:-Infinity)
    return world
  }, 100)
}
~~~


The world is some named objects with random (binary) properties:

~~~
var makeObj = function(name) {
  return {name: name, blond: flip(0.5), nice: flip(0.5)}
}

var worldPrior = function(objs) {
  return [makeObj("Bob"), makeObj("Bill"), makeObj("Alice")]
}
~~~

## The parser

Notice that we have written the `meaning` function as taking the utterance and world and returning a (model-theoretic) denotation -- a truth value when the utterance is a sentence. The motivation for doing things this way, rather than breaking it up into a meaning function that builds an 'LF' form which is then separately applied to the world, is well described by the introduction to Jacobson (1999):


>The point of departure for this paper is the hypothesis of "direct compositionality"
(see, e.g., Montague 1974): the syntax and the model-theoretic semantics work in
tandem. Thus the syntax "builds" (i.e. proves the well-formedness of)
expressions, where each syntactic rule supplies the proof of the well-formedness of
an output expression in terms of the well-formedness of one or more input
expressions. (These rules might, of course, be stated in highly general and
schematic terms as in, e.g., Categorial Grammar.) The semantics works in tandem
with this - each output expression is directly assigned a meaning (a model-theoretic
interpretation) in terms of the meaning(s) of the input expressions(s). There is thus
no need to for any kind of abstract level like LF mediating between the surface
syntax and the model-theoretic interpretation, and hence no need for an additional
set of rules mapping one "level" of syntactic representation into another.



For our system, the `meaning` function is a *stochastic* map from utterances to truth values, with the different return values corresponding (non-uniquely) to different parses or lexical choices.

First we get a lexical meaning for each word and filter out the undefined meanings, then we recursively apply meaning fragments to each other until only one meaning fragment is left.

~~~
// Split the string into words, lookup lexical meanings,
// delete words with vacuous meaning, then call combine_meanings..

var meaning = function(utterance, world) {
  return combine_meanings(
    filter(map(utterance.split(" "),
               function(w){return lexical_meaning(w, world)}),
           function(m){return !(m.sem==undefined)}))
}
~~~

The lexicon is captured in a function `lexical_meaning` which looks up the meaning of a word. A meaning is an object with semantics and syntax.

~~~
var lexical_meaning = function(word, world) {

  var wordMeanings = {

    "blond" : {
      sem: function(obj){return obj.blond},
      syn: {dir:'L', int:'NP', out:'S'} },

    "nice" : {
      sem: function(obj){return obj.nice},
      syn: {dir:'L', int:'NP', out:'S'} },

    "Bob" : {
      sem: find(function(obj){return obj.name=="Bob"}, world),
      syn: 'NP' },

    "some" : {
      sem: function(P){
        return function(Q){return filter(Q, filter(P, world)).length>0}},
      syn: {dir:'R',
            int:{dir:'L', int:'NP', out:'S'},
            out:{dir:'R',
                 int:{dir:'L', int:'NP', out:'S'},
                 out:'S'}} },

    "all" : {
      sem: function(P){
        return function(Q){return filter(neg(Q), filter(P, world)).length==0}},
      syn: {dir:'R',
            int:{dir:'L', int:'NP', out:'S'},
            out:{dir:'R',
                 int:{dir:'L', int:'NP', out:'S'},
                 out:'S'}} }
  }

  var meaning = wordMeanings[word];
  return meaning == undefined?{sem: undefined, syn: ''}:meaning;
}

// We use this helper function to negate a predicate above:
var neg = function(Q){
  return function(x){return !Q(x)}
}
~~~

Note that the `lexical_meaning` mapping could be stochastic, allowing us to capture polysemy. It can also depend on auxiliary elements of the world that play the role of semantically-free context variables.

To make a parsing step, we randomly choose a word such that the syntactic rules claim an application is possible, and do this application (reducing the set of meaning fragments). We do this until only one meaning fragment is left.

~~~
var combine_meaning = function(meanings) {
  var possibleComb = canApply(meanings,0)
  display(possibleComb)
  var i = possibleComb[randomInteger(possibleComb.length)]
  var s = meanings[i].syn
  if (s.dir == 'L') {
    var f = meanings[i].sem
    var a = meanings[i-1].sem
    var newmeaning = {sem: f(a), syn: s.out}
    return meanings.slice(0,i-1).concat([newmeaning]).concat(meanings.slice(i+1))
  }
  if (s.dir == 'R') {
    var f = meanings[i].sem
    var a = meanings[i+1].sem
    var newmeaning = {sem: f(a), syn: s.out}
    return meanings.slice(0,i).concat([newmeaning]).concat(meanings.slice(i+2))
  }
}

//make a list of the indexes that can (syntactically) apply.
var canApply = function(meanings,i) {
  if(i==meanings.length){
    return []
  }
  var s = meanings[i].syn
  if (s.hasOwnProperty('dir')){ //a functor
    var a = ((s.dir == 'L')?syntaxMatch(s.int, meanings[i-1].syn):false) |
            ((s.dir == 'R')?syntaxMatch(s.int, meanings[i+1].syn):false)
    if(a){return [i].concat(canApply(meanings,i+1))}
  }
  return canApply(meanings,i+1)
}


// The syntaxMatch function is a simple recursion to
// check if two syntactic types are equal.
var syntaxMatch = function(s,t) {
  return !s.hasOwnProperty('dir') ? s==t :
  s.dir==t.dir & syntaxMatch(s.int,t.int) & syntaxMatch(s.out,t.out)
}


// Recursively do the above until only one meaning is
// left, return it's semantics.
var combine_meanings = function(meanings){
  return meanings.length==1 ? meanings[0].sem : combine_meanings(combine_meaning(meanings))
}
~~~

To allow fancy movement and binding we would mix this with type-shifting operators, following, for example, Barker (2002) (who extends Jacobson, 1999).


~~~
///fold:

var literalListener = function(utterance) {
  Enumerate(function(){
    var world = worldPrior()
    var m = meaning(utterance, world)
    factor(m?0:-Infinity)
    return world
  }, 100)
}

var makeObj = function(name) {
  return {name: name, blond: flip(0.5), nice: flip(0.5)}
}

var worldPrior = function(objs) {
  return [makeObj("Bob"), makeObj("Bill"), makeObj("Alice")]
}

// Split the string into words, lookup lexical meanings,
// delete words with vacuous meaning, then call combine_meanings..

var meaning = function(utterance, world) {
  return combine_meanings(
    filter(function(m){return !(m.sem==undefined)},
	       map(function(w){return lexical_meaning(w, world)},
		       utterance.split(" "))))
}

var lexical_meaning = function(word, world) {

  var wordMeanings = {

    "blond" : {
      sem: function(obj){return obj.blond},
      syn: {dir:'L', int:'NP', out:'S'} },

    "nice" : {
      sem: function(obj){return obj.nice},
      syn: {dir:'L', int:'NP', out:'S'} },

    "Bob" : {
      sem: find(function(obj){return obj.name=="Bob"}, world),
      syn: 'NP' },

    "some" : {
      sem: function(P){
        return function(Q){return filter(Q, filter(P, world)).length>0}},
      syn: {dir:'R',
            int:{dir:'L', int:'NP', out:'S'},
            out:{dir:'R',
                 int:{dir:'L', int:'NP', out:'S'},
                 out:'S'}} },

    "all" : {
      sem: function(P){
        return function(Q){return filter(neg(Q), filter(P, world)).length==0}},
      syn: {dir:'R',
            int:{dir:'L', int:'NP', out:'S'},
            out:{dir:'R',
                 int:{dir:'L', int:'NP', out:'S'},
                 out:'S'}} }
  }

  var meaning = wordMeanings[word];
  return meaning == undefined?{sem: undefined, syn: ''}:meaning;
}

// We use this helper function to negate a predicate above:
var neg = function(Q){
  return function(x){return !Q(x)}
}

var combine_meaning = function(meanings) {
  var possibleComb = canApply(meanings,0)
  display(possibleComb)
  var i = possibleComb[randomInteger(possibleComb.length)]
  var s = meanings[i].syn
  if (s.dir == 'L') {
    var f = meanings[i].sem
    var a = meanings[i-1].sem
    var newmeaning = {sem: f(a), syn: s.out}
    return meanings.slice(0,i-1).concat([newmeaning]).concat(meanings.slice(i+1))
  }
  if (s.dir == 'R') {
    var f = meanings[i].sem
    var a = meanings[i+1].sem
    var newmeaning = {sem: f(a), syn: s.out}
    return meanings.slice(0,i).concat([newmeaning]).concat(meanings.slice(i+2))
  }
}

//make a list of the indexes that can (syntactically) apply.
var canApply = function(meanings,i) {
  if(i==meanings.length){
    return []
  }
  var s = meanings[i].syn
  if (s.hasOwnProperty('dir')){ //a functor
    var a = ((s.dir == 'L')?syntaxMatch(s.int, meanings[i-1].syn):false) |
            ((s.dir == 'R')?syntaxMatch(s.int, meanings[i+1].syn):false)
    if(a){return [i].concat(canApply(meanings,i+1))}
  }
  return canApply(meanings,i+1)
}


// The syntaxMatch function is a simple recursion to
// check if two syntactic types are equal.
var syntaxMatch = function(s,t) {
  return !s.hasOwnProperty('dir') ? s==t :
  s.dir==t.dir & syntaxMatch(s.int,t.int) & syntaxMatch(s.out,t.out)
}


// Recursively do the above until only one meaning is
// left, return it's semantics.
var combine_meanings = function(meanings){
  return meanings.length==1 ? meanings[0].sem : combine_meanings(combine_meaning(meanings))
}

///

//literalListener("Bob is nice")
//literalListener("some blond are nice")
//literalListener("some blond people are nice")

print(literalListener("all blond people are nice"))
~~~




## Incremental world building

The above version of semantic parsing constructs an entire world *and* an entire meaning before trying to enforce that the meaning is true of the world. We would like to make either the world construction or the parsing more incremental... Below we give a version that uses the [canceling heuristic factors](04-factorseq.html#inserting-canceling-heuristic-factors) trick to encourage the world to be one in which the constructed meaning is true, incrementally as we add objects to the world.

Two changes are involved. First we adapt the `worldPrior` to allow canceling factors. Second, this version constructs a function from world to truth value, which can then be used several times while the world is constructed. That is, we depart from direct compositionality, in building 'delayed' denotations that await the world.

First a slightly modified `literalListener` and world model, without added factors to see that the world generated does not *a priori* depend on the meaning. The `worldPrior` recursively adds objects to the world:

~~~
var literalListener = function(utterance) {
  Enumerate(function(){
            var m = meaning(utterance)
            var world = worldPrior(3,m)
            factor(m(world)?0:-Infinity)
            return world
            }, 100)
}


var makeObj = function() {
  return {blond: flip(0.5), nice: flip(0.5), tall: flip(0.5)}
}

var worldPrior = function(nObjLeft, meaningFn, worldSoFar) {
  var worldSoFar = worldSoFar==undefined ? [] : worldSoFar
  if(nObjLeft==0) {
    return worldSoFar
  } else {
    var newObj = makeObj()
    var newWorld = worldSoFar.concat([newObj])
    return worldPrior(nObjLeft-1, meaningFn, newWorld)
  }
}
~~~

Now we can add canceling pairs:

~~~
var worldPrior = function(nObjLeft, meaningFn, worldSoFar) {
  var worldSoFar = worldSoFar==undefined ? [] : worldSoFar
  if(nObjLeft==0) {
    return worldSoFar
  } else {
    var newObj = makeObj()
    var newWorld = worldSoFar.concat([newObj])
    var newFactor = meaningFn(newWorld)?0:-100
    factor(newFactor)
    factor(-newFactor)
    return worldPrior(nObjLeft-1, meaningFn, newWorld)
  }
}
~~~

And finally push the second factor forward into the next recursion (where it becomes called `prevFactor`):

~~~
var worldPrior = function(nObjLeft, meaningFn, worldSoFar, prevFactor) {
  var worldSoFar = worldSoFar==undefined ? [] : worldSoFar
  var prevFactor = prevFactor==undefined ? 0 : prevFactor
  if(nObjLeft==0) {
    factor(-prevFactor)
    return worldSoFar
  } else {
    var newObj = makeObj()
    var newWorld = worldSoFar.concat([newObj])
    var newFactor = meaningFn(newWorld)?0:-100
    factor(newFactor - prevFactor)
    return worldPrior(nObjLeft-1, meaningFn, newWorld, newFactor)
  }
}
~~~

Now we 'encourage' the world we are building to be such that the meaning is true at each stage, but only require it to be true at the end in the `literalListener` (and this is also the only factor that isn't canceled in the end).

The remainder of the model is similar to the above, but with delayed denotations as the semantic meanings:

~~~
var meaning = function(utterance) {
  return combine_meanings(
    filter(function(m){return !(m.sem==undefined)},
	       map(function(w){return lexical_meaning(w)},
		       utterance.split(" "))))
}


var lexical_meaning = function(word) {

  var wordMeanings = {

    "blond" : {
      sem: function(world){return function(obj){return obj.blond}},
      syn: {dir:'L', int:'NP', out:'S'} },

    "nice" : {
      sem: function(world){return function(obj){return obj.nice}},
      syn: {dir:'L', int:'NP', out:'S'} },

    "Bob" : {
    sem: function(world){return find(function(obj){return obj.name=="Bob"}, world)},
      syn: 'NP' },

    "some" : {
      sem: function(world){return function(P){return function(Q){return filter(Q, filter(P, world)).length>0}}},
      syn: {dir:'R',
            int:{dir:'L', int:'NP', out:'S'},
            out:{dir:'R',
                 int:{dir:'L', int:'NP', out:'S'},
                 out:'S'}} },

    "all" : {
      sem: function(world){return function(P){return function(Q){return filter(neg(Q), filter(P, world)).length==0}}},
      syn: {dir:'R',
            int:{dir:'L', int:'NP', out:'S'},
            out:{dir:'R',
                 int:{dir:'L', int:'NP', out:'S'},
                 out:'S'}} }
  }

  var meaning = wordMeanings[word];
  return meaning == undefined?{sem: undefined, syn: ''}:meaning;
}

// We use this helper function to negate a predicate above:
var neg = function(Q){
  return function(x){return !Q(x)}
}


//assume that both f and a will give their actual semantic value after being applied to a world. make a new meaning that passes on world arg.
var applyWorldPassing = function(f,a) {
  return function(w){return f(w)(a(w))}
}

var combine_meaning = function(meanings) {
  var possibleComb = canApply(meanings,0)
  var i = possibleComb[randomInteger(possibleComb.length)]
  var s = meanings[i].syn
  if (s.dir == 'L') {
    var f = meanings[i].sem
    var a = meanings[i-1].sem
    var newmeaning = {sem: applyWorldPassing(f,a), syn: s.out}
    return meanings.slice(0,i-1).concat([newmeaning]).concat(meanings.slice(i+1))
  }
  if (s.dir == 'R') {
    var f = meanings[i].sem
    var a = meanings[i+1].sem
    var newmeaning = {sem: applyWorldPassing(f,a), syn: s.out}
    return meanings.slice(0,i).concat([newmeaning]).concat(meanings.slice(i+2))
  }
}

//make a list of the indexes that can (syntactically) apply.
var canApply = function(meanings,i) {
  if(i==meanings.length){
    return []
  }
  var s = meanings[i].syn
  if (s.hasOwnProperty('dir')){ //a functor
    var a = ((s.dir == 'L')?syntaxMatch(s.int, meanings[i-1].syn):false) |
            ((s.dir == 'R')?syntaxMatch(s.int, meanings[i+1].syn):false)
    if(a){return [i].concat(canApply(meanings,i+1))}
  }
  return canApply(meanings,i+1)
}


// The syntaxMatch function is a simple recursion to
// check if two syntactic types are equal.
var syntaxMatch = function(s,t) {
  return !s.hasOwnProperty('dir') ? s==t :
  s.dir==t.dir & syntaxMatch(s.int,t.int) & syntaxMatch(s.out,t.out)
}


// Recursively do the above until only one meaning is
// left, return it's semantics.
var combine_meanings = function(meanings){
  return meanings.length==1 ? meanings[0].sem : combine_meanings(combine_meaning(meanings))
}
~~~

~~~
///fold:

var literalListener = function(utterance) {
  Enumerate(function(){
            var m = meaning(utterance)
            var world = worldPrior(3,m)
            factor(m(world)?0:-Infinity)
            return world
            }, 100)
}


var makeObj = function() {
  return {blond: flip(0.5), nice: flip(0.5), tall: flip(0.5)}
}

var worldPrior = function(nObjLeft, meaningFn, worldSoFar, prevFactor) {
  var worldSoFar = worldSoFar==undefined ? [] : worldSoFar
  var prevFactor = prevFactor==undefined ? 0 : prevFactor
  if(nObjLeft==0) {
    factor(-prevFactor)
    return worldSoFar
  } else {
    var newObj = makeObj()
    var newWorld = worldSoFar.concat([newObj])
    var newFactor = meaningFn(newWorld)?0:-100
    factor(newFactor - prevFactor)
    return worldPrior(nObjLeft-1, meaningFn, newWorld, newFactor)
  }
}

var meaning = function(utterance) {
  return combine_meanings(
    filter(function(m){return !(m.sem==undefined)},
	       map(function(w){return lexical_meaning(w)},
		       utterance.split(" "))))
}


var lexical_meaning = function(word) {

  var wordMeanings = {

    "blond" : {
      sem: function(world){return function(obj){return obj.blond}},
      syn: {dir:'L', int:'NP', out:'S'} },

    "nice" : {
      sem: function(world){return function(obj){return obj.nice}},
      syn: {dir:'L', int:'NP', out:'S'} },

    "Bob" : {
    sem: function(world){return find(function(obj){return obj.name=="Bob"}, world)},
      syn: 'NP' },

    "some" : {
      sem: function(world){return function(P){return function(Q){return filter(Q, filter(P, world)).length>0}}},
      syn: {dir:'R',
            int:{dir:'L', int:'NP', out:'S'},
            out:{dir:'R',
                 int:{dir:'L', int:'NP', out:'S'},
                 out:'S'}} },

    "all" : {
      sem: function(world){return function(P){return function(Q){return filter(neg(Q), filter(P, world)).length==0}}},
      syn: {dir:'R',
            int:{dir:'L', int:'NP', out:'S'},
            out:{dir:'R',
                 int:{dir:'L', int:'NP', out:'S'},
                 out:'S'}} }
  }

  var meaning = wordMeanings[word];
  return meaning == undefined?{sem: undefined, syn: ''}:meaning;
}

// We use this helper function to negate a predicate above:
var neg = function(Q){
  return function(x){return !Q(x)}
}


//assume that both f and a will give their actual semantic value after being applied to a world. make a new meaning that passes on world arg.
var applyWorldPassing = function(f,a) {
  return function(w){return f(w)(a(w))}
}

var combine_meaning = function(meanings) {
  var possibleComb = canApply(meanings,0)
  var i = possibleComb[randomInteger(possibleComb.length)]
  var s = meanings[i].syn
  if (s.dir == 'L') {
    var f = meanings[i].sem
    var a = meanings[i-1].sem
    var newmeaning = {sem: applyWorldPassing(f,a), syn: s.out}
    return meanings.slice(0,i-1).concat([newmeaning]).concat(meanings.slice(i+1))
  }
  if (s.dir == 'R') {
    var f = meanings[i].sem
    var a = meanings[i+1].sem
    var newmeaning = {sem: applyWorldPassing(f,a), syn: s.out}
    return meanings.slice(0,i).concat([newmeaning]).concat(meanings.slice(i+2))
  }
}

//make a list of the indexes that can (syntactically) apply.
var canApply = function(meanings,i) {
  if(i==meanings.length){
    return []
  }
  var s = meanings[i].syn
  if (s.hasOwnProperty('dir')){ //a functor
    var a = ((s.dir == 'L')?syntaxMatch(s.int, meanings[i-1].syn):false) |
            ((s.dir == 'R')?syntaxMatch(s.int, meanings[i+1].syn):false)
    if(a){return [i].concat(canApply(meanings,i+1))}
  }
  return canApply(meanings,i+1)
}


// The syntaxMatch function is a simple recursion to
// check if two syntactic types are equal.
var syntaxMatch = function(s,t) {
  return !s.hasOwnProperty('dir') ? s==t :
  s.dir==t.dir & syntaxMatch(s.int,t.int) & syntaxMatch(s.out,t.out)
}


// Recursively do the above until only one meaning is
// left, return it's semantics.
var combine_meanings = function(meanings){
  return meanings.length==1 ? meanings[0].sem : combine_meanings(combine_meaning(meanings))
}
///

print(literalListener("all blond people are nice"))
~~~

You can see that this version finds possible interpretations much sooner that the previous version.
