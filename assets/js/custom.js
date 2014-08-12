"use strict";


// Drawing

var activeCanvas = undefined;

var Draw = {

  newPath: function() {
    var path = new paper.Path(); // .apply(this, arguments);
    path.strokeColor = 'black';
    path.strokeWidth = 4;
    path.opacity = 0.6;
    return path;
  },

  newPoint: function(x, y) {
    return new paper.Point(x, y); // .apply(this, arguments);
  },

  line: function(x1, y1, x2, y2){
    var path = this.newPath();
    path.moveTo(x1, y1);
    path.lineTo(this.newPoint(x2, y2));
    this.redraw();
  },

  setup: function(){
    $(activeCanvas).css( "display", "block");
    paper.setup(activeCanvas);
  },

  redraw: function(){
    paper.view.draw();
  }

};


// Code boxes

var codeBoxCount = 0;

function setupCodeBoxes(){
  $('pre > code').each(function() {

    var $this = $(this),
      $code = $this.html(),
      $unescaped = $('<div/>').html($code).text();

      $this.empty();

      var cm = CodeMirror(this, {
        value: $unescaped,
        mode: 'javascript',
        lineNumbers: false,
        readOnly: false
      });

      var resultDiv = $('<div/>', {
        "class": "resultDiv"
      });

      var resultCanvas = $('<canvas/>', {
        "class": "resultCanvas",
        "width": 200,
        "height": 200
      })[0];

      var showResult = function(x){
        resultDiv.show();
        resultDiv.text(x);
      };

      var runButton = $('<button/>', {
        "text": "run",
        "id": 'run_' + codeBoxCount,
        "class": 'runButton',
        "click": function () {
            var oldActiveCanvas = activeCanvas;
            activeCanvas = resultCanvas;
            try {
              webppl.run(cm.getValue(), showResult, false);
            } catch (err) {
              showResult(err.message);
              throw err;
            } finally {
              // activeCanvas = oldActiveCanvas;
            }
        }
      });

      $this.parent().append(resultDiv);
      $this.parent().append(resultCanvas);
      $this.parent().append(runButton);

      codeBoxCount += 1;

  });
}

$(setupCodeBoxes);