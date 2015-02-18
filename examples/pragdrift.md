---
layout: hidden
title: Pragmatic Broadening
---

A number of extensions of RSA rely on the notion of pragmatic broadening, where the meaning of a word is "broadened" or "extended" in a context dependent manner so as to facilitate the understanding of non-literal utterances.
This page describes the process of pragmatic broadening in a unified manner (synthesizing work on hyperbole and metaphor) and outlines implications of this process in models of language learning/change.

## Definitions etc.

Broadening refers to the modification of a words semantics such that it returns true for more worlds than it did previously. 
More formally, broadening refers to the replacing of a words semantic meaning by a broadened semantic meaning, which is relevantly entailed by the original meaning. 
For example, the original semantics of the word "campaign" was (roughly)  paraphrasable as "coordinated military action"; a valid broadening of this meaning (and one that became lexicalized over time) is "coordinated goal-directed group action" (note that in every world where there is "coordinated military action" there is necessarily "coordinated goal-directed group action").

Broadening underlies non-literal understanding and can be seen as one of two major semantic-pragmatic operations, the other being refinement; in refinement, a words meaning is restricted or replaced by a meaning that relevantly entails the original (e.g., "some but not all" refines the semantics of "some"). 
Crucially, refinement does not result in non-literal meanings (only more specific ones), while broadening does.
Formally, broadening corresponds to a projection of a words meaning (i.e., a QUD projection), which is equivalent to the specification of an equivalence class over worlds (under the original semantics). 
Refinement does not admit such an interpretation.

## Synchronic model 

The synchronic model of pragmatic broadening is an extension/refactoring of the existing qRSA and lexical uncertainty models.
Some important aspects/features of the model:

* It extends to metaphors beyond those relying on object-feature relations via the notion of broadening, i.e. the replacement of a semantic function by one that it relevantly implies/entails.

* In contrast to previous models of non-literal understanding, the model reifies lexical-semantic ambiguity by requiring the (contextual) specification of an equivalence class for semantic meaning to be computed (e.g., category "features" are first-class members of the semantics). From an implementation perspective, this means that the lexicon is a function mapping words, world, *and* projections (i.e., equivalence-relations) to truth-values. 

* It makes explicit the division of labor between conceptual/associative (i.e., cognitive linguistic) accounts and inferential (i.e., pragmatic) accounts of metaphor: learned associative conceptual mappings generate and restrict the set of relevant implications (i.e., broadenings) that are available, while pragmatic inference explains how contextual cues allow a sophisticated listener to arrive at a correct interpretation given the availability of such alternative semantics. Only the pragmatic/inferential aspects are addressed here (i.e., we assume that the alternative sets/semantics are known).

The skeleton of the most basic model is as follows (this skeleton is underspecified and will not run):

~~~~
// Input: an utterance, a projection, and a lexicon
// Output: a distribution on worlds consistent with the utterances meaning under the projection
var litListener = function(utt, proj, lex) {
  Enumerate(function() {
    var world = sample(worldPrior);
    factor(lex(utt, world, proj) ? 0 : -Infinity);
    return world;
  });
}

// Input: a world, a semantic projection, a rationality weight, and a lexicon
// Output: an utterance that is likely to make the litListener give high posterior to the world 
var speaker = function(world, proj, lex) {
  Enumerate(function() {
    var utt = sample(uttPrior);
    factor(litListener(utt, proj, lex).score([], world));
    return utt;
  });
}

// Input: an utterance, a speaker rationality parameter, a lexicon, and a convenience return value param.
// Output: a distribution over the specified retVal induced by the utterance 
var pragListenerSample = function(utt, sAlpha, lex, retVal) {
  // sample possible projections, i.e. equivalence classes
  var proj = sample(projPrior);
  // sample worlds
  var world = sample(worldPrior);
  // condition on speaker saying utterance given world and projection
  factor(sAlpha * speaker(world, proj, lex).score([], utt));
  if (retVal == "proj") {
    return proj;
  } else if (retVal == "state") {
    return world;
  }
}

var enumPragListener = function(utt, sAlpha, lex, retVal) {
  return Enumerate(function() {
    return pragListenerSample(utt, sAlpha, lex, retVal);
  });
}
~~~~

This model assumes that a single lexicon is given/known. It is also underspecified, as it is lacking the definition of the common ground variables (`worldPrior` etc.). 

The key aspect of this model (e.g., compared to previous models) are as follows:

  * The lexicon function takes a world, a word, AND a projection as input and returns a truth value.
  * The projection function is passed all the way down to the literal listener level. 
  * The lexicon is not a common ground variable but a parameter.

The examples below incrementally build upon this skeleton, and illustrate the key aspects of this model in more detail.

### Example 1.1: Simple broadening

First, an example of "simple broadening", which corresponds to a fully-specified version of the model above.
We use the example of "campaign" with meaning broadened as discussed above.

~~~~
// world is two booleans: isCamp = is there coordinated group action, and isMil = is there military action
var makeWorldPrior = function(campProb, milCamp, milOther) {
  Enumerate(function() { 
    var isCamp = flip(campProb);
    var isMil = isCamp ? flip(milCamp) : flip(milOther);
    return [isCamp, isMil];
  });
}
// it is highly likely that we are talking about a general campaign
// but it is not likely that the campaign is military
var worldPrior = makeWorldPrior(0.9, 0.1, 0.5);

// projection is just boolean designating whether the semantics of campaign is broadened.
var makeProjPrior = function(projProb) {
  Enumerate(function() {
  return flip(projProb);
  });
}
// for generality we assume uninformative projection prior
var projPrior = makeProjPrior(0.5);

// possible utterances are as follows:
// Note: "null campaign" corresponds to an exact paraphrase of "campaign"'s broadened semantics. 
// Note: "military campaign" is redundant under the standard ("unbroadened") semantics.
var utts =  ['campaign', 'military campaign', 'military operation', 'null campaign', 'null'];
var makeUttPrior = function(weights) {
  Enumerate(function() {
  return utts[discrete(weights)];
  });
}
// prior reflects assumed costs, "null campaign" is costlier than two word phrases.
var uttPrior = makeUttPrior([1, 0.5, 0.5, 0.1, 0.01]) 

var lex =  function(utt, world, proj) {
  if (utt == 'campaign') {
    // campaign maps to isCamp && isMil usually but broadened to isCamp under projection
    return proj ? world[0] : world[0] && world[1]; 
  } else if (utt == 'military campaign') {
    // no projection possible due to "compositionality"/redundancy
    return world[0] && world[1]; 
  } else if (utt == 'military operation') {
    return world[1];
  } else if (utt == 'null campaign') {
    return world[0];
  } else {
    return true;
  }
}

// Model def'ns:
///fold:
// Input: an utterance, a projection, and a lexicon
// Output: a distribution on worlds consistent with the utterances meaning under the projection
var litListener = function(utt, proj, lex) {
  Enumerate(function() {
    var world = sample(worldPrior);
    factor(lex(utt, world, proj) ? 0 : -Infinity);
    return world;
  });
}

// Input: a world, a semantic projection, and a lexicon
// Output: an utterance that is likely to make the litListener give high posterior to the world 
var speaker = function(world, proj, lex) {
  Enumerate(function() {
    var utt = sample(uttPrior);
    factor(litListener(utt, proj, lex).score([], world));
    return utt;
  });
}

// Input: an utterance, a speaker rationality parameter, a lexicon, and a convenience return value param.
// Output: a distribution over the specified retVal induced by the utterance 
var pragListenerSample = function(utt, sAlpha, lex, retVal) {
  // sample possible projections, i.e. equivalence classes
  var proj = sample(projPrior);
  // sample worlds
  var world = sample(worldPrior);
  // condition on speaker saying utterance given world and projection
  factor(sAlpha * speaker(world, proj, lex).score([], utt));
  if (retVal == "proj") {
    return proj;
  } else if (retVal == "state") {
    return world;
  }
}

var enumPragListener = function(utt, sAlpha, lex, retVal) {
  return Enumerate(function() {
    return pragListenerSample(utt, sAlpha, lex, retVal);
  });
}
///

// sophisticated learner users context to infer that the broadened meaning was intended
print(enumPragListener("campaign", 1.0, lex, "state"));
~~~~

In this simple model the pragmatic listener uses context to infer that the speaker must have intended to use the broadened meaning of "campaign".
This is not that exciting since the sophisticated listener is relying mostly on context, but note that the posterior over the broadened meaning is higher than is implicated by the context alone.
Moreover, notice that this probability increases as either the projection prior is weighted higher or the cost of the redundant alternative "military campaign" is lowered (try it out!).

Extending this simple model slightly, we can add a pragmatic speaker:

~~~~
// Model and common ground def'ns from above
///fold:
// world is two booleans: isCamp = is there coordinated group action, and isMil = is there military action
var makeWorldPrior = function(campProb, milCamp, milOther) {
  Enumerate(function() { 
    var isCamp = flip(campProb);
    var isMil = isCamp ? flip(milCamp) : flip(milOther);
    return [isCamp, isMil];
  });
}
// it is highly likely that we are talking about a general campaign
// it could be a military or general campaign
var worldPrior = makeWorldPrior(0.9, 0.5, 0.5);

// projection is just boolean designating whether the semantics of campaign is broadened.
var makeProjPrior = function(projProb) {
  Enumerate(function() {
  return flip(projProb);
  });
}
// for generality we assume uninformative projection prior
var projPrior = makeProjPrior(0.5);

// possible utterances are as follows:
// Note: "null campaign" corresponds to an exact paraphrase of "campaigns" broadened semantics. 
// Note: "military campaign" is redundant under the standard ("unbroadened") semantics.
var utts =  ['campaign', 'military campaign', 'military operation', 'null campaign', 'null'];
var makeUttPrior = function(weights) {
  Enumerate(function() {
  return utts[discrete(weights)];
  });
}
// prior reflects assumed costs, "null campaign" is costlier than two word phrases.
var uttPrior = makeUttPrior([1, 0.5, 0.5, 0.1, 0.01]) 

var lex =  function(utt, world, proj) {
  if (utt == 'campaign') {
    // campaign maps to isCamp && isMil usually but broadened to isCamp under projection
    return proj ? world[0] : world[0] && world[1]; 
  } else if (utt == 'military campaign') {
    // no projection possible due to "compositionality"/redundancy
    return world[0] && world[1]; 
  } else if (utt == 'military operation') {
    return world[1];
  } else if (utt == 'null campaign') {
    return world[0];
  } else {
    return true;
  }
}

// Model def'ns:
///fold:
// Input: an utterance, a projection, and a lexicon
// Output: a distribution on worlds consistent with the utterances meaning under the projection
var litListener = function(utt, proj, lex) {
  Enumerate(function() {
    var world = sample(worldPrior);
    factor(lex(utt, world, proj) ? 0 : -Infinity);
    return world;
  });
}

// Input: a world, a semantic projection, and a lexicon
// Output: an utterance that is likely to make the litListener give high posterior to the world 
var speaker = function(world, proj, lex) {
  Enumerate(function() {
    var utt = sample(uttPrior);
    factor(litListener(utt, proj, lex).score([], world));
    return utt;
  });
}

// Input: an utterance, a speaker rationality parameter, a lexicon, and a convenience return value param.
// Output: a distribution over the specified retVal induced by the utterance 
var pragListenerSample = function(utt, sAlpha, lex, retVal) {
  // sample possible projections, i.e. equivalence classes
  var proj = sample(projPrior);
  // sample worlds
  var world = sample(worldPrior);
  // condition on speaker saying utterance given world and projection
  factor(sAlpha * speaker(world, proj, lex).score([], utt));
  if (retVal == "proj") {
    return proj;
  } else if (retVal == "state") {
    return world;
  }
}

var enumPragListener = function(utt, sAlpha, lex, retVal) {
  return Enumerate(function() {
    return pragListenerSample(utt, sAlpha, lex, retVal);
  });
}
///

// simple pragmatic speaker (variations are possible)
var pragSpeaker = function(world, alpha, lex) { 
  var _pragSpeaker = Enumerate(function() {
    var utt = sample(uttPrior);
    factor(enumPragListener(utt, alpha, lex, "state").score([], world));
    return utt;
  });
  return Enumerate(function() {
    var utt = sample(uttPrior);
    factor(alpha * _pragSpeaker.score([], utt));
    return utt;
  });
}

// what is a sophisicated speaker going to say if we wants to convey that there is a military campaign
print(pragSpeaker([true, true], 1.0, lex));
~~~~

In the above setting, a sophisticated speaker is more likely to use the redundant phrase "military campaign" despite its extra cost in order to convey the "unbroadened" meaning of "campaign", since the speaker knows that the "broadened" interpretation is possible. This effect is strengthened as the rationality parameter is increased and weakened as the common ground likelihood of the campaign being military is raised (try it out!).

### Example 1.2: Broadening post-refinement 

Often non-literal/metaphorical expressions correspond to both broadening and refinement.
For example, the word "princess" has a conventional metaphorical usage as referring to a "spoiled/over-indulged" female.
Intuitively, this corresponds to a broadening of the original meaning of "princess", where the requirement of being royalty is projected away (i.e., being "spoiled/over-indulged" is a property of being a "princess").
However, it is possible to imagine world where a "princess" (in the original meaning) is not "spoiled"; thus, for the metaphorical interpretation, the meaning has to be first refined from "royal female" to "spoiled royal female" prior to the broadening.

For simplicity, and following the work on refinement w.r.t. specificity implicatures, we model the refinement via lexical uncertainty.

~~~~
var makeWorldPrior = function(royalProb, spoiledRoyalProb, spoiledNotRoyalProb) {
  Enumerate(function() { 
    var isRoyal = flip(royalProb);
    var isSpoiled = isRoyal ? flip(spoiledRoyalProb) : flip(spoiledNotRoyalProb);
    return [isRoyal, isSpoiled];
  });
}
// referent not likely member of royalty, if royal probably spoiled, and if not royal 50/50 spoiled
var worldPrior = makeWorldPrior(0.01, 0.8, 0.5);

// again projection is just boolean whether we are projecting
var makeProjPrior = function(projProb) {
  Enumerate(function() {
  return flip(projProb);
  });
}
// uninformative prior over whether princess is broadened
var projPrior = makeProjPrior(0.5);

var lexica = [
  // original meaning
  function(utt, world, proj) {
    if (utt == 'princess') {
      return world[0]; 
    } else if (utt == 'null spoiled brat') {
      return world[1];
    } else {
      return true;
    }
  },
  //refined
  function(utt, world, proj) {
    if (utt == 'princess') {
      return !proj ? world[0] && world[1] : world[1]; 
    } else if (utt == 'null spoiled brat') {
      return world[1];
    } else  {
      return true;
    }
  },
];
var makeLexPrior = function(probs) {
  Enumerate(function() {return discrete(probs)});
}
// refined and un-refined versions equally likely
var lexPrior = makeLexPrior([1, 1]);

var utts =  ['princess', 'null spoiled brat', 'null'];
var makeUttPrior = function(weights) {
  Enumerate(function() {
  return utts[discrete(weights)];
  });
}
// null utterances more expensive
var uttPrior = makeUttPrior([1, 0.1, 0.01]);

// literal listeners and speaker the same
///fold:
// Input: an utterance, a projection, and a lexicon
// Output: a distribution on worlds consistent with the utterances meaning under the projection
var litListener = function(utt, proj, lex) {
  Enumerate(function() {
    var world = sample(worldPrior);
    factor(lex(utt, world, proj) ? 0 : -Infinity);
    return world;
  });
}

// Input: a world, a semantic projection, and a lexicon
// Output: an utterance that is likely to make the litListener give high posterior to the world 
var speaker = function(world, proj, lex) {
  Enumerate(function() {
    var utt = sample(uttPrior);
    factor(litListener(utt, proj, lex).score([], world));
    return utt;
  });
}
///

// Note: pragmatic speaker now has distribution over lexica
// Input: an utterance, a speaker rationality parameter, a distribution over lexica, and a convenience return value param.
// Output: a distribution over the specified retVal induced by the utterance 
var pragListenerSample = function(utt, sAlpha, lexDist, retVal) {
  // sample possible projections, i.e. equivalence classes
  var proj = sample(projPrior);
  // sample worlds
  var world = sample(worldPrior);
  // sample lexicon
  var lexIdx = sample(lexDist);
  var lex = lexica[lexIdx];
  // condition on speaker saying utterance given world and projection
  factor(sAlpha * speaker(world, proj, lex).score([], utt));
  if (retVal == "proj") {
    return proj;
  } else if (retVal == "state") {
    return world;
  } else if (retVal == "lex") {
    return lexIdx;
  }
}

var enumPragListener = function(utt, sAlpha, lexDist, retVal) {
  return Enumerate(function() {
    return pragListenerSample(utt, sAlpha, lexDist, retVal);
  });
}

print(enumPragListener("princess", 1.0, lexPrior, "state"));
~~~~

Again, the metaphorical interpretation is inferred from context, but now we have that this required uncertainty over which lexicon was in use (as broadening is only possible in refined lexicon).
Try experimenting with different rationalities and return values (the refined lexicon has a much higher posterior).
Note that since the example lacks a redundant alternative to "princess" (that blocks broadening), increasing the rationality actually decreases the probability of a non-literal interpretation!
Of course, this affect could be reversed by adding a redundant alternative such as "literally, the daughter of a monarch" (under the assumption this redundant alternative does not admit broadening).

### Example 1.3: Affective dimensions

For some words, e.g. those that involve hyperbole, their non-literal interpretations are associated with affective communicative intentions. 
For example, "starving" is conventionally and hyperbolically used to refer to the state of "hunger".
Note that without affect this case is the same as example 1.1 (with "campaign"), since in every world where X is starving X is also hungry.
However, "starve" also has a strong negative valence and this impacts its use and interpretation.

In line with our previous models, we treat affect as a part of semantics AND the world.
And for completeness, we assume that "starve" does not necessarily denote a state of negative valence (though it usually does) and thus refinement is also necessary here. 

~~~~ 
var makeWorldPrior = function(hungryProb, dyingProb, upsetGivenDying, upsetGivenHungry, upsetOther) {
  Enumerate(function() { 
    var isHungry = flip(hungryProb);
    var isDying = flip(dyingProb);
    var isUpset = isHungry ? flip(upsetGivenHungry) : (isDying ? flip(upsetGivenDying) : upsetOther); 
    return [isHungry, isDying, isUpset];
  });
}
// referent likely hungry, not likely dying, upset if dying and possibly upset otherwise
var worldPrior = makeWorldPrior(0.9, 0.01, 0.99, 0.5, 0.5);

// now two possible projection dimensions
var makeProjPrior = function(projProb) {
  Enumerate(function() {
  return [flip(projProb)];
  });
}
// uninformative prior over broadenings
var projPrior = makeProjPrior(0.5);

// assume that hungry has no affective component to its semantics
var lexica = [
  // unrefined starving
  function(utt, world, proj) {
    if (utt == 'hungry') {
      return world[0]; 
    } else if (utt == 'starving') {
      return proj[0] ? world[0] : world[0] && world[1]; 
    } else {
      return true;
    }
  },
  // refined starving
  function(utt, world, proj) {
    if (utt == 'hungry') {
      return world[0]; 
    } else if (utt == 'starving') {
      return proj[0] ? 
        (world[0] && world[2]) : 
        (world[0] && world[1] && world[2]);
    } else {
      return true;
    }
  },
];
var makeLexPrior = function(probs) {
  Enumerate(function() {return discrete(probs)});
}
// refined and un-refined versions equally likely
var lexPrior = makeLexPrior([1, 1]);

var utts =  ['hungry', 'starving', 'null'];
var makeUttPrior = function(weights) {
  Enumerate(function() {
  return utts[discrete(weights)];
  });
}
// null utterance more expensive
var uttPrior = makeUttPrior([1, 1, 0.01]);

// Models the same
///fold:
// Input: an utterance, a projection, and a lexicon
// Output: a distribution on worlds consistent with the utterances meaning under the projection
var litListener = function(utt, proj, lex) {
  Enumerate(function() {
    var world = sample(worldPrior);
    factor(lex(utt, world, proj) ? 0 : -Infinity);
    return world;
  });
}

// Input: a world, a semantic projection, a rationality weight, and a lexicon
// Output: an utterance that is likely to make the litListener give high posterior to the world 
var speaker = function(world, proj, lex) {
  Enumerate(function() {
    var utt = sample(uttPrior);
    factor(litListener(utt, proj, lex).score([], world));
    return utt;
  });
}

// Note: pragmatic speaker now has distribution over lexica
// Input: an utterance, a speaker rationality parameter, a distribution over lexica, and a convenience return value param.
// Output: a distribution over the specified retVal induced by the utterance 
var pragListenerSample = function(utt, sAlpha, lexDist, retVal) {
  // sample possible projections, i.e. equivalence classes
  var proj = sample(projPrior);
  // sample worlds
  var world = sample(worldPrior);
  // sample lexicon
  var lexIdx = sample(lexDist);
  var lex = lexica[lexIdx];
  // condition on speaker saying utterance given world and projection
  factor(sAlpha * speaker(world, proj, lex).score([], utt));
  if (retVal == "proj") {
    return proj;
  } else if (retVal == "state") {
    return world;
  } else if (retVal == "lex") {
    return lexIdx;
  }
}

var enumPragListener = function(utt, sAlpha, lexDist, retVal) {
  return Enumerate(function() {
    return pragListenerSample(utt, sAlpha, lexDist, retVal);
  });
}
///
print(enumPragListener("starving", 1.0, lexPrior, "state"));
~~~~

Again, we see that the sophisticated listener uses context to infer the hyperbolic meaning of "starving" (hungry, not dying, and probably upset). 
Interestingly, if you change the `retVal` to `"lex"`, you will see that the unrefined lexicon has an increased posterior, which corresponds to the bleaching of "starving" (i.e., it losing its affective association).

## Diachronic implications

The above models show how pragmatic broadening (and refinement) can give rise to non-literal interpretations in a synchronic setting.
This section examines the diachronic implications of these models using a simple, principled model of lexical learning.
In particular, we assume the following: 

  1. That there is a pre-defined set of possible lexica that could be in use. 
  2. That agents maintain a belief corresponding to what they think think the true mixture-weights over the lexica are.
  3. That lexica with broadened versions of words' semantics have small (but non-zero) prior probabilities. 

Lexical learning is thus conditional inference with regards to the weights of a categorical distribution (starting from a Dirichlet prior).
Note that as a metaphorical meaning is lexicalized it necessarily loses its dependence on context (i.e., the metaphoric meaning can be triggered without a strong supporting context).

An important point is the distinction between assumption 2 above and the simpler possible assumption where agents believe that there is a single true lexicon (learning would thus correspond to conditional inference over a categorical value).
Indeed, the models containing lexical uncertainty elucidated previously already incorporate this simpler type of lexical learning. 
The view taken here is that general learning is of the form described in assumptions 1-3 but that the "simple" model may be in use in "shorter", more conversational, time-scales, e.g. when individuals coordinate on a lexicon during a conversation. 
It is also highly likely that people learn to associate particular lexica with particular social settings, which would correspond to the "simpler" type of learning with an extra conditioning variable.

In summary, the general learning setting is viewed as corresponding to an individual estimating the general population distribution over lexica (marginalizing over potential social settings etc.), whereas the "simple" model is viewed as corresponding to inference w.r.t. a particular social setting.

The skeleton for the diachronic models is as follows (for completeness both the "simple" and "complex" variants are described):

~~~~
// literal listeners and speakers are unchanged
///fold:
// Input: an utterance, a projection, and a lexicon
// Output: a distribution on worlds consistent with the utterances meaning under the projection
var litListener = function(utt, proj, lex) {
  Enumerate(function() {
    var world = sample(worldPrior);
    factor(lex(utt, world, proj) ? 0 : -Infinity);
    return world;
  });
}

// Input: a world, a semantic projection, a rationality weight, and a lexicon
// Output: an utterance that is likely to make the litListener give high posterior to the world 
var speaker = function(world, proj, lex) {
  Enumerate(function() {
    var utt = sample(uttPrior);
    factor(litListener(utt, proj, lex).score([], world));
    return utt;
  });
}
///

// Note: simple model the same as the models with refinement introduced previously
// Input: an utterance, a speaker rationality parameter, a distribution over categorical distributions, and a convenience return value param.
// Output: a distribution over the specified retVal induced by the utterance 
var simplePragListenerSample = function(utt, sAlpha, lexDist, retVal) {
  // sample possible projections, i.e. equivalence classes
  var proj = sample(projPrior);
  // sample worlds
  var world = sample(worldPrior);
  // sample lexicon from prior distribution
  var lexIdx = sample(lexDist);
  var lex = lexica[lexIdx];
  // condition on speaker saying utterance given world and projection
  factor(sAlpha * speaker(world, proj, lex).score([], utt));
  if (retVal == "proj") {
    return proj;
  } else if (retVal == "state") {
    return world;
  } else if (retVal == "lex") {
    return lexIdx;
  }
}

// enumeration possible for the simple learning model
var simplePragListener = function(utt, sAlpha, lexDist, retVal) {
  return Enumerate(function() {
    return simplePragListenerSample(utt, sAlpha, lexDist, retVal);
  });
}

var iterateSimpleLearning = function(utt, sAlpha, lexPrior, iters) {
  var _iterateSimpleLearning = function(lexDists, iters) {
    return iters == 0 ? lexDists.slice(1) : 
      _iterateSimpleLearning(lexDists.concat(simplePragListener(utt, sAlpha, last(lexDists), "lex")), iters - 1);
  }
  return _iterateSimpleLearning([lexPrior], iters); 
}


// Note: now accepts a distribution over distribution of lexica as a parameter
// Input: an utterance, a speaker rationality parameter, a distribution over categorical distributions, and a convenience return value param.
// Output: a distribution over the specified retVal induced by the utterance 
var complexPragListenerSample = function(utt, sAlpha, lexDiri, retVal) {
  // sample possible projections, i.e. equivalence classes
  var proj = sample(projPrior);
  // sample worlds
  var world = sample(worldPrior);
  // sample lexicon distribution
  var lexDist = sample(lexDiri);
  // sample lexicon from sampled distribution
  var lexIdx = sample(lexDist);
  var lex = lexica[lexIdx];
  // condition on speaker saying utterance given world and projection
  factor(sAlpha * speaker(world, proj, lex).score([], utt));
  if (retVal == "proj") {
    return proj;
  } else if (retVal == "state") {
    return world;
  } else if (retVal == "lex") {
    return lexDist;
  }
}

// importance sampling necessary for complex lexical learning
var complexPragListener = function(utt, sAlpha, lexDiri, retVal, numIters) {
  return MH(function() {
    return complexPragListenerSample(utt, sAlpha, lexDiri, retVal);
  }, numIters);
}

var iterateComplexLearning = function(utt, sAlpha, lexDiriPrior, iters, mhIters) {
  var _iterateComplexLearning = function(lexDiris, iters) {
    return iters == 0 ? lexDiris.slice(1) : 
      _iterateComplexLearning(lexDiris.concat(complexPragListener(utt, sAlpha, last(lexDiris), "lex", mhIters)), iters - 1);
  }
  return _iterateComplexLearning([lexDiriPrior], iters); 
}

// hack to visualize mean of Dirichlet
///fold:
var meanDiriDist = function(diriERP) {
  var hist =  mapReduce1(function(a, b) { return map2(function(v1, v2) { v1 + v2}, a, b)}, 
      function(s) {return map(function(entry) { return Math.exp(diriERP.score([], s)) * entry}, s)},
      diriERP.support());
  return Enumerate(function() {return discrete(hist)}); 
}
///
~~~~

Again, these models are incomplete and require the specification of common ground variables etc.

### Example 2.1: Simple broadening 

The set-up is as in example 1.1, but with the addition of the possibility of lexicalizing the metaphorical meaning. For illustrative purposes, we also complicate matters by adding an extra (incorrect) candidate lexicon.

~~~~
// world is two booleans: isCamp = is there coordinated group action, and isMil = is there military action
var makeWorldPrior = function(campProb, milCamp, milOther) {
  Enumerate(function() { 
    var isCamp = flip(campProb);
    var isMil = isCamp ? flip(milCamp) : flip(milOther);
    return [isCamp, isMil];
  });
}
// it is highly likely that we are talking about a general campaign
// but it is not likely that the campaign is military
var worldPrior = makeWorldPrior(0.9, 0.1, 0.5);

// projection is just boolean designating whether the semantics of campaign is broadened.
var makeProjPrior = function(projProb) {
  Enumerate(function() {
  return flip(projProb);
  });
}
// for generality we assume uninformative projection prior
var projPrior = makeProjPrior(0.5);

// possible utterances are as follows:
// Note: "null campaign" corresponds to an exact paraphrase of "campaigns" broadened semantics. 
// Note: "military campaign" is redundant under the standard ("unbroadened") semantics.
var utts =  ['campaign', 'military campaign', 'military operation', 'null campaign', 'null'];
var makeUttPrior = function(weights) {
  Enumerate(function() {
  return utts[discrete(weights)];
  });
}
// prior reflects assumed costs, "null campaign" is costlier than two word phrases.
var uttPrior = makeUttPrior([1, 0.5, 0.5, 0.1, 0.01]) 

// possible lexica (include incorrect one)
var lexica = [
  // original meaning
  function(utt, world, proj) {
    if (utt == 'campaign') {
      return proj ? world[0] : world[0] && world[1]; 
    } else if (utt == 'military campaign') {
      // no projection possible due to "compositionality"
      return world[0] && world[1]; 
    } else if (utt == 'military operation') {
      return world[1];
    } else if (utt == 'null campaign') {
      return world[0];
    } else {
      return true;
    }
  },
  // broadened
  function(utt, world, proj) {
    if (utt == 'campaign') {
      return  world[0];
    } else if (utt == 'military campaign') {
      // no projection possible due to "compositionality"
      return world[0] && world[1]; 
    } else if (utt == 'military operation') {
      return world[1];
    } else if (utt == 'null campaign') {
      return world[0];
    } else {
      return true;
    }
  },
  // incorrect broadening
  function(utt, world, proj) {
    if (utt == 'campaign') {
      return  world[1];
    } else if (utt == 'military campaign') {
      // no projection possible due to "compositionality"
      return world[0] && world[1]; 
    } else if (utt == 'military operation') {
      return world[1];
    } else if (utt == 'null campaign') {
      return world[0];
    } else {
      return true;
    }
  },
];
var makeDiriPrior = function(alphas) { 
  ParticleFilter(
    function() {return dirichlet(alphas)}, 
    10000);
}
// prior of categorical weights assigns most weight to unbroadened lexicon
// (NOTE: realistic values would given unbroadened higher weight but that makes results hard to see..)
var lexDiriPrior = makeDiriPrior([10, 1, 1]);

var makeLexPrior = function(probs) {
  Enumerate(function() {return discrete(probs)});
}
// simple categorical distribution over lexicon mirrors Dirichlet above
var lexPrior =  makeLexPrior([10, 1, 1]);
 
// models as above
///fold:
// Input: an utterance, a projection, and a lexicon
// Output: a distribution on worlds consistent with the utterances meaning under the projection
var litListener = function(utt, proj, lex) {
  Enumerate(function() {
    var world = sample(worldPrior);
    factor(lex(utt, world, proj) ? 0 : -Infinity);
    return world;
  });
}

// Input: a world, a semantic projection, a rationality weight, and a lexicon
// Output: an utterance that is likely to make the litListener give high posterior to the world 
var speaker = function(world, proj, lex) {
  Enumerate(function() {
    var utt = sample(uttPrior);
    factor(litListener(utt, proj, lex).score([], world));
    return utt;
  });
}

// Note: simple model the same as the models with refinement introduced previously
// Input: an utterance, a speaker rationality parameter, a distribution over categorical distributions, and a convenience return value param.
// Output: a distribution over the specified retVal induced by the utterance 
var simplePragListenerSample = function(utt, sAlpha, lexDist, retVal) {
  // sample possible projections, i.e. equivalence classes
  var proj = sample(projPrior);
  // sample worlds
  var world = sample(worldPrior);
  // sample lexicon from prior distribution
  var lexIdx = sample(lexDist);
  var lex = lexica[lexIdx];
  // condition on speaker saying utterance given world and projection
  factor(sAlpha * speaker(world, proj, lex).score([], utt));
  if (retVal == "proj") {
    return proj;
  } else if (retVal == "state") {
    return world;
  } else if (retVal == "lex") {
    return lexIdx;
  }
}

// enumeration possible for the simple learning model
var simplePragListener = function(utt, sAlpha, lexDist, retVal) {
  return Enumerate(function() {
    return simplePragListenerSample(utt, sAlpha, lexDist, retVal);
  });
}

var iterateSimpleLearning = function(utt, sAlpha, lexPrior, iters) {
  var _iterateSimpleLearning = function(lexDists, iters) {
    return iters == 0 ? lexDists.slice(1) : 
      _iterateSimpleLearning(lexDists.concat(simplePragListener(utt, sAlpha, last(lexDists), "lex")), iters - 1);
  }
  return _iterateSimpleLearning([lexPrior], iters); 
}


// Note: now accepts a distribution over distribution of lexica as a parameter
// Input: an utterance, a speaker rationality parameter, a distribution over categorical distributions, and a convenience return value param.
// Output: a distribution over the specified retVal induced by the utterance 
var complexPragListenerSample = function(utt, sAlpha, lexDiri, retVal) {
  // sample possible projections, i.e. equivalence classes
  var proj = sample(projPrior);
  // sample worlds
  var world = sample(worldPrior);
  // sample lexicon distribution
  var lexDist = sample(lexDiri);
  // sample lexicon from sampled distribution
  var lexIdx = discrete(lexDist);
  var lex = lexica[lexIdx];
  // condition on speaker saying utterance given world and projection
  factor(sAlpha * speaker(world, proj, lex).score([], utt));
  if (retVal == "proj") {
    return proj;
  } else if (retVal == "state") {
    return world;
  } else if (retVal == "lex") {
    return lexDist;
  }
}

// importance sampling necessary for complex lexical learning
var complexPragListener = function(utt, sAlpha, lexDiri, retVal, numIters) {
  return MH(function() {
    return complexPragListenerSample(utt, sAlpha, lexDiri, retVal);
  }, numIters);
}

var iterateComplexLearning = function(utt, sAlpha, lexDiriPrior, iters, mhIters) {
  var _iterateComplexLearning = function(lexDiris, iters) {
    return iters == 0 ? lexDiris.slice(1) : 
      _iterateComplexLearning(lexDiris.concat(complexPragListener(utt, sAlpha, last(lexDiris), "lex", mhIters)), iters - 1);
  }
  return _iterateComplexLearning([lexDiriPrior], iters); 
}
///
// hack to visualize mean of Dirichlet
///fold:
var meanDiriDist = function(diriERP) {
  var hist =  mapReduce1(function(a, b) { return map2(function(v1, v2) { v1 + v2}, a, b)}, 
      function(s) {return map(function(entry) { return Math.exp(diriERP.score([], s)) * entry}, s)},
      diriERP.support());
  return Enumerate(function() {return discrete(hist)}); 
}
///
print(meanDiriDist(last(iterateComplexLearning("campaign", 1.0, lexDiriPrior, 10, 1000))));
//print(last(iterateSimpleLearning("campaign", 1.0, lexPrior, 10)));
~~~~

Running the above example as is shows how the metaphorical meaning will become lexicalized over time in the general learning setting while the incorrect broadening meaning is suppressed (WARNING: can take a minute or two to run). 
You can also uncomment on the last line and see a similar (but more extreme) result from iterating simple learning. 
The result is quite robust (play around with the parameter settings); though note that we have vastly simplified things here by assuming that the listener hears the word in the same context over and over. 

This example represents the strongest setting for lexicalization/conventionalization:

  * The metaphoric meaning cannot be succinctly paraphrased.
  * The metaphoric interpretation requires only broadening.
  * The metaphoric meaning is something commonly talked about.

### Example 2.2: Broadening post-refinement

This example, using term "princess", follows example 2.1. Recall that the metaphoric interpretation of "princess" requires broadening and refinement. 
Here we introduce the additional complication of considering lexica with incorrect broadenings.

~~~~
var makeWorldPrior = function(royalProb, spoiledRoyalProb, spoiledNotRoyalProb) {
  Enumerate(function() { 
    var isRoyal = flip(royalProb);
    var isSpoiled = isRoyal ? flip(spoiledRoyalProb) : flip(spoiledNotRoyalProb);
    return [isRoyal, isSpoiled];
  });
}
// referent not likely member of royalty, if royal probably spoiled, and if not royal 50/50 spoiled
var worldPrior = makeWorldPrior(0.01, 0.8, 0.5);

var makeProjPrior = function(projProb) {
  Enumerate(function() {
  return flip(projProb);
  });
}
// uninformative prior over whether princess is broadened
var projPrior = makeProjPrior(0.5);

var lexica = [
  // original
  function(utt, world, proj) {
    if (utt == 'princess') {
      return world[0]; 
    } else if (utt == 'null spoiled brat') {
      return world[1];
    } else {
      return true;
    }
  },
  //refined
  function(utt, world, proj) {
    if (utt == 'princess') {
      return !proj ? world[0] && world[1] : world[1]; 
    } else if (utt == 'null spoiled brat') {
      return world[1];
    } else  {
      return true;
    }
  },
  //refined and broadened
  function(utt, world, proj) {
    if (utt == 'princess') {
      return world[1]; 
    } else if (utt == 'null spoiled brat') {
      return world[1];
    } else {
      return true;
    }
  },
  //incorrect
  function(utt, world, proj) {
    if (utt == 'princess') {
      return !world[1]; 
    } else if (utt == 'null spoiled brat') {
      return world[1];
    } else {
      return true;
    }
  }
];
var makeLexicaDistPrior = function(alphas) { 
  ParticleFilter(
    function() {return dirichlet(alphas)}, 
    1000);
}
// refined and unrefined equal but broadened small weight
var lexDiriPrior = makeLexicaDistPrior([10, 10, 1, 1]); 
var makeLexPrior = function(probs) {
  Enumerate(function() {return discrete(probs)});
}
// same weights as above
var lexPrior = makeLexPrior([10, 10, 1, 1]);

var utts =  ['princess', 'null spoiled brat', 'null'];
var makeUttPrior = function(weights) {
  Enumerate(function() {
  return utts[discrete(weights)];
  });
}
var uttPrior = makeUttPrior([1, 0.1, 0.01]);

// models as above
///fold:
// Input: an utterance, a projection, and a lexicon
// Output: a distribution on worlds consistent with the utterances meaning under the projection
var litListener = function(utt, proj, lex) {
  Enumerate(function() {
    var world = sample(worldPrior);
    factor(lex(utt, world, proj) ? 0 : -Infinity);
    return world;
  });
}

// Input: a world, a semantic projection, a rationality weight, and a lexicon
// Output: an utterance that is likely to make the litListener give high posterior to the world 
var speaker = function(world, proj, lex) {
  Enumerate(function() {
    var utt = sample(uttPrior);
    factor(litListener(utt, proj, lex).score([], world));
    return utt;
  });
}

// Note: simple model the same as the models with refinement introduced previously
// Input: an utterance, a speaker rationality parameter, a distribution over categorical distributions, and a convenience return value param.
// Output: a distribution over the specified retVal induced by the utterance 
var simplePragListenerSample = function(utt, sAlpha, lexDist, retVal) {
  // sample possible projections, i.e. equivalence classes
  var proj = sample(projPrior);
  // sample worlds
  var world = sample(worldPrior);
  // sample lexicon from prior distribution
  var lexIdx = sample(lexDist);
  var lex = lexica[lexIdx];
  // condition on speaker saying utterance given world and projection
  factor(sAlpha * speaker(world, proj, lex).score([], utt));
  if (retVal == "proj") {
    return proj;
  } else if (retVal == "state") {
    return world;
  } else if (retVal == "lex") {
    return lexIdx;
  }
}

// enumeration possible for the simple learning model
var simplePragListener = function(utt, sAlpha, lexDist, retVal) {
  return Enumerate(function() {
    return simplePragListenerSample(utt, sAlpha, lexDist, retVal);
  });
}

var iterateSimpleLearning = function(utt, sAlpha, lexPrior, iters) {
  var _iterateSimpleLearning = function(lexDists, iters) {
    return iters == 0 ? lexDists.slice(1) : 
      _iterateSimpleLearning(lexDists.concat(simplePragListener(utt, sAlpha, last(lexDists), "lex")), iters - 1);
  }
  return _iterateSimpleLearning([lexPrior], iters); 
}


// Note: now accepts a distribution over distribution of lexica as a parameter
// Input: an utterance, a speaker rationality parameter, a distribution over categorical distributions, and a convenience return value param.
// Output: a distribution over the specified retVal induced by the utterance 
var complexPragListenerSample = function(utt, sAlpha, lexDiri, retVal) {
  // sample possible projections, i.e. equivalence classes
  var proj = sample(projPrior);
  // sample worlds
  var world = sample(worldPrior);
  // sample lexicon distribution
  var lexDist = sample(lexDiri);
  // sample lexicon from sampled distribution
  var lexIdx = discrete(lexDist);
  var lex = lexica[lexIdx];
  // condition on speaker saying utterance given world and projection
  factor(sAlpha * speaker(world, proj, lex).score([], utt));
  if (retVal == "proj") {
    return proj;
  } else if (retVal == "state") {
    return world;
  } else if (retVal == "lex") {
    return lexDist;
  }
}

// importance sampling necessary for complex lexical learning
var complexPragListener = function(utt, sAlpha, lexDiri, retVal, numIters) {
  return MH(function() {
    return complexPragListenerSample(utt, sAlpha, lexDiri, retVal);
  }, numIters);
}

var iterateComplexLearning = function(utt, sAlpha, lexDiriPrior, iters, mhIters) {
  var _iterateComplexLearning = function(lexDiris, iters) {
    return iters == 0 ? lexDiris.slice(1) : 
      _iterateComplexLearning(lexDiris.concat(complexPragListener(utt, sAlpha, last(lexDiris), "lex", mhIters)), iters - 1);
  }
  return _iterateComplexLearning([lexDiriPrior], iters); 
}
///
// hack to visualize mean of Dirichlet
///fold:
var meanDiriDist = function(diriERP) {
  var hist =  mapReduce1(function(a, b) { return map2(function(v1, v2) { v1 + v2}, a, b)}, 
      function(s) {return map(function(entry) { return Math.exp(diriERP.score([], s)) * entry}, s)},
      diriERP.support());
  return Enumerate(function() {return discrete(hist)}); 
}
///
print(meanDiriDist(last(iterateComplexLearning("princess", 1.0, lexDiriPrior, 10, 1000))));
//print(last(iterateSimpleLearning("princess", 1.0, lexPrior, 10)));
~~~~

Here we see that there is a problem. 
An incorrect meaning of "princess" (which defines "princess" as meaning someone who is not royal) is lexicalized (for both the simple and complex conditions)!
Of course, this only happens because we gave a reasonable prior to this alternative (try changing the values), and, surely, the broadened alternative meaning would have a higher prior.
Nevertheless, this is still troubling. 

However, an important simplification we made in the above simulations is that the agent only hears the word in the non-literal context. 
To explore the impact of this, we simulate a learning situation in which the learner is exposed to the word in both literal and non-literal contexts.

~~~~
var makeWorldPrior = function(royalProb, spoiledRoyalProb, spoiledNotRoyalProb) {
  Enumerate(function() { 
    var isRoyal = flip(royalProb);
    var isSpoiled = isRoyal ? flip(spoiledRoyalProb) : flip(spoiledNotRoyalProb);
    return [isRoyal, isSpoiled];
  });
}
// in metaphorical context referent not likely member of royalty, if royal probably spoiled, and if not royal 50/50 spoiled
var metWorldPrior = makeWorldPrior(0.01, 0.8, 0.5);
// in literal context referent likely member of royalty, if royal probably spoiled, and if not royal 50/50 spoiled
var litWorldPrior = makeWorldPrior(0.99, 0.8, 0.5);
// 75% prob in literal context
var litProb = 0.75;

var makeProjPrior = function(projProb) {
  Enumerate(function() {
  return flip(projProb);
  });
}
// uninformative prior over whether princess is broadened
var projPrior = makeProjPrior(0.5);

var lexica = [
  // original
  function(utt, world, proj) {
    if (utt == 'princess') {
      return world[0]; 
    } else if (utt == 'null spoiled brat') {
      return world[1];
    } else {
      return true;
    }
  },
  //refined
  function(utt, world, proj) {
    if (utt == 'princess') {
      return !proj ? world[0] && world[1] : world[1]; 
    } else if (utt == 'null spoiled brat') {
      return world[1];
    } else  {
      return true;
    }
  },
  //refined and broadened
  function(utt, world, proj) {
    if (utt == 'princess') {
      return world[1]; 
    } else if (utt == 'null spoiled brat') {
      return world[1];
    } else {
      return true;
    }
  },
  //incorrect
  function(utt, world, proj) {
    if (utt == 'princess') {
      return !world[1]; 
    } else if (utt == 'null spoiled brat') {
      return world[1];
    } else {
      return true;
    }
  }
];
var makeLexicaDistPrior = function(alphas) { 
  ParticleFilter(
    function() {return dirichlet(alphas)}, 
    10000);
}
// refined and unrefined equal but broadened small weight
var lexDiriPrior = makeLexicaDistPrior([10, 10, 1, 1]); 
var makeLexPrior = function(probs) {
  Enumerate(function() {return discrete(probs)});
}
// same weights as above
var lexPrior = makeLexPrior([10, 10, 1, 1]);

var utts =  ['princess', 'null spoiled brat', 'null'];
var makeUttPrior = function(weights) {
  Enumerate(function() {
  return utts[discrete(weights)];
  });
}
var uttPrior = makeUttPrior([1, 0.1, 0.01]);

// models as above
///fold:
// Input: an utterance, a projection, and a lexicon
// Output: a distribution on worlds consistent with the utterances meaning under the projection
var litListener = function(utt, proj, lex, worldPrior) {
  Enumerate(function() {
    var world = sample(worldPrior);
    factor(lex(utt, world, proj) ? 0 : -Infinity);
    return world;
  });
}

// Input: a world, a semantic projection, a rationality weight, and a lexicon
// Output: an utterance that is likely to make the litListener give high posterior to the world 
var speaker = function(world, proj, lex, worldPrior) {
  Enumerate(function() {
    var utt = sample(uttPrior);
    factor(litListener(utt, proj, lex, worldPrior).score([], world));
    return utt;
  });
}

// Note: simple model the same as the models with refinement introduced previously
// Input: an utterance, a speaker rationality parameter, a distribution over categorical distributions, and a convenience return value param.
// Output: a distribution over the specified retVal induced by the utterance 
var simplePragListenerSample = function(utt, sAlpha, lexDist, retVal, worldPrior) {
  // sample possible projections, i.e. equivalence classes
  var proj = sample(projPrior);
  // sample worlds
  var world = sample(worldPrior);
  // sample lexicon from prior distribution
  var lexIdx = sample(lexDist);
  var lex = lexica[lexIdx];
  // condition on speaker saying utterance given world and projection
  factor(sAlpha * speaker(world, proj, lex, worldPrior).score([], utt));
  if (retVal == "proj") {
    return proj;
  } else if (retVal == "state") {
    return world;
  } else if (retVal == "lex") {
    return lexIdx;
  }
}

// enumeration possible for the simple learning model
var simplePragListener = function(utt, sAlpha, lexDist, retVal, worldPrior) {
  return Enumerate(function() {
    return simplePragListenerSample(utt, sAlpha, lexDist, retVal, worldPrior);
  });
}

var iterateSimpleLearningDiffContexts = function(utt, sAlpha, lexPrior, iters) {
  var _iterateSimpleLearning = function(lexDists, iters) {
    return iters == 0 ? lexDists.slice(1) : 
      _iterateSimpleLearning(lexDists.concat(simplePragListener(utt, sAlpha, last(lexDists), "lex", flip(litProb) ? litWorldPrior : metWorldPrior)), iters - 1);
  }
  return _iterateSimpleLearning([lexPrior], iters); 
}


// Note: now accepts a distribution over distribution of lexica as a parameter
// Input: an utterance, a speaker rationality parameter, a distribution over categorical distributions, and a convenience return value param.
// Output: a distribution over the specified retVal induced by the utterance 
var complexPragListenerSample = function(utt, sAlpha, lexDiri, retVal, worldPrior) {
  // sample possible projections, i.e. equivalence classes
  var proj = sample(projPrior);
  // sample worlds
  var world = sample(worldPrior);
  // sample lexicon distribution
  var lexDist = sample(lexDiri);
  // sample lexicon from sampled distribution
  var lexIdx = discrete(lexDist);
  var lex = lexica[lexIdx];
  // condition on speaker saying utterance given world and projection
  factor(sAlpha * speaker(world, proj, lex, worldPrior).score([], utt));
  if (retVal == "proj") {
    return proj;
  } else if (retVal == "state") {
    return world;
  } else if (retVal == "lex") {
    return lexDist;
  }
}

// importance sampling necessary for complex lexical learning
var complexPragListener = function(utt, sAlpha, lexDiri, retVal, numIters, worldPrior) {
  return MH(function() {
    return complexPragListenerSample(utt, sAlpha, lexDiri, retVal, worldPrior);
  }, numIters);
}

var iterateComplexLearningDiffContexts = function(utt, sAlpha, lexDiriPrior, iters, mhIters) {
  var _iterateComplexLearning = function(lexDiris, iters) {
    return iters == 0 ? lexDiris.slice(1) : 
      _iterateComplexLearning(lexDiris.concat(complexPragListener(utt, sAlpha, last(lexDiris), "lex", mhIters, flip(litProb) ? litWorldPrior : metWorldPrior)), iters - 1);
  }
  return _iterateComplexLearning([lexDiriPrior], iters); 
}
///
// hack to visualize mean of Dirichlet
///fold:
var meanDiriDist = function(diriERP) {
  var hist =  mapReduce1(function(a, b) { return map2(function(v1, v2) { v1 + v2}, a, b)}, 
      function(s) {return map(function(entry) { return Math.exp(diriERP.score([], s)) * entry}, s)},
      diriERP.support());
  return Enumerate(function() {return discrete(hist)}); 
}
///
print(meanDiriDist(last(iterateComplexLearningDiffContexts("princess", 1.0, lexDiriPrior, 30, 10000))));
//print(last(iterateSimpleLearningDiffContexts("princess", 1.0, lexPrior, 10)));
~~~~

Note: the "complex" simulation needs lots of iterations to work correctly and may not run properly for you; the "simple" simulation can be used instead to get an idea of what is strengthened etc.

In this context-switching simulation, the incorrect meaning is suppressed very strongly in the literal context, whereas the correct broadened meaning is only slightly suppressed since it is still correct under projection. 
The result of this is that the incorrect meaning is suppressed over all.

Also, some interesting findings results from playing with the parameters. 
For example, the metaphorical meaning may overpower the literal one even with context-switching if there is still high uncertainty over the QUD.
Try this, and other modifications, out. 

### Example 2.3: Affective dimensions

The setting for this example is as in example 1.3.

~~~~
var makeWorldPrior = function(hungryProb, dyingProb, upsetGivenDying, upsetGivenHungry, upsetOther) {
  Enumerate(function() { 
    var isHungry = flip(hungryProb);
    var isDying = flip(dyingProb);
    var isUpset = isHungry ? flip(upsetGivenHungry) : (isDying ? flip(upsetGivenDying) : upsetOther); 
    return [isHungry, isDying, isUpset];
  });
}
// in metaphorical context, referent likely hungry, not likely dying, upset if dying and possibly upset otherwise
var metWorldPrior = makeWorldPrior(0.9, 0.01, 0.99, 0.5, 0.5);
// in literal context, referent likely hungry, dying and upset
var litWorldPrior = makeWorldPrior(0.9, 0.9, 0.99, 0.5, 0.5);
var litProb = 0.5;

// now two possible projection dimensions
var makeProjPrior = function(projProb) {
  Enumerate(function() {
  return [flip(projProb)];
  });
}
// uninformative prior over broadenings
var projPrior = makeProjPrior(0.5);

// assume that hungry has no affective component to its semantics
var lexica = [
  // unrefined starving
  function(utt, world, proj) {
    if (utt == 'hungry') {
      return world[0]; 
    } else if (utt == 'starving') {
      return proj[0] ? world[0] : world[0] && world[1]; 
    } else {
      return true;
    }
  },
  // refined starving
  function(utt, world, proj) {
    if (utt == 'hungry') {
      return world[0]; 
    } else if (utt == 'starving') {
      return proj[0] ? 
        (world[0] && world[2]) : 
        (world[0] && world[1] && world[2]);
    } else {
      return true;
    }
  },
  // unrefined and broadened starving
  function(utt, world, proj) {
    if (utt == 'hungry') {
      return world[0]; 
    } else if (utt == 'starving') {
      return world[0]; 
    } else {
      return true;
    }
  },
  // refined and broadened starving
  function(utt, world, proj) {
    if (utt == 'hungry') {
      return world[0]; 
    } else if (utt == 'starving') {
      return world[0] && world[2]; 
    } else {
      return true;
    }
  },
];
var makeLexPrior = function(probs) {
  Enumerate(function() {return discrete(probs)});
}
// refined and un-refined versions equally likely
var lexPrior = makeLexPrior([10, 10, 1, 1]);

var makeLexDiriPrior = function(alphas) {
  ParticleFilter(function() {return dirichlet(alphas)},
  10000);
}
var lexDiriPrior = makeLexDiriPrior([10, 10, 1, 1]);

var utts =  ['hungry', 'starving', 'null'];
var makeUttPrior = function(weights) {
  Enumerate(function() {
  return utts[discrete(weights)];
  });
}
// null utterance more expensive
var uttPrior = makeUttPrior([1, 1, 0.01]);

// models as above
///fold:
// Input: an utterance, a projection, and a lexicon
// Output: a distribution on worlds consistent with the utterances meaning under the projection
var litListener = function(utt, proj, lex, worldPrior) {
  Enumerate(function() {
    var world = sample(worldPrior);
    factor(lex(utt, world, proj) ? 0 : -Infinity);
    return world;
  });
}

// Input: a world, a semantic projection, a rationality weight, and a lexicon
// Output: an utterance that is likely to make the litListener give high posterior to the world 
var speaker = function(world, proj, lex, worldPrior) {
  Enumerate(function() {
    var utt = sample(uttPrior);
    factor(litListener(utt, proj, lex, worldPrior).score([], world));
    return utt;
  });
}

// Note: simple model the same as the models with refinement introduced previously
// Input: an utterance, a speaker rationality parameter, a distribution over categorical distributions, and a convenience return value param.
// Output: a distribution over the specified retVal induced by the utterance 
var simplePragListenerSample = function(utt, sAlpha, lexDist, retVal, worldPrior) {
  // sample possible projections, i.e. equivalence classes
  var proj = sample(projPrior);
  // sample worlds
  var world = sample(worldPrior);
  // sample lexicon from prior distribution
  var lexIdx = sample(lexDist);
  var lex = lexica[lexIdx];
  // condition on speaker saying utterance given world and projection
  factor(sAlpha * speaker(world, proj, lex, worldPrior).score([], utt));
  if (retVal == "proj") {
    return proj;
  } else if (retVal == "state") {
    return world;
  } else if (retVal == "lex") {
    return lexIdx;
  }
}

// enumeration possible for the simple learning model
var simplePragListener = function(utt, sAlpha, lexDist, retVal, worldPrior) {
  return Enumerate(function() {
    return simplePragListenerSample(utt, sAlpha, lexDist, retVal, worldPrior);
  });
}

var iterateSimpleLearningDiffContexts = function(utt, sAlpha, lexPrior, iters) {
  var _iterateSimpleLearning = function(lexDists, iters) {
    return iters == 0 ? lexDists.slice(1) : 
      _iterateSimpleLearning(lexDists.concat(simplePragListener(utt, sAlpha, last(lexDists), "lex", flip(litProb) ? litWorldPrior : metWorldPrior)), iters - 1);
  }
  return _iterateSimpleLearning([lexPrior], iters); 
}


// Note: now accepts a distribution over distribution of lexica as a parameter
// Input: an utterance, a speaker rationality parameter, a distribution over categorical distributions, and a convenience return value param.
// Output: a distribution over the specified retVal induced by the utterance 
var complexPragListenerSample = function(utt, sAlpha, lexDiri, retVal, worldPrior) {
  // sample possible projections, i.e. equivalence classes
  var proj = sample(projPrior);
  // sample worlds
  var world = sample(worldPrior);
  // sample lexicon distribution
  var lexDist = sample(lexDiri);
  // sample lexicon from sampled distribution
  var lexIdx = discrete(lexDist);
  var lex = lexica[lexIdx];
  // condition on speaker saying utterance given world and projection
  factor(sAlpha * speaker(world, proj, lex, worldPrior).score([], utt));
  if (retVal == "proj") {
    return proj;
  } else if (retVal == "state") {
    return world;
  } else if (retVal == "lex") {
    return lexDist;
  }
}

// importance sampling necessary for complex lexical learning
var complexPragListener = function(utt, sAlpha, lexDiri, retVal, numIters, worldPrior) {
  return MH(function() {
    return complexPragListenerSample(utt, sAlpha, lexDiri, retVal, worldPrior);
  }, numIters);
}

var iterateComplexLearningDiffContexts = function(utt, sAlpha, lexDiriPrior, iters, mhIters) {
  var _iterateComplexLearning = function(lexDiris, iters) {
    return iters == 0 ? lexDiris.slice(1) : 
      _iterateComplexLearning(lexDiris.concat(complexPragListener(utt, sAlpha, last(lexDiris), "lex", mhIters, flip(litProb) ? litWorldPrior : metWorldPrior)), iters - 1);
  }
  return _iterateComplexLearning([lexDiriPrior], iters); 
}
///
// hack to visualize mean of Dirichlet
///fold:
var meanDiriDist = function(diriERP) {
  var hist =  mapReduce1(function(a, b) { return map2(function(v1, v2) { v1 + v2}, a, b)}, 
      function(s) {return map(function(entry) { return Math.exp(diriERP.score([], s)) * entry}, s)},
      diriERP.support());
  return Enumerate(function() {return discrete(hist)}); 
}
///
print(meanDiriDist(last(iterateComplexLearningDiffContexts("starving", 1.0, lexDiriPrior, 10, 10000))));
//print(last(iterateSimpleLearningDiffContexts("starving", 1.0, lexPrior, 10)));
~~~~

Here we see that a weakened meaning of "starving" that simply means "hungry" is most strongly conventionalized, i.e. the meaning is both broadened and bleached (removed of its affective component).

### Example 2.4: Refinement only

This example looks at the case of "princess" in a literal context and examines the lexicalization of different refined meanings.

~~~~
var makeWorldPrior = function(royalProb, spoiledRoyalProb, spoiledNotRoyalProb) {
  Enumerate(function() { 
    var isRoyal = flip(royalProb);
    var isSpoiled = isRoyal ? flip(spoiledRoyalProb) : flip(spoiledNotRoyalProb);
    return [isRoyal, isSpoiled];
  });
}
// in metaphorical context referent not likely member of royalty, if royal probably spoiled, and if not royal 50/50 spoiled
var metWorldPrior = makeWorldPrior(0.01, 0.8, 0.5);
// in literal context referent likely member of royalty, if royal probably spoiled, and if not royal 50/50 spoiled
var litWorldPrior = makeWorldPrior(0.99, 0.8, 0.5);
// 50/50 prob in literal context
var litProb = 0.5;

var makeProjPrior = function(projProb) {
  Enumerate(function() {
  return flip(projProb);
  });
}
// uninformative prior over whether princess is broadened
var projPrior = makeProjPrior(0.5);

var lexica = [
  // original
  function(utt, world, proj) {
    if (utt == 'princess') {
      return world[0]; 
    } else if (utt == 'null spoiled brat') {
      return world[1];
    } else {
      return true;
    }
  },
  //refined
  function(utt, world, proj) {
    if (utt == 'princess') {
      return !proj ? world[0] && world[1] : world[1]; 
    } else if (utt == 'null spoiled brat') {
      return world[1];
    } else  {
      return true;
    }
  },
];
var makeLexicaDistPrior = function(alphas) { 
  ParticleFilter(
    function() {return dirichlet(alphas)}, 
    1000);
}
// refined and unrefined equal but broadened small weight
var lexDiriPrior = makeLexicaDistPrior([10, 1]); 
var makeLexPrior = function(probs) {
  Enumerate(function() {return discrete(probs)});
}
// same weights as above
var lexPrior = makeLexPrior([10, 1]);

var utts =  ['princess', 'null spoiled brat', 'null'];
var makeUttPrior = function(weights) {
  Enumerate(function() {
  return utts[discrete(weights)];
  });
}
var uttPrior = makeUttPrior([1, 0.1, 0.01]);

// models as above
///fold:
// Input: an utterance, a projection, and a lexicon
// Output: a distribution on worlds consistent with the utterances meaning under the projection
var litListener = function(utt, proj, lex, worldPrior) {
  Enumerate(function() {
    var world = sample(worldPrior);
    factor(lex(utt, world, proj) ? 0 : -Infinity);
    return world;
  });
}

// Input: a world, a semantic projection, a rationality weight, and a lexicon
// Output: an utterance that is likely to make the litListener give high posterior to the world 
var speaker = function(world, proj, lex, worldPrior) {
  Enumerate(function() {
    var utt = sample(uttPrior);
    factor(litListener(utt, proj, lex, worldPrior).score([], world));
    return utt;
  });
}

// Note: simple model the same as the models with refinement introduced previously
// Input: an utterance, a speaker rationality parameter, a distribution over categorical distributions, and a convenience return value param.
// Output: a distribution over the specified retVal induced by the utterance 
var simplePragListenerSample = function(utt, sAlpha, lexDist, retVal, worldPrior) {
  // sample possible projections, i.e. equivalence classes
  var proj = sample(projPrior);
  // sample worlds
  var world = sample(worldPrior);
  // sample lexicon from prior distribution
  var lexIdx = sample(lexDist);
  var lex = lexica[lexIdx];
  // condition on speaker saying utterance given world and projection
  factor(sAlpha * speaker(world, proj, lex, worldPrior).score([], utt));
  if (retVal == "proj") {
    return proj;
  } else if (retVal == "state") {
    return world;
  } else if (retVal == "lex") {
    return lexIdx;
  }
}

// enumeration possible for the simple learning model
var simplePragListener = function(utt, sAlpha, lexDist, retVal, worldPrior) {
  return Enumerate(function() {
    return simplePragListenerSample(utt, sAlpha, lexDist, retVal, worldPrior);
  });
}

var iterateSimpleLearningDiffContexts = function(utt, sAlpha, lexPrior, iters) {
  var _iterateSimpleLearning = function(lexDists, iters) {
    return iters == 0 ? lexDists.slice(1) : 
      _iterateSimpleLearning(lexDists.concat(simplePragListener(utt, sAlpha, last(lexDists), "lex", flip(litProb) ? litWorldPrior : metWorldPrior)), iters - 1);
  }
  return _iterateSimpleLearning([lexPrior], iters); 
}


// Note: now accepts a distribution over distribution of lexica as a parameter
// Input: an utterance, a speaker rationality parameter, a distribution over categorical distributions, and a convenience return value param.
// Output: a distribution over the specified retVal induced by the utterance 
var complexPragListenerSample = function(utt, sAlpha, lexDiri, retVal, worldPrior) {
  // sample possible projections, i.e. equivalence classes
  var proj = sample(projPrior);
  // sample worlds
  var world = sample(worldPrior);
  // sample lexicon distribution
  var lexDist = sample(lexDiri);
  // sample lexicon from sampled distribution
  var lexIdx = discrete(lexDist);
  var lex = lexica[lexIdx];
  // condition on speaker saying utterance given world and projection
  factor(sAlpha * speaker(world, proj, lex, worldPrior).score([], utt));
  if (retVal == "proj") {
    return proj;
  } else if (retVal == "state") {
    return world;
  } else if (retVal == "lex") {
    return lexDist;
  }
}

// importance sampling necessary for complex lexical learning
var complexPragListener = function(utt, sAlpha, lexDiri, retVal, numIters, worldPrior) {
  return MH(function() {
    return complexPragListenerSample(utt, sAlpha, lexDiri, retVal, worldPrior);
  }, numIters);
}

var iterateComplexLearningDiffContexts = function(utt, sAlpha, lexDiriPrior, iters, mhIters) {
  var _iterateComplexLearning = function(lexDiris, iters) {
    return iters == 0 ? lexDiris.slice(1) : 
      _iterateComplexLearning(lexDiris.concat(complexPragListener(utt, sAlpha, last(lexDiris), "lex", mhIters, flip(litProb) ? litWorldPrior : metWorldPrior)), iters - 1);
  }
  return _iterateComplexLearning([lexDiriPrior], iters); 
}
///
// hack to visualize mean of Dirichlet
///fold:
var meanDiriDist = function(diriERP) {
  var hist =  mapReduce1(function(a, b) { return map2(function(v1, v2) { v1 + v2}, a, b)}, 
      function(s) {return map(function(entry) { return Math.exp(diriERP.score([], s)) * entry}, s)},
      diriERP.support());
  return Enumerate(function() {return discrete(hist)}); 
}
///
print(meanDiriDist(last(iterateComplexLearningDiffContexts("princess", 1.0, lexDiriPrior, 10, 10000))));
//print(last(iterateSimpleLearningDiffContexts("princess", 1.0, lexPrior, 10)));
~~~~

These simulations show that the refined meaning's lexicalization is contingent on the contexts in which the word is used.
Most importantly, the refined meaning is lexicalized strongly when the word is used in the metaphorical sense, which would in turn facilitate the lexicalization of the refined and broadened meaning. 
Again, note that this lexicalization is very different from the examples of broadening, as it simply corresponds to lexicalizing more specific versions of a word (i.e., non-literal interpretation is not required). 

### Example 2.5: Specificity Implicatures

As a final case, we consider the lexicalization of specificity implicatures, in particular the classic case "some" vs "all". 

~~~~
var makeWorldPrior = function(weights) {
  Enumerate(function() { 
    var worlds = ['SOMENOTALL', 'ALL', 'NONE'];
    return worlds[discrete(weights)];
  });
}
// probably talking about some
var worldPrior = makeWorldPrior([1, 0.5, 0.5]);

// projection is just boolean designating whether the semantics of campaign is broadened.
var makeProjPrior = function(projProb) {
  Enumerate(function() {
  return flip(projProb);
  });
}
// for generality we assume uninformative projection prior
var projPrior = makeProjPrior(0.5);

// possible utterances are as follows:
// Note: "null campaign" corresponds to an exact paraphrase of "campaigns" broadened semantics. 
// Note: "military campaign" is redundant under the standard ("unbroadened") semantics.
var utts =  ['some', 'all', 'null'];
var makeUttPrior = function(weights) {
  Enumerate(function() {
  return utts[discrete(weights)];
  });
}
// prior reflects assumed costs, "null campaign" is costlier than two word phrases.
var uttPrior = makeUttPrior([1, 1, 0.01]);

var lexica = [
  // original meaning
  function(utt, world, proj) {
    if (utt == 'some') {
      return world == 'SOMENOTALL' || world == 'ALL';
    } else if (utt == 'all') {
      return world == 'ALL';
    } else {
      return true;
    }
  },
  // refined version 1
  function(utt, world, proj) {
    if (utt == 'some') {
      return world == 'SOMENOTALL';
    } else if (utt == 'all') {
      return world == 'ALL';
    } else {
      return true;
    }
  },
  // refined version 2
  function(utt, world, proj) {
    if (utt == 'some') {
      return world == 'ALL';
    } else if (utt == 'all') {
      return world == 'ALL';
    } else {
      return true;
    }
  },

];
var makeDiriPrior = function(alphas) { 
  ParticleFilter(
    function() {return dirichlet(alphas)}, 
    10000);
}
// prior of categorical weights assigns most weight to unbroadened lexicon
// (NOTE: realistic values would given unbroadened higher weight but that makes results hard to see..)
var lexDiriPrior = makeDiriPrior([10, 1, 1]);

var makeLexPrior = function(probs) {
  Enumerate(function() {return discrete(probs)});
}
// simple categorical distribution over lexicon mirrors Dirichlet above
var lexPrior =  makeLexPrior([10, 1, 1]);
 
// models as above
///fold:
// Input: an utterance, a projection, and a lexicon
// Output: a distribution on worlds consistent with the utterances meaning under the projection
var litListener = function(utt, proj, lex) {
  Enumerate(function() {
    var world = sample(worldPrior);
    factor(lex(utt, world, proj) ? 0 : -Infinity);
    return world;
  });
}

// Input: a world, a semantic projection, a rationality weight, and a lexicon
// Output: an utterance that is likely to make the litListener give high posterior to the world 
var speaker = function(world, proj, lex) {
  Enumerate(function() {
    var utt = sample(uttPrior);
    factor(litListener(utt, proj, lex).score([], world));
    return utt;
  });
}

// Note: simple model the same as the models with refinement introduced previously
// Input: an utterance, a speaker rationality parameter, a distribution over categorical distributions, and a convenience return value param.
// Output: a distribution over the specified retVal induced by the utterance 
var simplePragListenerSample = function(utt, sAlpha, lexDist, retVal) {
  // sample possible projections, i.e. equivalence classes
  var proj = sample(projPrior);
  // sample worlds
  var world = sample(worldPrior);
  // sample lexicon from prior distribution
  var lexIdx = sample(lexDist);
  var lex = lexica[lexIdx];
  // condition on speaker saying utterance given world and projection
  factor(sAlpha * speaker(world, proj, lex).score([], utt));
  if (retVal == "proj") {
    return proj;
  } else if (retVal == "state") {
    return world;
  } else if (retVal == "lex") {
    return lexIdx;
  }
}

// enumeration possible for the simple learning model
var simplePragListener = function(utt, sAlpha, lexDist, retVal) {
  return Enumerate(function() {
    return simplePragListenerSample(utt, sAlpha, lexDist, retVal);
  });
}

var iterateSimpleLearning = function(utt, sAlpha, lexPrior, iters) {
  var _iterateSimpleLearning = function(lexDists, iters) {
    return iters == 0 ? lexDists.slice(1) : 
      _iterateSimpleLearning(lexDists.concat(simplePragListener(utt, sAlpha, last(lexDists), "lex")), iters - 1);
  }
  return _iterateSimpleLearning([lexPrior], iters); 
}


// Note: now accepts a distribution over distribution of lexica as a parameter
// Input: an utterance, a speaker rationality parameter, a distribution over categorical distributions, and a convenience return value param.
// Output: a distribution over the specified retVal induced by the utterance 
var complexPragListenerSample = function(utt, sAlpha, lexDiri, retVal) {
  // sample possible projections, i.e. equivalence classes
  var proj = sample(projPrior);
  // sample worlds
  var world = sample(worldPrior);
  // sample lexicon distribution
  var lexDist = sample(lexDiri);
  // sample lexicon from sampled distribution
  var lexIdx = discrete(lexDist);
  var lex = lexica[lexIdx];
  // condition on speaker saying utterance given world and projection
  factor(sAlpha * speaker(world, proj, lex).score([], utt));
  if (retVal == "proj") {
    return proj;
  } else if (retVal == "state") {
    return world;
  } else if (retVal == "lex") {
    return lexDist;
  }
}

// importance sampling necessary for complex lexical learning
var complexPragListener = function(utt, sAlpha, lexDiri, retVal, numIters) {
  return MH(function() {
    return complexPragListenerSample(utt, sAlpha, lexDiri, retVal);
  }, numIters);
}

var iterateComplexLearning = function(utt, sAlpha, lexDiriPrior, iters, mhIters) {
  var _iterateComplexLearning = function(lexDiris, iters) {
    return iters == 0 ? lexDiris.slice(1) : 
      _iterateComplexLearning(lexDiris.concat(complexPragListener(utt, sAlpha, last(lexDiris), "lex", mhIters)), iters - 1);
  }
  return _iterateComplexLearning([lexDiriPrior], iters); 
}
///
// hack to visualize mean of Dirichlet
///fold:
var meanDiriDist = function(diriERP) {
  var hist =  mapReduce1(function(a, b) { return map2(function(v1, v2) { v1 + v2}, a, b)}, 
      function(s) {return map(function(entry) { return Math.exp(diriERP.score([], s)) * entry}, s)},
      diriERP.support());
  return Enumerate(function() {return discrete(hist)}); 
}
///
print(meanDiriDist(last(iterateComplexLearning("some", 1.0, lexDiriPrior, 10, 1000))));
//print(last(iterateSimpleLearning("some", 1.0, lexPrior, 10)));
~~~~

These simulations show that the "incorrect" refinement to "all" is suppressed (as expected).
Moreover, the "original" meaning dominates and in fact as the context implicates "some but not all" more and more the "simple" distribution over lexica converges to having half of the probability mass on the refined meaning and half on the "original".
In other words, this type of refinement is not strongly lexicalized (since the refined meaning also falls out of the pragmatics).


## TODOs

1. Add proper support for compositional semantics. Right now, compositional semantics is not really supported (and is hacked when necessary).
2. Make plots of meaning change etc. over time.
3. Brainstorm experiments that could use the model.
4. Add more complicated learning (e.g., at different levels).
