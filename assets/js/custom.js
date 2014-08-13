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

DrawObject.prototype.newPath = function(){
  var path = new this.paper.Path();
  path.strokeColor = 'black';
  path.strokeWidth = 8;
  path.opacity = 0.6;
  return path;
};

DrawObject.prototype.newPoint = function(x, y){
  return new this.paper.Point(x, y);
};

DrawObject.prototype.line = function(x1, y1, x2, y2){
  var path = this.newPath();
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

var codeBoxCount = 0;

function setupCodeBoxes(){
  $('pre > code').each(function() {

    var $this = $(this);
    var $code = $this.html();
    var $unescaped = $('<div/>').html($code).text();

    $this.empty();

    var cm = CodeMirror(
      this, {
        value: $unescaped,
        mode: 'javascript',
        lineNumbers: false,
        readOnly: false
      });

    var resultDiv = $('<div/>', { "class": "resultDiv" });

    var showResult = function(x){
      resultDiv.show();
      resultDiv.text(x);
    };

    var runButton = $(
      '<button/>', {
        "text": "run",
        "id": 'run_' + codeBoxCount,
        "class": 'runButton',
        "click": function () {
          var oldTopK = topK;
          var oldActiveCodeBox = activeCodeBox;
          topK = showResult;
          activeCodeBox = $this;
          activeCodeBox.find("canvas").remove();
          try {
            var compiled = webppl.compile(cm.getValue(), true);
            eval.call(window, compiled);
            // } catch (err) {
            //   showResult(err.message);
            //   throw err;
          } finally {
            // topK = oldTopK;
            // activeCodeBox = oldActiveCodeBox;
          }
        }
      });

    $this.parent().append(resultDiv);
    $this.parent().append(runButton);

    codeBoxCount += 1;

  });
}

$(setupCodeBoxes);