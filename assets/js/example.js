function foo(a, b){
  return a + b;
}

var bar = function(c, d){
  return c * bar(d, 3);
};

var x = 1;
var y = 2;
console.log(bar(foo(x, y), 3));