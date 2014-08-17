---
layout: lecture
title: Continuations
description: Examples of programs in continuation-passing style. CPS transform.
---

A continuation is a function that expresses "what to do next" with the value of a computation. In the following, we give a few examples of continuations in use and describe what continuation-passing style is. This exposition is partly based on the articles [By example: Continuation-passing style in JavaScript](http://matt.might.net/articles/by-example-continuation-passing-style/) and [How to compile with continuations](http://matt.might.net/articles/cps-conversion/) by Matt Might.

Consider a function `square` that takes a number and returns its square. We call this function with the number 3 and print the result:

~~~~
var square = function(x) {
  return x * x;
}

print(square(3))
~~~~

At the point in the computation where the function returns `3 * 3`, what is it that the computation "does next" with this value? In this case, we print it to the screen. When a computer executes this program, it knows this (has it stored on the stack), but this information is not explicitly available during the execution of the program. The continuation is a function that represents this information explicitly. **Continuation-passing style** (CPS) is a way of writing programs such that the current continuation is always explicitly available.

Let's rewrite the program above with an explicit continuation function `k`:

~~~~
var cpsSquare = function(k, x) {
  k(x * x);
}

cpsSquare(print, 3)
~~~~

Now, when we get to `return k(x * x)`, the variable `k` contains the function `print`, which is "what happens next" in the sense that we pass the value of `x * x` to this function instead of returning.

It is helpful to think that, in continuation-passing style, functions never return -- they only ever call continuations with the values that they would otherwise have returned.

Let's look at another example, the factorial function:

~~~~
var factorial = function(n) {
  if (n == 0) {
    return 1;
  } else {
    return factorial(n-1) * n;
  }
}

print(factorial(5))
~~~~

And in continuation-passing style:

~~~~
var cpsFactorial = function(k, n) {
  if (n == 0) {
    k(1);
  } else {
    cpsFactorial(
      function(x){ k(x * n) },
      n - 1);
  }
}

cpsFactorial(print, 5)
~~~~

Look at the `else` branch and note how continuation-passing style turns nested function applications "inside-out": in standard style, the product is on the outside and the result of the call to `factorial` is one of its arguments. In CPS, the call to `cpsFactorial` is on the outside, and it is its continuation argument that contains the information that the result of this function will be multiplied with `n`.

Compare to another way of writing the factorial function, the **tail-recursive** form. In this form, standard style and continuation-passing style are basically identical:

~~~~
// Standard version:

var factorial2 = function(n, a) {
  if (n == 0) {
    return a;
  } else {
    return factorial2(n-1, n*a);
  }
}


// CPS version:

var cpsFactorial2 = function(k, n, a) {
  if (n == 0) {
    k(a);
  } else {
    cpsFactorial2(k, n-1, n*a);
  }
}


print(factorial2(5, 1))

cpsFactorial2(print, 5, 1)
~~~~

A function is **tail-recursive** when the recursive call happens as the final action in a function, in which case it can happen without the function call stack growing. In continuation-passing style, there is no stack -- all functions are tail-recursive.

Continuation-passing style is useful because it allows us to manipulate the execution of the program in ways that would otherwise be difficult. For example, we can use CPS to implement exception handling.

Let's look at `cpsFactorial` again. Suppose we want to throw an error when `n < 0`. By "throw an error", we mean that we stop whatever computations we would have done next and instead pass control to an error handler. This is easy in continuation-passing style: since there is no implicit stack -- i.e. no computations waiting to be performed -- all we have to do is call an error continuation.

~~~~
var totalCpsFactorial = function(k, err, n) {
  if (n < 0) {
    err("cpsFactorial: n < 0!")
  } else if (n == 0) {
    k(1);
  } else {
    totalCpsFactorial(
      function(x){ k(x * n) },
      err,
      n - 1);
  }
}

var printError = function(x){
  print("Error: " + x);
}

totalCpsFactorial(print, printError, 5)
totalCpsFactorial(print, printError, -1)
~~~~


## Continuation-passing transform

Program can automatically be transformed into continuation-passing style. Let's look at what a naive transformation looks like for function expressions, function application, and constants:

Function expressions take an additional argument, the continuation `k`:

~~~~
// Before CPS
function(x, y, ...){
  // body
}

// After CPS
function(k, x, y, ...){
  var _return = k;
  // cpsTransform(body, "k")
}
~~~~

Function applications are sequentialized---we first evaluate the operator and pass it to a function; this function evaluates the first argument and passes it to a function; that function evaluates the next argument, etc, until we have evaluated operator and operands and can apply operator to operands, adding in an additional continuation argument `k`:

~~~~
// Before CPS
f(x, y, ...)

// After CPS (with top-level continuation k)
(function (_s0) {
    (function (_s1) {
        (function (_s2) {
            _s0(k, _s1, _s2);
        }(y));
    }(x));
}(f));
~~~~

Constants get passed to the current continuation:

~~~~
// Before CPS:
12

// After CPS (with top-level continuation k)
k(12)
~~~~


## CPS transform in action

The auto-updating form below shows the transform that we actually use for WebPPL programs. Try it out:

<div id="cpsTransform">
    <textarea id="cpsInput">1 + 2</textarea>
    <textarea id="cpsOutput"></textarea>
</div>
