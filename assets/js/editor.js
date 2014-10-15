/** @jsx React.DOM */

var cx = React.addons.classSet;


var indexOfValue = _.indexOf; // save a reference to the core implementation

_.mixin({

    // Based on http://stackoverflow.com/questions/12356642/

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


var CodeMirrorComponent = React.createClass({
  // Based on https://github.com/brigand/react-edit/

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
            <textarea onChange={this.handleChange} onFocus={this.onFocus} onBlur={this.onBlur}>{this.state.text}</textarea>
            <button className="removeBlock" onClick={this.props.removeMe}>x</button>
            <button className="moveUp" onClick={this.props.moveUp}>▲</button>
            <button className="moveDown" onClick={this.props.moveDown}>▼</button>
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

  render: function(){
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
  },

  shouldComponentUpdate: function(nextProps, nextState){
    return (((new Date()).getTime() - this.state.lastUpdate) > 500) && (nextProps != this.props);
  }
});


var WebpplEditor = React.createClass({

  getInitialState: function(){
    // block ids are separate from ordering indices (and only happen to coincide here)
    return {
      blocks: {
        1: {type: "text", content: "Edit me!", orderingKey: 1},
        2: {type: "code", content: 'print("hello world!")', orderingKey: 2}
      }
    };
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

  addBlock: function(type){
    var newBlocks = _.clone(this.state.blocks);
    var newBlock = {
      type: type,
      content: "",
      orderingKey: this.nextOrderingKey()
    };
    newBlocks[this.nextBlockId()] = newBlock;
    this.setState({blocks: newBlocks});
  },

  addCodeBlock: function(){
    this.addBlock("code");
  },

  addTextBlock: function(){
    this.addBlock("text");
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
        </div>
        <MarkdownOutputBox blocks={this.state.blocks}/>
      </div>);
  }
});


React.renderComponent(
  <WebpplEditor/>,
  document.getElementById('reactEditor'));