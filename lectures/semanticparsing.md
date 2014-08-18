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
      sem: find(world, function(obj){return obj.name=="Bob"}),
      syn: 'NP' },
    
    "some" : {
      sem: function(P){
        return function(Q){return filter(filter(world, P), Q).length>0}},
      syn: {dir:'R',
            int:{dir:'L', int:'NP', out:'S'},
            out:{dir:'R',
                 int:{dir:'L', int:'NP', out:'S'},
                 out:'S'}} },  
    
    "all" : {
      sem: function(P){
        return function(Q){return filter(filter(world, P), neg(Q)).length==0}},
      syn: {dir:'R',
            int:{dir:'L', int:'NP', out:'S'},
            out:{dir:'R',
                 int:{dir:'L', int:'NP', out:'S'},
                 out:'S'}} }
  }
  
  // any words not in wordMeanings are assumed to be vacuous, 
  // they'll get deleted.
  //
  // TODO other words...  

  var meaning = wordMeanings[word];
  
  if (meaning == undefined) {
    return {sem: undefined, syn: ''}
  } else {
    return meaning;
  }
  
}

// We use this helper function to negate a predicate above:
var neg = function(Q){
  return function(x){return !Q(x)}
}
~~~

Note that the `lexical_meaning` mapping could be stochastic, allowing us to capture polysemy. It can also depend on auxiliary elements of the world that play the role of semantically-free context variables.

To make a parsing step, we randomly choose a word, try applying as it asks (left or right), and if the application doesn't type we return original meanings. We do this until only one meaning fragment is left.
(It would be more efficient to pre-screen for typing and only choose among those applications which are syntactically well-formed. This introduces some ugly bookkeeping, so we've avoided it for simplicity.)

~~~
var combine_meaning = function(meanings) {
  var i = randomInteger(meanings.length)
  var s = meanings[i].syn
  if (s.hasOwnProperty('dir')){ //a functor
    if (s.dir == 'L') {//try to apply left
      if (syntaxMatch(s.int, meanings[i-1].syn)){
        var f = meanings[i].sem
        var a = meanings[i-1].sem
        var newmeaning = {sem: f(a), syn: s.out}
        return meanings.slice(0,i-1).concat([newmeaning]).concat(meanings.slice(i+1))
      }
    } else if (s.dir == 'R') {
      if (syntaxMatch(s.int, meanings[i+1].syn)){
        var f = meanings[i].sem
        var a = meanings[i+1].sem
        var newmeaning = {sem: f(a), syn: s.out}
        return meanings.slice(0,i).concat([newmeaning]).concat(meanings.slice(i+2))
      }
    }
  }
  return meanings
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
//literalListener("Bob is nice")
//literalListener("some blond are nice")
//literalListener("some blond people are nice")
literalListener("all blond people are nice")
~~~



