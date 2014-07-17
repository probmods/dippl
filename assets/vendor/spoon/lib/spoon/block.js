var block = exports,
    spoon = require('../spoon');

function Block(cfg) {
  this.cfg = cfg;
  this.id = cfg.blockId++;

  // CFG
  this.successors = [];
  this.predecessors = [];

  // Dominator tree
  this.parent = null;
  this.parents = [];
  this.children = [];
  this.frontier = [];

  // Reverse Dominator tree
  this.cparent = null;
  this.cparents = [];
  this.cchildren = [];
  this.cfrontier = [];

  this.instructions = [];
  this.root = null;
  this.parentRoot = null;
  this.fn = cfg.currentRoot;
  this.loop = false;
  this.exits = null;

  this.ended = false;
};
block.Block = Block;
block.create = function create(cfg) {
  return new Block(cfg);
};

Block.prototype.toString = function toString() {
  var buff = '[block ' + this.id + '' + (this.loop ? ' loop' : '') + ']\n';

  buff += '# predecessors: ' + this.predecessors.map(function(b) {
    return b.id
  }).join(', ') + '\n';
  buff += '# parent: ' + (this.parent && this.parent.id) + '\n';
  buff += '# frontier: ' + this.frontier.map(function(b) {
    return b.id;
  }).join(', ') + '\n';
  buff += '# cfrontier: ' + this.cfrontier.map(function(b) {
    return b.id;
  }).join(', ') + '\n';

  this.instructions.forEach(function(instr) {
    buff += instr.toString() + '\n';
  });

  buff += '# successors: ' + this.successors.map(function(b) {
    return b.id;
  }).join(', ') + '\n';
  buff += '# children: ' + this.children.map(function(b) {
    return b.id;
  }).join(', ') + '\n';

  return buff;
};

Block.prototype.distance = function distance(to) {
  var queue = [],
      visited = {},
      start = { from: this, path: 0 },
      best = null;

  queue.push(start);
  while (queue.length > 0) {
    var item = queue.shift();

    // Update best value if we've found
    if (item.from === to) {
      if (!best || item.path < best.path) best = item;
      continue;
    }

    // Ignore paths of same length
    if (visited[item.from.id] && visited[item.from.id] <= item.path) {
      continue;
    }
    visited[item.from.id] = item.path;

    item.from.predecessors.forEach(function(pred) {
      queue.push({ from: pred, path: item.path + 1 });
    });
  }

  return best ? best.path : Infinity;
};

Block.prototype.split = function split(at, root, asyncify, marker) {
  var index = this.instructions.indexOf(at),
      head = this.instructions.slice(0, index),
      tail = this.instructions.slice(asyncify ? index + 1 : index);

  this.instructions = head;

  var next = new Block(this.cfg);
  next.instructions = tail;

  // Reconnect successors of block to newly created one
  this.successors.forEach(function(succ) {
    succ.predecessors.splice(succ.predecessors.indexOf(this), 1, next);
    next.successors.push(succ);
  }, this);
  this.successors = [];

  // Add function declaration to the root block
  var fn = root.prepend('fn', [ next ]),
      res = '__$r' + next.id;

  root.prepend('var', [ res ]);

  fn.name = '__$fn' + next.id;
  fn.params = ['__$e', '__$r'];
  fn.isExpression = false;
  next.prepend('async-prelude', [ res ]);

  this.ended = false;

  if (asyncify) {
    var getfn = this.add('get', [ fn.name ]);
    if (marker >= 0) {
      var removed = at.args.splice(at.args.length - marker, 1, getfn)[0],
          index = removed.block.instructions.indexOf(removed);

      if (index !== -1) {
        removed.block.instructions.splice(index, 1);
      }
    } else {
      at.args.push(getfn);
    }
    this.instructions.push(at);

    this.add('async-end', [ at ]);
  } else {
    this.add('nop');
  }
  this.end();

  next.instructions.forEach(function(instr) {
    instr.block = next;
  });

  // Copy dominance information
  next.children = this.children.slice();
  next.frontier = this.frontier.slice();
  this.children = [];
  this.frontier = [];
  next.cparents = this.cparents.slice();
  this.cparents = [];

  return {
    next: next,
    fn: fn,
    res: res
  };
};

Block.prototype.removeInstruction = function removeInstruction(instr) {
  if (instr.uses.length > 0) return false;
  var index = this.instructions.indexOf(instr);
  if (index === -1) return false;

  this.instructions.splice(index, 1);

  return true;
};

Block.prototype.prepend = function prepend(type, args) {
  var instr = spoon.instruction.create(this, type, args || []);

  this.instructions.unshift(instr);
  return instr;
};

Block.prototype.add = function add(type, args) {
  var instr = spoon.instruction.create(this, type, args || []);
  if (this.ended) return instr;

  this.instructions.push(instr);
  return instr;
};

Block.prototype.end = function end() {
  if (this.ended) return;

  if (this.instructions.length === 0) this.add('nop');
  this.ended = true;
};

Block.prototype.addSuccessor = function addSuccessor(block) {
  if (this.successors.length == 2) {
    throw new Error('Block can\'t have more than 2 successors');
  }
  this.successors.push(block);
  block.addPredecessor(this);
};

Block.prototype.addPredecessor = function addPredecessor(block) {
  if (this.predecessors.length == 2) {
    throw new Error('Block can\'t have more than 2 predecessors');
  }
  this.predecessors.push(block);
};

Block.prototype.goto = function goto(block) {
  if (this.ended) return block;

  this.add('goto');
  this.addSuccessor(block);
  this.end();

  // For chaining
  return block;
};

Block.prototype.branch = function goto(instr, args, left, right) {
  if (this.ended) return block;

  var branch = this.add(instr, args);
  this.addSuccessor(left);
  this.addSuccessor(right);
  this.end();

  return branch;
};

Block.prototype.getRoot = function getRoot() {
  var queue = [ this ],
      visited = {};

  while (queue.length > 0) {
    var node = queue.pop();
    if (visited[node.id]) continue;
    visited[node.id] = true;

    if (node.predecessors.length === 0) return node;

    node.predecessors.forEach(function(pred) {
      queue.push(pred);
    });
  }

  throw new TypeError('Wrong graph structure');
};
