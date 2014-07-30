"use strict";

var keys = Object.keys
function property(name) { return this[name] }
function values(form) { return keys(form).map(property, form) }
function isObject(form) { return form && typeof(form) === "object" }
function isNode(form) { return isObject(form) && !!form.type }

function isBranch(node) { return isObject(node) }
exports.isBranch = isBranch

function append(left, right) { return left.concat(right) }

var defineProperty = Object.defineProperty
function defineParent(node) {
  return defineProperty(node, "parent", {
    value: this,
    enumerable: false,
    // TODO: Remove this
    configurable: true
  })
}

function children(form) {
  return values(form).
    // If property is an array then inline it's elements as children.
    reduce(append, []).
    // Ignore non node properties
    filter(isNode).
    // Define references to the parent nodes
    map(defineParent, form)
}
exports.children = children

var slicer = Array.prototype.slice
function select(forms) {
  var types = slicer.call(arguments, 1)
  return forms.filter(function(form) {
    return types.indexOf(form.type) >= 0
  })
}
exports.select = select

function isFunctionDeclaration(form) {
  return form.type === "FunctionDeclaration"
}
exports.isFunctionDeclaration = isFunctionDeclaration

function isVariableDeclarator(form) {
  return form.type === "VariableDeclarator"
}
exports.isVariableDeclarator = isVariableDeclarator

function isDeclaration(form) {
  return isFunctionDeclaration(form) ||
         isVariableDeclarator(form)
}
exports.isDeclaration = isDeclaration

function isFunction(form) {
  /**
  Returns `true` if given from is a function expression or declaration.
  **/
  return form.type === "FunctionExpression" ||
    form.type === "FunctionDeclaration"
}
exports.isFunction = isFunction

function isCatch(form) {
  /**
  Returns `true` if given form is a `catch` clause.
  **/
  return form.type === "CatchClause"
}
exports.isCatch = isCatch

function isScope(form) {
  /**
  Returns `true` if given form forms a `scope`, which means it's either
  function, catch clause, or a `with` statement.
  **/
  return form.type === "Program" ||
    isFunction(form) ||
    isCatch(form) ||
    form.type === "WithStatement"
}
exports.isScope = isScope

function isntScope(form) {
  /**
  Returns `true` if given form is a branch node, but it isn't a scope form,
  this way tree walk won't analyze nested scopes.
  **/
  return isBranch(form) && !isScope(form)
}
exports.isntScope = isntScope
