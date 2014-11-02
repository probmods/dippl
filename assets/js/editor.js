/** @jsx React.DOM */

var cx = React.addons.classSet;

var converter = new Showdown.converter();


// Extend _.indexOf to work with functions instead of values
// Based on http://stackoverflow.com/questions/12356642/

var indexOfValue = _.indexOf; // save a reference to the core implementation

_.mixin({

    // return the index of the first array element passing a test
    indexOf: function(array, test) {
        // delegate to standard indexOf if the test isn't a function
        if (!_.isFunction(test)) return indexOfValue(array, test);
        // otherwise, look for the index
        for (var x = 0; x < array.length; x++) {
            if (test(array[x])) return x;
        }
        // not found, return fail value
        return -1;
    }

});


// CodeMirror component for React
// Based on https://github.com/brigand/react-edit/

var CodeMirrorComponent = React.createClass({

  updateCode: function(){
    // TODO: make scroll position maintain
    this.cm.setValue(this.props.code);
  },

  codeChanged: function(cm){
    // set a flag so this doesn't cause a cm.setValue
    this.userChangedCode = true;
    this.props.onChange && this.props.onChange(cm.getValue());
  },

  componentDidMount: function() {
    this.cm = setupCodeBox(this.getDOMNode());
    this.cm.on("change", this.codeChanged);
    this.cm.on("blur", this.props.onBlur);
    this.cm.on("focus", this.props.onFocus);
    this.updateCode();
  },

  componentDidUpdate: function(){
    this.cm && this.updateCode();
  },

  componentWillUnmount: function(){
    this.cm.off("change", this.codeChanged);
  },

  render: function() {
    return (<div />);
  },

  shouldComponentUpdate: function(nextProps){
    if (this.userChangedCode) {
      this.userChangedCode = false;
      return false;
    }
    return nextProps.code !== this.props.code;
  }
});


var CodeInputBox = React.createClass({

  getInitialState: function(){
    return {hasFocus: false};
  },

  onFocus: function(){
    this.setState({hasFocus: true});
  },

  onBlur: function(){
    this.setState({hasFocus: false});
  },

  render: function(){
    var blockClasses = cx({
      editorBlock: true,
      currentBlock: this.state.hasFocus,
      codeBlock: true
    });
    return (<div className={blockClasses}>
            <pre>
              <CodeMirrorComponent code={this.props.initialCode}
                                   onChange={this.props.updateCode}
                                   onBlur={this.onBlur}
                                   onFocus={this.onFocus} />
            </pre>
            <button className="removeBlock" onClick={this.props.removeMe}>x</button>
            <button className="moveUp" onClick={this.props.moveUp}>▲</button>
            <button className="moveDown" onClick={this.props.moveDown}>▼</button>
           </div>);
  }
});


var MarkdownInputBox = React.createClass({

  getInitialState: function(){
    return {text: this.props.initialText, hasFocus: false};
  },

  setFocus: function(){
    $(this.getDOMNode()).find("textarea").focus();
  },

  onFocus: function(){
    this.setState({hasFocus: true});
  },

  onBlur: function(){
    this.setState({hasFocus: false});
  },

  handleChange: function(event){
    var text = event.target.value;
    this.userChangedText = true;
    this.setState({text: text});
    this.props.updateText(text);
  },

  render: function(){
    var blockClasses = cx({
      editorBlock: true,
      currentBlock: this.state.hasFocus,
      markdownBlock: true
    });
    return (<div className={blockClasses}>
            <button className="removeBlock" onClick={this.props.removeMe}>x</button>
            <button className="moveUp" onClick={this.props.moveUp}>▲</button>
            <button className="moveDown" onClick={this.props.moveDown}>▼</button>
            <textarea onChange={this.handleChange} onFocus={this.onFocus} onBlur={this.onBlur}>{this.state.text}</textarea>
            <div className="preview" onClick={this.setFocus} dangerouslySetInnerHTML={{ __html: converter.makeHtml(this.state.text) }} />
            </div>);
  },

  componentDidMount: function(){
    $(".editorBlock textarea").autosize();
    this.props.updateText(this.state.text);
  },

  componentDidUpdate: function(){
    $(".editorBlock textarea").trigger('autosize.resize');
  },

  shouldComponentUpdate: function(nextProps, nextState){
    if (this.userChangedText){
      this.userChangedText = false;
      return false;
    }
    return (nextState.text != this.state.text) || (nextState.hasFocus != this.state.hasFocus);
  }
});


var getOrderedBlockList = function(originalBlocks){

  // Deep-copy blocks state
  var blocks = $.extend(true, {}, originalBlocks);

  // Add id to block data
  for (var id in blocks){
    blocks[id].id = id;
  }

  // Sort by ordering key
  var blockList = _.values(blocks);
  var orderedBlockList = _.sortBy(blockList, function(block){return block.orderingKey;});

  return orderedBlockList;
};


var MarkdownOutputBox = React.createClass({

  getInitialState: function(){
    return {lastUpdate: (new Date()).getTime()};
  },

  shouldComponentUpdate: function(nextProps, nextState){
    return (((new Date()).getTime() - this.state.lastUpdate) > 500) && (nextProps != this.props);
  },

  render: function(){

    if (!this.props.open){
      return <div></div>;
    }

    // get ordered list of blocks
    var orderedBlocks = getOrderedBlockList(this.props.blocks);

    // generate markdow
    var generatedMarkdown = "";
    orderedBlocks.map(function(block){
      var content = $.trim(block.content);
      if (block.type === "code"){
        generatedMarkdown += "\n\n~~~~\n" + content + "\n~~~~";
      } else if (block.type === "text"){
        generatedMarkdown += "\n\n" + block.content;
      } else {
        console.error("Unknown block type: ", block.type);
      }
    });
    return <textarea id="editorMarkdown" value={$.trim(generatedMarkdown)}></textarea>;
  },

  componentDidMount: function(){
    $('#editorMarkdown').autosize();
  },

  componentDidUpdate: function(){
    $("#editorMarkdown").trigger('autosize.resize');
  }

});


var WebpplEditor = React.createClass({

  getInitialState: function(){
    var localState = localStorage.getItem("WebPPLEditorState");
    if (localState === null){
      // block ids are separate from ordering indices (and only happen to coincide here)
      return {
        blocks: {
          1: {type: "text", content: "*Click here* to edit me!", orderingKey: 1},
          2: {type: "code", content: 'print("hello world!")', orderingKey: 2}
        },
        markdownOutputOpen: false
      };
    } else {
      var parsedState = JSON.parse(localState);
      parsedState.markdownOutputOpen = false;
      return parsedState;
    }
  },

  componentDidUpdate: function(prevProps, prevState) {
    localStorage.WebPPLEditorState = JSON.stringify(this.state);
  },

  nextBlockId: function(){
    var keys = _.keys(this.state.blocks).map(function(x){return parseInt(x);});
    if (keys.length) {
      return _.max(keys) + 1;
    } else {
      return 0;
    }
  },

  nextOrderingKey: function(){
    var keys = _.values(this.state.blocks).map(function(block){return block.orderingKey;});
    if (keys.length) {
      return _.max(keys) + 1;
    } else {
      return 0;
    }
  },

  addBlock: function(type, content){
    var newBlocks = _.clone(this.state.blocks);
    var newBlock = {
      type: type,
      content: content,
      orderingKey: this.nextOrderingKey()
    };
    newBlocks[this.nextBlockId()] = newBlock;
    this.setState({blocks: newBlocks});
  },

  addCodeBlock: function(){
    this.addBlock("code", "");
  },

  addTextBlock: function(){
    this.addBlock("text", "*Click here* to edit me!");
  },

  updateBlockContent: function(blockId, content){
    var newBlocks = _.clone(this.state.blocks);
    var updatedBlock = _.clone(this.state.blocks[blockId]);
    updatedBlock.content = content;
    newBlocks[blockId] = updatedBlock;
    this.setState({blocks: newBlocks});
  },

  removeBlock: function(blockId){
    var newBlocks = _.clone(this.state.blocks);
    delete newBlocks[blockId];
    this.setState({blocks: newBlocks});
  },

  moveBlock: function(blockId, direction){
    // Get ordered list of blocks (with ids)
    var orderedBlockList = getOrderedBlockList(this.state.blocks);

    // Figure out where blockId is in that list
    var i = _.indexOf(orderedBlockList, function(block){return block.id == blockId;});

    // Swap orderingKey with node before/after
    if (direction == "up"){
      if (i > 0) {
        var tmp = orderedBlockList[i - 1].orderingKey;
        orderedBlockList[i - 1].orderingKey = orderedBlockList[i].orderingKey;
        orderedBlockList[i].orderingKey = tmp;
      }
    } else if (direction == "down") {
      if (i < (orderedBlockList.length - 1)) {
        var tmp = orderedBlockList[i + 1].orderingKey;
        orderedBlockList[i + 1].orderingKey = orderedBlockList[i].orderingKey;
        orderedBlockList[i].orderingKey = tmp;
      }
    } else {
      console.error("Unknown direction", direction);
    }

    // Create new blocks, and set state
    var newBlocks = {};
    orderedBlockList.map(function(block){
      var id = block.id;
      delete block.id;
      newBlocks[id] = block;
    });

    this.setState({blocks: newBlocks});
  },

  toggleMarkdownOutput: function(){
    var newMarkdownOutputOpen = !this.state.markdownOutputOpen;
    this.setState({markdownOutputOpen: newMarkdownOutputOpen});
    if (newMarkdownOutputOpen){
      setTimeout(function(){$('#editorMarkdown').autosize();}, 500);
    }
  },

  render: function() {
    var that = this;
    var orderedBlocks = getOrderedBlockList(this.state.blocks);
    var renderedBlocks = [];
    orderedBlocks.map(function(block){
      if (block.type === "text") {
        var renderedBlock = (<MarkdownInputBox initialText={block.content}
                                               updateText={that.updateBlockContent.bind(that, block.id)}
                                               removeMe={that.removeBlock.bind(that, block.id)}
                                               moveUp={that.moveBlock.bind(that, block.id, "up")}
                                               moveDown={that.moveBlock.bind(that, block.id, "down")}
                                               key={block.id} />);
      } else if (block.type === "code") {
        var renderedBlock = (<CodeInputBox initialCode={block.content}
                                           updateCode={that.updateBlockContent.bind(that, block.id)}
                                           removeMe={that.removeBlock.bind(that, block.id)}
                                           moveUp={that.moveBlock.bind(that, block.id, "up")}
                                           moveDown={that.moveBlock.bind(that, block.id, "down")}
                                           key={block.id} />);
      } else {
        console.error("Unknown block type: ", block.type);
      }
      renderedBlocks.push(renderedBlock);
    });
    return (<div>
        <div id="editorBlocks">
          {renderedBlocks}
        </div>
        <div id="editorControls">
          <button onClick={this.addCodeBlock}>add code</button>
          <button onClick={this.addTextBlock}>add text</button>
          <button onClick={this.toggleMarkdownOutput}>toggle output</button>
        </div>
        <MarkdownOutputBox blocks={this.state.blocks} open={this.state.markdownOutputOpen}/>
      </div>);
  }
});

var editorContainer = document.getElementById('reactEditor');

if (editorContainer){
  React.renderComponent(<WebpplEditor/>, editorContainer);
}