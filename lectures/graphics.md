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

var drawLines = function(n){
  var x1 = randomInteger(200);
  var y1 = randomInteger(200);    
  var x2 = randomInteger(200);
  var y2 = randomInteger(200);        
  Draw.line(x1, y1, x2, y2);
  return (n==0) ? 0 : drawLines(n-1);
}

drawLines(100)
~~~~
