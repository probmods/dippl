---
layout: default
title: Computer vision and language
description: Combining vision with semantics and pragmatics
---

Combining vision with semantics and pragmatics

~~~~
///fold:
// helpers
var multinomial = function(s, p) { return s[discrete(p)] }
var uniformDraw = function(l) {return l[randomInteger(l.length)]}

var neg = function(Q){ return function(x){return !Q(x)} }
var applyWorldPassing = function(f,a) { return function(w){return f(w)(a(w))} }

var maxF = function(f,ar) {
  var fn = function(_ar, _best) {
    if (_ar.length == 0) {
      return _best
    } else if (_ar[0][1] > _best[1]) {
      return fn(_ar.slice(1), _ar[0])
    } else {
      return fn(_ar.slice(1), _best)
    }
  }
  return fn(zip(ar,map(f,ar)), [-Infinity,-Infinity])
}

///

// language: ccg

var lexical_meaning = function(word) {

  var lexicon = {
    "blue" : {
      sem: function(world) {return function(obj){return obj.blue}},
      syn: {dir:'L', int:'NP', out:'S'} },

    "green" : {
      sem: function(world) {return function(obj){return !obj.blue}},
      syn: {dir:'L', int:'NP', out:'S'} },

    "squares" : {
      sem: function(world) {return function(obj){return obj.square}},
      syn: {dir:'L', int:'NP', out:'S'} },

    "triangles" : {
      sem: function(world) {return function(obj){return !obj.square}},
      syn: {dir:'L', int:'NP', out:'S'} },

    "some" : {
      sem: function(world){
        return function(P){
          return function(Q){
            return filter(Q, filter(P, world)).length>0}}},
      syn: {dir:'R',
            int:{dir:'L', int:'NP', out:'S'},
            out:{dir:'R',
                 int:{dir:'L', int:'NP', out:'S'},
                 out:'S'}} },

    "all" : {
      sem: function(world){
        return function(P){
          return function(Q){
            var first = filter(P, world)
            return first.length != 0 & filter(neg(Q), first).length==0
            // return first.length == world.length & filter(neg(Q), first).length==0
          }}},
      syn: {dir:'R',
            int:{dir:'L', int:'NP', out:'S'},
            out:{dir:'R',
                 int:{dir:'L', int:'NP', out:'S'},
                 out:'S'}} },

    "none" : {
      sem: function(world){
        return function(P){
          return function(Q){
            var first = filter(P, world)
            return first.length != 0 & filter(Q, first).length==0
            // return first.length == world.length & filter(Q, first).length==0
          }}},
      syn: {dir:'R',
            int:{dir:'L', int:'NP', out:'S'},
            out:{dir:'R',
                 int:{dir:'L', int:'NP', out:'S'},
                 out:'S'}} }

  }

  var meaning = lexicon[word]
  return meaning == undefined ? {sem: undefined, syn: ''} : meaning
}

var syntaxMatch = function(s,t) {
  return s.hasOwnProperty('dir')
    ? s.dir == t.dir & syntaxMatch(s.int,t.int) & syntaxMatch(s.out,t.out)
    : s == t
}

var canApply = function(meanings,i) {
  if(i == meanings.length) { return [] }
  var s = meanings[i].syn
  if (s.hasOwnProperty('dir')){ // a functor
    var a = ((s.dir == 'L') ? syntaxMatch(s.int, meanings[i-1].syn) : false) |
        ((s.dir == 'R') ? syntaxMatch(s.int, meanings[i+1].syn) : false)
    if (a) { return [i].concat(canApply(meanings,i+1)) }
  }
  return canApply(meanings,i+1)
}

var combine_meaning = function(meanings) {
  var possibleComb = canApply(meanings,0)
  var i = uniformDraw(possibleComb)
  var s = meanings[i].syn
  var f = meanings[i].sem
  if (s.dir == 'L') {
    var a = meanings[i-1].sem
    var newmeaning = {sem: applyWorldPassing(f,a), syn: s.out}
    return meanings.slice(0,i-1).concat([newmeaning]).concat(meanings.slice(i+1))
  }
  if (s.dir == 'R') {
    var a = meanings[i+1].sem
    var newmeaning = {sem: applyWorldPassing(f,a), syn: s.out}
    return meanings.slice(0,i).concat([newmeaning]).concat(meanings.slice(i+2))
  }
}

var combine_meanings = function(meanings){
  return meanings.length == 1
    ? meanings[0].sem
    : combine_meanings(combine_meaning(meanings))
}

var meaning = function(utterance) {
  return combine_meanings(
    filter(function(m){return !(m.sem == undefined)},
           map(lexical_meaning, utterance.split(" "))))
}

// world: construction

var makeObj = function() {
  return {pos: [randomInteger(200), randomInteger(200)],
          blue: flip(0.5), // !blue = green;
          square: flip(0.5)} // !square = triangle
}

var worldPrior = function(nObjLeft, meaningFn, worldSoFar, prevFactor) {
  var worldSoFar = worldSoFar == undefined ? [] : worldSoFar
  var prevFactor = prevFactor == undefined ?  0 : prevFactor
  if(nObjLeft==0) {
    factor(-prevFactor)
    return worldSoFar
  } else {
    var newObj = makeObj()
    var newWorld = worldSoFar.concat([newObj])
    var newFactor = meaningFn(newWorld) ? 0 : -100
    factor(newFactor - prevFactor)
    return worldPrior(nObjLeft-1, meaningFn, newWorld, newFactor)
  }
}

// global priors

var utterancePrior = function() {
  var utterances = ["some of the squares are blue",
                    "all of the squares are blue",
                    "none of the squares are blue",
                    "some of the squares are green",
                    "all of the squares are green",
                    "none of the squares are green",
                    "some of the triangles are blue",
                    "all of the triangles are blue",
                    "none of the triangles are blue",
                    "some of the triangles are green",
                    "all of the triangles are green",
                    "none of the triangles are green"]
  return uniformDraw(utterances)
}

// Image utilities
// 1. comparing worlds is greedy, best first
// 2. parseimage is currently based on lookup -- should actually do some cv

var renderImg = function(imgObj, world) {
  var fn = function (w) {
    if (w.length != 0) {
      var colour = w[0].blue ? 'blue' : 'green'
      var nsides = w[0].square ? 4 : 3
      imgObj.polygon(w[0].pos[0], w[0].pos[1], nsides, undefined, colour)
      fn(w.slice(1))
    }
  }
  fn(world)
}

var worldMatch = function(world1, world2) {
  var objMatch = function(obj1, obj2) {
    // doesn't consider position distance yet
    return obj1.square != obj2.square | obj1.blue != obj2.blue ? -5 : 0
  }
  var fn = function(w1, w2, _accf) {
    if (w1.length == 0 | w2.length == 0) {
      return _accf - (Math.abs(w1.length - w2.length) * 10)
    } else {
      var _elem = maxF(function(o2) { return objMatch(w1[0],o2) }, w2)
      return fn(w1.slice(1), remove(_elem[0], w2), _accf + _elem[1])
    }
  }
  return fn(world1, world2, 0)
}

// data
// initially this was made externally, but now just make with internal libs

var imageDataset = [
  ["all_sq_blue", [{pos: [ 50,  50], blue: true, square: true},
                   {pos: [150,  50], blue: true, square: true},
                   {pos: [150, 150], blue: true, square: true}]],
  ["all_sq_green", [{pos: [ 50,  50], blue: false, square: true},
                    {pos: [150,  50], blue: false, square: true},
                    {pos: [ 50, 150], blue: false, square: true}]],
  ["some_sq_blue", [{pos: [ 50,  50], blue: true, square: true},
                    {pos: [150, 150], blue: false, square: true},
                    {pos: [150,  50], blue: true, square: true}]],
  ["some_sq_green", [{pos: [ 50, 150], blue: false, square: true},
                     {pos: [150, 150], blue: false, square: true},
                     {pos: [150,  50], blue: true, square: true}]],
  ["all_tri_blue", [{pos: [ 50,  50], blue: true, square: false},
                    {pos: [150,  50], blue: true, square: false},
                    {pos: [150, 150], blue: true, square: false}]],
  ["all_tri_green", [{pos: [ 50,  50], blue: false, square: false},
                     {pos: [150,  50], blue: false, square: false},
                     {pos: [ 50, 150], blue: false, square: false}]],
  ["some_tri_blue", [{pos: [ 50,  50], blue: true, square: false},
                     {pos: [150, 150], blue: false, square: false},
                     {pos: [150,  50], blue: true, square: false}]],
  ["some_tri_green", [{pos: [ 50, 150], blue: false, square: false},
                      {pos: [150, 150], blue: false, square: false},
                      {pos: [150,  50], blue: true, square: false}]]
]

// model

var printW = function(w) {
  var printE = function(e) {
    return (e.blue ? "blue" : "green") + " " + (e.square ? "square" : "triangle")
  }
  return map(printE,w).join(", ")
}

var parseImage = function(img) {
  // somewhat ugly hack: does a lookup on the dataset to find correct world.
  // this is where actual cv stuff happens :: image -> scene/world
  var r = find(function(i) {return img == i[0]}, imageDataset)
  return r[1]
}

var literalListener = function(meaningFn, targetWorld) {
  ParticleFilter(function(){
    // var nelems = binomial(0.6,5)+1
    // if (nelems == 0) console.log("zero elements!")
    var nelems = 3
    var world = worldPrior(nelems,meaningFn)
    factor(meaningFn(world) ? 0 : -Infinity)
    return world
  }, 40)
}

var speaker = function(img) {
  ParticleFilter(function(){
    var pw = parseImage(img)
    var utterance = utterancePrior()
    var m = meaning(utterance)
    var w = literalListener(m,pw)
    console.log("dist size: ", w.support([]).length)
    var score = expectation(w, function(s) {
      // for stack size issues
      var match = function(){ return worldMatch(pw,s) }
      return withEmptyStack(match)
    })
    factor(score)
    return utterance
  }, 80)
}

// var targetImage = Draw(200, 200, true);
// loadImage(targetImage, "/assets/img/some_sq_blue.png")
var _f = uniformDraw(imageDataset)
print(_f[0])
var targetImage = Draw(200, 200, true);
renderImg(targetImage, _f[1])
print(speaker(_f[0]))
~~~~

#### Notes
1. when we want stochasticity in meaning, push into literalListener, else keep
   outside for efficiency.
2. when particle filter is saturated with just one sample, make sure
   expectations etc, can handle that.
3. Clipart instead of squares and triangles, maybe slightly larger images to
   accommodate such. (I like foxes and hens)
    - google for foxes and hens
    - google for knights and dragons
    - [MS Abstract Scenes](http://research.microsoft.com/en-us/um/people/larryz/clipart/abstract_scenes.html)
