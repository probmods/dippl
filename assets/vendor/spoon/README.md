# Spoon

Continuation passing style for javascript.

## It's hot

Spoon is a javascript *transpiler*, it's designed to compile javascript to...
javascript.

Lets take following code sample:
```javascript
var x = 1;

var y = hardMath(x) * 2;

console.log(y);
```

Suppose you would like to do `hardMath` on some remote machine (or in thread),
this will surely require you to make this call asynchronous - i.e. pass a
continuation as a callback for `hardMath` function.

Calling `spoon(code, ['hardMath'])` will find all occurences of `hardMath` and
replace them with following thing:
```javascript
function __$fn1(__$r) {
    y = __$r * 2;
    console.log(y);
    return __$callback.call(this);
};

var y;

var x;

x = 1;

return hardMath(x, __$fn1);
```

As you can see `__$callback` function should be available in a context.

## Why spoon is interesting?

Spoon isn't just doing stupid tricks with your code, it compiles javascript to
well-known form (used by almost every compiler, including v8) HIR (High-Level
intermediate representation).

You can do it yourself by calling:
```javascript
var cfg = spoon.construct(esprima.parse('x = y + 1 * 2'));

console.log(cfg.toString());
```

Will produce:
```
--- CFG ---
[block 0]
# predecessors: 
# parent: null
# frontier: 
# cfrontier: 
i0 = var y
i1 = get x
i2 = literal 1
i3 = literal 2
i4 = binop *, i2, i3
i5 = binop +, i1, i4
i6 = set =, y, i5
# successors: 
# children: 
```

You can manipulate blocks, change order of instruction, do some optimizations,
and, after that, compile CFG back to JS:
```javascript
spoon.render(cfg);
```

## API

```javascript
// Transpile code
spoon(code, [ functions ], {
  declaration: 'enable spoon', // spoon will touch only code with
                               // "enable spoon"; declaration
  uglify: {},                  // uglifyjs options (used for code generation)
  esprima: {}                  // esprima options (used for parsing)
})

// Construct CFG
var cfg = spoon.construct(EsprimaAST);

// Render CFG
spoon.render(cfg);
```

### License

This software is licensed under the MIT License.

Copyright Fedor Indutny, 2012.

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the
following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
USE OR OTHER DEALINGS IN THE SOFTWARE.
