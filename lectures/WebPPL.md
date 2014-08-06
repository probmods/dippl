
This is a brief documentation of a very small probabilistic programming language, called WebPPL (pronounced 'web people').

# The language

## A subset of Javascirpt

Following the notation from the [Mozilla Parser API | https://developer.mozilla.org/en-US/docs/Mozilla/Projects/SpiderMonkey/Parser_API] our language consists of the subset of javascript given by:
Program, BlockStatement, ExpressionStatement, ReturnStatement, EmptyStatement, VariableDeclaration, Identifier, Literal, FunctionExpression, CallExpression, ConditionalExpression, ArrayExpression, MemberExpression.

Note in particular that there are no AssignmentExpressions or looping constructs. This is because a purely functional language is much easier to transform into Continuation Passing Style (CPS), which we will use to implement coroutines for inference algorithms.

Because we allow recursive and higher-order functions this subset is still universal, and is pretty easy to use (especially once you get use to thinking in a functional style!).

Here is a (very boring) program that uses most of the syntax we have available:
~~~~
var foo = function(x) {
  var bar = x==0 ? [] : [1, foo(x-1)]
  return bar
}

foo(5) 
~~~~

## With random sampling

Elementary Random Primitives (ERPs) are the basic type that represents distributions.

You can sample from ERPs with the `sample` operator:

~~~~
sample(flip, 0.5)
~~~~

There are a set of pre-defined ERPs (FIXME): flip, guassian, ... It is also possible to define new ERPs and to build distributions via inference functions (see below).

With only the ability to sample from primitive distributions and do deterministic computation, the language is already universal!




## And inference

It is easier to build useful models (that, for instance, condition on data) with `factor`. But `factor` by itself doesn't do anything -- it interacts with *marginalization* functions that normalize the computation they are applied to.

These functions (which we will generally call inference functions) take a random computation represented as a function with no arguments and return an ERP that represents the marginal distribution on return values. How they get this marginal ERP differs between inference functions, and is the topic of most of this tutorial.

 
#

## A grammar of SmallPPL

first the wrapper statements (which we can pretty much ignore for pedagogical purposes): Program, BlockStatement, ExpressionStatement, ReturnStatement
        next the basic statements where nothing fancy happens: VariableDeclaration, CallExpression, Identifier, Literal
        we need some branching operator: ConditionalExpression  or  IfStatement
        we have to choose whether to make this turing complete via first class functions or while loops: WhileStatement  or  FunctionExpression
        and then i think we should explicitly mark ERP applications to make life simple: SampleStatement
        maybe also make queries a special case: QueryStatement, ConditionStatement, and maybe: FactorStatement
