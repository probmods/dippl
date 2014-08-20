"use strict";

var topK; // Top-level continuation
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
  if (isErpWithSupport(x)){
    var params = Array.prototype.slice.call(arguments, 2);
    var labels = x.support(params);
    var counts = _.map(labels, function(label){return Math.exp(x.score(params, label));});
    var resultDivSelector = "#" + resultDiv.attr('id');
    barChart(resultDivSelector, labels, counts);
  } else {
    resultDiv.append(document.createTextNode(x + "\n"));
  }
}

function print(k, x){
  jsPrint(x);
  k();
}


// Bar plots

function barChart(containerSelector, labels, counts){
  var svg = d3.select(containerSelector)
    .append("svg")
    .attr("class", "barChart");
  var data = [];
  for (var i=0; i<labels.length; i++){
    data.push({
                "Label": JSON.stringify(labels[i]),
                "Count": counts[i]
              });
  };
  var chart = new dimple.chart(svg, data);
  chart.setBounds(80, 30, 480, 250);
  var xAxis = chart.addMeasureAxis("x", "Count");
  xAxis.title = null;
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
    $(activeCodeBox).append(this.canvas);
  };
  this.paper = new paper.PaperScope();
  this.paper.setup(this.canvas);
  this.paper.view.viewSize = new this.paper.Size(width, height);
  this.redraw();
}

DrawObject.prototype.newPath = function(strokeWidth, opacity){
  var path = new this.paper.Path();
  path.strokeColor = 'black';
  path.strokeWidth = strokeWidth || 8;
  path.opacity = opacity || 0.6;
  return path;
};

DrawObject.prototype.newPoint = function(x, y){
  return new this.paper.Point(x, y);
};

DrawObject.prototype.circle = function(x, y, fillColor, radius){
  var point = this.newPoint(x, y);
  var circle = new this.paper.Path.Circle(point, radius || 50);
  circle.fillColor = fillColor || 'black';
  this.redraw();
};

DrawObject.prototype.line = function(x1, y1, x2, y2, strokeWidth, opacity){
  var path = this.newPath(strokeWidth, opacity);
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

DrawObject.prototype.distance = function(cmpDrawObject){
  if (!((this.canvas.width == cmpDrawObject.canvas.width) &&
        (this.canvas.height == cmpDrawObject.canvas.height))){
    console.log(this.canvas.width, cmpDrawObject.canvas.width,
                this.canvas.height, cmpDrawObject.canvas.height);
    throw new Error("Dimensions must match for distance computation!");
  }
  var thisImgData = this.toArray();
  var cmpImgData = cmpDrawObject.toArray();
  var distance = 0;
  for (var i=0; i<thisImgData.length; i+=4) {
    var col1 = [thisImgData[i], thisImgData[i+1], thisImgData[i+2], thisImgData[i+3]];
    var col2 = [cmpImgData[i], cmpImgData[i+1], cmpImgData[i+2], cmpImgData[i+3]];
    distance += euclideanDistance(col1, col2);
  };
  return distance;
};

DrawObject.prototype.destroy = function(){
  this.paper = undefined;
  $(this.canvas).remove();
}

function Draw(k, width, height, visible){
  return k(new DrawObject(width, height, visible));
}

function loadImage(k, drawObject, url){
  // Synchronous loading - only continue with computation once image is loaded
  var context = drawObject.canvas.getContext('2d');
  var imageObj = new Image();
  imageObj.onload = function() {
    var raster = new drawObject.paper.Raster(imageObj);
    raster.position = drawObject.paper.view.center;
    drawObject.redraw();
    k();
  };
  imageObj.src = url;
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

  var getLanguage = function(){
    if (cm.getValue().split("\n")[0] == "// language: javascript") {
      return "javascript";
    } else {
      return "webppl";
    }
  };

  var resultDiv = $('<div/>',
                    { "id": "result_" + codeBoxCount,
                      "class": "resultDiv" });

  var showResult = function(x){
    resultDiv.show();
    if (x !== undefined) {
      resultDiv.append(document.createTextNode(webpplObjectToText(x)));
    }
  };

  var runWebPPL = function(){
    var oldTopK = topK;
    var oldActiveCodeBox = activeCodeBox;
    topK = showResult;
    activeCodeBox = $element;
    activeCodeBox.parent().find("canvas").remove();
    activeCodeBox.parent().find(".resultDiv").text("");
    try {
      var compiled = webppl.compile(cm.getValue(), true);
      eval.call(window, compiled);
    // } catch (err) {
    //   resultDiv.show();
    //   resultDiv.append(document.createTextNode((err.stack)));
      // throw err;
    } finally {
      // topK = oldTopK;
      // activeCodeBox = oldActiveCodeBox;
    }
  };

  var runJS = function(){
    activeCodeBox = $element;
    activeCodeBox.parent().find("canvas").remove();
    activeCodeBox.parent().find(".resultDiv").text("");
    try {
      var result = eval.call(window, cm.getValue());
      showResult(result);
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

  $element.parent().append(resultDiv);
  $element.parent().append(runButton);

  codeBoxCount += 1;
}

function setupCodeBoxes(){
  $('pre > code').each(function() {
    setupCodeBox(this);
  });
}

$(setupCodeBoxes);


// iPython-style editor

function addToTextarea(element, text){
  element.val(element.val() + text);
}

function addCodeBlock(){
  var newCodeBlock = $('<pre>', {'html': $('<code>', {'html': ""}),
                                 'class': "editorBlock"});
  $("#editorBlocks").append(newCodeBlock);
  newCodeBlock.find("code").each(function(){setupCodeBox(this);});
  return newCodeBlock;
}

function addTextBlock(){
  var newTextBlock = $('<textarea>', {"class": "editorBlock"});
  $("#editorBlocks").append(newTextBlock);
  newTextBlock.autosize();
  return newTextBlock;
}

function generateMarkdown(){
  $('#editorMarkdown').val("");
  $(".editorBlock").each(
    function(){
      var codeElements = $(this).find(".CodeMirror");
      if (codeElements.length == 1){
        var code = codeElements[0].CodeMirror.getValue();
        addToTextarea($('#editorMarkdown'), "\n\n~~~~\n" + code + "\n~~~~");
      } else {
        addToTextarea($('#editorMarkdown'), "\n\n" + $(this).val());
      };
    });
  $('#editorMarkdown').val($.trim($('#editorMarkdown').val()));
  $('#editorMarkdown').show().trigger('autosize.resize');
}

function loadEditor(){
  $('#editorMarkdown').autosize();
  $("#addCodeBlock").click(addCodeBlock);
  $("#addTextBlock").click(addTextBlock);
  $("#generateMarkdown").click(generateMarkdown);
  var textBlock = addTextBlock();
  textBlock.val("Edit me!");
  var codeBlock = addCodeBlock();
  $(codeBlock).find(".CodeMirror")[0].CodeMirror.setValue('print("hello world!")');
}

$(loadEditor);


// CPS form

function updateCpsForm(){
  try {
    var cpsCode = webppl.cps($("#cpsInput").val());
    $("#cpsOutput").val(cpsCode);
  } catch (err) {
  }
  $("#cpsOutput").trigger('autosize.resize');
}

function setupCpsForm(){
  $('#cpsInput').autosize();
  $('#cpsOutput').autosize();
  $('#cpsInput').bind('input propertychange', updateCpsForm);
  $('#cpsInput').change();
  updateCpsForm();
}

$(setupCpsForm);
