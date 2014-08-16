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

Let's look at our `cpsFactorial` again. Suppose we want to build in error handling for the case when 

~~~~
var totalCpsFactorial = function(k, err, n) {
  if (n < 0) {
    err("cpsFactorial: n < 0!")
  } else {
    if (n == 0) {
      k(1);
    } else {
      totalCpsFactorial(
        function(x){ k(x * n) },
        err,
        n - 1);
    }
  }
}

var printError = function(x){
  print("Error: " + x);
}

totalCpsFactorial(print, printError, 5)
~~~~

## Continuation-passing transform

continuation-passing transform for the lambda calculus:

- function def
- function application
- variables

interactive form that applies our transform to webppl program (auto-update)
