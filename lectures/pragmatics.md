---
layout: lecture
title: Rational Speech Acts models of pragmatics
description: Modeling pragmatic language understanding in WebPPL.
---


The world is some number of objects with three random (binary) properties:

~~~
var makeObj = function() {
    return [flip(0.3), flip(0.3), flip(0.3)]
}

var worldPrior = function(objs) {
    var objs = objs?objs:[]
    return flip(0.5) ? worldPrior(objs.concat([makeObj()])) : objs
}
~~~

utterancePrior, meaning function...


~~~
var literalListener = function(utterance) {
    Enumerate(function(){
              var world = worldPrior()
              factor(meaning(utterance, world) ?0:-Infinity)
              return world
              }, 100)
}

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


# Optimizing inference

## Combining factor and sample

The search space in `speaker` and `literalListener` is needlessly big because the factors provide hard constraints on what the embedded listener/speaker can return. Indeed, `factor( v == sample(e) ?0:-Infinity)` for an ERP `e` is equivalent to `factor(e.score(v))`.

~~~
var literalListener = function(utterance) {
    Enumerate(function(){
              var world = worldPrior()
              factor(meaning(utterance, world) ?0:-Infinity)
              return world
              }, 100)
}

var speaker = function(world) {
    Enumerate(function(){
              var utterance = utterancePrior()
              factor(literalListener(utterance).score(world))
              return utterance
              },100)
}

var listener = function(utterance) {
    Enumerate(function(){
              var world = worldPrior()
              factor(speaker(world).score(utterance))
              return world
              },100)
}
~~~




TODO:
*transform speaker / listener factor to avoid sampling?
*incrementalize the literalListener worldPrior / meaning recursion: make meaning apply to partial worlds?
*incrementalize speaker: make literalListener apply to partial utterances?
*caching, with interpolation?
*softmax
*free index vars / QUD
