---
layout: lecture
title: WebPPL for computer graphics
description: Render to canvas, condition on output
---

Drawing a line:

~~~~
Draw.setup()
var x1 = randomInteger(200);
var y1 = randomInteger(200);    
var x2 = randomInteger(200);
var y2 = randomInteger(200);        
Draw.line(x1, y1, x2, y2);
~~~~

Drawing many lines:

~~~~
Draw.setup()

var makeLines = function(n, xs){
  var x1 = randomInteger(200);
  var y1 = randomInteger(200);    
  var x2 = randomInteger(200);
  var y2 = randomInteger(200);        
  var xs2 = xs.concat([[x1, y1, x2, y2]]);
  return (n==0) ? xs : makeLines(n-1, xs2);
}

var drawLines = function(lines){
  return (lines.length == 0) ? "done" : drawLines(lines.slice(1));
}

var lines = makeLines(100, []);

drawLines(lines);
~~~~
