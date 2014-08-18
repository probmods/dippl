---
layout: example
title: Computer vision
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
loadImage(myDraw1, "/esslli2014/assets/img/the_scream.jpg");

var myDraw2 = Draw(200, 200, true);
loadImage(myDraw2, "/esslli2014/assets/img/box.png");
~~~~

Computing the pixel-by-pixel distance between two images:

~~~~
var myDraw1 = Draw(200, 200, false);
loadImage(myDraw1, "/esslli2014/assets/img/the_scream.jpg");

var myDraw2 = Draw(200, 200, false);
loadImage(myDraw2, "/esslli2014/assets/img/box.png");

myDraw1.distance(myDraw2);
~~~~

Target image:

~~~~
var targetImage = Draw(50, 50, true);
loadImage(targetImage, "/esslli2014/assets/img/box.png")
~~~~

Inferring lines that match the target image:

~~~~
var targetImage = Draw(50, 50, false);
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
