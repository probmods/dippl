---
layout: lecture
title: Particle Filtering
description: Simple parsing models. Sequential Monte Carlo techniques.
---


## Models with large state spaces

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

- for gaussian mixture model
- add ImportanceSample alias for particle filtering that only allows a single factor


## Particle filter

The HMM revisited:

~~~~
var hmm = function(states, observations){
  var prevState = states[states.length - 1];
  var state = sample(bernoulliERP, [prevState ? .9 : .1]);
  // factor((state == observations[0]) ? 0 : -1);
  if (observations.length == 0) {
    return states;
  } else {
    return hmm(states.concat([state]), observations.slice(1));
  }      
}

var observations = [true, true, true, true];
var startState = false;

print(hmm([startState], observations))
~~~~

The HMM in continuation-passing style:

~~~~
// language: javascript

var factor = function(k, score){
  k(undefined);
}

var cpsHmm = function(k, states, observations){
  var prevState = states[states.length - 1];
  sample(
    function(state){
      factor(
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

runCpsHmm(jsPrint);
~~~~

Unweighted sampling:

~~~~
// language: javascript

var runCpsHmm = function(k){
  var observations = [true, true, true, true];
  var startState = false;  
  return cpsHmm(k, [startState], observations);
}


var factor = function(k, score){
  k(undefined);
}

var exit = function(x){
  jsPrint(x)
}

var SampleUnweighted = function(cpsComp, n){  
  var samples = []
  for (var i=0; i<n; i++){
    samples.push(cpsComp(exit));
  }
  return samples;
}

SampleUnweighted(runCpsHmm, 10)
~~~~

The factors tell us that we should be sampling some paths more often, and some paths less often. Let's accumulate the factor weights with each sample. Also, let's call samples particles.

With weights:

~~~~
// language: javascript

var cpsHmm = function(k, states, observations){
  var prevState = states[states.length - 1];
  sample(
    function(state){
      factor(
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


var restart = undefined;
var particles = [];
var activeParticle = 0;

var factor = function(k, score){
  particles[activeParticle].weight += score;
  k(undefined);
}

var exit = function(value){
  
  particles[activeParticle].value = value;
  
  if (!(activeParticle == (particles.length - 1))){
    activeParticle += 1;
    return restart(exit);
  }

  particles.forEach(jsPrint);
};

var SampleWithWeights = function(cpsComp, numParticles){  

  // Store continuation for beginning
  restart = cpsComp;
  
  // Create initial particles
  for (var i=0; i<numParticles; i++) {
    var particle = {
      weight: 0,
      value: undefined
    };
    particles.push(particle);
  }
  // Run computation from beginning
  restart(exit);
}

SampleWithWeights(runCpsHmm, 10);
~~~~

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
