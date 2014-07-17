var renderer = exports,
    assert = require('assert'),
    spoon = require('../spoon');

function Renderer(cfg) {
  this.current = null;
  this.cfg = cfg;

  // Queue of blocks to visit
  this.queue = null;
  this.slots = null;
  this.fns = null;
  this.defaultSlots = null;

  // Track block visits to perfrom preorder traversal
  this.blockVisits = {};

  // Cache
  this.instructions = {};
};
renderer.Renderer = Renderer;
renderer.create = function create(cfg) {
  return new Renderer(cfg);
};

Renderer.prototype.addSlots = function addSlot(slots) {
  this.slots[this.current.id] = slots.map(function(slot, i) {
    assert(this.current.successors[i] !== undefined);
    return [ this.current.successors[i], slot ];
  }, this);
};

Renderer.prototype.getSlot = function getSlot() {
  var cfrontier;

  // Choose closest cfrontier
  if (this.current.cfrontier.length > 1) {
    var distances = this.current.cfrontier.map(function(block) {
      return {
        distance: this.current.distance(block),
        block: block
      };
    }, this).sort(function(a, b) {
      return a.distance - b.distance;
    });
    cfrontier = distances[0].block;
  } else {
    cfrontier = this.current.cfrontier[0];
  }

  var slots = cfrontier &&
              this.slots[cfrontier.id];
  if (!slots) return this.defaultSlots[0];

  // One branch - one slot
  if (slots.length === 1) return slots[0][1];

  // Choose closest branch
  if (this.current.distance(slots[0][0]) < this.current.distance(slots[1][0])) {
    return slots[0][1];
  } else {
    return slots[1][1];
  }
};

Renderer.prototype.canVisit = function canVisit(block, update) {
  var r;

  if (update !== false) {
    if (!this.blockVisits[block.id]) {
      r = this.blockVisits[block.id] = 1;
    } else {
      r = ++this.blockVisits[block.id];
    }
  } else {
    r = this.blockVisits[block.id] || 0;
  }

  return block.loop ?
      r == (update === false ? 0 : 1)
      :
      r >= block.predecessors.length;
};

Renderer.prototype.render = function render() {
  var result = {
    type: 'Program',
    body: []
  };

  this.cfg.derive();

  this.queue = [ this.cfg.root ];
  this.slots = {};
  this.fns = {};
  this.defaultSlots = [ null, result.body ];

  while (this.queue.length > 0) {
    var current = this.queue.pop();
    this.current = current;
    if (this.current.predecessors.length === 0) {
      this.defaultSlots.shift();
    }

    var slot = this.getSlot();

    // Visit only if all parents were processed
    if (!this.canVisit(current)) continue;

    this.renderBlock(current).forEach(function(instr) {
      if (!/(Declaration|Statement)$/.test(instr.type)) {
        instr = {
          type: 'ExpressionStatement',
          expression: instr
        };
      }
      slot.push(instr);
    });

    // Enqueue blocks with priority to left one
    current.successors.slice().reverse().forEach(function(block) {
      this.queue.push(block);
    }, this);
  }

  return result;
};

Renderer.prototype.renderBlock = function renderBlock(block) {
  var ast = [];

  // Visit instructions in reverse order to detect dependencies
  block.instructions.slice().reverse().forEach(function(instr) {
    // If instruction was already rendered - skip it
    if (this.instructions[instr.id]) return;

    this.currentInstruction = instr;

    var instr = this.renderInstruction(instr);
    if (instr) ast.push(instr);
  }, this);

  ast.reverse();

  return ast;
};

Renderer.prototype.renderInstruction = function renderInstruction(instr) {
  var name = { type: 'Identifier', name: '__$i' + instr.id };
  if (this.current !== instr.block) return name;

  // If instruction has external uses - generate it separately and put it's
  // result to the variable
  var external = instr.isExternal ||
                 instr.uses.length > 1 ||
                 instr.uses.length === 1 &&
                 instr.uses[0].block !== this.current;

  if (external && this.currentInstruction !== instr) return name;

  var args = instr.args.map(function(arg) {
    if (arg instanceof spoon.instruction.Instruction) {
      return this.renderInstruction(arg);
    }
    return arg;
  }, this);

  var t = instr.type,
      fn;

  if (t === 'literal') {
    fn = this.renderLiteral;
  } else if (t === 'get') {
    fn = this.renderGet;
  } else if (t === 'set') {
    fn = this.renderSet;
  } else if (t === 'setprop') {
    fn = this.renderSetprop;
  } else if (t === 'var') {
    fn = this.renderVar;
  } else if (t === 'binop') {
    fn = this.renderBinop;
  } else if (t === 'unop') {
    fn = this.renderUnop;
  } else if (t === 'update') {
    fn = this.renderUpdate;
  } else if (t === 'return') {
    fn = this.renderReturn;
  } else if (t === 'fn') {
    fn = this.renderFn;
  } else if (t === 'goto') {
    fn = this.renderGoto;
  } else if (t === 'call') {
    fn = this.renderCall;
  } else if (t === 'method') {
    fn = this.renderMethod;
  } else if (t === 'getprop') {
    fn = this.renderGetprop;
  } else if (t === 'getprops') {
    fn = this.renderGetprops;
  } else if (t === 'if') {
    fn = this.renderIf;
  } else if (t === 'logical') {
    fn = this.renderIf;
  } else if (t === 'loop') {
    fn = this.renderLoop;
  } else if (t === 'break') {
    fn = this.renderBreak;
  } else if (t === 'sbreak') {
    fn = this.renderSBreak;
  } else if (t === 'continue') {
    fn = this.renderContinue;
  } else if (t === 'phi') {
    fn = this.renderPhi;
  } else if (t === 'phimove') {
    fn = this.renderPhiMove;
  } else if (t === 'ternary') {
    fn = this.renderIf;
  } else if (t === 'object') {
    fn = this.renderObject;
  } else if (t === 'array') {
    fn = this.renderArray;
  } else if (t === 'try') {
    fn = this.renderTry;
  } else if (t === 'throw') {
    fn = this.renderThrow;
  } else if (t === 'new') {
    fn = this.renderNew;
  } else if (t === 'async-goto') {
    fn = this.renderAsyncGoto;
  } else if (t === 'async-return') {
    fn = this.renderAsyncReturn;
  } else if (t === 'async-end') {
    fn = this.renderAsyncEnd;
  } else if (t === 'async-prelude') {
    fn = this.renderAsyncPrelude;
  } else if (t === 'nop') {
    fn = this.renderNop;
  } else {
    throw new Error('Unexpected instruction: ' + t);
  }

  var ast = fn.call(this, args, instr);
  if (external) {
    if (!instr.fn || instr.fn.id === 0) {
      ast = {
        type: 'VariableDeclaration',
        kind: 'var',
        declarations: [{
          type: 'VariableDeclarator',
          id: name,
          init: ast
        }]
      };
    } else {
      if (ast !== null) {
        // Wrap instructions with external use into variable declaration.
        // Insert declaration on the level accessible for both instruction
        // and it's every use.
        ast = {
          type: 'AssignmentExpression',
          operator: '=',
          left: name,
          right: ast
        };
      }

      var decl = {
        type: 'VariableDeclaration',
        kind: 'var',
        declarations: [{
          type: 'VariableDeclarator',
          id: name,
          init: null
        }]
      };
      this.fns[instr.fn.id].unshift(decl);
    }
  }
  this.instructions[instr.id] = ast;

  return ast;
};

Renderer.prototype.renderLiteral = function renderLiteral(args) {
  return { type: 'Literal', value: args[0] };
};

Renderer.prototype.renderGet = function renderGet(args) {
  if (args[0] === 'this') return { type: 'ThisExpression' };
  return { type: 'Identifier', name: args[0] };
};

Renderer.prototype.renderSet = function renderSet(args) {
  return {
    type: 'AssignmentExpression',
    operator: args[0],
    left: { type: 'Identifier', name: args[1] },
    right: args[2]
  };
};

Renderer.prototype.renderSetprop = function renderSetprop(args) {
  return {
    type: 'AssignmentExpression',
    operator: args[0],
    left: this.renderGetprop(args.slice(1, 3)),
    right: args[3]
  };
};

Renderer.prototype.renderVar = function renderVar(args) {
  if (args.length === 0) return null;

  return {
    type: 'VariableDeclaration',
    kind: 'var',
    declarations: args.map(function(name) {
      return {
        type: 'VariableDeclarator',
        id: { type: 'Identifier', name: name },
        init: null
      };
    })
  };
};

Renderer.prototype.renderBinop = function renderBinop(args) {
  return {
    type: 'BinaryExpression',
    operator: args[0],
    left: args[1],
    right: args[2]
  };
};

Renderer.prototype.renderUnop = function renderUnop(args) {
  return {
    type: 'UnaryExpression',
    operator: args[0],
    argument: args[1]
  };
};

Renderer.prototype.renderUpdate = function renderUpdate(args) {
  return {
    type: 'UpdateExpression',
    operator: args[0],
    prefix: args[1],
    argument: args[2]
  };
};

Renderer.prototype.renderReturn = function renderReturn(args) {
  return {
    type: 'ReturnStatement',
    argument: args[0]
  };
};

Renderer.prototype.renderFn = function renderFn(args, instr) {
  var slot = [];

  var inputs = instr.params.slice();

  this.queue.unshift(args[0]);
  this.defaultSlots.push(slot);
  this.fns[instr.args[0].id] = slot;

  return {
    type: instr.isExpression ? 'FunctionExpression' : 'FunctionDeclaration',
    id: instr.name === null ? null : { type: 'Identifier', name: instr.name },
    params: inputs.map(function(input) {
      return { type: 'Identifier', name: input };
    }),
    defaults: [],
    rest: null,
    body: { type: 'BlockStatement', body: slot },
    generator: false,
    expression: false
  };
};

Renderer.prototype.renderGoto = function renderGoto() {
  return null;
};

Renderer.prototype.renderCall = function renderCall(args) {
  return {
    type: 'CallExpression',
    callee: args[0],
    'arguments': args.slice(1)
  };
};

Renderer.prototype.renderMethod = function renderMethod(args) {
  return {
    type: 'CallExpression',
    callee: this.renderGetprop(args.slice(0, 2)),
    'arguments': args.slice(2)
  };
};

var reserved = [
  'break', 'case', 'catch', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'finally', 'for', 'function', 'function', 'if',
  'in', 'instanceof', 'new', 'return', 'switch', 'this', 'throw', 'try',
  'typeof', 'var', 'void', 'while', 'with', 'class', 'enum', 'export',
  'extends', 'import', 'super', 'implements', 'interface', 'let',
  'package', 'private', 'protected', 'public', 'static', 'yield', 'null',
  'true', 'false', 'undefined'
];
reserved = new RegExp('^(' + reserved.join('|') + ')$');

Renderer.prototype.renderGetprop = function renderGetprop(args) {
  if (args[1][0] === 'string' && /^[$_a-z][$_a-z0-9]*$/i.test(args[1][1]) &&
      !reserved.test(args[1][1])) {
    return {
      type: 'MemberExpression',
      computed: false,
      object: args[0],
      property: { type: 'Identifier', name: args[1][1] }
    };
  }
  return {
    type: 'MemberExpression',
    computed: true,
    object: args[0],
    property: args[1]
  };
};

Renderer.prototype.renderGetprops = function renderGetprops(args) {
  var type = {
        type: 'UnaryExpression',
        operator: 'typeof',
        argument: args[0]
      },
      isObject = {
        type: 'BinaryExpression',
        operator: '&&',
        left: {
          type: 'BinaryExpression',
          operator: '===',
          left: type,
          right: { type: 'Literal', value: 'object' }
        },
        right: {
          type: 'BinaryExpression',
          operator: '!==',
          left: args[0],
          right: { type: 'Literal', value: null }
        }
      };

  return {
    type: 'ConditionalExpression',
    test: isObject,
    consequent: {
      type: 'CallExpression',
      callee: {
        type: 'MemberExpression',
        computed: false,
        object: { type: 'Identifier', name: 'Object' },
        property: { type: 'Identifier', name: 'keys' }
      },
      arguments: [ args[0] ],
    },
    alternate: { type: 'ArrayExpression', elements: [] }
  };
};

Renderer.prototype.renderIf = function renderIf(args) {
  var slots = [ [], [] ];

  this.addSlots(slots);

  return {
    type: 'IfStatement',
    test: args[0],
    consequent: { type: 'BlockStatement', body: slots[0] },
    alternate: { type: 'BlockStatement', body: slots[1] }
  };
};

Renderer.prototype.renderLoop = function renderLoop(args) {
  var slot = [];
  this.addSlots([ slot, this.getSlot() ]);
  return {
    type: 'WhileStatement',
    test: args[0] ? args[0] : { type: 'Literal', value: true },
    body: { type: 'BlockStatement', body: slot }
  };
};

Renderer.prototype.renderBreak = function renderBreak(args) {
  return {
    type: 'BreakStatement',
    label: null
  };
};

Renderer.prototype.renderSBreak = function renderSBreak(args) {
  return null;
};

Renderer.prototype.renderContinue = function renderContinue(args) {
  return {
    type: 'ContinueStatement',
    label: null
  };
};

Renderer.prototype.renderPhi = function renderPhi() {
  return null;
};

Renderer.prototype.renderPhiMove = function renderPhiMove(args) {
  return {
    type: 'AssignmentExpression',
    operator: '=',
    left: args[1],
    right: args[0]
  };
};

Renderer.prototype.renderObject = function renderObject(args) {
  var kvs = [];

  for (var i = 0; i < args.length; i += 2) {
    kvs.push({
      type: 'Property',
      key: { type: 'Literal', value: args[i] },
      value: args[i + 1],
      kind: 'init'
    });
  }

  return {
    type: 'ObjectExpression',
    properties: kvs
  };
};

Renderer.prototype.renderArray = function renderArray(args) {
  return {
    type: 'ArrayExpression',
    elements: args
  };
};

Renderer.prototype.renderTry = function renderTry(args, instr) {
  var body = [],
      caught = [];

  this.addSlots([body, caught]);

  // XXX: This is very limited AST form
  return {
    type: 'TryStatement',
    guardedHandlers: [],
    block: { type: 'BlockStatement', body: body },
    handlers: [{
      type: 'CatchClause',
      param: { type: 'Identifier', name: instr.catchParam },
      body: { type: 'BlockStatement', body: caught }
    }],
    finalizer: null
  };
};

Renderer.prototype.renderThrow = function renderThrow(args) {
  return { type: 'ThrowStatement', argument: args[0] };
};

Renderer.prototype.renderNew = function renderNew(args) {
  return { type: 'NewExpression', callee: args[0], arguments: args.slice(1) };
};

Renderer.prototype.renderAsyncReturn = function renderAsyncReturn(args) {
  return {
    type: 'ReturnStatement',
    argument: {
      type: 'CallExpression',
      callee: {
        type: 'MemberExpression',
        computed: false,
        object: { type: 'Identifier', name: '__$callback' },
        property: { type: 'Identifier', name: 'call' }
      },
      arguments: [
        { type: 'ThisExpression' },
        { type: 'Literal', value: null }
      ].concat(args)
    }
  };
};

Renderer.prototype.renderAsyncEnd = function renderAsyncEnd(args) {
  return {
    type: 'ReturnStatement',
    argument: args[0]
  };
};

Renderer.prototype.renderAsyncGoto = function renderAsyncGoto(args) {
  return {
    type: 'ReturnStatement',
    argument: {
      type: 'CallExpression',
      callee: {
        type: 'MemberExpression',
        computed: false,
        object: args[0],
        property: { type: 'Identifier', name: 'call' }
      },
      arguments: [
        { type: 'ThisExpression' }
      ]
    }
  };
};

Renderer.prototype.renderAsyncPrelude = function renderAsyncPrelude(args) {
  return {
    type: 'IfStatement',
    test: { type: 'Identifier', name: '__$e' },
    consequent: {
      type: 'BlockStatement',
      body: [{
        type: 'ReturnStatement',
        argument: {
          type: 'CallExpression',
          callee: {
            type: 'MemberExpression',
            computed: false,
            object: { type: 'Identifier', name: '__$callback' },
            property: { type: 'Identifier', name: 'call' }
          },
          arguments: [
            { type: 'ThisExpression' },
            { type: 'Identifier', name: '__$e' },
            { type: 'Identifier', name: '__$r' }
          ]
        }
      }]
    },
    alternate: {
      type: 'BlockStatement',
      body: [{
        type: 'ExpressionStatement',
        expression: {
          type: 'AssignmentExpression',
          operator: '=',
          left: { type: 'Identifier', name: args[0] },
          right: { type: 'Identifier', name: '__$r' }
        }
      }]
    }
  };
};

Renderer.prototype.renderNop = function renderNop() {
  return null;
};
