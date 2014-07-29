var fs = require('fs');
var path = require('path');
var types = require("../vendor/ast-types/main.js");
var build = types.builders;
var esprima = require("esprima");
var escodegen = require("escodegen");
var cps = require("./cps.js");
var util = require("./util.js");

function main(){

    // Load program code
    var programFile = process.argv[2];
    console.log('Processing', programFile);
    var programAst = esprima.parse(fs.readFileSync(programFile));

    // Load SPPL header
    var spplHeaderFile = path.resolve(__dirname, "header.sppl");
    var spplHeaderAst = esprima.parse(fs.readFileSync(spplHeaderFile));

    // Concat SPPL header and program code
    programAst.body = spplHeaderAst.body.concat(programAst.body)

    // Apply CPS transform to SPPL code
    var newProgramAst = cps.cps(programAst, build.identifier("topK"));

    // Add Javascript header
    var jsHeaderFile = path.resolve(__dirname, "header.js");
    var jsHeaderAst = esprima.parse(fs.readFileSync(jsHeaderFile));
    newProgramAst.body = jsHeaderAst.body.concat(newProgramAst.body)

    // Print converted code
    var newCode = escodegen.generate(newProgramAst);
    var originalCode = escodegen.generate(programAst);
    console.log("\n* Original code:\n");
    console.log(originalCode);
    console.log("\n* CPS code:\n");
    console.log(newCode);
}

main();
