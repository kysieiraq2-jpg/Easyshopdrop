/*
 Shop&Drop Fix174B
 Compact Dispatching pricing interface.

 Additive file.
 Does not modify Other Services.
 Preserves existing shared rate collection and saving.
 Does not activate payments.
*/
(() => {
  'use strict';

  const UNITS = [
    ['hour', 'Per hour'],
    ['half_day', 'Per half-day'],
    ['day', 'Per day'],
    ['night', 'Per night'],
    ['week', 'Per week'],
    ['month', 'Per month'],
    ['kilometre', 'Per kilometre'],
    ['trip', 'Per trip'],
    ['load', 'Per load'],
    ['visit', 'Per visit'],
    ['job', 'Per completed job'],
    ['square_metre', 'Per square metre']
  ];

  function make(tag, text) {
    const node = document.createElement(tag);

    if (text !== undefined) {
      node.textContent = text;
    }

    return node;
  }

  function initialize() {
    const root = document.getElementById(
      'shopdropDispatchRates'
    );

    if (!root) return;

    if (document.getElementById(
      'shopdropCompactDispatchRates'
    )) return;

    const original = new Map();

    for (const [unit, label] of UNITS) {
      const price = Array.from(
        root.querySelectorAll('input')
      ).find(input =>
        input.getAttribute('aria-label') ===
        label + ' price'
      );

      if (!price) return;

      const line = price.closest('label');

      if (!line) return;

      const fields = Array.from(
        line.querySelectorAll('input')
      );

      original.set(unit, {
        price,
        duration: fields[1],
        capacity: fields[2],
        line
      });
    }

    const wrapper = make('div');
    wrapper.id = 'shopdropCompactDispatchRates';

    wrapper.style.padding = '14px';
    wrapper.style.margin = '12px 0';
    wrapper.style.border = '1px solid #cbd5e1';
    wrapper.style.borderRadius = '10px';
    wrapper.style.background = '#f8fafc';

    wrapper.append(
      make('h3', 'Choose your pricing methods')
    );

    wrapper.append(
      make(
        'p',
        'Select how you charge. Enter your price. ' +
        'Add another rate only if you offer one.'
      )
    );

    const rows = make('div');
    const addButton = make(
      'button',
      '+ Add another pricing method'
    );

    addButton.type = 'button';
    addButton.style.marginTop = '12px';

    wrapper.append(rows, addButton);

    const section = root.querySelector('section');

    if (!section) return;

    section.insertBefore(
      wrapper,
      section.firstChild
    );

    for (const item of original.values()) {
      item.line.style.display = 'none';
    }

    const active = new Map();

    function synchronize(unit, values) {
      const target = original.get(unit);

      if (!target) return;

      target.price.value = values?.price || '';

      if (target.duration) {
        target.duration.value =
          values?.duration || '';
      }

      if (target.capacity) {
        target.capacity.value =
          values?.capacity || '';
      }
    }

    function addRate() {
      if (active.size >= UNITS.length) return;

      const card = make('div');

      card.style.background = '#fff';
      card.style.padding = '12px';
      card.style.margin = '10px 0';
      card.style.border = '1px solid #cbd5e1';
      card.style.borderRadius = '8px';

      const unitLabel = make(
        'label',
        'How do you charge?'
      );

      const unitSelect = make('select');

      const available = UNITS.filter(
        ([unit]) => !active.has(unit)
      );

      for (const [unit, label] of available) {
        const option = make('option', label);
        option.value = unit;
        unitSelect.append(option);
      }

      unitLabel.append(unitSelect);

      const priceLabel = make(
        'label',
        'Your price in rand (R)'
      );

      const priceInput = make('input');
      priceInput.type = 'number';
      priceInput.min = '0.01';
      priceInput.step = '0.01';
      priceInput.placeholder = 'Example: 850.00';
      priceInput.required = true;

      priceLabel.append(priceInput);

      const details = make('details');

      const summary = make(
        'summary',
        'Optional duration and capacity'
      );

      details.append(summary);

      const durationLabel = make(
        'label',
        'Estimated minutes per unit'
      );

      const durationInput = make('input');
      durationInput.type = 'number';
      durationInput.min = '1';
      durationInput.max = '1440';
      durationInput.step = '1';
      durationInput.placeholder =
        'Leave empty if not applicable';

      durationLabel.append(durationInput);

      const capacityLabel = make(
        'label',
        'Simultaneous bookings'
      );

      const capacityInput = make('input');
      capacityInput.type = 'number';
      capacityInput.min = '1';
      capacityInput.max = '10000';
      capacityInput.step = '1';
      capacityInput.placeholder =
        'Leave empty if not specified';

      capacityLabel.append(capacityInput);

      details.append(
        durationLabel,
        capacityLabel
      );

      const removeButton = make(
        'button',
        'Remove this pricing method'
      );

      removeButton.type = 'button';
      removeButton.style.background = '#64748b';

      card.append(
        unitLabel,
        priceLabel,
        details,
        removeButton
      );

      rows.append(card);

      let currentUnit = unitSelect.value;

      active.set(currentUnit, card);

      function sync() {
        synchronize(currentUnit, {
          price: priceInput.value,
          duration: durationInput.value,
          capacity: capacityInput.value
        });
      }

      unitSelect.addEventListener(
        'change',
        () => {
          const nextUnit = unitSelect.value;

          if (
            active.has(nextUnit) &&
            active.get(nextUnit) !== card
          ) {
            unitSelect.value = currentUnit;
            return;
          }

          synchronize(currentUnit, null);
          active.delete(currentUnit);

          currentUnit = nextUnit;
          active.set(currentUnit, card);

          sync();
          refreshChoices();
        }
      );

      priceInput.addEventListener(
        'input',
        sync
      );

      durationInput.addEventListener(
        'input',
        sync
      );

      capacityInput.addEventListener(
        'input',
        sync
      );

      removeButton.addEventListener(
        'click',
        () => {
          synchronize(currentUnit, null);
          active.delete(currentUnit);
          card.remove();
          refreshChoices();
        }
      );

      refreshChoices();
    }

    function refreshChoices() {
      for (const card of active.values()) {
        const select = card.querySelector('select');
        const selected = select.value;

        select.replaceChildren();

        for (const [unit, label] of UNITS) {
          if (
            unit !== selected &&
            active.has(unit)
          ) continue;

          const option = make('option', label);
          option.value = unit;
          select.append(option);
        }

        select.value = selected;
      }

      addButton.disabled =
        active.size >= UNITS.length;
    }

    addButton.addEventListener(
      'click',
      addRate
    );

    addRate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initialize,
      {once: true}
    );
  } else {
    initialize();
  }
})();
