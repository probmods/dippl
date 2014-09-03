---
layout: example
title: Computer vision
description: Finding latent structure that renders to a target image.
---

Drawing a line:

~~~~
var myDraw = Draw(200, 200, true);
var x1 = randomInteger(200);
var y1 = randomInteger(200);
var x2 = randomInteger(200);
var y2 = randomInteger(200);
myDraw.line(x1, y1, x2, y2);
~~~~

Drawing many lines:

~~~~
var myDraw = Draw(200, 200, true);

var makeLines = function(n, xs){
  var x1 = randomInteger(200);
  var y1 = randomInteger(200);
  var x2 = randomInteger(200);
  var y2 = randomInteger(200);
  var xs2 = xs.concat([[x1, y1, x2, y2]]);
  return (n==0) ? xs : makeLines(n-1, xs2);
}

var drawLines = function(lines){
  var line = lines[0];
  myDraw.line(line[0], line[1], line[2], line[3]);
  if (lines.length > 1) {
    drawLines(lines.slice(1));
  }
}

var lines = makeLines(20, []);

drawLines(lines);
~~~~

Loading images:

~~~~
var myDraw1 = Draw(200, 200, true);
loadImage(myDraw1, "/assets/img/the_scream.jpg");

var myDraw2 = Draw(200, 200, true);
loadImage(myDraw2, "/assets/img/box.png");
~~~~

Computing the pixel-by-pixel distance between two images:

~~~~
var myDraw1 = Draw(200, 200, false);
loadImage(myDraw1, "/assets/img/the_scream.jpg");

var myDraw2 = Draw(200, 200, false);
loadImage(myDraw2, "/assets/img/box.png");

myDraw1.distance(myDraw2);
~~~~

Target image:

~~~~
var targetImage = Draw(50, 50, true);
loadImage(targetImage, "/assets/img/box.png")
~~~~

Inferring lines that match the target image:

~~~~
var targetImage = Draw(50, 50, false);
loadImage(targetImage, "/assets/img/box.png")

var drawLines = function(drawObj, lines){
  var line = lines[0];
  drawObj.line(line[0], line[1], line[2], line[3]);
  if (lines.length > 1) {
    drawLines(drawObj, lines.slice(1));
  }
}

var makeLines = function(n, lines, prevScore){
  // Add a random line to the set of lines
  var x1 = randomInteger(50);
  var y1 = randomInteger(50);
  var x2 = randomInteger(50);
  var y2 = randomInteger(50);
  var newLines = lines.concat([[x1, y1, x2, y2]]);
  // Compute image from set of lines
  var generatedImage = Draw(50, 50, false);
  drawLines(generatedImage, newLines);
  // Factor prefers images that are close to target image
  var newScore = -targetImage.distance(generatedImage)/1000; // Increase to 10000 to see more diverse samples
  factor(newScore - prevScore);
  generatedImage.destroy();
  // Generate remaining lines (unless done)
  return (n==1) ? newLines : makeLines(n-1, newLines, newScore);
}

ParticleFilter(
  function(){
    var lines = makeLines(4, [], 0);
    var finalGeneratedImage = Draw(50, 50, true);
	drawLines(finalGeneratedImage, lines);
   }, 100)
~~~~

Inference using MCMC and with a model that can manipulate opacity and stroke width:

~~~~
///fold:
var targetImage = Draw(50, 50, false);
loadImage(targetImage, "/assets/img/box.png")

var uniformDraw = function(xs){
  var i = randomInteger(xs.length);
  return xs[i];
}

var drawLines = function(drawObj, lines){
  var line = lines[0];
  drawObj.line(line[0], line[1], line[2], line[3], line[4], line[5]);
  if (lines.length > 1) {
    drawLines(drawObj, lines.slice(1));
  }
}

var randomStrokeWidth = function(){
  var widths = [2, 4, 8, 16];
  return uniformDraw(widths);
}

var randomOpacity = function(){
  var opacities = [0, .5];
  return uniformDraw(opacities);
}

var makeLines = function(n, lines){
  var x1 = randomInteger(50);
  var y1 = randomInteger(50);
  var x2 = randomInteger(50);
  var y2 = randomInteger(50);
  var strokeWidth = randomStrokeWidth();
  var opacity = randomOpacity();
  var newLines = lines.concat([[x1, y1, x2, y2, strokeWidth, opacity]]);
  return (n==1) ? newLines : makeLines(n-1, newLines);
}

var finalImgSampler = MH(
  function(){
    var lines = makeLines(4, []);
    var finalGeneratedImage = Draw(50, 50, true);
    drawLines(finalGeneratedImage, lines);
    var newScore = -targetImage.distance(finalGeneratedImage)/1000; // Increase to 10000 to see more diverse samples
    factor(newScore);
    // print(newScore);
    return lines
   }, 1000)
///

var finalImage = Draw(100, 100, false);
var finalLines = sample(finalImgSampler);
drawLines(finalImage, finalLines);
~~~~

A more colorful target image:

~~~~
var targetImage = Draw(50, 50, true);
loadImage(targetImage, "/assets/img/beach.png")
~~~~

A richer image prior:

~~~~
///fold:
var targetImage = Draw(50, 50, true);
loadImage(targetImage, "/assets/img/beach.png")

var uniformDraw = function(xs){
  var i = randomInteger(xs.length);
  return xs[i];
}

var drawLines = function(drawObj, lines){
  var line = lines[0];
  drawObj.line(line[0], line[1], line[2], line[3], line[4], line[5], line[6]);
  if (lines.length > 1) {
    drawLines(drawObj, lines.slice(1));
  }
}

var randomStrokeWidth = function(){
  var widths = [2, 4, 8, 16];
  return uniformDraw(widths);
}

var randomOpacity = function(){
  var opacities = [0, 0.2, .5];
  return uniformDraw(opacities);
}

var _getRandomColor = function(i) {
  if (i == 0){
    return "";
  } else {
    // var letters = '0123456789ABCDEF'.split('');
    var color = '#';
    return uniformDraw('04AF') + _getRandomColor(i-1);
  }
}

var randomColor = function(){
  return "#" + _getRandomColor(6);
}

var makeLines = function(n, lines){
  var x1 = randomInteger(50);
  var y1 = randomInteger(50);
  var x2 = randomInteger(50);
  var y2 = randomInteger(50);
  var strokeWidth = randomStrokeWidth();
  var opacity = randomOpacity();
  var color = randomColor();
  var newLines = lines.concat([[x1, y1, x2, y2, strokeWidth, opacity, color]]);
  return (n==1) ? newLines : makeLines(n-1, newLines);
}
///

MH(
  function(){
    var lines = makeLines(8, []);
    var finalGeneratedImage = Draw(50, 50, true);
    drawLines(finalGeneratedImage, lines);
    var newScore = -targetImage.distance(finalGeneratedImage)/1000; // Increase to 10000 to see more diverse samples
    factor(newScore);
    // print(newScore);
    return lines
   }, 1000)
~~~~

Combining vision with semantics and pragmatics

~~~~
var multinomial = function(s, p) { return s[discrete(p)] }

var makeObj = function() {
  return {pos: [randomInteger(200), randomInteger(200)],
          // pos: multinomial([[50, 50], [50, 150], [150, 50], [150, 150]], [0.25, 0.25, 0.25, 0.25]),
          blue: flip(0.5),
          square: flip(0.5)} // !blue = green; !square = triangle
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
    filter(map(utterance.split(" "), lexical_meaning),
           function(m){return !(m.sem==undefined)}))
}

var lexical_meaning = function(word) {

  var wordMeanings = {
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
            return filter(filter(world, P), Q).length>0}}},
      syn: {dir:'R',
            int:{dir:'L', int:'NP', out:'S'},
            out:{dir:'R',
                 int:{dir:'L', int:'NP', out:'S'},
                 out:'S'}} },

    "all" : {
      sem: function(world){
        return function(P){
          return function(Q){
            var first = filter(world, P)
            return first.length != 0 & filter(first, neg(Q)).length==0}}},
      syn: {dir:'R',
            int:{dir:'L', int:'NP', out:'S'},
            out:{dir:'R',
                 int:{dir:'L', int:'NP', out:'S'},
                 out:'S'}} },

    "none" : {
      sem: function(world){
        return function(P){
          return function(Q){
            var first = filter(world, P)
            return first.length != 0 & filter(first, Q).length==0}}},
      syn: {dir:'R',
            int:{dir:'L', int:'NP', out:'S'},
            out:{dir:'R',
                 int:{dir:'L', int:'NP', out:'S'},
                 out:'S'}} },

    "not" : {
      sem: function(world){ return neg },
      syn: {dir:'R',
            int:{dir:'L', int:'NP', out:'S'},
            out:{dir:'L', int:'NP', out:'S'} }
      }
  }

  var meaning = wordMeanings[word];
  return meaning == undefined?{sem: undefined, syn: ''}:meaning;
}

var neg = function(Q){ return function(x){return !Q(x)} }

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
  return meanings.length==1
    ? meanings[0].sem
    : combine_meanings(combine_meaning(meanings))
}

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
  var i = randomInteger(utterances.length)
  return utterances[i]
}

var toInt = function(v) {return Math.floor(v)}

var shapeCircumRadius = 20
var polygonVerts = function(n, nverts, at, ps) {
  var newps = ps.concat(
    [[toInt(at[0] + shapeCircumRadius * Math.cos(2 * Math.PI * n / nverts)),
      toInt(at[1] + shapeCircumRadius * Math.sin(2 * Math.PI * n / nverts))]]
  )
  return (n == 1) ? newps.concat([ps[0]]) : polygonVerts(n-1, nverts, at, newps)
}

var drawPolygon = function(d, n, at, colour) {
  var fn = function(ps) {
    if (ps.length != 1) {
      d.line(ps[0][0], ps[0][1], ps[1][0], ps[1][1], 4, undefined, colour);
      fn(ps.slice(1));
    }
  }
  fn(polygonVerts(n, n, at, []))
}

var renderImg = function(imgObj, world) {
  var fn = function (w) {
    if (w.length != 0) {
      var colour = w[0].blue ? 'blue' : 'green'
      var nsides = w[0].square ? 4 : 3
      drawPolygon(imgObj, nsides, w[0].pos, colour)
      fn(w.slice(1))
    }
  }
  fn(world)
}

var literalListener = function(utterance) {
  ParticleFilter(function(){
    var m = meaning(utterance)
    var world = worldPrior(3,m)
    factor(m(world)?0:-Infinity)
    return world
  }, 100)
}

var speaker = function(img) {
 ParticleFilter(function(){
   var utterance = utterancePrior()
   var L = literalListener(utterance)
   var newimg = Draw(200, 200, false)
   renderImg(img, sample(L))
   var newscore = -img.distance(newimg)/1000
   //newimg.destroy()
   factor(newscore)
   return utterance
 }, 100)
}

// literalListener("all of the squares are blue")

var targetImage = Draw(200, 200, true);
loadImage(targetImage, "/assets/img/some_sq_blue.png")
print(speaker(targetImage))

~~~~
