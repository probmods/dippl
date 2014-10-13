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
