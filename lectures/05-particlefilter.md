---
layout: lecture
title: Particle Filtering
description: Simple parsing models. Sequential Monte Carlo techniques.
---


## Models with large state spaces

For many models with large state spaces, enumeration is infeasible, even if we use smart prioritization. This is particularly clear for models with continuous random variables, where the state space is infinite. 

Let's look at a few examples.


### Vision

~~~~
var targetImage = Draw(50, 50, false);
loadImage(targetImage, "/esslli2014/assets/img/box.png")

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

Enumerate(
  function(){
    var lines = makeLines(4, [], 0);
    var finalGeneratedImage = Draw(50, 50, true);
	drawLines(finalGeneratedImage, lines);    
   }, 100)
~~~~


### Gaussian random walk

~~~~
var drawPositions = function(canvas, start, positions){
  if (positions.length == 0) {
    return [];
  }
  var next = positions[0];  
  canvas.line(start[0], start[1], next[0], next[1], 4, 0.2);
  drawPositions(canvas, next, positions.slice(1));
}

var canvas = Draw(400, 400, true)



var init = function(dim){
  return repeat(dim, function(){ return gaussian(200, 1) });
}

var transition = function(pos){
  return map(
    pos,
    function(x){ return gaussian(x, 10); }
  );
};

var last = function(xs){
  return xs[xs.length - 1];
}

var gaussianRandomWalk = function(n, dim) {
  var prevStates = (n==1) ? [init(dim)] : gaussianRandomWalk(n-1, dim);
  var newState = transition(last(prevStates));
  return prevStates.concat([newState]);
};

var positions = gaussianRandomWalk(100, 2);

drawPositions(canvas, positions[0], positions.slice(1))
~~~~

### Semi-Markov random walk

~~~~
var drawPositions = function(canvas, start, positions){
  if (positions.length == 0) {
    return [];
  }
  var next = positions[0];  
  canvas.line(start[0], start[1], next[0], next[1], 4, 0.2);
  drawPositions(canvas, next, positions.slice(1));
}

var canvas = Draw(400, 400, true)


var last = function(xs){
  return xs[xs.length - 1];
}

var secondLast = function(xs){
  return xs[xs.length - 2];
}

var map2 = function(ar1,ar2,fn) {
  if (ar1.length==0 | ar2.length==0) {
    return []
  } else {
    return append([fn(ar1[0], ar2[0])], map2(ar1.slice(1), ar2.slice(1), fn));
  }
};


var init = function(dim){
  return repeat(dim, function(){ return gaussian(200, 1) });
}

var transition = function(lastPos, secondLastPos){  
  return map2(
    lastPos,
    secondLastPos,
    function(lastX, secondLastX){ 
      var momentum = (lastX - secondLastX) * .7;
      return gaussian(lastX + momentum, 3); 
    }
  );
};

var semiMarkovWalk = function(n, dim) {
  var prevStates = (n==2) ? [init(dim), init(dim)] : semiMarkovWalk(n-1, dim);
  var newState = transition(last(prevStates), secondLast(prevStates));
  return prevStates.concat([newState]);
};

var positions = semiMarkovWalk(100, 2);

drawPositions(canvas, positions[0], positions.slice(1))
~~~~

### Semi-Hidden Markov model

~~~~
var drawPositions = function(canvas, start, positions){
  if (positions.length == 0) {
    return [];
  }
  var next = positions[0];  
  canvas.line(start[0], start[1], next[0], next[1], 4, 0.2);
  drawPositions(canvas, next, positions.slice(1));
}

var canvas = Draw(400, 400, true)


var last = function(xs){
  return xs[xs.length - 1];
}

var secondLast = function(xs){
  return xs[xs.length - 2];
}

var map2 = function(ar1,ar2,fn) {
  if (ar1.length==0 | ar2.length==0) {
    return []
  } else {
    return append([fn(ar1[0], ar2[0])], map2(ar1.slice(1), ar2.slice(1), fn));
  }
};


var init = function(dim){
  return repeat(dim, function(){ return gaussian(200, 1) });
}

var observe = function(pos){
  return map(
    pos,
    function(x){ return gaussian(x, 5); }
  );
};

var transition = function(lastPos, secondLastPos){  
  return map2(
    lastPos,
    secondLastPos,
    function(lastX, secondLastX){ 
      var momentum = (lastX - secondLastX) * .7;
      return gaussian(lastX + momentum, 3); 
    }
  );
};

var semiMarkovWalk = function(n, dim) {
  var prevStates = (n==2) ? [init(dim), init(dim)] : semiMarkovWalk(n-1, dim);
  var newState = transition(last(prevStates), secondLast(prevStates));
  var newObservation = observe(newState);
  canvas.circle(newObservation[0], newObservation[1], "red", 2);  
  return prevStates.concat([newState]);
};

var positions = semiMarkovWalk(100, 2);

// drawPositions(canvas, positions[0], positions.slice(1))
~~~~

### Gaussian mixture

~~~~
var map2 = function(ar1,ar2,fn) {
  if (ar1.length==0 | ar2.length==0) {
    return []
  } else {
    return append([fn(ar1[0], ar2[0])], map2(ar1.slice(1), ar2.slice(1), fn));
  }
};

var makeGaussian = function(dim){
  var means = repeat(dim, function(){uniform(20, 380)});
  var stds = repeat(dim, function(){uniform(5, 50)});
  return function(){
    return map2(means, stds, gaussian);
  }
}
  
var mixtureWeight = uniform(0, 1);

var gaussian1 = makeGaussian(2);
var gaussian2 = makeGaussian(2);

var gaussianMixture = function(){
  if (flip(mixtureWeight)) {
    return gaussian1();
  } else {
    return gaussian2();
  }
}

var canvas = Draw(400, 400, true);

var points = repeat(100, gaussianMixture);

var drawPoints = function(canvas, points){
  if (points.length > 0) {
    var next = points[0];    
    canvas.circle(next[0], next[1], "black", 2);    
    drawPoints(canvas, points.slice(1));
  }
}

drawPoints(canvas, points)
~~~~


## Importance sampling

How can we estimate the marginal distribution for models such as the ones above?

If there are a large number of execution paths, it is clear that we cannot explore all paths individually. This leaves two possibilities: either we reason about paths more abstractly, or we explore only a subset of paths. In these notes, we focus on the second possibility[^1].

[^1]: Dynamic Programming (caching) can be viewed as an instance of reasoning about many concrete paths at once.

Previously, we have enumerated paths using depth-first search, breadth-first search, and a probability-based priority queue. However, this approach can result in an unrepresentative set of paths for models with large state spaces, and for uncountably infinite state spaces it isn't even clear what exactly we are enumerating.

Random sampling is a promising alternative: if we could sample paths in proportion to their (unnormalized) probability, we could easily get a representative picture of the marginal distribution.

Let's go back to the HMM and let's think about how we could make this work.

Here is a simple HMM with binary states and observations:

~~~~
var hmm = function(states, observations){
  var prevState = states[states.length - 1];
  var state = sample(bernoulliERP, [prevState ? .9 : .1]);
  factor((state == observations[0]) ? 0 : -2);
  if (observations.length == 0) {
    return states;
  } else {
    return hmm(states.concat([state]), observations.slice(1));
  }      
}

var observations = [true, true, true, true];
var startState = false;

print(Enumerate(
  function(){
    return hmm([startState], observations)
  }
))
~~~~

This HMM prefers subsequent states to be similar, and it prefers observations to be similar to the latent state. By far the most likely explanation for the observations `[true, true, true, true]` is that most of the latent states are `true` as well.

As in [lecture 3](/esslli2014/lectures/03-enumeration.html), we are going to think about exploring the computation paths of this model in some detail. For this purpose, it will be helpful to have the HMM available in continuation-passing style:

~~~~
// language: javascript

var cpsHmm = function(k, states, observations){
  var prevState = states[states.length - 1];
  _sample(
    function(state){
      _factor(
        function(){
          if (observations.length == 0) {
            return k(states);
          } else {
            return cpsHmm(k, states.concat([state]), observations.slice(1));
          }      
        },        
        (state == observations[0]) ? 0 : -1);
    },    
    bernoulliERP, 
    [prevState ? .9 : .1]);
}

var runCpsHmm = function(k){
  var observations = [true, true, true, true];
  var startState = false;  
  return cpsHmm(k, [startState], observations);
}
~~~~

We use `_sample` and `_factor` so that we can redefine these functions without overwriting the webppl `sample` and `factor` functions. For now, we define sample to simply sample according to the random primitive's distribution, and factor to do nothing:

~~~~
// language: javascript

var _factor = function(k, score){
  k(undefined);
}

var _sample = function(k, erp, params){
  return sample(k, erp, params);
}
~~~~

If we run the HMM with these sample and factor functions, we see that we sample latent states that reflect the prior distribution of the hmm, but not the posterior distribution that takes into account observations using factors:

~~~~
// language: javascript

runCpsHmm(jsPrint);
~~~~

Let's write some scaffolding so that we can take multiple samples from the prior -- i.e. without taking into account factors -- more easily:

~~~~
// language: javascript


var startCpsComp = undefined;
var samples = [];
var sampleIndex = 0;


var priorExit = function(value){
  
  // Store sampled value
  samples[sampleIndex].value = value;
  
  if (sampleIndex < samples.length-1){
    // If samples left, restart computation for next sample
    sampleIndex += 1;
    return startCpsComp(priorExit);
  } else {  
    // Print all samples
    samples.forEach(jsPrint);
  }
};


var PriorSampler = function(cpsComp, numSamples){  

  // Create placeholders for samples
  for (var i=0; i<numSamples; i++) {
    var sample = {
      index: i,
      value: undefined
    };
    samples.push(sample);
  }
  
  // Run computation from beginning
  startCpsComp = cpsComp;  
  startCpsComp(priorExit);
}


PriorSampler(runCpsHmm, 10);
~~~~

The factors tell us that we should be sampling some paths more often, and some paths less often. If we knew the total factor for each path, we would know which paths we "oversampled" by how much, and which paths we "undersampled". 

Let's accumulate the factor weights with each sample:

~~~~
// language: javascript

var startCpsComp = undefined;
var samples = [];
var sampleIndex = 0;

var _factor = function(k, score){
  samples[sampleIndex].score += score; // NEW
  k(undefined);
}

var priorExit = function(value){
  
  // Store sampled value
  samples[sampleIndex].value = value;
  
  if (sampleIndex < samples.length-1){
    // If samples left, restart computation for next sample
    sampleIndex += 1;
    return startCpsComp(priorExit);
  } else {  
    // Print all samples
    samples.forEach(jsPrint);
  }
};


var PriorSamplerWithWeights = function(cpsComp, numSamples){  

  // Create placeholders for samples
  for (var i=0; i<numSamples; i++) {
    var sample = {
      index: i,
      value: undefined,
      score: 0 // NEW
    };
    samples.push(sample);
  }
  
  // Run computation from beginning
  startCpsComp = cpsComp;  
  startCpsComp(priorExit);
}


PriorSamplerWithWeights(runCpsHmm, 10);
~~~~

Looking at the results, the paths that we oversampled the most -- the paths with the lowest weights -- are paths that result in value `[false,false,false,false,false]`. This makes sense: this execution is very likely under the prior, but for our observations `[true, true, true, true]`, it is not a good explanation.

TODO: Importance sampling math

TODO: Importance sampling for the Gaussian mixture model


## Resampling

What if we want samples instead?

...

Resampling at the end (importance sampling with resampling):

~~~~
// language: javascript

var resample = function(particles){
  var weights = particles.map(
    function(particle){return Math.exp(particle.weight);});
  var newParticles = [];
  for (var i=0; i<particles.length; i++){
    j = multinomialSample(weights);
    newParticles.push(particles[j]);
  }
  return newParticles;
}

var exit = function(value){
  
  particles[activeParticle].value = value;
  
  if (!(activeParticle == (particles.length - 1))){
    activeParticle += 1;
    return restart(exit);
  }
  console.log(particles);
  particles = resample(particles);
  console.log(particles);
  particles.forEach(jsPrint);
};

SampleWithWeights(runCpsHmm, 10);
~~~~

## Particle filters

Resampling at factors (particle filter):

~~~~
~~~~

## Applications

- Kalman filter
- Incremental inference examples (from previous lecture)
- Computer vision
  - remind of incremental factor heuristics pattern seen yesterday
- Better vision example


## Extensions

### Residual resampling

- ...

### PMCMC: Anytime particle filtering

- ...
