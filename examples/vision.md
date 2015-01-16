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
var targetImage = Draw(50, 50, false);
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
  var y2 = y1;
  var strokeWidth = randomStrokeWidth();
  var opacity = randomOpacity();
  var color = randomColor();
  var newLines = lines.concat([[x1, y1, x2, y2, strokeWidth, opacity, color]]);
  return (n==1) ? newLines : makeLines(n-1, newLines);
}
///

var counter = [];

MH(
  function(){
    var lines = makeLines(8, []);
    

    var showOutputImage = (counter.length % 100 == 0);
    var finalGeneratedImage = Draw(50, 50, showOutputImage);

    drawLines(finalGeneratedImage, lines);
    var newScore = -targetImage.distance(finalGeneratedImage)/1000; // Increase to 10000 to see more diverse samples
    factor(newScore);
    
    if (!showOutputImage) {
      finalGeneratedImage.destroy()
    }
    
    counter.push(1);
    
    return lines
   }, 2500);

// show target image for comparison
loadImage(Draw(50, 50, true), "/assets/img/beach.png")
~~~~
