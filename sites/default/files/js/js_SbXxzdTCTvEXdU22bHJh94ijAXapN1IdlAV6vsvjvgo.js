/**
 * @file
 * Javascript behaviors for custom webform #states.
 */

(function ($, Drupal) {

  'use strict';

  // Issue #2860529: Conditional required File upload field don't work.
  var $document = $(document);
  $document.on('state:required', function (e) {
    if (e.trigger) {
      if (e.value) {
        $(e.target).find('input[type="file"]').attr({'required': 'required', 'aria-required': 'aria-required'});
      }
      else {
        $(e.target).find('input[type="file"]').removeAttr('required aria-required');
      }
    }
  });

  // Make absolutely sure the below event handlers are triggered after
  // the /core/misc/states.js event handlers by attaching them after DOM load.
  $(function () {
    var $document = $(document);
    $document.on('state:visible', function (e) {
      if (!e.trigger) {
        return true;
      }

      if (!e.value) {
        // @see https://www.sitepoint.com/jquery-function-clear-form-data/
        $(':input', e.target).andSelf().each(function () {
          backupValueAndRequired(this);
          clearValueAndRequired(this);
          triggerEventHandlers(this);
        });
      }
      else {
        $(':input', e.target).andSelf().each(function () {
          restoreValueAndRequired(this);
          triggerEventHandlers(this);
        });
      }
    });

    $document.on('state:disabled', function (e) {
      if (e.trigger) {
        $(e.target).trigger('webform:disabled')
          .find('select, input, textarea').trigger('webform:disabled');
      }
    });

  });

  /**
   * Trigger an input's event handlers.
   *
   * @param input
   *   An input.
   */
  function triggerEventHandlers(input) {
    var $input = $(input);
    var type = input.type;
    var tag = input.tagName.toLowerCase(); // Normalize case.
    if (type === 'checkbox' || type === 'radio') {
      $input
        .trigger('change')
        .trigger('blur');
    }
    else if (tag === 'select') {
      $input
        .trigger('change')
        .trigger('blur');
    }
    else if (type !== 'submit' && type !== 'button') {
      $input
        .trigger('input')
        .trigger('change')
        .trigger('keydown')
        .trigger('keyup')
        .trigger('blur');
    }
  }

  /**
   * Backup an input's current value and required attribute
   *
   * @param input
   *   An input.
   */
  function backupValueAndRequired(input) {
    var $input = $(input);
    var type = input.type;
    var tag = input.tagName.toLowerCase(); // Normalize case.

    // Backup required.
    if ($input.prop('required')) {
      $input.data('webform-require', true);
    }

    // Backup value.
    if (type === 'checkbox' || type === 'radio') {
      $input.data('webform-value', $input.prop('checked'));
    }
    else if (tag === 'select') {
      var values = [];
      $input.find('option:selected').each(function (i, option) {
        values[i] = option.value;
      });
      $input.data('webform-value', values);
    }
    else if (type != 'submit' && type != 'button') {
      $input.data('webform-value', input.value);
    }

  }

  /**
   * Restore an input's value and required attribute.
   *
   * @param input
   *   An input.
   */
  function restoreValueAndRequired(input) {
    var $input = $(input);

    // Restore value.
    var value = $input.data('webform-value');
    if (typeof value !== 'undefined') {
      var type = input.type;
      var tag = input.tagName.toLowerCase(); // Normalize case.

      if (type === 'checkbox' || type === 'radio') {
        $input.prop('checked', value);
      }
      else if (tag === 'select') {
        $.each(value, function (i, option_value) {
          $input.find("option[value='" + option_value + "']").prop('selected', true);
        });
      }
      else if (type !== 'submit' && type !== 'button') {
        input.value = value;
      }
    }

    // Restore required.
    if ($input.data('webform-required')) {
      $input.prop('required', true);
    }
  }

  /**
   * Clear an input's value and required attributes.
   *
   * @param input
   *   An input.
   */
  function clearValueAndRequired(input) {
    var $input = $(input);

    // Clear value.
    var type = input.type;
    var tag = input.tagName.toLowerCase(); // Normalize case.
    if (type === 'checkbox' || type === 'radio') {
      $input.prop('checked', false);
    }
    else if (tag === 'select') {
      if ($input.find('option[value=""]').length) {
        $input.val('');
      }
      else {
        input.selectedIndex = -1;
      }
    }
    else if (type !== 'submit' && type != 'button') {
      input.value = (type === 'color') ? '#000000' : '';
    }

    // Clear required.
    $input.prop('required', false);
  }

})(jQuery, Drupal);
;
/**
 * @file
 * Javascript behaviors for webforms.
 */

(function ($, Drupal) {

  'use strict';

  /**
   * Autofocus first input.
   *
   * @type {Drupal~behavior}
   *
   * @prop {Drupal~behaviorAttach} attach
   *   Attaches the behavior for the webform autofocusing.
   */
  Drupal.behaviors.webformAutofocus = {
    attach: function (context) {
      $(context).find('.webform-submission-form.js-webform-autofocus :input:visible:enabled:first').focus();
    }
  };

  /**
   * Prevent webform autosubmit on wizard pages.
   *
   * @type {Drupal~behavior}
   *
   * @prop {Drupal~behaviorAttach} attach
   *   Attaches the behavior for disabling webform autosubmit.
   */
  Drupal.behaviors.webformDisableAutoSubmit = {
    attach: function (context) {
      // @see http://stackoverflow.com/questions/11235622/jquery-disable-form-submit-on-enter
      $(context).find('.webform-submission-form.js-webform-disable-autosubmit input').once('webform-disable-autosubmit').on('keyup keypress', function (e) {
        var keyCode = e.keyCode || e.which;
        if (keyCode === 13) {
          e.preventDefault();
          return false;
        }
      });
    }
  };

  /**
   * Skip client-side validation when submit button is pressed.
   *
   * @type {Drupal~behavior}
   *
   * @prop {Drupal~behaviorAttach} attach
   *   Attaches the behavior for the skipping client-side validation.
   */
  Drupal.behaviors.webformSubmitNoValidate = {
    attach: function (context) {
      $(context).find('input:submit.js-webform-novalidate').once('webform-novalidate').on('click', function () {
        $(this.form).attr('novalidate', 'novalidate');
      });
    }
  };

  /**
   * Disable validate when save draft submit button is clicked.
   *
   * @type {Drupal~behavior}
   *
   * @prop {Drupal~behaviorAttach} attach
   *   Attaches the behavior for the webform draft submit button.
   */
  Drupal.behaviors.webformDraft = {
    attach: function (context) {
      $(context).find('#edit-draft').once('webform-draft').on('click', function () {
        $(this.form).attr('novalidate', 'novalidate');
      });
    }
  };

  /**
   * Filters the webform element list by a text input search string.
   *
   * The text input will have the selector `input.webform-form-filter-text`.
   *
   * The target element to do searching in will be in the selector
   * `input.webform-form-filter-text[data-element]`
   *
   * The text source where the text should be found will have the selector
   * `.webform-form-filter-text-source`
   *
   * @type {Drupal~behavior}
   *
   * @prop {Drupal~behaviorAttach} attach
   *   Attaches the behavior for the webform element filtering.
   */
  Drupal.behaviors.webformFilterByText = {
    attach: function (context, settings) {
      var $input = $('input.webform-form-filter-text').once('webform-form-filter-text');
      var $table = $($input.attr('data-element'));
      var $filter_rows;

      /**
       * Filters the webform element list.
       *
       * @param {jQuery.Event} e
       *   The jQuery event for the keyup event that triggered the filter.
       */
      function filterElementList(e) {
        var query = $(e.target).val().toLowerCase();

        /**
         * Shows or hides the webform element entry based on the query.
         *
         * @param {number} index
         *   The index in the loop, as provided by `jQuery.each`
         * @param {HTMLElement} label
         *   The label of the webform.
         */
        function toggleEntry(index, label) {
          var $label = $(label);
          var $row = $label.parent().parent();
          var textMatch = $label.text().toLowerCase().indexOf(query) !== -1;
          $row.toggle(textMatch);
        }

        // Filter if the length of the query is at least 2 characters.
        if (query.length >= 2) {
          $filter_rows.each(toggleEntry);
        }
        else {
          $filter_rows.each(function (index) {
            $(this).parent().parent().show();
          });
        }
      }

      if ($table.length) {
        $filter_rows = $table.find('div.webform-form-filter-text-source');
        $input.on('keyup', filterElementList);
      }
    }
  };

  if (window.imceInput) {
    window.imceInput.processUrlInput = function (i, el) {
      var button = imceInput.createUrlButton(el.id, el.getAttribute('data-imce-type'));
      el.parentNode.insertAfter(button, el);
    };
  }

  /**
   * Reacts to contextual links being added.
   *
   * @param {jQuery.Event} event
   *   The `drupalContextualLinkAdded` event.
   * @param {object} data
   *   An object containing the data relevant to the event.
   *
   * @listens event:drupalContextualLinkAdded
   */
  $(document).on('drupalContextualLinkAdded', function (event, data) {
    // Bind Ajax behaviors to all items showing the class.
    // @todo Fix contextual links to work with use-ajax links in
    //    https://www.drupal.org/node/2764931.
    Drupal.attachBehaviors(data.$el[0]);
  });

})(jQuery, Drupal);
;
/**
 * @file
 * Javascript behaviors for details element.
 */

(function ($, Drupal) {

  'use strict';

  /**
   * Attach handler to toggle details open/close state.
   *
   * @type {Drupal~behavior}
   */
  Drupal.behaviors.webformDetailsToggle = {
    attach: function (context) {
      $('.js-webform-details-toggle', context).once('webform-details-toggle').each(function () {
        var $form = $(this);
        var $details = $form.find('details');

        // Toggle is only useful when there are two or more details elements.
        if ($details.length < 2) {
          return;
        }

        // Add toggle state link to first details element.
        $details.first().before($('<button type="button" class="link webform-details-toggle-state"></button>')
          .attr('title', Drupal.t('Toggle details widget state.'))
          .on('click', function (e) {
            var open;
            if (isFormDetailsOpen($form)) {
              $form.find('details').removeAttr('open');
              open = 0;
            }
            else {
              $form.find('details').attr('open', 'open');
              open = 1;
            }
            setDetailsToggleLabel($form);

            // Set the saved states for all the details elements.
            // @see webform.element.details.save.js
            if (Drupal.webformDetailsSaveGetName) {
              $form.find('details').each(function () {
                var name = Drupal.webformDetailsSaveGetName($(this));
                if (name) {
                  localStorage.setItem(name, open);
                }
              });
            }
          })
          .wrap('<div class="webform-details-toggle-state-wrapper"></div>')
          .parent()
        );

        setDetailsToggleLabel($form);
      });
    }
  };

  /**
   * Determine if a webform's details are all opened.
   *
   * @param {jQuery} $form
   *   A webform.
   *
   * @return {boolean}
   *   TRUE if a webform's details are all opened.
   */
  function isFormDetailsOpen($form) {
    return ($form.find('details[open]').length === $form.find('details').length);
  }

  /**
   * Set a webform's details toggle state widget label.
   *
   * @param {jQuery} $form
   *   A webform.
   */
  function setDetailsToggleLabel($form) {
    var label = (isFormDetailsOpen($form)) ? Drupal.t('Collapse all') : Drupal.t('Expand all');
    $form.find('.webform-details-toggle-state').html(label);
  }

})(jQuery, Drupal);
;
/**
 * @file
 * Javascript behaviors for details element.
 */

(function ($, Drupal) {

  'use strict';

  /**
   * Attach handler to save details open/close state.
   *
   * @type {Drupal~behavior}
   */
  Drupal.behaviors.webformDetailsSave = {
    attach: function (context) {
      if (!window.localStorage) {
        return;
      }

      // Summary click event handler.
      $('details > summary', context).once('webform-details-summary-save').click(function () {
        var $details = $(this).parent();

        var name = Drupal.webformDetailsSaveGetName($details);
        if (!name) {
          return;
        }

        var open = ($details.attr('open') !== 'open') ? '1' : '0';
        localStorage.setItem(name, open);
      });

      // Initialize details open state via local storage.
      $('details', context).once('webform-details-save').each(function () {
        var $details = $(this);

        var name = Drupal.webformDetailsSaveGetName($details);
        if (!name) {
          return;
        }

        var open = localStorage.getItem(name);
        if (open === null) {
          return;
        }

        if (open === '1') {
          $details.attr('open', 'open');
        }
        else {
          $details.removeAttr('open');
        }
      });
    }

  };

  /**
   * Get the name used to store the state of details element.
   *
   * @param {jQuery} $details
   *   A details element.
   *
   * @return string
   *   The name used to store the state of details element.
   */
  Drupal.webformDetailsSaveGetName = function ($details) {
    if (!window.localStorage) {
      return '';
    }

    // Any details element not included a webform must have define its own id.
    var webformId = $details.attr('data-webform-element-id');
    if (webformId) {
      return 'Drupal.webform.' + webformId.replace('--', '.');
    }

    var detailsId = $details.attr('id');
    if (!detailsId) {
      return '';
    }

    var $form = $details.parents('form');
    if (!$form.length || !$form.attr('id')) {
      return '';
    }

    var formId = $form.attr('id');
    if (!formId) {
      return '';
    }

    // ISSUE: When Drupal renders a webform  in a modal dialog it appends a unique
    // identifier to webform ids and details ids. (ie my-form--FeSFISegTUI)
    // WORKAROUND: Remove the unique id that delimited using double dashes.
    formId = formId.replace(/--.+?$/, '').replace(/-/g, '_');
    detailsId = detailsId.replace(/--.+?$/, '').replace(/-/g, '_');
    return 'Drupal.webform.' + formId + '.' + detailsId;
  }

})(jQuery, Drupal);
;
