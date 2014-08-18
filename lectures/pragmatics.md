---
layout: example
title: Pragmatics
description: The (simplified) Rational Speech Acts model of natural language pragmatics.
---

We start with a literal listener: a Bayesian agent who updates her prior beliefs (given by the `worldPrior` function) into posterior beliefs by assuming the utterance is true in the actual world.

~~~
var literalListener = function(utterance) {
  Enumerate(function(){
    var world = worldPrior()
    var m = meaning(utterance, world)
    factor(m?0:-Infinity)
    return world
  })
}
~~~

To flesh out this model, we need the `worldPrior`, the `utterancePrior`, and the `meaning` function which evaluates and utterance in a given world. We will start with a very simple scenario: there is a (known and fixed) set of 3 people, and an unknown number of these people (between 0 and 3) is nice. The three equally probable utterances are 'none/some/all of the people are nice', and these utterances get their standard (highly intuitive) meanings.

~~~
var worldPrior = function() {
  var num_nice_people = randomInteger(4) //3 people.. 0-3 can be nice.
  return num_nice_people
}

var utterancePrior = function() {
  var utterances = ["some of the people are nice",
                    "all of the people are nice",
                    "none of the people are nice"]
  var i = randomInteger(utterances.length)
  return utterances[i]
}

var meaning = function(utt,world) {
  return utt=="some of the people are nice"? world>0 :
         utt=="all of the people are nice"? world==3 :
         utt=="none of the people are nice"? world==0 :
         true
}

print(literalListener("some of the people are nice"))
~~~

If you evaluate the above code box, you will see that the inferred meaning of "some of the people are nice" is uniform on all world states where at least one person is nice -- including the state in which all people are nice. This fails to capture the usual 'some but not all' scalar implicature.

We can move to a more Gricean listener who assumes that the speaker has chosen an utterance to convey the intended state of the world: 

~~~
var speaker = function(world) {
  Enumerate(function(){
    var utterance = utterancePrior()
    factor(world == sample(literalListener(utterance)) ?0:-Infinity)
    return utterance
  })
}

var listener = function(utterance) {
  Enumerate(function(){
    var world = worldPrior()
    factor(utterance == sample(speaker(world)) ?0:-Infinity)
    return world
  })
}

print(listener("some of the people are nice"))
~~~

If you evaluate the above code box you will see that it does capture the scalar implicature!

This simple Rational Speech Acts model was introduced in Frank and Goodman (2012) and Goodman and Stuhlmueller (2013). It is similar to the Iterated Best Response, and other game theoretic models of pragmatics. The RSA has been extended and applied to a host of phenomena.




# Optimizing inference

## Combining factor and sample

The search space in `speaker` and `literalListener` is needlessly big because the factors provide hard constraints on what the embedded listener/speaker can return. Indeed, `factor( v == sample(e) ?0:-Infinity)` for an ERP `e` is equivalent to `factor(e.score(v))`.

~~~
var speaker = function(world) {
  Enumerate(function(){
    var utterance = utterancePrior()
    var L = literalListener(utterance)
    factor(L.score([],world))
    return utterance
  })
}

var listener = function(utterance) {
  Enumerate(function(){
    var world = worldPrior()
    var S = speaker(world)
    factor(S.score([],utterance))
    return world
  })
}

print(listener("some of the people are nice"))
~~~


## Caching

~~~
var literalListener = cache(function(utterance) {
  Enumerate(function(){
    var world = worldPrior()
    var m = meaning(utterance, world)
    factor(m?0:-Infinity)
    return world
  })
})


var speaker = cache(function(world) {
  Enumerate(function(){
    var utterance = utterancePrior()
    var L = literalListener(utterance)
    factor(L.score([],world))
    return utterance
  })
})

var listener = function(utterance) {
  Enumerate(function(){
    var world = worldPrior()
    var S = speaker(world)
    factor(S.score([],utterance))
    return world
  })
}

print(listener("some of the people are nice"))
~~~




# With semantic parsing

What if we want more complex worlds, and don't want to hard code the meaning of sentences? The section on [semantic parsing](semantic parsing.html) shows how to implement a literal listener that does a CCG-like parsing process, to compute the meaning value of a sentence in a world by 'direct compositionality'. We can simply plug that parsing model in to the above pragmatic speaker and listener.
(Note: still debugging this one...)

~~~
var makeObj = function(name) {
  return {name: name, blond: flip(0.5), nice: flip(0.5)}
}

var worldPrior = function(objs) {
  return [makeObj("Bob"), makeObj("Bill"), makeObj("Alice")]
}

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

var neg = function(Q){return function(x){return !Q(x)}}

var syntaxMatch = function(s,t) {
  return !(Array.isArray(s)) ? s==t :
  s.length==0? t.length==0 : (syntaxMatch(s[0], t[0]) & syntaxMatch(s.slice(1),t.slice(1)))
}

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

var combine_meanings = function(meanings){
  return meanings.length==1 ? meanings[0].sem : combine_meanings(combine_meaning(meanings))
}

var meaning = function(utterance, world) {
  return combine_meanings( filter(map(utterance.split(" "),
                                      function(w){return lexical_meaning(w, world)}),
                                  function(m){return !(m.sem==undefined)}))
}

var utterancePrior = function() {
  var utterances = ["some of the blond people are nice",
                    "all of the blond people are nice",
                    "none of the blond people are nice"]
  var i = randomInteger(utterances.length)
  return utterances[i]
}

var literalListener = cache(function(utterance) {
  Enumerate(function(){
    var world = worldPrior()
    var m = meaning(utterance, world)
    factor(m?0:-Infinity)
    return world
  }, 100)
})

var speaker = cache(function(world) {
  Enumerate(function(){
    var utterance = utterancePrior()
    var L = literalListener(utterance)
    factor(L.score(world))
    return utterance
  }, 100)
})

var listener = function(utterance) {
  Enumerate(function(){
    var world = worldPrior()
    var S = speaker(world)
    factor(S.score(utterance))
    return world
  }, 100)
}

listener("some of the blond people are nice")
~~~


<!---
# With free indices

--->




<!---
TODO:
*transform speaker / listener factor to avoid sampling?
*incrementalize the literalListener worldPrior / meaning recursion: make meaning apply to partial worlds?
*incrementalize speaker: make literalListener apply to partial utterances?
*caching, with interpolation?
*softmax
*free index vars / QUD
--->
