"use strict";

var activeCodeBox;

// Utils

function euclideanDistance(v1, v2){
  var i;
  var d = 0;
  for (i = 0; i < v1.length; i++) {
    d += (v1[i] - v2[i])*(v1[i] - v2[i]);
  }
  return Math.sqrt(d);
};

function isErp(x){
  return (x && (x.score != undefined) && (x.sample != undefined));
}

function isErpWithSupport(x){
  return (isErp(x) && (x.support != undefined));
}

function jsPrint(x){
  var resultDiv = $(activeCodeBox.parent().find(".resultDiv"));
  resultDiv.show();
  if (isErpWithSupport(x)){
    var params = Array.prototype.slice.call(arguments, 2);
    var labels = x.support(params);
    var scores = _.map(labels, function(label){return x.score(params, label);});
    if (_.find(scores, isNaN) !== undefined){
      resultDiv.append(document.createTextNode("ERP with NaN scores!\n"));
      return;
    }
    var counts = scores.map(Math.exp);
    var resultDivSelector = "#" + resultDiv.attr('id');
    barChart(resultDivSelector, labels, counts);
  } else {
    resultDiv.append(
      document.createTextNode(
        (typeof x == 'string' ? x : JSON.stringify(x)) + "\n"));
  }
}

function hist(s, k, a, lst) {
  var resultDiv = $(activeCodeBox.parent().find(".resultDiv"));
  var frequencyDict = _(lst).countBy(function(x) { return x + ""});
  var labels = _(frequencyDict).keys();
  var counts = _(frequencyDict).values();

  var resultDivSelector = "#" + resultDiv.attr('id');

  return k(s, barChart(resultDivSelector, labels, counts));
}

function print(store, k, a, x){
  jsPrint(x);
  return k(store);
}


// Bar plots

function barChart(containerSelector, labels, counts){
  $(containerSelector).show();
  var svg = d3.select(containerSelector)
    .append("svg")
    .attr("class", "barChart");
  var data = [];
  for (var i=0; i<labels.length; i++){
    if (counts[i] > 0) {
      data.push({
        "Label": JSON.stringify(labels[i]),
        "Count": counts[i]
      });
    }
  };
  var chart = new dimple.chart(svg, data);
  chart.setBounds(80, 30, 480, 250);
  var xAxis = chart.addMeasureAxis("x", "Count");
  xAxis.title = null;
  xAxis.tickFormat = ",.2f";
  var yAxis = chart.addCategoryAxis("y", "Label");
  yAxis.title = null;
  chart.addSeries("Count", dimple.plot.bar);
  chart.draw();
}


// Drawing

function DrawObject(width, height, visible){
  this.canvas = $('<canvas/>', {
    "class": "drawCanvas",
    "Width": width + "px",
    "Height": height + "px"
  })[0];
  if (visible==true){
    $(this.canvas).css({"display": "inline"});
    $(activeCodeBox).parent().append(this.canvas);
  };
  this.paper = new paper.PaperScope();
  this.paper.setup(this.canvas);
  this.paper.view.viewSize = new this.paper.Size(width, height);
  this.redraw();
}

DrawObject.prototype.newPath = function(strokeWidth, opacity, color){
  var path = new this.paper.Path();
  path.strokeColor = color || 'black';
  path.strokeWidth = strokeWidth || 8;
  path.opacity = opacity || 0.6;
  return path;
};

DrawObject.prototype.newPoint = function(x, y){
  return new this.paper.Point(x, y);
};

DrawObject.prototype.circle = function(x, y, radius, stroke, fill){
  var point = this.newPoint(x, y);
  var circle = new this.paper.Path.Circle(point, radius || 50);
  circle.fillColor = fill || 'black';
  circle.strokeColor = stroke || 'black';
  this.redraw();
};

DrawObject.prototype.polygon = function(x, y, n, radius, stroke, fill){
  var point = this.newPoint(x, y);
  var polygon = new this.paper.Path.RegularPolygon(point, n, radius || 20);
  polygon.fillColor = fill || 'white';
  polygon.strokeColor = stroke || 'black';
  polygon.strokeWidth = 4;
  this.redraw();
};

DrawObject.prototype.line = function(x1, y1, x2, y2, strokeWidth, opacity, color){
  var path = this.newPath(strokeWidth, opacity, color);
  path.moveTo(x1, y1);
  path.lineTo(this.newPoint(x2, y2));
  this.redraw();
};

DrawObject.prototype.redraw = function(){
  this.paper.view.draw();
};

DrawObject.prototype.toArray = function(){
  var context = this.canvas.getContext('2d');
  var imgData = context.getImageData(0, 0, this.canvas.width, this.canvas.height);
  return imgData.data;
};

DrawObject.prototype.distanceF = function(f, cmpDrawObject){
  if (!((this.canvas.width == cmpDrawObject.canvas.width) &&
        (this.canvas.height == cmpDrawObject.canvas.height))){
    console.log(this.canvas.width, cmpDrawObject.canvas.width,
                this.canvas.height, cmpDrawObject.canvas.height);
    throw new Error("Dimensions must match for distance computation!");
  }
  var thisImgData = this.toArray();
  var cmpImgData = cmpDrawObject.toArray();
  return f(thisImgData, cmpImgData);
};

DrawObject.prototype.distance = function(cmpDrawObject){
  var df = function(thisImgData, cmpImgData) {
    var distance = 0;
    for (var i=0; i<thisImgData.length; i+=4) {
      var col1 = [thisImgData[i], thisImgData[i+1], thisImgData[i+2], thisImgData[i+3]];
      var col2 = [cmpImgData[i], cmpImgData[i+1], cmpImgData[i+2], cmpImgData[i+3]];
      distance += euclideanDistance(col1, col2);
    };
    return distance;
  };
  return this.distanceF(df, cmpDrawObject)
};

DrawObject.prototype.destroy = function(){
  this.paper = undefined;
  $(this.canvas).remove();
}

function Draw(s, k, a, width, height, visible){
  return k(s, new DrawObject(width, height, visible));
}

function loadImage(s, k, a, drawObject, url){
  // Synchronous loading - only continue with computation once image is loaded
  var context = drawObject.canvas.getContext('2d');
  var imageObj = new Image();
  imageObj.onload = function() {
    var raster = new drawObject.paper.Raster(imageObj);
    raster.position = drawObject.paper.view.center;
    drawObject.redraw();
    var trampoline = k(s);
    while (trampoline){
      trampoline = trampoline();
    }
  };
  imageObj.src = url;
  return false;
}


// Code boxes

function webpplObjectToText(x){
  if (isErp(x)){
    return "<erp>";
  } else {
    return JSON.stringify(x);
  }
}

var codeBoxCount = 0;

CodeMirror.keyMap.default["Cmd-/"] = "toggleComment";
CodeMirror.keyMap.default["Cmd-."] = function(cm){cm.foldCode(cm.getCursor(), myRangeFinder); };

//fold "///fold: ... ///" parts:
function foldCode(cm){
  var lastLine = cm.lastLine();
  for(var i=0;i<=lastLine;i++) {
    var txt = cm.getLine(i),
    pos = txt.indexOf("///fold:");
    if (pos==0) {cm.foldCode(CodeMirror.Pos(i,pos), tripleCommentRangeFinder);}
  }
}

function setupCodeBox(element){
  var $element = $(element);
  var $code = $element.html();
  var $unescaped = $('<div/>').html($code).text();

  $element.empty();

  var cm = CodeMirror(
    element, {
      value: $unescaped,
      mode: 'javascript',
      lineNumbers: false,
      readOnly: false,
      extraKeys: {"Tab": "indentAuto"}
    });

  foldCode(cm);

  var getLanguage = function(){
    var firstLine = cm.getValue().split("\n")[0];
    if (firstLine == "// language: javascript") {
      return "javascript";
    } else if (firstLine == "// static") {
      return "static";
    } else {
      return "webppl";
    }
  };

  var resultDiv = $('<div/>',
    { "id": "result_" + codeBoxCount,
      "class": "resultDiv" });

  var showResult = function(store, x){
    if (x !== undefined) {
      resultDiv.show();
      resultDiv.append(document.createTextNode(webpplObjectToText(x)));
    }
  };

  var runWebPPL = function(){
    var oldActiveCodeBox = activeCodeBox;
    activeCodeBox = $element;
    activeCodeBox.parent().find("canvas").remove();
    activeCodeBox.parent().find(".resultDiv").text("");
    var compiled = webppl.compile(cm.getValue(), true);
    eval.call(window, compiled)({}, showResult, '');
  };

  var runJS = function(){
    activeCodeBox = $element;
    activeCodeBox.parent().find("canvas").remove();
    activeCodeBox.parent().find(".resultDiv").text("");
    try {
      var result = eval.call(window, cm.getValue());
      showResult({}, result);
    } catch (err) {
      resultDiv.show();
      resultDiv.append(document.createTextNode((err.stack)));
      throw err;
    }
  };

  var runButton = $(
    '<button/>', {
      "text": "run",
      "id": 'run_' + codeBoxCount,
      "class": 'runButton',
      "click": function(){
        return (getLanguage() == "javascript") ? runJS() : runWebPPL();
      }
    });

  var runButtonDiv = $("<div/>");
  runButtonDiv.append(runButton);

  if (getLanguage() == "static"){
    cm.setValue(cm.getValue().split("\n").slice(1).join("\n").trim());
  } else {
    $element.parent().append(runButtonDiv);
  }

  $element.parent().append(resultDiv);

  codeBoxCount += 1;

  return cm;
}

function setupCodeBoxes(){
  $('pre > code').each(function() {
    setupCodeBox(this);
  });
}

$(setupCodeBoxes);


// CPS and addressing forms

function updateTransformForm(inputId, outputId, transformer){
  try {
    var cpsCode = transformer($(inputId).val());
    $(outputId).val(cpsCode);
  } catch (err) {
  }
  $(outputId).trigger('autosize.resize');
}

function setupTransformForm(inputId, outputId, eventListener){
  $(inputId).autosize();
  $(outputId).autosize();
  $(inputId).bind('input propertychange', eventListener);
  $(inputId).change();
  eventListener();
}

// CPS

var updateCpsForm = function(){
  updateTransformForm("#cpsInput", "#cpsOutput", webppl.cps);
};
var setupCpsForm = function(){
  setupTransformForm("#cpsInput", "#cpsOutput", updateCpsForm);
};

$(function(){
  if ($("#cpsInput").length){
    $(setupCpsForm);
  }
});


// Naming

var updateNamingForm = function(){
  updateTransformForm("#namingInput", "#namingOutput", webppl.naming);
};
var setupNamingForm = function(){
  setupTransformForm("#namingInput", "#namingOutput", updateNamingForm);
};

$(function(){
  if ($("#namingInput").length){
    $(setupNamingForm);
  }
});


// Google analytics

(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','//www.google-analytics.com/analytics.js','ga');

ga('create', 'UA-54996-12', 'auto');
ga('send', 'pageview');


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

$(setBibtex)

// Special functions for webppl code boxes

var invertMap = function (store, k, a, obj) {

  var newObj = {};

  for (var prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      var value = obj[prop];
      if (newObj.hasOwnProperty(value)) {
        newObj[value].push(prop);
      } else {
        newObj[value] = [prop];
      }
    }
  }

  return k(store, newObj);
};
