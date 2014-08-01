var fs = require('fs');
var path = require('path');
var types = require("../vendor/ast-types/main.js");
var build = types.builders;
var esprima = require("esprima");
var escodegen = require("escodegen");
var cps = require("./cps.js");
var util = require("./util.js");

//make runtime stuff globally available:
var runtime = require("./header.js");
for (var prop in runtime)
{
    if (runtime.hasOwnProperty(prop))
    {
        global[prop] = runtime[prop]
    }
}

function main(){

    // Load program code
    var programFile = process.argv[2];
    console.log('Processing', programFile);
    var programAst = esprima.parse(fs.readFileSync(programFile));

    // Load WPPL header
    var wpplHeaderFile = path.resolve(__dirname, "header.wppl");
    var wpplHeaderAst = esprima.parse(fs.readFileSync(wpplHeaderFile));

    // Concat WPPL header and program code
    programAst.body = wpplHeaderAst.body.concat(programAst.body)

    // Apply CPS transform to WPPL code
    var newProgramAst = cps.cps(programAst, build.identifier("topK"));

//    // Add Javascript header -- [now via require]
//    var jsHeaderFile = path.resolve(__dirname, "header.js");
//    var jsHeaderAst = esprima.parse(fs.readFileSync(jsHeaderFile));
//    newProgramAst.body = jsHeaderAst.body.concat(newProgramAst.body)

    // Print converted code
    var newCode = escodegen.generate(newProgramAst);
    var originalCode = escodegen.generate(programAst);
    console.log("\n* Original code:\n");
    console.log(originalCode);
    console.log("\n* CPS code:\n");
    console.log(newCode);
    
    //Run the program
    console.log("\n* Program return value:\n")
    var topKAst = esprima.parse("var topK = function(x){display(x)};");
    newProgramAst.body = topKAst.body.concat(newProgramAst.body);
    newCode = escodegen.generate(newProgramAst);
    eval(newCode)
    
}

main();
