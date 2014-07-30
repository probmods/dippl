# episcope

[![Build Status](https://secure.travis-ci.org/Gozala/episcope.png)](http://travis-ci.org/Gozala/episcope)

ECMAScript scope analyzer. Library provides set of functions that perform
analyzes on the nodes of the AST in the de facto [syntax tree format][ast].
All the API function take AST nodes denoting a lexical scope and performed
static analyzes at the given scope level.


## API


#### references

Returns array of `Identifier` nodes for all the free references with in the
given scope that are not part of declarations or members access identifiers.

```js
var esprima = require("esprima")
var references = require("episcope/references")
var ast = esprima.parse("console.log('>>>', error)")
references(ast)
// =>  [{ type: "Identifier", name: "console" }, { type: "Identifier", name: "error" }]
```

#### bindings

Returns array of `Identifier` nodes for all the declared bindings available
to the given scope, including named arguments if given scope is a function
form.

```js
var esprima = require("esprima")
var bindings = require("episcope/bindings")
var ast = esprima.parse("function foo(a, b) { var c = a + b; return c * c }")
ast.body[0].id
// => { type: 'Identifier', name: 'foo' }
bindings(ast.body[0])
// =>  [ { type: 'Identifier', name: 'a' },
//       { type: 'Identifier', name: 'b' },
//       { type: 'Identifier', name: 'c' } ]
```

#### scopes

Returns array of nested scope forms for the given one. Note the nested scopes
of those nested scopes are not included, but this function can be used to
do the walk through them too.

```js
var esprima = require("esprima")
var scopes = require("episcope/scopes")
var ast = esprima.parse(String(function root() {
  function nested() { /***/ }
  try { /***/ } catch(error) { /***/ }
}))
ast.body[0].id
// => { type: 'Identifier', name: 'foo' }

scopes(ast.body[0])
// => [
//  { 
//    type: 'FunctionDeclaration',
//    id: { type: 'Identifier', name: 'nested' },
//    // ...
//  },
//  {
//    type: 'CatchClause',
//    param: { type: 'Identifier', name: 'error' },
//    body: { type: 'BlockStatement', body: [] }
//  }
//]
```

#### properties

Returns array of `Identifier` nodes for all the property references within
the given scope. Mainly used internally to filter out references to free
variables.

```js
var esprima = require("esprima")
var properties = require("episcope/properties")
var ast = esprima.parse("document.body.appendChild(node)")

properties(ast)
// => [ { type: 'Identifier', name: 'appendChild' },
//      { type: 'Identifier', name: 'body' } ]
```

## Install

    npm install episcope

[esprima]:http://esprima.org/
[ast]:http://esprima.org/doc/index.html#ast
