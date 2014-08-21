//var CodeMirror = require('codemirror');

/* global CodeMirror */

(function() {
    "use strict";

    function doFold(cm, pos, options) {
        var finder = options && (options.call ? options : options.rangeFinder);
        if (!finder) finder = cm.getHelper(pos, "fold");
        if (!finder) return;
        if (typeof pos == "number") pos = CodeMirror.Pos(pos, 0);
        var minSize = options && options.minFoldSize || 0;

        function getRange(allowFolded) {
            var range = finder(cm, pos);
            if (!range || range.to.line - range.from.line < minSize) return null;
            var marks = cm.findMarksAt(range.from);
            for (var i = 0; i < marks.length; ++i) {
                if (marks[i].__isFold) {
                    if (!allowFolded) return null;
                    range.cleared = true;
                    marks[i].clear();
                }
            }
            return range;
        }

        var range = getRange(true);
        if (options && options.scanUp) while (!range && pos.line > cm.firstLine()) {
            pos = CodeMirror.Pos(pos.line - 1, 0);
            range = getRange(false);
        }
        if (!range || range.cleared) return;

        var myWidget = makeWidget(options);
        CodeMirror.on(myWidget, "mousedown", function() { myRange.clear(); });
        var myRange = cm.markText(range.from, range.to, {
            replacedWith: myWidget,
            clearOnEnter: true,
            __isFold: true
        });
        myRange.on("clear", function(from, to) {
            CodeMirror.signal(cm, "unfold", cm, from, to);
        });
        CodeMirror.signal(cm, "fold", cm, range.from, range.to);
    }

    function makeWidget(options) {
        var widget = (options && options.widget) || "\u2194";
        if (typeof widget == "string") {
            var text = document.createTextNode(widget);
            widget = document.createElement("span");
            widget.appendChild(text);
            widget.className = "CodeMirror-foldmarker";
        }
        return widget;
    }

    // Clumsy backwards-compatible interface
    CodeMirror.newFoldFunction = function(rangeFinder, widget) {
        return function(cm, pos) { doFold(cm, pos, {rangeFinder: rangeFinder, widget: widget}); };
    };

    // New-style interface
    CodeMirror.defineExtension("foldCode", function(pos, options) { doFold(this, pos, options); });

    CodeMirror.registerHelper("fold", "combine", function() {
        var funcs = Array.prototype.slice.call(arguments, 0);
        return function(cm, start) {
            for (var i = 0; i < funcs.length; ++i) {
                var found = funcs[i](cm, start);
                if (found) return found;
            }
        };
    });
})();

var myRangeFinder = function(cm, start) {

    var line = start.line, lineText = cm.getLine(line);

    //if the line has a comment fold, then do that:
    if (lineText.indexOf("///fold:") != -1) return tripleCommentRangeFinder(cm, start)
      
      return

//    var startCh, tokenType;
//
//    //    function findOpening(openCh) {
//    //        for (var at = start.ch, pass = 0;;) {
//    //            var found = at <= 0 ? -1 : lineText.lastIndexOf(openCh, at - 1);
//    //            if (found == -1) {
//    //                if (pass == 1) break;
//    //                pass = 1;
//    //                at = lineText.length;
//    //                continue;
//    //            }
//    //            if (pass == 1 && found < start.ch) break;
//    //            tokenType = cm.getTokenTypeAt(CodeMirror.Pos(line, found + 1));
//    //            if (!/^(comment|string)/.test(tokenType)) return found + 1;
//    //            at = found - 1;
//    //        }
//    //    }
//
//    var startToken = "(", endToken = ")";
//    var startCh = lineText.lastIndexOf("(", start.ch);
//    if (startCh == -1) return;
//    startCh++;
//    tokenType = cm.getTokenTypeAt(CodeMirror.Pos(line, startCh));
//
//    var count = 1, lastLine = cm.lastLine(), end, endCh;
//
//    outer: for (var i = line; i <= lastLine; ++i) {
//        var text = cm.getLine(i), pos = i == line ? startCh : 0;
//        for (;;) {
//            var nextOpen = text.indexOf(startToken, pos), nextClose = text.indexOf(endToken, pos);
//            if (nextOpen < 0) nextOpen = text.length;
//            if (nextClose < 0) nextClose = text.length;
//            pos = Math.min(nextOpen, nextClose);
//            if (pos == text.length) break;
//            if (cm.getTokenTypeAt(CodeMirror.Pos(i, pos + 1)) == tokenType) {
//                if (pos == nextOpen) ++count;
//                else if (!--count) { end = i; endCh = pos; break outer; }
//            }
//            ++pos;
//        }
//    }
//    if (end == null || line == end && endCh == startCh) return;
//    return {from: CodeMirror.Pos(line, startCh),
//            to: CodeMirror.Pos(end, endCh)};
}

//if we want to fold what's between "///fold:" and "///".
//assume that start is already the line with "///fold:"
//so find the next "///" and return the range from start line + 1 to match.
var tripleCommentRangeFinder = function(cm, start) {
    var lastLine = cm.lastLine();
    var pos;
    for (var i = start.line+1; i<=lastLine; i++) {
        var text = cm.getLine(i)
        pos = text.indexOf("///")
        if (pos==0) {
            var endCh = cm.getLine(i).length
            return {from: CodeMirror.Pos(start.line+1, 0), to: CodeMirror.Pos(i, endCh)}; }
    }
    return;
}

//module.exports = {
//    tripleCommentRangeFinder: tripleCommentRangeFinder,
//    myRangeFinder: myRangeFinder
//}
