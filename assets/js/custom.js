"use strict";

// Utils

function euclideanDistance(v1, v2){
  var i;
  var d = 0;
  for (i = 0; i < v1.length; i++) {
    d += (v1[i] - v2[i])*(v1[i] - v2[i]);
  }
  return Math.sqrt(d);
};

// Code boxes

function setupCodeBoxes(){
  // TODO: optimize this, (maybe have wpEditor.setup take a content option?)
  $("pre:not(#bibtex)").map(function(i,el) {
    var firstLine = $(el).text().split("\n")[0];
    var language = (firstLine == '// language: javascript' ? 'javascript' : 'webppl');
    wpEditor.setup(el, {language: language});    
  });
}

$(setupCodeBoxes);


// Date

function setDate(){
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth() + 1; //January is 0!
  var yyyy = today.getFullYear();
  $(".date").text(yyyy+'-'+mm+'-'+dd);
}

$(setDate);


// Bibtex

function setBibtex(){
  $('#toggle-bibtex').click(function(){$('#bibtex').toggle(); return false;});
}

$(setBibtex);
