var spoon = require('./spoon/api').spoon;
module.exports = spoon;

spoon.block = require('./spoon/block');
spoon.instruction = require('./spoon/instruction');
spoon.cfg = require('./spoon/cfg');
spoon.renderer = require('./spoon/renderer');

// Export API
spoon.construct = require('./spoon/api').construct;
spoon.render = require('./spoon/api').render;
spoon.preprocess = require('./spoon/api').preprocess;
