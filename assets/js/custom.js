
// Code boxes

function setupCodeBoxes(){
    $('pre > code').each(function() {
        
        var $this = $(this),
        $code = $this.html(),
        $unescaped = $('<div/>').html($code).text();
        
        $this.empty();

        CodeMirror(this, {
            value: $unescaped,
            mode: 'javascript',
            lineNumbers: false,
            readOnly: false
        });
        
    });
}

$(setupCodeBoxes);
