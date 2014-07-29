function makeGensym() {
    var seq = 0;
    return function(prefix){
        var result = prefix + seq;
        seq += 1;
        return result;
    }
}

var gensym = makeGensym();

function prettyJSON(obj) {
    console.log(JSON.stringify(obj, null, 2));
}

module.exports = {
    gensym: gensym,
    prettyJSON: prettyJSON
}
