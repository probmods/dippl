---
layout: lecture
title: WebPPL
description: A probabilistic sub-language of Javascript.
---


This is a brief documentation of a very small probabilistic programming language, called WebPPL (pronounced 'web people').

# The language

## A subset of Javascirpt

Following the notation from the [Mozilla Parser API](https://developer.mozilla.org/en-US/docs/Mozilla/Projects/SpiderMonkey/Parser_API) our language consists of the subset of javascript given by:
Program, BlockStatement, ExpressionStatement, ReturnStatement, EmptyStatement, VariableDeclaration, Identifier, Literal, FunctionExpression, CallExpression, ConditionalExpression, ArrayExpression, MemberExpression, BinaryExpression, UnaryExpression.

Note in particular that there are no AssignmentExpressions or looping constructs. This is because a purely functional language is much easier to transform into Continuation Passing Style (CPS), which we will use to implement inference algorithms (via coroutines).

Because we allow recursive and higher-order functions this subset is still universal, and is pretty easy to use (especially once you get use to thinking in a functional style!).

Here is a (very boring) program that uses most of the syntax we have available:

~~~~
var foo = function(x) {
  var bar = x==0 ? [] : [Math.log(1), foo(x-1)]
  return bar
}

foo(5) 
~~~~

### Using Javascript libraries

Functions from the Javscript environment that WebPPL is called from can be used in a WebPPL program, with a few restrictions. First, these external functions must be deterministic and can carry no state from one call to another (that is, the functions must be 'referentially transparent': calling obj.foo(args) must always return the same value when called with given arguments). Second, external functions must be invoked as the method of an object (indeed, this is the only use of object method invocation in WebPPL). So the use of `Math.log()` in the above example is allowed: it is a deterministic function invoked as a method of the `Math` object (which is a standard object in the Javascript global environment).


## With random sampling

Elementary Random Primitives (ERPs) are the basic type that represents distributions.

You can sample from ERPs with the `sample` operator:

~~~~
sample(bernoulli, 0.5)
~~~~

There are a set of pre-defined ERPs: flip, guassian, [FIXME]... It is also possible to define new ERPs and to build ERP distributions via inference functions (see below).

With only the ability to sample from primitive distributions and do deterministic computation, the language is already universal!




## And inference

It is easier to build useful models (that, for instance, condition on data) with `factor`. But `factor` by itself doesn't do anything -- it interacts with *marginalization* functions that normalize the computation they are applied to.

These marginalization functions (which we will generally call inference functions) take a random computation represented as a function with no arguments and return an ERP that represents the marginal distribution on return values. How they get this marginal ERP differs between inference functions, and is the topic of most of this tutorial.

 
