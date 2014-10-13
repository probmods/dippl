(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(__browserify__,module,exports){
;(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['react'], factory);
  } else {
    root.ReactForms = factory(root.React);
  }
})(window, function(React) {
  return __browserify__('./lib/');
});

},{"./lib/":20}],2:[function(__browserify__,module,exports){
/**
 * @jsx React.DOM
 */
'use strict';

var React       = (window.React);
var cx          = React.addons.classSet;
var FieldMixin  = __browserify__('./FieldMixin');
var Message     = __browserify__('./Message');
var Label       = __browserify__('./Label');
var isFailure   = __browserify__('./validation').isFailure;

/**
 * Field component represents values which correspond to Property schema nodes
 * and so received PropetyValue as value.
 *
 * It provides basic markup which include <input /> component (can be customized
 * via schema) and <label /> (label text and hint text).
 */
var Field = React.createClass({displayName: 'Field',
  mixins: [FieldMixin],

  propTypes: {
    label: React.PropTypes.string
  },

  render: function() {
    var value = this.value();
    var externalValidation = this.externalValidation();
    var isInvalid = isFailure(value.validation)
                 || isFailure(externalValidation.validation);

    var className = cx({
      'rf-Field': true,
      'rf-Field--invalid': isInvalid,
      'rf-Field--dirty': !value.isUndefined
    });

    var id = this._rootNodeID;

    var input = this.renderInputComponent({id:id, onBlur: this.onBlur});

    return (
      React.DOM.div( {className:cx(className, this.props.className)}, 
        this.renderLabel(id),
        this.transferPropsTo(input),
        isFailure(externalValidation) &&
          Message(null, externalValidation.validation.failure),
        isFailure(value.validation) && !value.isUndefined &&
          Message(null, value.validation.validation.failure)
      )
    );
  },

  renderLabel: function(htmlFor) {
    var schema = this.value().schema;
    return (
      Label(
        {htmlFor:htmlFor,
        className:"rf-Field__label",
        schema:schema,
        label:this.props.label,
        hint:this.props.hint}
        )
    );
  },

  onBlur: function() {
    var value = this.value();
    if (value.isUndefined) {
      this.onValueUpdate(value.update({value: value.value}));
    }
  }
});

module.exports = Field;

},{"./FieldMixin":3,"./Label":11,"./Message":12,"./validation":28}],3:[function(__browserify__,module,exports){
/**
 * @jsx React.DOM
 */
'use strict';

var React            = (window.React);
var cloneWithProps   = React.addons.cloneWithProps;
var mergeInto        = __browserify__('./utils').mergeInto;
var FormElementMixin = __browserify__('./FormElementMixin');

/**
 * Mixin for implementing fieldcomponents.
 *
 * See <Field /> component for the basic implementation example.
 */
var FieldMixin = {
  mixins: [FormElementMixin],

  propTypes: {
    input: React.PropTypes.component
  },

  onChange: function(e) {
    if (e.stopPropagation) {
      e.stopPropagation();
    }

    var serialized = getValueFromEvent(e);
    var value = this.value().updateSerialized(serialized);
    this.onValueUpdate(value);
  },

  /**
   * Render input component.
   *
   * @returns {ReactComponent}
   */
  renderInputComponent: function(props) {
    var value = this.value();

    var input = this.props.input || value.schema.props.input;
    var inputProps = {value: value.serialized, onChange: this.onChange};

    if (props) {
      mergeInto(inputProps, props);
    }

    if (input) {
      return cloneWithProps(input, inputProps);
    } else {
      inputProps.type = 'text';
      return React.DOM.input(inputProps);
    }
  }
};

/**
 * Extract value from event
 *
 * We support both React.DOM 'change' events and custom change events
 * emitted from custom components.
 *
 * This function also normalizes empty strings to null.
 *
 * @param {Event} e
 */
function getValueFromEvent(e) {
  return e && e.target && e.target.value !== undefined ?
    e.target.value : e;
}

module.exports = FieldMixin;

},{"./FormElementMixin":8,"./utils":27}],4:[function(__browserify__,module,exports){
/**
 * @jsx React.DOM
 */
'use strict';

var React         = (window.React);
var cx            = React.addons.classSet;
var Label         = __browserify__('./Label');
var FieldsetMixin = __browserify__('./FieldsetMixin');

/**
 * A component which renders a set of fields.
 *
 * It is used by <Form /> component at top level to render its fields.
 */
var Fieldset = React.createClass({displayName: 'Fieldset',
  mixins: [FieldsetMixin],

  render: function() {
    var schema = this.value().schema;
    return this.transferPropsTo(
      React.DOM.div( {className:cx("rf-Fieldset", this.props.className)}, 
        this.renderLabel(),
        schema.map(this.renderField)
      )
    );
  },

  renderLabel: function() {
    var schema = this.value().schema;
    return (
      Label(
        {className:"rf-Fieldset__label",
        schema:schema,
        label:this.props.label,
        hint:this.props.hint}
        )
    );
  }
});

module.exports = Fieldset;

},{"./FieldsetMixin":5,"./Label":11}],5:[function(__browserify__,module,exports){
/**
 * @jsx React.DOM
 */
'use strict';

var FormElementMixin = __browserify__('./FormElementMixin');
var FormContextMixin = __browserify__('./FormContextMixin');

/**
 * Mixin for implementing fieldcomponents.
 *
 * See <Fieldset /> component for the basic implementation example.
 */
var FieldsetMixin = {
  mixins: [FormElementMixin, FormContextMixin],

  /**
   * Render field given a schema node
   *
   * @param {Schema} node
   * @returns {ReactComponent}
   */
  renderField: function(node) {
    // prevent circular require
    var createComponentFromSchema = __browserify__('./createComponentFromSchema');
    return createComponentFromSchema(node);
  }
};

module.exports = FieldsetMixin;

},{"./FormContextMixin":7,"./FormElementMixin":8,"./createComponentFromSchema":17}],6:[function(__browserify__,module,exports){
/**
 * @jsx React.DOM
 */
'use strict';

var React     = (window.React);
var cx        = React.addons.classSet;
var FormMixin = __browserify__('./FormMixin');
var FormFor   = __browserify__('./FormFor');
var v         = __browserify__('./validation');

var Form = React.createClass({displayName: 'Form',
  mixins: [FormMixin],

  propTypes: {
    component: React.PropTypes.constructor,
    onChange: React.PropTypes.func,
    onUpdate: React.PropTypes.func
  },

  render: function() {
    var component = this.props.component;
    var className = cx({
      'rf-Form': true,
      'rf-Form--invalid': v.isFailure(this.value().validation)
    });
    return this.transferPropsTo(
      component( {className:className}, 
        FormFor(null )
      )
    );
  },

  getDefaultProps: function() {
    return {component: React.DOM.form};
  },

  valueUpdated: function(value, update) {
    var isSuccess = v.isSuccess(value.validation);
    if (this.props.onUpdate) {
      this.props.onUpdate(value.value, isSuccess, update);
    }
    if (this.props.onChange && isSuccess) {
      this.props.onChange(value.value, update);
    }
  }
});

module.exports = Form;

},{"./FormFor":9,"./FormMixin":10,"./validation":28}],7:[function(__browserify__,module,exports){
/**
 * @jsx React.DOM
 */
'use strict';

var React = (window.React);

var ContextTypes = {
  value: React.PropTypes.object,
  externalValidation: React.PropTypes.any,
  onValueUpdate: React.PropTypes.func
};

/**
 * Mixin for components which exposes form context.
 *
 * See <Form />, <Fieldset /> and <RepeatingFieldset /> for components which
 * expose form context.
 */
var FormContextMixin = {

  childContextTypes: ContextTypes,

  getChildContext: function() {
    return {
      value: this.value(),
      externalValidation: this.externalValidation(),
      onValueUpdate: this.onValueUpdate
    };
  }
};

module.exports = FormContextMixin;
module.exports.ContextTypes = ContextTypes;

},{}],8:[function(__browserify__,module,exports){
/**
 * @jsx React.DOM
 */
'use strict';

var React            = (window.React);
var FormContextMixin = __browserify__('./FormContextMixin');
var v                = __browserify__('./validation');
var PropTypes        = __browserify__('./PropTypes');

/**
 * Mixin for components which serve as form elements.
 *
 * Form elements can get their values being in the context of a form or via
 * props.
 *
 * See <Field />, <Fieldset /> and <RepeatingFieldset /> components for the
 * examples.
 */
var FormElementMixin = {

  propTypes: {
    value: PropTypes.Value,
    externalValidation: React.PropTypes.object,
    onValueUpdate: React.PropTypes.func,
    name: React.PropTypes.oneOfType([
      React.PropTypes.string,
      React.PropTypes.number
    ])
  },

  contextTypes: FormContextMixin.ContextTypes,

  /**
   * Get the form value corresponding to an element.
   *
   * @returns {Value}
   */
  value: function() {
    if (this.props.value) {
      return this.props.value;
    }

    var value = this.context.value;
    if (this.props.name !== undefined) {
      value = value.get(this.props.name);
    }

    return value;
  },

  /**
   * Get external validation state corresponding to an element.
   *
   * @returns {Validation}
   */
  externalValidation: function() {
    if (this.props.externalValidation) {
      return this.props.externalValidation;
    }

    var externalValidation = this.context.externalValidation;
    if (this.props.name !== undefined &&
        externalValidation &&
        externalValidation.children) {
      return externalValidation.children[this.props.name] || v.success;
    }
    return externalValidation || v.success;
  },

  /**
   * Notify form controller of the changed form value.
   *
   * @param {Value} value
   */
  updateValue: function(value) {
    if (this.props.onValueUpdate) {
      this.props.onValueUpdate(value);
    } else {
      this.context.onValueUpdate(value);
    }
  },

  /**
   * Called when the form value is being updated.
   *
   * This method intercepts updated value and perform its own local validation
   * and deserialization. Then passes everything up to the form controller.
   *
   * @param {Any} value
   */
  onValueUpdate: function(value) {
    this.updateValue(value);
  }
};

module.exports = FormElementMixin;

},{"./FormContextMixin":7,"./PropTypes":13,"./validation":28}],9:[function(__browserify__,module,exports){
/**
 * @jsx React.DOM
 */
'use strict';

var React                     = (window.React);
var FormElementMixin          = __browserify__('./FormElementMixin');
var createComponentFromSchema = __browserify__('./createComponentFromSchema');

/**
 * A "proxy" component which renders into field, fieldset or repeating fieldset
 * based on a current schema node.
 *
 * Example usage:
 *
 *    <FormFor name="fieldName" />
 *
 * will automatically generate a form component for the "fieldName" field of the
 * form value (retreived from current context).
 *
 * Alternatively pass value, onValueUpdate via props:
 *
 *    <FormFor
 *      value={value.get('fieldName')}
 *      onValueUpdate={onValueUpdate}
 *      />
 */
var FormFor = React.createClass({displayName: 'FormFor',
  mixins: [FormElementMixin],

  render: function() {
    var component = createComponentFromSchema(this.value().schema);
    return this.transferPropsTo(component);
  }
});

module.exports = FormFor;

},{"./FormElementMixin":8,"./createComponentFromSchema":17}],10:[function(__browserify__,module,exports){
/**
 * @jsx React.DOM
 */
'use strict';

var React                     = (window.React);
var FormContextMixin          = __browserify__('./FormContextMixin');
var getDefaultValueForSchema  = __browserify__('./getDefaultValueForSchema');
var Value                     = __browserify__('./Value');
var v                         = __browserify__('./validation');

/**
 * Mixin which handles form value.
 *
 * @private
 */
var FormStateMixin = {

  propTypes: {
    defaultValue: React.PropTypes.any,
    value: React.PropTypes.any,
    externalValidation: React.PropTypes.any,
    schema: React.PropTypes.object.isRequired
  },

  getInitialState: function() {
    var value = (
      this.props.value
      || this.props.defaultValue
      || getDefaultValueForSchema(this.props.schema)
    );
    return this._getFormState(value);
  },

  componentWillReceiveProps: function(nextProps) {
    // use either new value or current value
    // XXX: we read from pending state... this isn't good but fixes a lot of
    // problems if you trigger update from some callback deep inside form
    var value = nextProps.value
      || (this._pendingState && this._pendingState.value)
      || this.state.value;

    // if schema changes we need to update value
    if (nextProps.schema !== this.props.schema) {
      var newValue = value.forSchema(nextProps.schema);
      this.setState(this._getFormState(newValue));
    // if new value is available we need to update it
    } else if (nextProps.value !== undefined) {
      this.setState(this._getFormState(value));
    }
  },

  /**
   * Return current form value.
   *
   * @returns {Value}
   */
  value: function() {
    return this.state.value;
  },

  /**
   * Return external validation.
   *
   * @returns {Validation}
   */
  externalValidation: function() {
    return this.props.externalValidation || v.success;
  },

  updateValue: function(value) {
    this.setState(this._getFormState(value));
  },

  /**
   * Called when the form value and validation state is being updated.
   *
   * @param {Any} value
   * @param {Validation} validation
   * @param {Any} convertedValue
   */
  onValueUpdate: function(value) {
    var update = {
      schema: value.schema,
      path: value.path
    };

    this.setState(this._getFormState(value.root()), function()  {
      if (typeof this.valueUpdated === 'function') {
        this.valueUpdated(this.state.value, update);
      }
    }.bind(this));
  },

  _getFormState: function(value) {
    if (!Value.isValue(value)) {
      value = Value(this.props.schema, value);
    }
    if (typeof this.getFormState === 'function') {
      return this.getFormState(value);
    } else {
      return {value:value};
    }
  }
};

/**
 * Mixin for form controller components.
 *
 * See <Form /> component for the example.
 */
var FormMixin = {
  mixins: [FormStateMixin, FormContextMixin]
};

module.exports = FormMixin;

},{"./FormContextMixin":7,"./Value":16,"./getDefaultValueForSchema":18,"./validation":28}],11:[function(__browserify__,module,exports){
/**
 * @jsx React.DOM
 */
'use strict';

var React = (window.React);

var Label = React.createClass({displayName: 'Label',

  propTypes: {
    schema: React.PropTypes.object,
    label: React.PropTypes.string,
    hint: React.PropTypes.string
  },

  render: function() {
    var schema = this.props.schema;
    var label = this.props.label ? this.props.label : schema.props.label;
    var hint = this.props.hint ? this.props.hint : schema.props.hint;
    if (!hint && !label) {
      return React.DOM.span(null );
    }
    return this.transferPropsTo(
      React.DOM.label( {className:"rf-Label"}, 
        label,
        hint && Hint( {hint:hint} )
      )
    );
  }
});

var Hint = React.createClass({displayName: 'Hint',

  propTypes: {
    hint: React.PropTypes.string.isRequired
  },

  render: function() {
    return this.transferPropsTo(
      React.DOM.span( {className:"rf-Hint"}, this.props.hint)
    );
  }
});

module.exports = Label;

},{}],12:[function(__browserify__,module,exports){
/**
 * @jsx React.DOM
 */
'use strict';

var React = (window.React);

var Message = React.createClass({displayName: 'Message',

  render: function() {
    return this.transferPropsTo(
      React.DOM.span( {className:"rf-Message"}, 
        this.props.children
      )
    );
  }
});

module.exports = Message;

},{}],13:[function(__browserify__,module,exports){
/**
 * @jsx React.DOM
 */
'use strict';

var isValue = __browserify__('./Value').isValue;

function Value(props, name, component) {
  if (props[name] !== undefined && !isValue(props[name])) {
    console.warn(
      'Invalid Value object passed as prop "' + name + '"',
      'to component "' + component + '"'
    );
  }
}

module.exports = {Value:Value};

},{"./Value":16}],14:[function(__browserify__,module,exports){
/**
 * @jsx React.DOM
 */
'use strict';

var React                   = (window.React);
var cx                      = React.addons.classSet;
var Label                   = __browserify__('./Label');
var RepeatingFieldsetMixin  = __browserify__('./RepeatingFieldsetMixin');

var Item = React.createClass({displayName: 'Item',

  render: function() {
    return this.transferPropsTo(
      React.DOM.div( {className:"rf-RepeatingFieldset__item"}, 
        this.props.children,
        React.DOM.button(
          {onClick:this.onRemove,
          type:"button",
          className:"rf-RepeatingFieldset__remove"}, "×")
      )
    );
  },

  onRemove: function() {
    if (this.props.onRemove) {
      this.props.onRemove(this.props.name);
    }
  }

});

/**
 * A component which renders values which correspond to List schema node.
 */
var RepeatingFieldset = React.createClass({displayName: 'RepeatingFieldset',

  mixins: [RepeatingFieldsetMixin],

  getDefaultProps: function() {
    return {
      item: Item
    };
  },

  render: function() {
    var Component = this.props.item;
    var fields = this.renderFields().map(function(item) 
      {return Component(
        {key:item.props.name,
        name:item.props.name,
        onRemove:this.remove}, 
        item
      );}.bind(this)
    );
    return this.transferPropsTo(
      React.DOM.div( {className:cx("rf-RepeatingFieldset", this.props.className)}, 
        this.renderLabel(),
        fields,
        React.DOM.button(
          {type:"button",
          onClick:this.onAdd,
          className:"rf-RepeatingFieldset__add"}, "Add")
      )
    );
  },

  renderLabel: function() {
    var schema = this.value().schema;
    return (
      Label(
        {className:"rf-RepeatingFieldset__label",
        schema:schema,
        label:this.props.label,
        hint:this.props.hint}
        )
    );
  },

  onAdd: function () {
    this.add();
  }

});

module.exports = RepeatingFieldset;
module.exports.Item = Item;

},{"./Label":11,"./RepeatingFieldsetMixin":15}],15:[function(__browserify__,module,exports){
/**
 * @jsx React.DOM
 */
'use strict';

var React            = (window.React);
var cloneWithProps   = React.addons.cloneWithProps;
var FormElementMixin = __browserify__('./FormElementMixin');
var FormContextMixin = __browserify__('./FormContextMixin');

/**
 * Mixin for implementing repeating fieldsets.
 *
 * See <RepeatingFieldset /> component for the basic implementation example.
 */
var RepeatingFieldsetMixin = {
  mixins: [FormElementMixin, FormContextMixin],

  propTypes: {
    onRemove: React.PropTypes.func,
    onAdd: React.PropTypes.func
  },

  /**
   * Return an array of React components rendered for all the values in an array
   * this fieldset owns.
   *
   * @returns {Array.<ReactComponent>}
   */
  renderFields: function() {
    // prevent circular require
    var createComponentFromSchema = __browserify__('./createComponentFromSchema');
    var value = this.value();
    var children = createComponentFromSchema(value.schema.children);
    return value.serialized.map(function(item, name) 
      {return cloneWithProps(children, {name:name, key: name});});
  },

  /**
   * Remove a value from fieldset's value by index
   *
   * @param {Number} index
   */
  remove: function(index) {
    var value = this.value().remove(index);
    this.updateValue(value);
    if (this.props.onRemove) {
      this.props.onRemove(index);
    }
  },

  /**
   * Add new value to fieldset's value.
   */
  add: function(itemValue) {
    var value = this.value().add(itemValue);
    this.updateValue(value);
    if (this.props.onAdd) {
      this.props.onAdd(value.value[value.value.length - 1]);
    }
  }
};

module.exports = RepeatingFieldsetMixin;

},{"./FormContextMixin":7,"./FormElementMixin":8,"./createComponentFromSchema":17}],16:[function(__browserify__,module,exports){
/**
 * @jsx React.DOM
 * @preventMunge
 */
'use strict';

var v = __browserify__('./validation');
var s = __browserify__('./schema');
var u = __browserify__('./utils');
var getDefaultValueForSchema = __browserify__('./getDefaultValueForSchema');



  function Value(parent, name, path, schema, value, serialized, validation) {
    this.parent = parent;
    this.name = name;
    this.path = path;
    this.schema = schema;
    this.value = value;
    this.serialized = serialized;
    this.validation = validation;

    this.isUndefined = this.value === undefined;

    if (this.value === undefined) {
      this.value = getDefaultValueForSchema(this.schema);
    }

    if (this.validation === undefined) {
      var validated = v.validate(this.schema, this.value);
      this.value = validated.value;
      this.validation = validated.validation;
    }

    if (this.serialized === undefined) {
      this.serialized = v.serialize(schema, this.value);
    }
  }

  Value.prototype.root=function() {
    var value = this;

    while (value.parent) {
      value = value.parent;
    }

    return value;
  };

  Value.prototype.forSchema=function(schema) {
    var root = this.root();
    // keep value and serialized value but drop validation state
    var newRoot = make(schema, root.value, root.serialized);
    return this.for_(newRoot);
  };

  Value.prototype.for_=function(root) {
    var value = root;

    for (var i = 0, len = this.path.length; i < len; i++) {
      value = value.get(this.path[i]);
    }

    return value;
  };

  Value.prototype.get=function(name) {
    return _make(
      this,
      name,
      this.path.concat(name),
      this.schema.get(name),
      this.value[name],
      this.serialized[name],
      (this.validation.children && this.validation.children[name]) || v.success
    );
  };

  Value.prototype.updateValue=function(value) {
    return this.update({value:value});
  };

  Value.prototype.updateValidation=function(validation) {
    return this.update({validation:validation});
  };

  Value.prototype.updateSerialized=function(serialized) {
    return this.update({serialized:serialized});
  };

  Value.prototype.update=function(update) {
    var current = this;
    update = this._updateSelf(update);

    while (current.parent) {
      update = current.parent._updateChild(current.name, update);
      current = current.parent;
    }

    return this.for_(make(
      current.schema,
      update.value,
      update.serialized,
      update.validation
    ));
  };

  Value.prototype._updateSelf=function(update) {
    u.invariant(
      !(update.value === undefined
        && update.serialized === undefined
        && update.validation === undefined)
    );

    if (update.value === undefined || update.validation === undefined) {
      var toValidate = update.value !== undefined ?
        update.value :
        update.serialized !== undefined ?
        update.serialized :
        this.value;
      var validated = v.validate(this.schema, toValidate);
      update.value = validated.value;
      update.validation = mergeValidation(
        validated.validation,
        update.validation);
    }

    if (update.serialized === undefined) {
      update.serialized = v.serialize(this.schema, update.value);
    }

    return update;
  };



function mergeValidation(a, b) {
  if (b === undefined || b === null) {
    return a;
  }

  var result = {
    validation: {},
    children: {}
  };

  if (b.validation) {
    result.validation = b.validation;
  } else if (a.validation) {
    result.validation = a.validation;
  }

  var k;

  if (b.children) {
    for (k in a.children) {
      result.children[k] = mergeValidation(a.children[k], b.children[k]);
    }

    for (k in b.children) {
      if (result.children[k] === undefined) {
        result.children[k] = b.children[k];
      }
    }
  } else {
    result.children = a.children;
  }

  return result;
}

for(var Value____Key in Value){if(Value.hasOwnProperty(Value____Key)){SchemaValue[Value____Key]=Value[Value____Key];}}var ____SuperProtoOfValue=Value===null?null:Value.prototype;SchemaValue.prototype=Object.create(____SuperProtoOfValue);SchemaValue.prototype.constructor=SchemaValue;SchemaValue.__superConstructor__=Value;function SchemaValue(){if(Value!==null){Value.apply(this,arguments);}}

  SchemaValue.prototype._updateChild=function(name, update) {
    update = this._updateSelf(update);

    var value = {};
    var serialized = {};
    var validation = {
      validation: this.validation.validation,
      children: {}
    };

    var n;

    for (n in this.value) {
      value[n] = this.value[n];
      serialized[n] = this.serialized[n];
    }

    for (n in this.validation.children) {
      validation.children[n] = this.validation.children[n];
    }

    value[name] = update.value;
    serialized[name] = update.serialized;
    validation.children[name] = update.validation;

    var validated = v.validateOnly(this.schema, value, validation.children);

    value = validated.value;
    validation = validated.validation;

    return {value:value, serialized:serialized, validation:validation};
  };


for(Value____Key in Value){if(Value.hasOwnProperty(Value____Key)){ListValue[Value____Key]=Value[Value____Key];}}ListValue.prototype=Object.create(____SuperProtoOfValue);ListValue.prototype.constructor=ListValue;ListValue.__superConstructor__=Value;function ListValue(){if(Value!==null){Value.apply(this,arguments);}}

  ListValue.prototype._updateChild=function(name, update) {
    update = this._updateSelf(update);

    var value = this.value.slice(0);
    var serialized = this.serialized.slice(0);

    var validation = {
      validation: this.validation.validation,
      children: {}
    };

    for (var n in this.validation.children) {
      validation.children[n] = this.validation.children[n];
    }

    value[name] = update.value;
    serialized[name] = update.serialized;
    validation.children[name] = update.validation;

    return {value:value, serialized:serialized, validation:validation};
  };

  ListValue.prototype.swap=function(aIndex, bIndex) {
    var value = this.value.slice(0);
    var serialized = this.serialized.slice(0);

    value.splice(bIndex, 0, value.splice(aIndex, 1)[0]);
    serialized.splice(bIndex, 0, serialized.splice(aIndex, 1)[0]);

    return this.update({value:value, serialized:serialized});
  };

  ListValue.prototype.add=function(value) {
    if (value === undefined) {
      value = getDefaultValueForSchema(this.schema.children);
    }

    return this.update({value: this.value.concat(value)});
  };

  ListValue.prototype.remove=function(index) {
    var value = this.value.slice(0);
    var serialized = this.serialized.slice(0);

    value.splice(index, 1);
    serialized.splice(index, 1);

    return this.update({value:value, serialized:serialized});
  };


for(Value____Key in Value){if(Value.hasOwnProperty(Value____Key)){PropertyValue[Value____Key]=Value[Value____Key];}}PropertyValue.prototype=Object.create(____SuperProtoOfValue);PropertyValue.prototype.constructor=PropertyValue;PropertyValue.__superConstructor__=Value;function PropertyValue(){if(Value!==null){Value.apply(this,arguments);}}



function _make(parent, name, path, schema, value, serialized, validation) {
  var constructor;
  if (s.isSchema(schema)) {
    constructor = SchemaValue;
  } else if (s.isList(schema)) {
    constructor = ListValue;
  } else if (s.isProperty(schema)) {
    constructor = PropertyValue;
  } else {
    u.invariant(false, 'invalid schema node');
  }

  return new constructor(
    parent, name, path, schema, value, serialized, validation);
}

function make(schema, value, serialized, validation) {
  return _make(null, null, [], schema, value, serialized, validation);
}

function isValue(value) {
  return value instanceof Value;
}

module.exports = make;
module.exports.isValue = isValue;

},{"./getDefaultValueForSchema":18,"./schema":25,"./utils":27,"./validation":28}],17:[function(__browserify__,module,exports){
/**
 * @jsx React.DOM
 */
'use strict';

var React             = (window.React);
var cloneWithProps    = React.addons.cloneWithProps;
var utils             = __browserify__('./utils');
var schema            = __browserify__('./schema');
var Field             = __browserify__('./Field');
var Fieldset          = __browserify__('./Fieldset');
var RepeatingFieldset = __browserify__('./RepeatingFieldset');

/**
 * Create a component which represents provided schema node
 *
 * @private
 * @param {SchemaNode} node
 * @returns {ReactComponent}
 */
function createComponentFromSchema(node) {
  var props = {key: node.name, name: node.name};

  if (node.props.component) {
    // React.isValidComponent returns true even for component classes so we
    // check if it is not in fact
    if (React.isValidComponent(node.props.component)
        && !React.isValidClass(node.props.component)) {
      return cloneWithProps(node.props.component, props);
    } else {
      return node.props.component(props);
    }
  }

  if (schema.isList(node)) {
    return RepeatingFieldset(props);
  } else if (schema.isSchema(node)) {
    return Fieldset(props);
  } else if (schema.isProperty(node)) {
    return Field(props);
  } else {
    utils.invariant(false, 'invalid schema node: ' + node);
  }
}

module.exports = createComponentFromSchema;

},{"./Field":2,"./Fieldset":4,"./RepeatingFieldset":14,"./schema":25,"./utils":27}],18:[function(__browserify__,module,exports){
/**
 * @jsx React.DOM
 */
'use strict';

var utils     = __browserify__('./utils');
var schema    = __browserify__('./schema');

/**
 * Get default value for schema node
 *
 * @param {SchemaNode} node
 * @returns {Any}
 */
function getDefaultValueForSchema(node) {
  if (node && node.props && node.props.defaultValue !== undefined) {
    return node.props.defaultValue;
  }
  if (schema.isSchema(node)) {
    return {};
  } else if (schema.isList(node)) {
    return [];
  } else if (schema.isProperty(node)) {
    return null;
  } else {
    utils.invariant(
      false,
      'do not know how to infer default value for ' + node
    );
  }
}

module.exports = getDefaultValueForSchema;

},{"./schema":25,"./utils":27}],19:[function(__browserify__,module,exports){
/**
 * @jsx React.DOM
 */
'use strict';

var utils     = __browserify__('./utils');
var types     = __browserify__('./types');
var schema    = __browserify__('./schema');

/**
 * Return a type which corresponds to a given schema node.
 *
 * @param {Schema} node
 * @return {Type}
 */
function getTypeFromSchema(node) {
  if (node && node.props.type) {

    utils.invariant(
      schema.isProperty(node),
      'only Property schema nodes can have types'
    );

    if (utils.isString(node.props.type)) {
      var type = types[node.props.type];
      utils.invariant(type, 'unknown type ' + node.props.type);
      return type;
    }

    return node.props.type;
  }

  return types.any;
}

module.exports = getTypeFromSchema;

},{"./schema":25,"./types":26,"./utils":27}],20:[function(__browserify__,module,exports){
/**
 * @jsx React.DOM
 */
'use strict';

var Form                    = __browserify__('./Form');
var Fieldset                = __browserify__('./Fieldset');
var RepeatingFieldset       = __browserify__('./RepeatingFieldset');
var Field                   = __browserify__('./Field');
var FormFor                 = __browserify__('./FormFor');
var Message                 = __browserify__('./Message');

var FormMixin               = __browserify__('./FormMixin');
var FormContextMixin        = __browserify__('./FormContextMixin');
var FormElementMixin        = __browserify__('./FormElementMixin');
var FieldMixin              = __browserify__('./FieldMixin');
var FieldsetMixin           = __browserify__('./FieldsetMixin');
var RepeatingFieldsetMixin  = __browserify__('./RepeatingFieldsetMixin');

var PropTypes               = __browserify__('./PropTypes');

var validators              = __browserify__('./validators');
var messages                = __browserify__('./messages');
var validation              = __browserify__('./validation');
var types                   = __browserify__('./types');
var schema                  = __browserify__('./schema');
var input                   = __browserify__('./input');

module.exports = {
  FormMixin:FormMixin, FormContextMixin:FormContextMixin, FormElementMixin:FormElementMixin,
  FieldMixin:FieldMixin, FieldsetMixin:FieldsetMixin, RepeatingFieldsetMixin:RepeatingFieldsetMixin,

  Form:Form, Field:Field, Fieldset:Fieldset, RepeatingFieldset:RepeatingFieldset,

  FormFor:FormFor, Message:Message,

  PropTypes:PropTypes,

  schema:schema, types:types, validators:validators, validation:validation, messages:messages, input:input
};

},{"./Field":2,"./FieldMixin":3,"./Fieldset":4,"./FieldsetMixin":5,"./Form":6,"./FormContextMixin":7,"./FormElementMixin":8,"./FormFor":9,"./FormMixin":10,"./Message":12,"./PropTypes":13,"./RepeatingFieldset":14,"./RepeatingFieldsetMixin":15,"./input":23,"./messages":24,"./schema":25,"./types":26,"./validation":28,"./validators":29}],21:[function(__browserify__,module,exports){
/**
 * @jsx React.DOM
 */
'use strict';

var React = (window.React);

var CheckboxGroup = React.createClass({displayName: 'CheckboxGroup',

  propTypes: {
    options: React.PropTypes.array.isRequired,
    value: React.PropTypes.array,
    onChange: React.PropTypes.func
  },

  getDefaultProps: function() {
    return {value: []};
  },

  onChange: function(e) {
    if (!this.props.onChange) {
      return;
    }

    var nextValue = this.props.value.slice(0);

    if (e.target.checked) {
      nextValue.push(e.target.value);
    } else {
      var idx = nextValue.indexOf(e.target.value);
      if (idx > -1) {
        nextValue.splice(idx, 1);
      }
    }

    var values = this.props.options.map(function(o)  {return o.value;});
    nextValue.sort(function(a, b)  {return values.indexOf(a) - values.indexOf(b);});

    this.props.onChange(nextValue);
  },

  render: function() {
    var name = this._rootNodeID;
    var value = this.props.value;
    var options = this.props.options.map(function(option)  {
      var checked = value && value.indexOf(option.value) > -1;
      return (
        React.DOM.div(
          {className:"rf-CheckboxGroup__button",
          key:option.value}, 
          React.DOM.label( {className:"rf-CheckboxGroup__label"}, 
            React.DOM.input(
              {onChange:this.onChange,
              checked:checked,
              className:"rf-CheckboxGroup__checkbox",
              type:"checkbox",
              name:name,
              value:option.value} ),
            React.DOM.span( {className:"rf-CheckboxGroup__caption"}, 
              option.name
            )
          )
        )
      );
    }.bind(this));

    return (
      React.DOM.div( {className:"rf-CheckboxGroup"}, 
        options
      )
    );
  }
});

module.exports = CheckboxGroup;

},{}],22:[function(__browserify__,module,exports){
/**
 * @jsx React.DOM
 */
'use strict';

var React = (window.React);

function renderEmptyOption(props, onChange) {
  return (
    React.DOM.div(
        {className:"rf-RadioButtonGroup__button",
        key:""}, 
      React.DOM.label(
        {className:"rf-RadioButtonGroup__label"}, 
        React.DOM.input(
          {checked:props.checked,
          className:"rf-RadioButtonGroup__radio",
          type:"radio",
          name:props.name,
          onChange:onChange.bind(null, null),
          value:""} ),
        React.DOM.span( {className:"rf-RadioButtonGroup__caption"}, 
          "none"
        )
      )
    )
  );
}

var RadioButtonGroup = React.createClass({displayName: 'RadioButtonGroup',

    propTypes: {
      options: React.PropTypes.array.isRequired,
      allowEmpty: React.PropTypes.bool,
      value: React.PropTypes.string,
      onChange: React.PropTypes.func
    },

    render: function() {
      var options = this.props.options.map(this.renderOption);

      if (this.props.allowEmpty) {
        options.unshift(renderEmptyOption({
            name: this._rootNodeID,
            checked: !this.props.value
        }, this.onChange));
      }

      return (
        React.DOM.div( {className:"rf-RadioButtonGroup"}, 
          options
        )
      );
    },

    renderOption: function(option) {
      var name = this._rootNodeID;
      var checked = this.props.value ?
          this.props.value === option.value :
          false;
      return (
        React.DOM.div(
          {className:"rf-RadioButtonGroup__button",
          key:option.value}, 
          React.DOM.label(
            {className:"rf-RadioButtonGroup__label"}, 
            React.DOM.input(
              {checked:checked,
              className:"rf-RadioButtonGroup__radio",
              type:"radio",
              name:name,
              onChange:this.onChange.bind(null, option.value),
              value:option.value} ),
            React.DOM.span( {className:"rf-RadioButtonGroup__caption"}, 
              option.name
            )
          )
        )
      );
    },

    onChange: function(value) {
      if (this.props.onChange) {
        this.props.onChange(value);
      }
    }
});

module.exports = RadioButtonGroup;

},{}],23:[function(__browserify__,module,exports){
'use strict';
/**
 * @jsx React.DOM
 */
module.exports = {
  CheckboxGroup: __browserify__('./CheckboxGroup'),
  RadioButtonGroup: __browserify__('./RadioButtonGroup')
};

},{"./CheckboxGroup":21,"./RadioButtonGroup":22}],24:[function(__browserify__,module,exports){
/**
 * @jsx React.DOM
 */
'use strict';

module.exports = {
  INVALID_VALUE: 'invalid value',
  VALUE_IS_REQUIRED: 'value is required',
  AT_LEAST_ONE_ITEM_IS_REQUIRED: 'at least one item is required',
  IS_NOT_A_DATE: 'should be a date in YYYY-MM-DD format'
};

},{}],25:[function(__browserify__,module,exports){
/**
 * @jsx React.DOM
 */
'use strict';

var utils     = __browserify__('./utils');

function Node(){}



for(var Node____Key in Node){if(Node.hasOwnProperty(Node____Key)){PropertyNode[Node____Key]=Node[Node____Key];}}var ____SuperProtoOfNode=Node===null?null:Node.prototype;PropertyNode.prototype=Object.create(____SuperProtoOfNode);PropertyNode.prototype.constructor=PropertyNode;PropertyNode.__superConstructor__=Node;

  function PropertyNode(props) {
    props = props ? utils.merge({}, props) : {};

    this.name = props.name;
    this.props = props;
  }


for(Node____Key in Node){if(Node.hasOwnProperty(Node____Key)){SchemaNode[Node____Key]=Node[Node____Key];}}SchemaNode.prototype=Object.create(____SuperProtoOfNode);SchemaNode.prototype.constructor=SchemaNode;SchemaNode.__superConstructor__=Node;

  function SchemaNode(props) {
    props = props ? utils.merge({}, props) : {};

    var args = Array.prototype.slice.call(arguments, 1);
    var children = {};

    if (args.length !== 0) {
      forEachNested(args, function(arg)  {
        if (arg) {
          utils.invariant(
            arg.name,
            'Each child of <Schema> node should have name property'
          );
          children[arg.name] = arg;
        }
      });
    }

    this.name = props.name;
    this.props = props;
    this.children = children;
  }

  SchemaNode.prototype.map=function(func, context) {
    var results = [];
    for (var name in this.children) {
      results.push(func.call(context, this.children[name], name, this));
    }
    return results;
  };

  SchemaNode.prototype.get=function(name) {
    return this.children[name];
  };


for(Node____Key in Node){if(Node.hasOwnProperty(Node____Key)){ListNode[Node____Key]=Node[Node____Key];}}ListNode.prototype=Object.create(____SuperProtoOfNode);ListNode.prototype.constructor=ListNode;ListNode.__superConstructor__=Node;

  function ListNode(props) {
    props = props ? utils.merge({}, props) : {};

    var args = Array.prototype.slice.call(arguments, 1);

    utils.invariant(
      args.length === 1,
      '<List> node should contain exactly one child'
    );

    this.name = props.name;
    this.props = props;
    this.children = args[0];
  }

  ListNode.prototype.get=function() {
    return this.children;
  };


function forEachNested(collection, func, context) {
  for (var i = 0, len = collection.length; i < len; i++) {
    if (Array.isArray(collection[i])) {
      forEachNested(collection[i], func, context);
    } else {
      func.call(context, collection[i], i, collection);
    }
  }
}

function makeFactory(constructor) {
  function factory() {
    var node = Object.create(constructor.prototype);
    constructor.apply(node, arguments);
    return node;
  }
  // we do this to support instanceof check
  factory.prototype = constructor.prototype;
  return factory;
}

var Property  = makeFactory(PropertyNode);
var List      = makeFactory(ListNode);
var Schema    = makeFactory(SchemaNode);

function createType(spec) {
  return function(props) {
    props = props || {};
    return spec(props);
  };
}

function isSchema(node) {
  return node instanceof SchemaNode;
}

function isList(node) {
  return node instanceof ListNode;
}

function isProperty(node) {
  return node instanceof PropertyNode;
}

module.exports = {
  Node:Node,
  Property:Property, isProperty:isProperty,
  Schema:Schema, isSchema:isSchema,
  List:List, isList:isList,
  createType:createType
};

},{"./utils":27}],26:[function(__browserify__,module,exports){
/**
 * @jsx React.DOM
 */
'use strict';

var messages = __browserify__('./messages');
var utils    = __browserify__('./utils');

function idSerialize(value) {
  return value === null ? '' : value;
}

function idDeserialize(value) {
  return value === '' ? null : value;
}

var any = {
  serialize: idSerialize,
  deserialize: idDeserialize
};

var string = any;

var number = {
  serialize: idSerialize,
  deserialize: function(value) {
    if (value === '') {
      return null;
    // based on http://stackoverflow.com/a/1830844/182954
    } else if (!isNaN(parseFloat(value)) && isFinite(value)) {
      return parseFloat(value);
    } else {
      throw new Error(messages.INVALID_VALUE);
    }
  }
};

var isDateRe = /^\d\d\d\d-\d\d-\d\d$/;

var date = {
  serialize: function(value) {
    if (value === null) {
      return '';
    }
    var year = value.getFullYear();
    var month = value.getMonth() + 1;
    var day = value.getDate();
    return (year + "-" + pad(month, 2) + "-" + pad(day, 2));
  },
  deserialize: function(value) {
    if (value === '') {
      return null;
    }

    if (value instanceof Date) {
      return value;
    }

    if (!isDateRe.exec(value)) {
      throw new Error(messages.IS_NOT_A_DATE);
    }

    value = new Date(value);

    if (isNaN(value.getTime())) {
      throw new Error(messages.INVALID_VALUE);
    }

    return value;
  }
};

var array = {
  serialize: function (value) {
    return value ? value : [];
  },

  deserialize: utils.emptyFunction.thatReturnsArgument
};

var bool = {
  serialize: function (value) {
    return value;
  },
  deserialize: function(value) {
    return value;
  }
};

function pad(num, size) {
  return ('0000' + num).substr(-size);
}

module.exports = {any:any, string:string, number:number, date:date, array:array, bool:bool};

},{"./messages":24,"./utils":27}],27:[function(__browserify__,module,exports){
/**
 * @jsx React.DOM
 */
'use strict';

function mergeInto(dst, src) {
  if (src != null) {
    for (var k in src) {
      if (!src.hasOwnProperty(k)) {
        continue;
      }
      dst[k] = src[k];
    }
  }
}

function merge(a, b) {
  var result = {};
  if (a) {
    mergeInto(result, a);
  }
  if (b) {
    mergeInto(result, b);
  }
  return result;
}

function invariant(condition, message) {
  if (!condition) {

    throw new Error(message || 'invariant violation');
  }
}

function emptyFunction() {

}

emptyFunction.thatReturnsTrue = function() {
  return true;
};

emptyFunction.thatReturnsArgument = function(arg) {
  return arg;
};

var toString = Object.prototype.toString;

function isString(o) {
  return toString.call(o) === '[object String]';
}

module.exports = {mergeInto:mergeInto, merge:merge, invariant:invariant, emptyFunction:emptyFunction, isString:isString};

},{}],28:[function(__browserify__,module,exports){
/**
 * Schema validation
 *
 * @jsx React.DOM
 */
'use strict';

var utils                     = __browserify__('./utils');
var schema                    = __browserify__('./schema');
var getTypeFromSchema         = __browserify__('./getTypeFromSchema');
var getDefaultValueForSchema  = __browserify__('./getDefaultValueForSchema');
var validators                = __browserify__('./validators');

var exists     = validators.exists;
var nonEmpty   = validators.nonEmpty;

function serialize(node, value) {
  var result;

  if (schema.isProperty(node)) {
    result = getTypeFromSchema(node).serialize(value);
  } else if (schema.isSchema(node)) {
    result = {};
    for (var k in value) {
      if (node.children[k]) {
        result[k] = serialize(node.children[k], value[k]);
      } else {
        result[k] = value[k];
      }
    }
  } else if (schema.isList(node)) {
    result = new Array(value.length);
    for (var i = 0, len = value.length; i < len; i++) {
      result[i] = serialize(node.children, value[i]);
    }
  } else {
    utils.invariant(false, 'unknown schema passed');
  }

  return result;
}

function deserializeOnly(node, value) {
  if (value === undefined || value === null) {
    return {value:value, validation: success};
  }
  var type = getTypeFromSchema(node);
  try {
    value = type.deserialize(value);
  } catch(e) {
    return {
      validation: failure(e.message),
      value:value
    };
  }
  return {
    validation: success,
    value:value
  };
}

/**
 * Validate value against schema
 *
 * @param {Schema} node
 * @param {Any} value
 * @returns {Validation}
 */
function validate(node, value) {
  if (schema.isSchema(node)) {
    return validateSchema(node, value);
  } else if (schema.isList(node)) {
    return validateList(node, value);
  } else if (schema.isProperty(node)) {
    return validateProperty(node, value);
  } else {
    utils.invariant(
      false,
      'do not know how to validate ' + node + ' of type ' + node.constructor
    );
  }
}

/**
 * Validate value against schema but only using the root schema node.
 *
 * This method is useful when doing an incremental validation.
 *
 * @param {Schema} node
 * @param {Any} value
 * @returns {Validation}
 */
function validateOnly(node, value, children) {
  if (schema.isSchema(node)) {
    return validateSchemaOnly(node, value, children);
  } else if (schema.isList(node)) {
    return validateListOnly(node, value, children);
  } else if (schema.isProperty(node)) {
    return validateProperty(node, value);
  } else {
    utils.invariant(
      false,
      'do not know how to validate ' + node + ' of type ' + node.constructor
    );
  }
}

function validateSchema(node, value) {
  var childrenValidation = validateSchemaChildren(node, value);

  var convertedValue = value;

  if (Object.keys(childrenValidation.children).length > 0) {
    convertedValue = {};
    for (var k in value) {
      convertedValue[k] = childrenValidation.children[k] !== undefined ?
        childrenValidation.children[k] :
        value[k];
    }
  }

  var validation = validateSchemaOnly(
      node,
      convertedValue,
      childrenValidation.validation
  );

  return validation;
}

function validateSchemaOnly(node, value, children) {

  if (!areChildrenValid(children)) {
    return {
      value:value,
      validation: {
        validation: {failure: undefined},
        children: children
      }
    };
  }

  var deserialized = deserializeOnly(node, value);

  if (isFailure(deserialized.validation)) {
    return deserialized;
  }

  var validation = node.props.validate ?
    validators.validator(node.props.validate)(value, node.props) :
    validators.success;

  return {
    value: deserialized.value,
    validation: {validation:validation, children:children}
  };
}

function validateSchemaChildren(node, value) {
  var validation = {};
  var children = {};

  if (value && node.children) {
    for (var name in node.children) {
      var childValue = value[name] !== undefined ?
        value[name] :
        getDefaultValueForSchema(node.children[name]);
      var childValidation = validate(node.children[name], childValue);

      if (isFailure(childValidation.validation)) {
        validation[name] = childValidation.validation;
      }

      children[name] = childValidation.value;
    }
  }

  return {validation:validation, children:children};
}

function validateList(node, value) {
  var childrenValidation = validateListChildren(node, value);

  var validation = validateListOnly(
      node,
      childrenValidation.children,
      childrenValidation.validation
  );
  return validation;
}

function validateListOnly(node, value, children) {

  if (!areChildrenValid(children)) {
    return {
      value:value,
      validation: {
        validation: {failure: undefined},
        children: children
      }
    };
  }

  var deserialized = deserializeOnly(node, value);

  if (isFailure(deserialized.validation)) {
    return deserialized;
  }

  var validator = nonEmpty.andThen(node.props.validate);
  var validation = validator(deserialized.value, node.props);

  return {
    value: deserialized.value,
    validation: {validation:validation, children:children}
  };
}

function validateListChildren(node, value) {
  var validation = {};
  var children = [];

  if (value && node.children) {
    for (var idx = 0, len = value.length; idx < len; idx++) {
      var childValidation = validate(node.children, value[idx]);
      if (isFailure(childValidation.validation)) {
        validation[idx] = childValidation.validation;
      }
      children[idx] = childValidation.value;
    }
  }

  return {validation:validation, children:children};
}

function validateProperty(node, value) {

  var deserialized = deserializeOnly(node, value);

  if (isFailure(deserialized.validation)) {
    return deserialized;
  }

  var validator = exists.andThen(node.props.validate);
  var validation = validator(deserialized.value, node.props);

  return {
    value: deserialized.value,
    validation: {validation:validation}
  };
}

var success = {
  validation: {},
  children: {}
};

function failure(failure) {
  return {validation: {failure:failure}};
}

function isSuccess(validation) {
  return !isFailure(validation);
}

function isFailure(validation) {
  return validation && (
    (validation.validation && validation.validation.failure !== undefined)
    || (validation.children !== undefined && !areChildrenValid(validation.children))
  );
}


function areChildrenValid(children) {
  for (var k in children) {
    if (isFailure(children[k])) {
      return false;
    }
  }

  return true;
}

module.exports = {
  validate:validate, validateOnly:validateOnly,
  success:success, failure:failure,
  deserializeOnly:deserializeOnly, serialize:serialize,
  isSuccess:isSuccess, isFailure:isFailure
};

},{"./getDefaultValueForSchema":18,"./getTypeFromSchema":19,"./schema":25,"./utils":27,"./validators":29}],29:[function(__browserify__,module,exports){
/**
 * @jsx React.DOM
 */
'use strict';

var utils         = __browserify__('./utils');
var messages      = __browserify__('./messages');

var success = {failure: undefined};
var commonFailure = {failure: messages.INVALID_VALUE};

function isSuccess(validation) {
  return validation.failure === undefined;
}

function isFailure(validation) {
  return validation.failure !== undefined;
}

function make(func) {
  var wrapper = function(value, schema)  {
    var maybeFailure = func(value, schema);
    if (maybeFailure === true) {
      return success;
    }
    if (maybeFailure === false) {
      return commonFailure;
    }
    if (utils.isString(maybeFailure)) {
      return {failure: maybeFailure};
    }
    return maybeFailure;
  };
  wrapper.andThen = andThen.bind(null, wrapper);
  wrapper.isValidator = true;
  return wrapper;
}

function validatorEmpty(func) {
  if (!func) {
    return utils.emptyFunction.thatReturnsTrue;
  }
  if (func.isValidator) {
    return func;
  }

  return make(func);
}

function validator(func) {
  if (!func) {
    return utils.emptyFunction.thatReturnsTrue;
  }
  if (func.isValidator) {
    return func;
  }

  var wrapper = function(value, schema) 
    {return value === null || value === undefined ?
      true :
      func(value, schema);};

  return make(wrapper);
}

function andThen(first, second) {
  if (!second) {
    return first;
  }

  second = validator(second);

  var wrapper = function(value, schema)  {
    var validation = first(value, schema);
    return isFailure(validation) ?
      validation :
      second(value, schema);
  };

  return make(wrapper);
}

var exists = validatorEmpty(function(value, schema) 
  {return schema.required && (value === null || value === undefined) ?
    messages.VALUE_IS_REQUIRED :
    true;});

var nonEmpty = validator(function(value, schema) 
  {return schema.nonEmpty && value.length === 0 ?
    messages.AT_LEAST_ONE_ITEM_IS_REQUIRED :
    true;});

module.exports = {
  validatorEmpty:validatorEmpty,
  validator:validator,

  isSuccess:isSuccess,
  isFailure:isFailure,

  success:success,
  exists:exists,
  nonEmpty:nonEmpty
};

},{"./messages":24,"./utils":27}]},{},[1])
