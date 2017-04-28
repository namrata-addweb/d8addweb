/**
 * @file
 * Form-based in-place editor. Works for any field type.
 */

(function ($, Drupal, _) {

  'use strict';

  /**
   * @constructor
   *
   * @augments Drupal.quickedit.EditorView
   */
  Drupal.quickedit.editors.form = Drupal.quickedit.EditorView.extend(/** @lends Drupal.quickedit.editors.form# */{

    /**
     * Tracks form container DOM element that is used while in-place editing.
     *
     * @type {jQuery}
     */
    $formContainer: null,

    /**
     * Holds the {@link Drupal.Ajax} object.
     *
     * @type {Drupal.Ajax}
     */
    formSaveAjax: null,

    /**
     * @inheritdoc
     *
     * @param {object} fieldModel
     *   The field model that holds the state.
     * @param {string} state
     *   The state to change to.
     */
    stateChange: function (fieldModel, state) {
      var from = fieldModel.previous('state');
      var to = state;
      switch (to) {
        case 'inactive':
          break;

        case 'candidate':
          if (from !== 'inactive') {
            this.removeForm();
          }
          break;

        case 'highlighted':
          break;

        case 'activating':
          // If coming from an invalid state, then the form is already loaded.
          if (from !== 'invalid') {
            this.loadForm();
          }
          break;

        case 'active':
          break;

        case 'changed':
          break;

        case 'saving':
          this.save();
          break;

        case 'saved':
          break;

        case 'invalid':
          this.showValidationErrors();
          break;
      }
    },

    /**
     * @inheritdoc
     *
     * @return {object}
     *   A settings object for the quick edit UI.
     */
    getQuickEditUISettings: function () {
      return {padding: true, unifiedToolbar: true, fullWidthToolbar: true, popup: true};
    },

    /**
     * Loads the form for this field, displays it on top of the actual field.
     */
    loadForm: function () {
      var fieldModel = this.fieldModel;

      // Generate a DOM-compatible ID for the form container DOM element.
      var id = 'quickedit-form-for-' + fieldModel.id.replace(/[\/\[\]]/g, '_');

      // Render form container.
      var $formContainer = this.$formContainer = $(Drupal.theme('quickeditFormContainer', {
        id: id,
        loadingMsg: Drupal.t('Loading…')
      }));
      $formContainer
        .find('.quickedit-form')
        .addClass('quickedit-editable quickedit-highlighted quickedit-editing')
        .attr('role', 'dialog');

      // Insert form container in DOM.
      if (this.$el.css('display') === 'inline') {
        $formContainer.prependTo(this.$el.offsetParent());
        // Position the form container to render on top of the field's element.
        var pos = this.$el.position();
        $formContainer.css('left', pos.left).css('top', pos.top);
      }
      else {
        $formContainer.insertBefore(this.$el);
      }

      // Load form, insert it into the form container and attach event handlers.
      var formOptions = {
        fieldID: fieldModel.get('fieldID'),
        $el: this.$el,
        nocssjs: false,
        // Reset an existing entry for this entity in the PrivateTempStore (if
        // any) when loading the field. Logically speaking, this should happen
        // in a separate request because this is an entity-level operation, not
        // a field-level operation. But that would require an additional
        // request, that might not even be necessary: it is only when a user
        // loads a first changed field for an entity that this needs to happen:
        // precisely now!
        reset: !fieldModel.get('entity').get('inTempStore')
      };
      Drupal.quickedit.util.form.load(formOptions, function (form, ajax) {
        Drupal.AjaxCommands.prototype.insert(ajax, {
          data: form,
          selector: '#' + id + ' .placeholder'
        });

        $formContainer
          .on('formUpdated.quickedit', ':input', function (event) {
            var state = fieldModel.get('state');
            // If the form is in an invalid state, it will persist on the page.
            // Set the field to activating so that the user can correct the
            // invalid value.
            if (state === 'invalid') {
              fieldModel.set('state', 'activating');
            }
            // Otherwise assume that the fieldModel is in a candidate state and
            // set it to changed on formUpdate.
            else {
              fieldModel.set('state', 'changed');
            }
          })
          .on('keypress.quickedit', 'input', function (event) {
            if (event.keyCode === 13) {
              return false;
            }
          });

        // The in-place editor has loaded; change state to 'active'.
        fieldModel.set('state', 'active');
      });
    },

    /**
     * Removes the form for this field, detaches behaviors and event handlers.
     */
    removeForm: function () {
      if (this.$formContainer === null) {
        return;
      }

      delete this.formSaveAjax;
      // Allow form widgets to detach properly.
      Drupal.detachBehaviors(this.$formContainer.get(0), null, 'unload');
      this.$formContainer
        .off('change.quickedit', ':input')
        .off('keypress.quickedit', 'input')
        .remove();
      this.$formContainer = null;
    },

    /**
     * @inheritdoc
     */
    save: function () {
      var $formContainer = this.$formContainer;
      var $submit = $formContainer.find('.quickedit-form-submit');
      var editorModel = this.model;
      var fieldModel = this.fieldModel;

      function cleanUpAjax() {
        Drupal.quickedit.util.form.unajaxifySaving(formSaveAjax);
        formSaveAjax = null;
      }

      // Create an AJAX object for the form associated with the field.
      var formSaveAjax = Drupal.quickedit.util.form.ajaxifySaving({
        nocssjs: false,
        other_view_modes: fieldModel.findOtherViewModes()
      }, $submit);

      // Successfully saved.
      formSaveAjax.commands.quickeditFieldFormSaved = function (ajax, response, status) {
        cleanUpAjax();
        // First, transition the state to 'saved'.
        fieldModel.set('state', 'saved');
        // Second, set the 'htmlForOtherViewModes' attribute, so that when this
        // field is rerendered, the change can be propagated to other instances
        // of this field, which may be displayed in different view modes.
        fieldModel.set('htmlForOtherViewModes', response.other_view_modes);
        // Finally, set the 'html' attribute on the field model. This will cause
        // the field to be rerendered.
        _.defer(function () {
          fieldModel.set('html', response.data);
        });
      };

      // Unsuccessfully saved; validation errors.
      formSaveAjax.commands.quickeditFieldFormValidationErrors = function (ajax, response, status) {
        editorModel.set('validationErrors', response.data);
        fieldModel.set('state', 'invalid');
      };

      // The quickeditFieldForm AJAX command is called upon attempting to save
      // the form; Form API will mark which form items have errors, if any. This
      // command is invoked only if validation errors exist and then it runs
      // before editFieldFormValidationErrors().
      formSaveAjax.commands.quickeditFieldForm = function (ajax, response, status) {
        Drupal.AjaxCommands.prototype.insert(ajax, {
          data: response.data,
          selector: '#' + $formContainer.attr('id') + ' form'
        });
      };

      // Click the form's submit button; the scoped AJAX commands above will
      // handle the server's response.
      $submit.trigger('click.quickedit');
    },

    /**
     * @inheritdoc
     */
    showValidationErrors: function () {
      this.$formContainer
        .find('.quickedit-form')
        .addClass('quickedit-validation-error')
        .find('form')
        .prepend(this.model.get('validationErrors'));
    }
  });

})(jQuery, Drupal, _);
;
/**
 * @file
 * Drag+drop based in-place editor for images.
 */

(function ($, _, Drupal) {

  'use strict';

  Drupal.quickedit.editors.image = Drupal.quickedit.EditorView.extend(/** @lends Drupal.quickedit.editors.image# */{

    /**
     * @constructs
     *
     * @augments Drupal.quickedit.EditorView
     *
     * @param {object} options
     *   Options for the image editor.
     */
    initialize: function (options) {
      Drupal.quickedit.EditorView.prototype.initialize.call(this, options);
      // Set our original value to our current HTML (for reverting).
      this.model.set('originalValue', this.$el.html().trim());
      // $.val() callback function for copying input from our custom form to
      // the Quick Edit Field Form.
      this.model.set('currentValue', function (index, value) {
        var matches = $(this).attr('name').match(/(alt|title)]$/);
        if (matches) {
          var name = matches[1];
          var $toolgroup = $('#' + options.fieldModel.toolbarView.getMainWysiwygToolgroupId());
          var $input = $toolgroup.find('.quickedit-image-field-info input[name="' + name + '"]');
          if ($input.length) {
            return $input.val();
          }
        }
      });
    },

    /**
     * @inheritdoc
     *
     * @param {Drupal.quickedit.FieldModel} fieldModel
     *   The field model that holds the state.
     * @param {string} state
     *   The state to change to.
     * @param {object} options
     *   State options, if needed by the state change.
     */
    stateChange: function (fieldModel, state, options) {
      var from = fieldModel.previous('state');
      switch (state) {
        case 'inactive':
          break;

        case 'candidate':
          if (from !== 'inactive') {
            this.$el.find('.quickedit-image-dropzone').remove();
            this.$el.removeClass('quickedit-image-element');
          }
          if (from === 'invalid') {
            this.removeValidationErrors();
          }
          break;

        case 'highlighted':
          break;

        case 'activating':
          // Defer updating the field model until the current state change has
          // propagated, to not trigger a nested state change event.
          _.defer(function () {
            fieldModel.set('state', 'active');
          });
          break;

        case 'active':
          var self = this;

          // Indicate that this element is being edited by Quick Edit Image.
          this.$el.addClass('quickedit-image-element');

          // Render our initial dropzone element. Once the user reverts changes
          // or saves a new image, this element is removed.
          var $dropzone = this.renderDropzone('upload', Drupal.t('Drop file here or click to upload'));

          $dropzone.on('dragenter', function (e) {
            $(this).addClass('hover');
          });
          $dropzone.on('dragleave', function (e) {
            $(this).removeClass('hover');
          });

          $dropzone.on('drop', function (e) {
            // Only respond when a file is dropped (could be another element).
            if (e.originalEvent.dataTransfer && e.originalEvent.dataTransfer.files.length) {
              $(this).removeClass('hover');
              self.uploadImage(e.originalEvent.dataTransfer.files[0]);
            }
          });

          $dropzone.on('click', function (e) {
            // Create an <input> element without appending it to the DOM, and
            // trigger a click event. This is the easiest way to arbitrarily
            // open the browser's upload dialog.
            $('<input type="file">')
              .trigger('click')
              .on('change', function () {
                if (this.files.length) {
                  self.uploadImage(this.files[0]);
                }
              });
          });

          // Prevent the browser's default behavior when dragging files onto
          // the document (usually opens them in the same tab).
          $dropzone.on('dragover dragenter dragleave drop click', function (e) {
            e.preventDefault();
            e.stopPropagation();
          });

          this.renderToolbar(fieldModel);
          break;

        case 'changed':
          break;

        case 'saving':
          if (from === 'invalid') {
            this.removeValidationErrors();
          }

          this.save(options);
          break;

        case 'saved':
          break;

        case 'invalid':
          this.showValidationErrors();
          break;
      }
    },

    /**
     * Validates/uploads a given file.
     *
     * @param {File} file
     *   The file to upload.
     */
    uploadImage: function (file) {
      // Indicate loading by adding a special class to our icon.
      this.renderDropzone('upload loading', Drupal.t('Uploading <i>@file</i>…', {'@file': file.name}));

      // Build a valid URL for our endpoint.
      var fieldID = this.fieldModel.get('fieldID');
      var url = Drupal.quickedit.util.buildUrl(fieldID, Drupal.url('quickedit/image/upload/!entity_type/!id/!field_name/!langcode/!view_mode'));

      // Construct form data that our endpoint can consume.
      var data = new FormData();
      data.append('files[image]', file);

      // Construct a POST request to our endpoint.
      var self = this;
      this.ajax({
        type: 'POST',
        url: url,
        data: data,
        success: function (response) {
          var $el = $(self.fieldModel.get('el'));
          // Indicate that the field has changed - this enables the
          // "Save" button.
          self.fieldModel.set('state', 'changed');
          self.fieldModel.get('entity').set('inTempStore', true);
          self.removeValidationErrors();

          // Replace our html with the new image. If we replaced our entire
          // element with data.html, we would have to implement complicated logic
          // like what's in Drupal.quickedit.AppView.renderUpdatedField.
          var $content = $(response.html).closest('[data-quickedit-field-id]').children();
          $el.empty().append($content);
        }
      });
    },

    /**
     * Utility function to make an AJAX request to the server.
     *
     * In addition to formatting the correct request, this also handles error
     * codes and messages by displaying them visually inline with the image.
     *
     * Drupal.ajax is not called here as the Form API is unused by this
     * in-place editor, and our JSON requests/responses try to be
     * editor-agnostic. Ideally similar logic and routes could be used by
     * modules like CKEditor for drag+drop file uploads as well.
     *
     * @param {object} options
     *   Ajax options.
     * @param {string} options.type
     *   The type of request (i.e. GET, POST, PUT, DELETE, etc.)
     * @param {string} options.url
     *   The URL for the request.
     * @param {*} options.data
     *   The data to send to the server.
     * @param {function} options.success
     *   A callback function used when a request is successful, without errors.
     */
    ajax: function (options) {
      var defaultOptions = {
        context: this,
        dataType: 'json',
        cache: false,
        contentType: false,
        processData: false,
        error: function () {
          this.renderDropzone('error', Drupal.t('A server error has occurred.'));
        }
      };

      var ajaxOptions = $.extend(defaultOptions, options);
      var successCallback = ajaxOptions.success;

      // Handle the success callback.
      ajaxOptions.success = function (response) {
        if (response.main_error) {
          this.renderDropzone('error', response.main_error);
          if (response.errors.length) {
            this.model.set('validationErrors', response.errors);
          }
          this.showValidationErrors();
        }
        else {
          successCallback(response);
        }
      };

      $.ajax(ajaxOptions);
    },

    /**
     * Renders our toolbar form for editing metadata.
     *
     * @param {Drupal.quickedit.FieldModel} fieldModel
     *   The current Field Model.
     */
    renderToolbar: function (fieldModel) {
      var $toolgroup = $('#' + fieldModel.toolbarView.getMainWysiwygToolgroupId());
      var $toolbar = $toolgroup.find('.quickedit-image-field-info');
      if ($toolbar.length === 0) {
        // Perform an AJAX request for extra image info (alt/title).
        var fieldID = fieldModel.get('fieldID');
        var url = Drupal.quickedit.util.buildUrl(fieldID, Drupal.url('quickedit/image/info/!entity_type/!id/!field_name/!langcode/!view_mode'));
        var self = this;
        self.ajax({
          type: 'GET',
          url: url,
          success: function (response) {
            $toolbar = $(Drupal.theme.quickeditImageToolbar(response));
            $toolgroup.append($toolbar);
            $toolbar.on('keyup paste', function () {
              fieldModel.set('state', 'changed');
            });
            // Re-position the toolbar, which could have changed size.
            fieldModel.get('entity').toolbarView.position();
          }
        });
      }
    },

    /**
     * Renders our dropzone element.
     *
     * @param {string} state
     *   The current state of our editor. Only used for visual styling.
     * @param {string} text
     *   The text to display in the dropzone area.
     *
     * @return {jQuery}
     *   The rendered dropzone.
     */
    renderDropzone: function (state, text) {
      var $dropzone = this.$el.find('.quickedit-image-dropzone');
      // If the element already exists, modify its contents.
      if ($dropzone.length) {
        $dropzone
          .removeClass('upload error hover loading')
          .addClass('.quickedit-image-dropzone ' + state)
          .children('.quickedit-image-text')
            .html(text);
      }
      else {
        $dropzone = $(Drupal.theme('quickeditImageDropzone', {
          state: state,
          text: text
        }));
        this.$el.append($dropzone);
      }

      return $dropzone;
    },

    /**
     * @inheritdoc
     */
    revert: function () {
      this.$el.html(this.model.get('originalValue'));
    },

    /**
     * @inheritdoc
     */
    getQuickEditUISettings: function () {
      return {padding: false, unifiedToolbar: true, fullWidthToolbar: true, popup: false};
    },

    /**
     * @inheritdoc
     */
    showValidationErrors: function () {
      var errors = Drupal.theme('quickeditImageErrors', {
        errors: this.model.get('validationErrors')
      });
      $('#' + this.fieldModel.toolbarView.getMainWysiwygToolgroupId())
        .append(errors);
      this.getEditedElement()
        .addClass('quickedit-validation-error');
      // Re-position the toolbar, which could have changed size.
      this.fieldModel.get('entity').toolbarView.position();
    },

    /**
     * @inheritdoc
     */
    removeValidationErrors: function () {
      $('#' + this.fieldModel.toolbarView.getMainWysiwygToolgroupId())
        .find('.quickedit-image-errors').remove();
      this.getEditedElement()
        .removeClass('quickedit-validation-error');
    }

  });

})(jQuery, _, Drupal);
;
/**
 * @file
 * Provides theme functions for image Quick Edit's client-side HTML.
 */

(function (Drupal) {

  'use strict';

  /**
   * Theme function for validation errors of the Image in-place editor.
   *
   * @param {object} settings
   *   Settings object used to construct the markup.
   * @param {string} settings.errors
   *   Already escaped HTML representing error messages.
   *
   * @return {string}
   *   The corresponding HTML.
   */
  Drupal.theme.quickeditImageErrors = function (settings) {
    return '<div class="quickedit-image-errors">' + settings.errors + '</div>';
  };

  /**
   * Theme function for the dropzone element of the Image module's in-place
   * editor.
   *
   * @param {object} settings
   *   Settings object used to construct the markup.
   * @param {string} settings.state
   *   State of the upload.
   * @param {string} settings.text
   *   Text to display inline with the dropzone element.
   *
   * @return {string}
   *   The corresponding HTML.
   */
  Drupal.theme.quickeditImageDropzone = function (settings) {
    return '<div class="quickedit-image-dropzone ' + settings.state + '">' +
      '  <i class="quickedit-image-icon"></i>' +
      '  <span class="quickedit-image-text">' + settings.text + '</span>' +
      '</div>';
  };

  /**
   * Theme function for the toolbar of the Image module's in-place editor.
   *
   * @param {object} settings
   *   Settings object used to construct the markup.
   * @param {bool} settings.alt_field
   *   Whether or not the "Alt" field is enabled for this field.
   * @param {bool} settings.alt_field_required
   *   Whether or not the "Alt" field is required for this field.
   * @param {string} settings.alt
   *   The current value for the "Alt" field.
   * @param {bool} settings.title_field
   *   Whether or not the "Title" field is enabled for this field.
   * @param {bool} settings.title_field_required
   *   Whether or not the "Title" field is required for this field.
   * @param {string} settings.title
   *   The current value for the "Title" field.
   *
   * @return {string}
   *   The corresponding HTML.
   */
  Drupal.theme.quickeditImageToolbar = function (settings) {
    var html = '<form class="quickedit-image-field-info">';
    if (settings.alt_field) {
      html += '  <div>' +
        '    <label for="alt" class="' + (settings.alt_field_required ? 'required' : '') + '">' + Drupal.t('Alternative text') + '</label>' +
        '    <input type="text" placeholder="' + settings.alt + '" value="' + settings.alt + '" name="alt" ' + (settings.alt_field_required ? 'required' : '') + '/>' +
        '  </div>';
    }
    if (settings.title_field) {
      html += '  <div>' +
        '    <label for="title" class="' + (settings.title_field_required ? 'form-required' : '') + '">' + Drupal.t('Title') + '</label>' +
        '    <input type="text" placeholder="' + settings.title + '" value="' + settings.title + '" name="title" ' + (settings.title_field_required ? 'required' : '') + '/>' +
        '  </div>';
    }
    html += '</form>';

    return html;
  };

})(Drupal);
;
