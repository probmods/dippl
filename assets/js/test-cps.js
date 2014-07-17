var estraverse = require("assets/vendor/estraverse/estraverse.js");
var escodegen = require("assets/vendor/escodegen/escodegen.js");
var esprima = require("assets/vendor/esprima/esprima.js");
var spoon = require("assets/vendor/spoon/lib/spoon.js");

function main(__$callback) {
    function async(callback) {
        callback(null, 1);
    }
    "enable spoon";
    return 1 + async();
}

var code = spoon(main.toString(), ['async'], {
    declaration: 'enable spoon'
});

console.log(code);
eval(code);

function toplevelCont(err, value) {
    console.log("done!");
    console.log(value);
}

main(toplevelCont);
