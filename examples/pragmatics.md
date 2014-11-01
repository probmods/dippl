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
///fold:
var literalListener = function(utterance) {
  Enumerate(function(){
    var world = worldPrior()
    var m = meaning(utterance, world)
    factor(m?0:-Infinity)
    return world
  })
}
///

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
///fold:
var literalListener = function(utterance) {
  Enumerate(function(){
    var world = worldPrior()
    var m = meaning(utterance, world)
    factor(m?0:-Infinity)
    return world
  })
}

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
///

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




## Optimizing inference

### Combining factor and sample

The search space in `speaker` and `literalListener` is needlessly big because the factors provide hard constraints on what the embedded listener/speaker can return. Indeed, `factor( v == sample(e) ?0:-Infinity)` for an ERP `e` is equivalent to `factor(e.score(v))`.

~~~
///fold:
var literalListener = function(utterance) {
  Enumerate(function(){
    var world = worldPrior()
    var m = meaning(utterance, world)
    factor(m?0:-Infinity)
    return world
  })
}

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
///

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


### Caching

~~~
///fold:
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
///

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




## With semantic parsing

What if we want more complex worlds, and don't want to hard code the meaning of sentences? The section on [semantic parsing](semanticparsing.html) shows how to implement a literal listener that  computes the meaning value of a sentence by compositionally building it up from the meanings of words. We can simply plug that parsing model in to the above pragmatic speaker and listener, resulting in a [combined model](zSemanticPragmaticMashup.html).


<!---

(Note: still debugging this one...)

~~~
var makeObj = function(name) {
  return {name: name, blond: flip(0.5), nice: flip(0.5)}
}

var worldPrior = function(objs) {
  return [makeObj("Bob"), makeObj("Bill"), makeObj("Alice")]
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

var neg = function(Q){return function(x){return !Q(x)}}

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

var syntaxMatch = function(s,t) {
  return !s.hasOwnProperty('dir') ? s==t :
  s.dir==t.dir & syntaxMatch(s.int,t.int) & syntaxMatch(s.out,t.out)
}

var combine_meanings = function(meanings){
  return meanings.length==1 ? meanings[0].sem : combine_meanings(combine_meaning(meanings))
}

var meaning = function(utterance, world) {
  return combine_meanings(
    filter(function(m){return !(m.sem==undefined)},
	       map(function(w){return lexical_meaning(w, world)},
	           utterance.split(" "))))
}

var utterancePrior = function() {
  var utterances = ["some of the blond people are nice",
                    "all of the blond people are nice"]
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
    factor(L.score([],world))
    return utterance
  }, 100)
})

var listener = function(utterance) {
  Enumerate(function(){
    var world = worldPrior()
    var S = speaker(world)
    factor(S.score([],utterance))
    return world
  }, 100)
}

print(listener("some of the blond people are nice"))
~~~

--->

<!---
## With free indices

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
