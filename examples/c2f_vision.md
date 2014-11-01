---
layout: hidden
title: Coarse-to-Fine inference for vision
---

Here, we explore the application of a general coarse-to-fine approach through
the use of heuristic factors as shown
[here](http://dippl.org/examples/coarsetofine2), to computer vision.

Inference in the image domain lends itself rather well to a heirarchical view,
since it is easier to reason about some aspects of an image at a higher level
of abstraction, and some other aspects at a lower level of abstraction. One
could reasonably expect that a probabilistic model of interpretation of images
would gain handsomely from such a hierarchical approach.

TODO: setup the classification problem as before

This is an example of sampling an image that best matches a given template --
nominally, sampling individual pixels would be bad, but considering that the
more abstract, ie, lower resolution, the image is, the easier it is to sample a
good match. (This is different from the classification example we had before)

~~~~
///fold:

var uniformDist = function(xs) {
  Enumerate(function(){ return xs[randomInteger(xs.length)] })
}

///

// binary valued image
var pixelVals = [0,1]
var pixelDist = uniformDist(pixelVals)

var imageDist = function(n) {
  Enumerate(
    function() {
	  return repeat(n, function(){return repeat(n, function(){ return sample(pixelDist) })})
	}
  )
}

// // 4x4 exceeds depth
// var observedImage = [[0,0,0,0],
//                      [0,0,0,0],
// 					 [1,1,1,1],
// 					 [1,1,1,1]]

var observedImageH = [[0,0],
                      [1,1]]
var observedImageV = [[0,1],
                      [0,1]]

var matchingScore = function(img, obsimg) {
  return sum(map2(function(i,o){
                    return sum(map2(function(iv,ov){return iv == ov ? 0 : -2} ,i ,o))
				  },
				  img,
				  obsimg))
}

var model = function() {
  var anImage = sample(imageDist(2))
  //print(anImage)
  factor(matchingScore(anImage, observedImageV))
  return anImage
}

print(Enumerate(model))

~~~~
