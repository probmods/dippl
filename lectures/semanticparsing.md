---
layout: example
title: Semantic parsing
description: A Bayesian literal listener who conditions on the meaning of a sentence. The meaning is computed by a CCG-like system.
---


#The world and the listener

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

#The parser

The meanings function is a stochastic semantic parser akin to CCG.
Each step of the meaning function tries to combine meaning fragments by left or right application, resulting in a new meaning.
First we get a lexical meaning for each word and filter out the undefined meanings, then we recursively apply until only one meaning fragment is left.

~~~
//split the string into words, lookup lexical meanings, delete words with vacuous meaning, then call combine_meanings..
var meaning = function(utterance, world) {
    return combine_meanings( filter(map(utterance.split(" "),
                                        function(w){return lexical_meaning(w, world)}),
                                    function(m){return !(m.sem==undefined)}))
}
~~~


The lexicon is captured in a function `lexical_meaning` which looks up the meaning of a word. A meaning is an object with semantics and syntax. 

~~~
var lexical_meaning = function(word, world) {
    return (word=="blond")? {sem: function(obj){return obj.blond},
                             syn: ['L', 'NP', 'S']} :
    (word=="nice")? {sem: function(obj){return obj.nice},
                     syn: ['L', 'NP', 'S']} :
    (word == "Bob")? {sem:find(world, function(obj){return obj.name=="Bob"}),
                      syn: 'NP'} :
    (word=="some")? {sem: function(P){return function(Q){return filter(filter(world, P), Q).length>0}},
                     syn: ['R', ['L', 'NP', 'S'], ['R', ['L', 'NP', 'S'], 'S']] } :
    (word=="all")? {sem: function(P){return function(Q){return filter(filter(world, P), neg(Q)).length==0}},
                    syn: ['R', ['L', 'NP', 'S'], ['R', ['L', 'NP', 'S'], 'S']] } :
    {sem: undefined, syn: ''} //any other words are assumed to be vacuous, they'll get deleted.
            //TODO other words...
}

//we use this helper function to negate a predicate above:
var neg = function(Q){return function(x){return !Q(x)}}
~~~

Note that the `lexical_meaning` mapping could be stochastic, allowing us to capture polysemy. It can also depend on auxiliary elements of the world that play the role of semantically-free context variables.

To make a parsing step, we randomly choose a word, try applying as it asks, and if it doesn't type we return original meanings. We do this until only one meaning fragment is left.
(It would be more efficient to pre-screen for typing and only choose among those applications which are syntactically well-formed. This introduces some ugly bookkeeping, so we've avoided it for simplicity.)

~~~
var combine_meaning = function(meanings) {
    var i = randomInteger(meanings.length)
    var s = meanings[i].syn
    if(Array.isArray(s)){ //a functor
       if(s[0] == 'L') {//try to apply left
            if(syntaxMatch(s[1],meanings[i-1].syn)){
                var f = meanings[i].sem
                var a = meanings[i-1].sem
                var newmeaning = {sem: f(a), syn: s[2]}
                return meanings.slice(0,i-1).concat([newmeaning]).concat(meanings.slice(i+1))
                }
        } else if(s[0] == 'R') {
            if(syntaxMatch(s[1],meanings[i+1].syn)){
                var f = meanings[i].sem
                var a = meanings[i+1].sem
                var newmeaning = {sem: f(a), syn: s[2]}
                return meanings.slice(0,i).concat([newmeaning]).concat(meanings.slice(i+2))
            }
        }
    }
    return meanings
}

//the syntaxMatch function is a simple recursion to check if two syntactic types are equal.
var syntaxMatch = function(s,t) {
    return !(Array.isArray(s)) ? s==t :
    s.length==0? t.length==0 : (syntaxMatch(s[0], t[0]) & syntaxMatch(s.slice(1),t.slice(1)))
}

//recursively do the above until only one meaning is left, return it's semantics.
var combine_meanings = function(meanings){
    return meanings.length==1 ? meanings[0].sem : combine_meanings(combine_meaning(meanings))
}
~~~

To allow fancy movement and binding we would mix this with type-shifting operators, following, for example, Barker 2002 (who extends Jacobsen 1999).


~~~
//literalListener("Bob is nice")
//literalListener("some blond are nice")
//literalListener("some blond people are nice")
literalListener("all blond people are nice")
~~~



