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
              }, 100)
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
    return  utt=="some of the people are nice"? world>0 :
            utt=="all of the people are nice"? world==3 :
            utt=="none of the people are nice"? world==0 :
            true
}
~~~

If you evaluate `literalListener("some of the people are nice")` in the above code box, you will see that the inferred meaning is uniform on all world states where at least one person is nice -- including the state in which all people are nice. This fails to capture the usual 'some but not all' scalar implicature.

We can move to a more Gricean listener who assumes that the speaker has chosen an utterance to convey the intended state of the world: 

~~~
var speaker = function(world) {
    Enumerate(function(){
              var utterance = utterancePrior()
              factor(world == sample(literalListener(utterance)) ?0:-Infinity)
              return utterance
              },100)
}

var listener = function(utterance) {
    Enumerate(function(){
              var world = worldPrior()
              factor(utterance == sample(speaker(world)) ?0:-Infinity)
              return world
              },100)
}
~~~

If you evaluate `literal("some of the people are nice")` in the above code box you will see that it does capture the scalar implicature!

This simple Rational Speech Acts model was introduced in Frank and Goodman (2012) and Goodman and Stuhlmueller (2013). It is similar to the Iterated Best Response, and other game theoretic models of pragmatics. The RSA has been extended and applied to a host of phenomena.



# With semantic parsing

What if we want more complex worlds, and don't want to hard code the meaning of sentences? The section on [semantic parsing](semantic parsing.html) shows how to implement a literal listener that does a CCG-like parsing process, to compute the meaning value of a sentence in a world by 'direct compositionality'. We can simply plug that parsing model in to the above pragmatic speaker and listener.


<!---
# With free indices

--->







# Optimizing inference

## Combining factor and sample

The search space in `speaker` and `literalListener` is needlessly big because the factors provide hard constraints on what the embedded listener/speaker can return. Indeed, `factor( v == sample(e) ?0:-Infinity)` for an ERP `e` is equivalent to `factor(e.score(v))`.

~~~
var speaker = function(world) {
    Enumerate(function(){
              var utterance = utterancePrior()
              var L = literalListener(utterance)
              factor(L.score(world))
              return utterance
              },100)
}

var listener = function(utterance) {
    Enumerate(function(){
              var world = worldPrior()
              var S = speaker(world)
              factor(S.score(utterance))
              return world
              },100)
}
~~~

## Caching

~~~
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
              },100)
})

var listener = function(utterance) {
    Enumerate(function(){
              var world = worldPrior()
              var S = speaker(world)
              factor(S.score(utterance))
              return world
              },100)
}
~~~


<!---
TODO:
*transform speaker / listener factor to avoid sampling?
*incrementalize the literalListener worldPrior / meaning recursion: make meaning apply to partial worlds?
*incrementalize speaker: make literalListener apply to partial utterances?
*caching, with interpolation?
*softmax
*free index vars / QUD
--->
