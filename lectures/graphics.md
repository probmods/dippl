---
layout: lecture
title: WebPPL for computer graphics
description: Render to canvas, condition on output
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

Loading an image (synchronously):

~~~~
var myDraw = Draw(200, 200, true);
loadImage(myDraw, "/esslli2014/assets/img/the_scream.jpg");
~~~~

Computing the distance between two images:

~~~~
var imageCanvas = Draw(200, 200, true);
loadImage(imageCanvas, "/esslli2014/assets/img/the_scream.jpg")

var lineCanvas = Draw(200, 200, true);
loadImage(lineCanvas, "/esslli2014/assets/img/the_scream.jpg")
var x1 = randomInteger(200);
var y1 = randomInteger(200);    
var x2 = randomInteger(200);
var y2 = randomInteger(200);        
lineCanvas.line(x1, y1, x2, y2);

imageCanvas.distance(lineCanvas);
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
  return (lines.length == 1) ? "done" : drawLines(lines.slice(1));
}

var lines = makeLines(100, []);

drawLines(lines);
~~~~

Inferring lines that match an image:

~~~~
var targetImage = Draw(50, 50, true);
loadImage(targetImage, "/esslli2014/assets/img/box.png")

var drawLines = function(drawObj, lines){
  var line = lines[0];
  drawObj.line(line[0], line[1], line[2], line[3]);
  return (lines.length == 1) ? "done" : drawLines(drawObj, lines.slice(1));
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
  var newScore = -targetImage.distance(generatedImage)/1000;
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
