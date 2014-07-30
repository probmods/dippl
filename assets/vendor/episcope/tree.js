"use strict";

function concat(left, right) {
  return [].concat(left, right)
}

function expand(array, f) {
  return array.map(f).reduce(concat, [])
}

function tree(form, isBranch, nodes) {
  function traversable(node) { return tree(node, isBranch, nodes) }
  var children = isBranch(form) ? expand(nodes(form), traversable) : []
  return [form].concat(children)
}

module.exports = tree