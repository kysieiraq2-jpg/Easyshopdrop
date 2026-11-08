
/*
 * Shop&Drop — Dispatch required appointment time.
 * Additive frontend validation.
 * Existing dispatch submission preserved.
 */
(() => {
  'use strict';

  function initialize() {
    const date = document.getElementById('date');
    const submit = document.getElementById('preview');
    const status = document.getElementById('msg');

    if (!date || !submit || !status) return;

    date.required = true;

    function validate() {
      if (!date.value) {
        status.textContent =
          'Select a collection date and arrival time.';
        date.focus();
        return false;
      }

      const timestamp = new Date(date.value).getTime();

      if (
        !Number.isFinite(timestamp) ||
        timestamp <= Date.now()
      ) {
        status.textContent =
          'Select a valid future collection date and time.';
        date.focus();
        return false;
      }

      return true;
    }

    // Capture phase: validate before the existing
    // dispatch submission handler executes.
    submit.addEventListener(
      'click',
      event => {
        if (!validate()) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      true
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }
})();

