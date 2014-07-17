var cfg = exports,
    assert = require('assert'),
    spoon = require('../spoon');

function Cfg() {
  this.instructionId = 0;
  this.blockId = 0;

  this.root = null;
  this.exits = null;
  this.blocks = [];
  this.roots = [];
  this.rootQueue = [];
  this.current = null;
  this.currentRoot = null;
  this.asyncifyState = null;

  this.breakInfo = null;
};
cfg.Cfg = Cfg;
cfg.create = function create() {
  return new Cfg();
};

Cfg.prototype.toString = function toString(format) {
  if (format === 'graphviz') {
    return 'digraph {\n' +
           this.blocks.map(function(block) {
             return block.id + ';\n' +
                    block.successors.map(function(succ) {
                      return block.id + ' -> ' + succ.id;
                    }).join(';\n');
           }).join(';\n') + ';' +
          '\n}';
  }

  var buff = '--- CFG ---\n';

  this.blocks.forEach(function(block) {
    buff += block.toString() + '\n';
  });

  return buff;
};

Cfg.prototype.createBlock = function createBlock() {
  var block = spoon.block.create(this);

  this.blocks.push(block);

  return block;
};

Cfg.prototype.setCurrentBlock = function setCurrentBlock(block) {
  this.current = block;
};

Cfg.prototype.add = function add(type, args) {
  return this.current.add(type, args);
};

Cfg.prototype.goto = function branch(target) {
  return this.current.goto(target);
}

Cfg.prototype.branch = function branch(type, args, tblock, fblock) {
  return this.current.branch(type, args, tblock, fblock);
};

Cfg.prototype.translate = function translate(ast) {
  this.rootQueue.push({
    instr: null,
    parent: null,
    ast: ast
  });

  while (this.rootQueue.length > 0) {
    var root = this.rootQueue.shift(),
        block = this.createBlock();

    if (!this.root) {
      this.root = block;
    }
    this.currentRoot = block;
    block.fn = block;
    this.exits = block.exits = [];

    this.roots.push(block);
    this.setCurrentBlock(block);
    if (root.instr) root.instr.addArg(block);
    block.root = root;

    this.visit(root.ast);

    if (this.exits.indexOf(this.current) === -1) {
      this.exits.push(this.current);
      this.current.end();
    }
  }
};

Cfg.prototype.split = function split(at, root, asyncify, marker) {
  var block = at.block;

  // Do not split same blocks twice
  if (this.asyncifyState[block.id]) return this.asyncifyState[block.id];

  var info = block.split(at, root, asyncify, marker);
  this.asyncifyState[block.id] = info;

  this.roots.push(info.next);
  this.blocks.push(info.next);
  info.next.exits = this.getNodes(info.next).filter(function(node) {
    return node.successors.length === 0;
  });

  // Traverse blocks starting from next, split on every frontier
  info.next.frontier.forEach(function(block) {
    var info = this.split(block.instructions[0], root, false, marker);

    block.predecessors.forEach(function(pred) {
      if (pred.successors.length < 2) {
        pred.successors = [];

        // Remove goto
        var last = pred.instructions.pop();

        pred.ended = false;
      } else {
        // Replace one of the branches
        var index = pred.successors[0] === block ? 0 : 1,
            tmp = this.createBlock();

        pred.successors[index] = tmp;
        tmp.addPredecessor(pred);
        pred = tmp;
      }

      pred.add('async-goto', [ pred.add('get', [ info.fn.name ]) ]);
      pred.end();
    }, this);
    block.predecessors = [];
  }, this);

  return info;
};

Cfg.prototype.asyncify = function asyncify(asts, options) {
  this.asyncifyState = {};

  this.derive();

  var targets = asts.map(function(ast) {
    assert.equal(ast.type, 'Program');
    assert.equal(ast.body.length, 1);
    assert.equal(ast.body[0].type, 'ExpressionStatement');
    return ast.body[0].expression;
  });

  function markerIndex(instr, marker) {
    if (!marker) return -1;
    var args;
    if (instr.type === 'call') {
      args = instr.args.slice(1);
    } else if (instr.type === 'method') {
      args = instr.args.slice(2);
    }
    if (!args) return -1;
    var found = -1;
    args.forEach(function(arg, i) {
      if (arg.type === 'get' && arg.args[0] === marker) {
        found = args.length - i;
      }
    });
    return found;
  }

  // Test whether instr matches 'fn' or not
  function match(instr) {
    return targets.some(function(target) {
      if (target.type === 'Identifier') {
        if (instr.type !== 'call') return false;
        var name = instr.args[0];
        if (name.type !== 'get' || name.args[0] !== target.name) return false;
      } else if (target.type === 'MemberExpression') {
        if (instr.type !== 'method') return false;
        var obj = instr.args[0],
            prop = instr.args[1],
            targetName = target.object.type === 'Identifier' ?
                target.object.name :
                target.object.type === 'ThisExpression' ?
                    'this' : null;

        if (obj.type !== 'get' || obj.args[0] !== targetName ||
            prop.type !== 'literal' || prop.args[0] !== target.property.name) {
          return false;
        }
      } else {
        throw new TypeError('Unexpected target type:' + target.type);
      }

      return true;
    });
  }

  // Replace async instruction in all blocks that either have
  // "enable spoon" declaration or are children of blocks with declaration.
  var hasDeclaration = {},
      visited = {},
      queue = this.roots.slice(),
      rootBlocks = this.blocks.length;

  while (queue.length > 0) {
    var block = queue.shift();
    if (visited[block.id]) continue;
    visited[block.id] = true;

    if (!hasDeclaration[block.id]) {
      // Find declaration first
      var found = block.instructions.some(function(instr) {
        // No declaration? - All blocks counts
        if (options.declaration) {
          if (instr.type !== 'literal' ||
              instr.args[0] !== options.declaration ||
              instr.uses.length > 0) {
            return false;
          }

          // Remove literals
          instr.remove();
        }
        if (options.marker && block.fn.root.instr) {
          var marker = block.fn.root.instr.params.indexOf(options.marker);
          if (marker < 0) return false;
          block.fn.root.instr.params[marker] = '__$callback';
        }

        hasDeclaration[block.id] = block;
        return true;
      });

      // Skip block if it hasn't one
      if (!found) continue;
    }

    block.successors.forEach(function(succ) {
      // Visit some blocks twice if needed
      if (!hasDeclaration[succ.id]) visited[succ.id] = false;

      // All children should be processed too
      hasDeclaration[succ.id] = succ;
      queue.push(succ);
    });
  }

  for (var i = 0; i < this.blocks.length; i++) {
    var block = this.blocks[i];
    if (i >= rootBlocks) {
      // Extra blocks should be counted as async blocks
      hasDeclaration[block.id] = block;
    } else if (!hasDeclaration[block.id]) {
      continue;
    }

    block.instructions.forEach(function(instr) {
      var marker = markerIndex(instr, options.marker);
      if (marker < 0 && !match(instr)) return;

      // Split graph at instruction
      var info = this.split(instr, instr.block.getRoot(), true, marker);

      // Replace all instruction uses by __$r[num]
      instr.uses.forEach(function(use, i) {
        if (i === instr.uses.length - 1) return;
        use.args = use.args.map(function(arg) {
          if (arg !== instr) return arg;

          var r = spoon.instruction.create(use.block, 'get', [ info.res ]),
              index = use.block.instructions.indexOf(use);

          use.block.instructions = [].concat(
            use.block.instructions.slice(0, index),
            [ r ],
            use.block.instructions.slice(index)
          );

          return r;
        });
      });
      instr.uses = [];
    }, this);
  }

  // Every exit should invoke callback
  var seeds = Object.keys(hasDeclaration).map(function(id) {
    return hasDeclaration[id];
  });

  // Replace all synchronous exits in block with asynchronous ones
  function replaceExits(block) {
    if (block.successors.length !== 0) return;

    var last = block.instructions[block.instructions.length - 1],
        args;

    if (last) {
      if (last && (last.type === 'async-return' ||
          last.type === 'async-goto' ||
          last.type === 'async-end' ||
          last.type === 'throw' ||
          last.type === 'fn' && /^__\$fn/.test(last.name))) {
        return;
      }

      if (last.type === 'return') {
        block.instructions.splice(block.instructions.indexOf(last), 1);
        args = last.args.slice();
        args.forEach(function(arg) {
          arg.uses.splice(arg.uses.indexOf(last), 1);
        });
      }
    } else {
      args = [];
    }

    block.ended = false;
    block.add('async-return', args);
    block.end();
  };

  seeds.forEach(function(seed) {
    replaceExits(seed);
  }, this);

  this.derive();
};

Cfg.prototype.derive = function derive() {
  // For each root derive control dependencies
  this.roots.forEach(function(root) {
    var leafs = this.deriveDominator(root);
    this.deriveFrontier(leafs.normal);
    this.deriveCFrontier(leafs.control);
  }, this);
};

Cfg.prototype.getNodes = function getNodes(root) {
  var nodes = [],
      visited = {},
      queue = [root];

  // Get list of all nodes first
  while (queue.length > 0) {
    var node = queue.pop();
    if (visited[node.id]) continue;
    visited[node.id] = true;
    nodes.push(node);

    node.successors.forEach(function(succ) {
      queue.push(succ);
    });
  }

  return nodes;
};

// Derive control and normal dominanator tree
Cfg.prototype.deriveDominator = function deriveDominator(root) {
  var nodes = this.getNodes(root);

  // At start each node (except exits) will think it has all nodes as children
  nodes.forEach(function(node) {
    node.parent = null;
    node.parents = nodes.slice();
    node.children = [];
    node.frontier = [];

    node.cparent = null;
    node.cparents = nodes.slice();
    node.cchildren = [];
    node.cfrontier = [];
  });

  // But exits do not have parents
  root.exits.forEach(function(node) {
    node.cparents = [ node ];
  });

  // And root too
  root.parents = [ root ];

  // Propagate set intersection until there will be no changes
  var changed;
  do {
    changed = false;

    nodes.forEach(function(node) {
      var parents = [ node ],
          cparents = [ node ],
          seen = {},
          cseen = {};

      // For normal
      node.predecessors.forEach(function(pred) {
        pred.parents.forEach(function(parent) {
          seen[parent.id] = (seen[parent.id] || 0) + 1;
          if (seen[parent.id] === node.predecessors.length && parent !== node) {
            parents.push(parent);
          }
        });
      });

      // For contorl
      node.successors.forEach(function(succ) {
        succ.cparents.forEach(function(parent) {
          cseen[parent.id] = (cseen[parent.id] || 0) + 1;
          if (cseen[parent.id] === node.successors.length && parent !== node) {
            cparents.push(parent);
          }
        });
      });

      if (node.parents.length !== parents.length ||
          node.cparents.length !== cparents.length) {
        changed = true;
        node.parents = parents;
        node.cparents = cparents;
      }
    });
  } while (changed);

  // Leave only closest on the route from exit to node (immediate) parents
  nodes.forEach(function(node) {
    // For normal
    var closest = node.parents.filter(function(parent) {
      return parent !== node;
    }).map(function(parent) {
      return {
        parent: parent,
        distance: node.distance(parent)
      };
    }).sort(function(a, b) {
      return a.distance - b.distance;
    })[0];

    if (closest) {
      node.parent = closest.parent;
      if (node.parent.children.indexOf(node) === -1) {
        node.parent.children.push(node);
      }
    } else {
      node.parent = null;
    }

    // For control
    var closest = node.cparents.filter(function(parent) {
      return parent !== node;
    }).map(function(parent) {
      return {
        parent: parent,
        distance: parent.distance(node)
      };
    }).sort(function(a, b) {
      return a.distance - b.distance;
    })[0];

    if (closest) {
      node.cparent = closest.parent;
      if (node.cparent.cchildren.indexOf(node) === -1) {
        node.cparent.cchildren.push(node);
      }
    } else {
      node.cparent = null;
    }
  });

  // Return "leafs" (needed for bottom-up traversal later)
  return {
    normal: nodes.filter(function(node) {
      return node.children.length === 0;
    }),
    control: nodes.filter(function(node) {
      return node.cchildren.length === 0;
    })
  };
};

// Derive dominance frontier of reverse CFG
Cfg.prototype.deriveFrontier = function deriveFrontier(leafs) {
  var df = {},
      visited = {},
      queue = leafs.slice();

  // Bottom-up traversal of reverse dominator tree
  while (queue.length > 0) {
    var node = queue.shift();

    // Skip already visited nodes
    if (visited[node.id]) continue;

    // Every child should be visited before this node
    var reachable = node.children.every(function(child) {
      return visited[child.id];
    });
    if (!reachable) continue;

    visited[node.id] = true;

    if (!df[node.id]) df[node.id] = { node: node, map: {} };
    var r = df[node.id].map;

    // Local
    node.successors.forEach(function(succ) {
      if (succ.parent === node) return;
      r[succ.id] = succ;
    });

    // Up
    node.children.forEach(function(child) {
      if (!df[child.id]) df[child.id] = { node: child, map: {} };
      var cr = df[child.id].map;

      Object.keys(cr).forEach(function(id) {
        if (cr[id].parent === node) return;
        r[id] = cr[id];
      });
    });

    // Now visit parent
    if (node.parent) queue.push(node.parent);
  }

  Object.keys(df).forEach(function(id) {
    // Set sorted by distance frontier
    df[id].node.frontier = Object.keys(df[id].map).map(function(sid) {
      return this.map[sid];
    }, df[id]);
  });
};

// Derive dominance frontier of reverse CFG
Cfg.prototype.deriveCFrontier = function deriveCFrontier(leafs) {
  var rdf = {},
      visited = {},
      queue = leafs.slice();

  // Bottom-up traversal of reverse dominator tree
  while (queue.length > 0) {
    var node = queue.shift();

    // Skip already visited nodes
    if (visited[node.id]) continue;

    // Every child should be visited before this node
    var reachable = node.cchildren.every(function(child) {
      return visited[child.id];
    });
    if (!reachable) continue;

    visited[node.id] = true;

    if (!rdf[node.id]) rdf[node.id] = { node: node, map: {} };
    var r = rdf[node.id].map;

    // Local
    node.predecessors.forEach(function(pred) {
      if (pred.cparent === node) return;
      r[pred.id] = pred;
    });

    // Up
    node.cchildren.forEach(function(child) {
      if (!rdf[child.id]) rdf[child.id] = { node: child, map: {} };
      var cr = rdf[child.id].map;

      Object.keys(cr).forEach(function(id) {
        if (cr[id].cparent === node) return;
        if (cr[id].id === node.id) return;
        r[id] = cr[id];
      });
    });

    // Now visit parent
    if (node.cparent) queue.push(node.cparent);
  }

  Object.keys(rdf).forEach(function(id) {
    // Set sorted by distance frontier
    rdf[id].node.cfrontier = Object.keys(rdf[id].map).map(function(sid) {
      return rdf[id].map[sid];
    });
  });
};

Cfg.prototype.visit = function visit(ast) {
  var t = ast.type;

  if (t === 'Program' || t === 'BlockStatement') {
    return this.visitBlock(ast);
  } else if (t === 'ExpressionStatement') {
    return this.visitExpr(ast);
  } else if (t === 'CallExpression') {
    return this.visitCall(ast);
  } else if (t === 'VariableDeclaration') {
    return this.visitVar(ast);
  } else if (t === 'AssignmentExpression') {
    return this.visitAssign(ast);
  } else if (t === 'BinaryExpression') {
    return this.visitBinop(ast);
  } else if (t === 'LogicalExpression') {
    return this.visitLogical(ast);
  } else if (t === 'UnaryExpression') {
    return this.visitUnop(ast);
  } else if (t === 'UpdateExpression') {
    return this.visitUpdate(ast);
  } else if (t === 'Literal') {
    return this.visitLiteral(ast);
  } else if (t === 'Identifier') {
    return this.visitIdentifier(ast);
  } else if (t === 'MemberExpression') {
    return this.visitMember(ast);
  } else if (t === 'IfStatement') {
    return this.visitIf(ast);
  } else if (t === 'FunctionExpression') {
    return this.visitFunction(ast, true);
  } else if (t === 'FunctionDeclaration') {
    return this.visitFunction(ast, false);
  } else if (t === 'ReturnStatement') {
    return this.visitReturn(ast);
  } else if (t === 'WhileStatement') {
    return this.visitWhile(ast);
  } else if (t === 'DoWhileStatement') {
    return this.visitDoWhile(ast);
  } else if (t === 'ForStatement') {
    return this.visitFor(ast);
  } else if (t === 'ForInStatement') {
    return this.visitForIn(ast);
  } else if (t === 'BreakStatement') {
    return this.visitBreak(ast);
  } else if (t === 'ContinueStatement') {
    return this.visitContinue(ast);
  } else if (t === 'ConditionalExpression') {
    return this.visitConditional(ast);
  } else if (t === 'SequenceExpression') {
    return this.visitSequence(ast);
  } else if (t === 'ObjectExpression') {
    return this.visitObject(ast);
  } else if (t === 'ArrayExpression') {
    return this.visitArray(ast);
  } else if (t === 'ThisExpression') {
    return this.visitThis(ast);
  } else if (t === 'TryStatement') {
    return this.visitTry(ast);
  } else if (t === 'ThrowStatement') {
    return this.visitThrow(ast);
  } else if (t === 'NewExpression') {
    return this.visitNew(ast);
  } else if (t === 'SwitchStatement') {
    return this.visitSwitch(ast);
  } else if (t === 'EmptyStatement') {
    return null;
  } else {
    throw new Error('Type: ' + t + ' is not supported yet!');
  }
};

Cfg.prototype.visitBlock = function visitBlock(ast) {
  // Visit each statement
  ast.body.forEach(function(instr) {
    this.visit(instr);
  }, this);

  return null;
};

Cfg.prototype.visitExpr = function visitExpr(ast) {
  return this.visit(ast.expression);
};

Cfg.prototype.visitCall = function visitCall(ast) {
  if (ast.callee.type === 'MemberExpression') {
    return this.add('method', [
      this.visit(ast.callee.object),
      this.visit(ast.callee.computed ?
                    ast.callee.property :
                    { type: 'Literal', value: ast.callee.property.name })
    ].concat(ast.arguments.map(function(arg) {
      return this.visit(arg);
    }, this)));
  } else {
    return this.add('call', [
      this.visit(ast.callee)
    ].concat(ast.arguments.map(function(arg) {
      return this.visit(arg);
    }, this)));
  }
};

Cfg.prototype.visitVar = function visitVar(ast) {
  // Add var declaration to the root block (i.e. function start)
  this.currentRoot.prepend('var', ast.declarations.map(function(ast) {
    return ast.id.name;
  }, this));

  // Put values into them
  ast.declarations.forEach(function(ast) {
    if (!ast.init) return;

    this.visit({
      type: 'AssignmentExpression',
      operator: '=',
      left: ast.id,
      right: ast.init
    });
  }, this);

  return null;
};

Cfg.prototype.visitAssign = function visitAssign(ast) {
  if (ast.left.type === 'Identifier') {
    return this.add('set', [ast.operator,
                            ast.left.name,
                            this.visit(ast.right)]);
  } else if (ast.left.type === 'MemberExpression') {
    return this.add('setprop', [ast.operator,
                                this.visit(ast.left.object),
                                ast.left.computed ?
                                    this.visit(ast.left.property)
                                    :
                                    this.visitLiteral({
                                      value: ast.left.property.name
                                    }),
                                this.visit(ast.right)]);
  } else {
    throw new Error('Incorrect lhs of assignment');
  }
};

Cfg.prototype.visitBinop = function visitBinop(ast) {
  return this.add('binop', [ast.operator,
                            this.visit(ast.left),
                            this.visit(ast.right)]);
};

Cfg.prototype.visitLogical = function visitLogical(ast) {
  var left = this.visit(ast.left),
      right,
      tblock = this.createBlock(),
      fblock = this.createBlock(),
      join = this.createBlock(),
      move1,
      move2;

  this.branch('logical', [ left ], tblock, fblock);

  if (ast.operator === '||') {
    this.setCurrentBlock(tblock);
    move1 = this.add('phimove', [ left ]);
    this.goto(join);

    this.setCurrentBlock(fblock);
    right = this.visit(ast.right);
    move2 = this.add('phimove', [ right ]);
    this.goto(join);
  } else {
    this.setCurrentBlock(tblock);
    right = this.visit(ast.right);
    move1 = this.add('phimove', [ right ]);
    this.goto(join);

    this.setCurrentBlock(fblock);
    move2 = this.add('phimove', [ left ]);
    this.goto(join);
  }

  this.setCurrentBlock(join);
  var phi = this.add('phi');

  move1.addArg(phi);
  move2.addArg(phi);

  var afterJoin = this.createBlock();
  this.goto(afterJoin);
  this.setCurrentBlock(afterJoin);

  return phi;
};

Cfg.prototype.visitUnop = function visitUnop(ast) {
  return this.add('unop', [ast.operator, this.visit(ast.argument)]);
};

Cfg.prototype.visitUpdate = function visitUpdate(ast) {
  return this.add('update', [ast.operator,
                             ast.prefix,
                             this.visit(ast.argument)]);
};

Cfg.prototype.visitLiteral = function visitLiteral(ast) {
  return this.add('literal', [ast.value]);
};

Cfg.prototype.visitIdentifier = function visitIdentifier(ast) {
  return this.add('get', [ast.name]);
};

Cfg.prototype.visitMember = function visitMember(ast) {
  if (!ast.computed) {
    return this.add('getprop', [this.visit(ast.object),
                                this.visit({
                                  type: 'Literal',
                                  value: ast.property.name
                                })]);
  } else {
    return this.add('getprop', [this.visit(ast.object),
                                this.visit(ast.property)]);
  }
};

Cfg.prototype.visitIf = function visitIf(ast) {
  var tblock = this.createBlock(),
      fblock = ast.alternate && this.createBlock(),
      join = this.createBlock();

  this.branch('if',
              [ this.visit(ast.test) ],
              tblock,
              ast.alternate ? fblock : join);

  // True branch
  this.setCurrentBlock(tblock);
  this.visit(ast.consequent);
  this.goto(join);

  if (fblock) {
    // False branch
    this.setCurrentBlock(fblock);
    this.visit(ast.alternate);
    this.goto(join);

    var afterJoin = this.createBlock();
    join.goto(afterJoin);
    this.setCurrentBlock(afterJoin);
  } else {
    this.setCurrentBlock(join);
  }

  return null;
};

Cfg.prototype.visitFunction = function visitFunction(ast, expression) {
  var instr = this.add('fn');
  instr.ast = ast;
  instr.isExpression = expression;
  instr.name = ast.id && ast.id.name;
  instr.params = ast.params.map(function(param) {
    return param.name;
  });

  this.rootQueue.push({
    instr: instr,
    ast: ast.body,
    parent: this.currentRoot
  });

  return instr;
};

Cfg.prototype.visitReturn = function visitReturn(ast) {
  this.add('return', ast.argument ? [this.visit(ast.argument)] : []);
  this.current.end();
  this.exits.push(this.current);

  return null;
};

Cfg.prototype.visitBreak = function visitBreak(ast) {
  var block = this.createBlock();

  this.add(this.breakInfo.loop ? 'break' : 'sbreak');
  this.current.addSuccessor(block);
  this.current.end();

  this.breakInfo.breakBlocks.push(block);
  return null;
};

Cfg.prototype.visitContinue = function visitContinue(ast) {
  var block = this.createBlock();

  if (this.breakInfo.update) this.visit(this.breakInfo.update);
  this.add('continue');
  this.current.addSuccessor(block);
  this.current.end();

  this.breakInfo.continueBlocks.push(block);
  return null;
};

Cfg.prototype.enterLoop = function enterLoop(cb) {
  var old = this.breakInfo,
      pre = this.createBlock(),
      loop = this.createBlock(),
      start = this.createBlock(),
      end = this.createBlock();

  this.breakInfo = {
    loop: true,
    update: null,
    breakBlocks: [],
    continueBlocks: []
  };

  pre.loop = true;
  this.goto(pre);
  pre.goto(start);
  this.setCurrentBlock(start);

  var result = cb.call(this, end, loop);

  // Add continue blocks before looping block
  this.breakInfo.continueBlocks.concat(loop).reduce(function(p, b) {
    return p.goto(b);
  }, this.current);

  // Looping block goes to the start of loop
  loop.goto(pre);

  // Add break blocks after end
  var lastBrk = this.breakInfo.breakBlocks.reduce(function(p, b) {
    return p.goto(b);
  }, end);

  // Add one last block that will have only one parent
  this.setCurrentBlock(lastBrk.goto(this.createBlock()));

  // Restore
  this.breakInfo = old;

  return null;
};

Cfg.prototype.loopTestBreak = function loopTestBreak(test) {
  this.visit({
    type: 'IfStatement',
    test: {
      type: 'UnaryExpression',
      prefix: true,
      operator: '!',
      argument: test
    },
    consequent: {
      type: 'BreakStatement'
    }
  });
};

Cfg.prototype.visitWhile = function visitWhile(ast) {
  return this.enterLoop(function(end) {
    var start = this.current,
        body = this.createBlock();

    this.branch('loop', [], body, end);

    this.setCurrentBlock(body);
    this.loopTestBreak(ast.test);
    this.visit(ast.body);
  });
};

Cfg.prototype.visitDoWhile = function visitDoWhile(ast) {
  return this.enterLoop(function(end) {
    var start = this.current,
        body = this.createBlock();

    this.branch('loop', [], body, end);

    this.setCurrentBlock(body);
    this.visit(ast.body);

    var cond = this.createBlock();
    this.goto(cond);
    this.setCurrentBlock(cond);

    this.loopTestBreak(ast.test);
  });
};

Cfg.prototype.visitConditional = function visitConditional(ast) {
  var tblock = this.createBlock(),
      fblock = this.createBlock(),
      join = this.createBlock();

  this.branch('ternary',
             [this.visit(ast.test), tblock, fblock],
             tblock,
             ast.alternate ? fblock : join);

  // True branch
  this.setCurrentBlock(tblock);
  var consequent = this.visit(ast.consequent),
      move1 = this.add('phimove', [consequent]);
  this.goto(join);

  // False branch
  this.setCurrentBlock(fblock);
  var alternate = this.visit(ast.alternate),
      move2 = this.add('phimove', [alternate]);
  this.goto(join);

  this.setCurrentBlock(join);
  var phi = this.add('phi');

  move1.addArg(phi);
  move2.addArg(phi);

  var afterJoin = this.createBlock();
  this.goto(afterJoin);
  this.setCurrentBlock(afterJoin);

  return phi;
};

Cfg.prototype.visitSequence = function visitSequence(ast) {
  var result;

  ast.expressions.forEach(function(expr) {
    result = this.visit(expr);
  }, this);

  return result;
};

Cfg.prototype.visitObject = function visitObject(ast) {
  var kvs = [];

  ast.properties.forEach(function(prop) {
    kvs.push(prop.key.type === 'Literal' ? prop.key.value : prop.key.name,
             this.visit(prop.value));
  }, this);
  return this.add('object', kvs);
};

Cfg.prototype.visitArray = function visitArray(ast) {
  var elements = ast.elements.map(function(elem) {
    return this.visit(elem);
  }, this);
  return this.add('array', elements);
};

Cfg.prototype.visitThis = function visitThis(ast) {
  return this.add('get', ['this']);
};

Cfg.prototype.visitFor = function visitFor(ast) {
  if (ast.init) this.visit(ast.init);

  return this.enterLoop(function(end, loop) {
    var start = this.current,
        body = this.createBlock();

    this.breakInfo.update = ast.update;
    this.branch('loop', [], body, end);

    this.setCurrentBlock(body);
    this.loopTestBreak(ast.test);
    this.visit(ast.body);
    this.visit(ast.update);
  });
};

Cfg.prototype.visitForIn = function visitForIn(ast) {
  var left = ast.left,
      right = ast.right;

  if (left.type === 'VariableDeclaration') {
    this.visit(left);
    left = left.declarations[0].id;
  } else {
    // No declaration?! Create assignment
    this.visit({
      type: 'AssignmentExpression',
      operator: '=',
      left: left,
      right: { type: 'Identifier', name: 'undefined' }
    });
  }

  var leftName = left.name;
  left = this.visit(left);
  right = this.visit(right);
  right.isExternal = true;

  var props = this.add('getprops', [ right ]),
      iterator = '__$fi' + props.id;

  // Declare iterator
  this.currentRoot.prepend('var', [ iterator ]);
  this.add('set', [ '=', iterator, this.add('literal', [ 0 ]) ]);

  return this.enterLoop(function(end) {
    var start = this.current,
        body = this.createBlock();

    this.breakInfo.update = {
      type: 'UpdateExpression',
      operator: '++',
      prefix: false,
      argument: { type: 'Identifier', name: iterator }
    };

    var propCount = this.add('getprop', [ props, this.visit({
                                type: 'Literal',
                                value: 'length'
                              }) ]);
    var test = this.add('binop', [ '<',
                                  this.add('get', [ iterator ]),
                                  propCount ]);

    // Iterate through properties and set left according to current property
    this.branch('loop', [test], body, end);
    start.end();

    this.setCurrentBlock(body);
    this.add('set', [ '=',
                     leftName,
                     this.add('getprop', [ props,
                                           this.add('get', [ iterator ]) ]) ]);
    this.visit(ast.body);
    this.visit(this.breakInfo.update);
  });
};

Cfg.prototype.visitTry = function visitTry(ast) {
  var body = this.createBlock(),
      caught = this.createBlock(),
      join = this.createBlock();

  var instr = this.branch('try', [], body, caught);

  this.setCurrentBlock(body);
  this.visit(ast.block);
  this.goto(join);

  this.setCurrentBlock(caught);
  ast.handlers.forEach(function(handler) {
    instr.catchParam = handler.param.name;
    this.visit(handler.body);
  }, this);
  this.goto(join);

  this.setCurrentBlock(join);
  if (ast.finalizer) throw TypeError('Finally is not supported yet');

  var afterJoin = this.createBlock();
  this.goto(afterJoin);
  this.setCurrentBlock(afterJoin);

  return null;
};

Cfg.prototype.visitThrow = function visitThrow(ast) {
  this.add('throw', ast.argument ? [ this.visit(ast.argument) ] : []);
  this.current.end();
  return null;
};

Cfg.prototype.visitNew = function visitNew(ast) {
  return this.add('new', [
    this.visit(ast.callee)
  ].concat(ast.arguments.map(function(arg) {
    return this.visit(arg);
  }, this)));
};

Cfg.prototype.visitSwitch = function visitSwitch(ast) {
  throw new TypeError('Switch is not implemented yet');
  var self = this,
      disc = this.visit(ast.discriminant),
      old = this.breakInfo,
      lastBody,
      def;

  this.breakInfo = {
    loop: false,
    breakBlocks: [],
    continueBlocks: []
  };

  var lastBranch = ast.cases.reduce(function(prev, clause) {
    var body = self.createBlock(),
        next;

    if (clause.test === null) {
      // Do not create new blocks
      next = prev;
      def = body;

      var link = self.createBlock();

      // Create link block
      if (lastBody) lastBody.goto(link);
      link.goto(body);
      def = body;
    } else {
      next = self.createBlock();

      self.setCurrentBlock(prev);
      var test = self.add('binop', ['==', disc, self.visit(clause.test)]);
      prev.branch('if', [test], body, next);

      // Link body blocks together
      if (lastBody) lastBody.goto(body);
    }

    // Fill block with instructions
    self.setCurrentBlock(body);
    clause.consequent.forEach(function(ast) {
      this.visit(ast);
    }, self);

    lastBody = self.current;

    return next;
  }, this.current);

  if (def) {
    lastBranch.goto(def);
  } else {
    def = lastBranch;
  }

  var join = this.createBlock();
  def.goto(join);
  lastBody.goto(join);

  // Add break blocks after end
  var lastBrk = this.breakInfo.breakBlocks.reduce(function(p, b) {
    return p.goto(b);
  }, join);
  this.setCurrentBlock(lastBrk);

  // Restore
  this.breakInfo = old;
};
