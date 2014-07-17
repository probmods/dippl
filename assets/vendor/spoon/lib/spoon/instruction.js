var instruction = exports,
    spoon = require('../spoon');

function Instruction(block, type, args) {
  this.block = block;
  this.fn = block.fn;
  this.cfg = block.cfg;
  this.id = block.cfg.instructionId++;
  this.until = null;
  this.test = null;
  this.isExpression = false;

  this.type = type;
  this.args = args;
  this.uses = [];

  this.args.forEach(function(arg) {
    if (!(arg instanceof Instruction)) return;
    arg.uses.push(this);
  }, this);
};
instruction.Instruction = Instruction;
instruction.create = function create(block, type, args) {
  return new Instruction(block, type, args);
};

Instruction.prototype.toString = function toString() {
  return 'i' + this.id + ' = ' + this.type + ' ' + this.args.map(function(arg) {
    if (arg instanceof Instruction) return 'i' + arg.id;
    if (arg instanceof spoon.block.Block) return 'b' + arg.id;

    return arg;
  }).join(', ');
};

Instruction.prototype.addArg = function addArg(arg) {
  this.args.push(arg);

  if (!(arg instanceof Instruction)) return;
  arg.uses.push(this);
};

Instruction.prototype.remove = function remove() {
  return this.block.removeInstruction(this);
};
