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

        var showResult = function(x){
          resultDiv.show();
          resultDiv.text(x);
        };

        var runButton = $('<button/>', {
          "text": "run",
          "id": 'run_' + codeBoxCount,
          "class": 'runButton',
          "click": function () {
              try {
                webppl.run(cm.getValue(), showResult, false);
              } catch (err) {
                showResult(err.message);
              }
          }
        });

        $this.parent().append(resultDiv);
        $this.parent().append(runButton);

        codeBoxCount += 1;

    });
}

$(setupCodeBoxes);
