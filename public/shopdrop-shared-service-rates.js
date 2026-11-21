
/*
 Shop&Drop Fix121
 Shared provider rates for services and dispatch.
 Fix146: optional booking duration per rate.
 Existing functions preserved.
 No payment or booking modifications.
*/
(() => {
  'use strict';

  const units = [
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

  const days = [
    'Sunday', 'Monday', 'Tuesday',
    'Wednesday', 'Thursday', 'Friday',
    'Saturday'
  ];

  const instances = new Map();

  function make(tag, text) {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    return node;
  }

  function mount(id, kind) {
    const root = document.getElementById(id);
    if (!root) return;

    if (instances.has(id)) return;

    const rows = new Map();
    const durations = new Map();

    const section = make('section');
    section.style.margin = '14px 0';

    const heading = make(
      'h3', 'Additional service rates'
    );

    section.append(heading);

    if (kind === 'dispatch') {
      heading.textContent =
        'Service rates — choose at least one';
    }

    const explanation = make(
      'p',
      'Enter the prices you offer. ' +
      'Leave unused rates empty. ' +
      'For bookings with a known duration, ' +
      'enter the estimated minutes per unit.'
    );

    section.append(explanation);

    for (const [unit, label] of units) {
      const line = make('label');
      line.style.display = 'flex';
      line.style.flexWrap = 'wrap';
      line.style.gap = '8px';
      line.style.alignItems = 'center';
      line.style.margin = '8px 0';

      const name = make('span', label);
      name.style.minWidth = '145px';

      const price = make('input');
      price.type = 'number';
      price.min = '0.01';
      price.step = '0.01';
      price.placeholder = 'R amount';
      price.style.maxWidth = '160px';
      price.setAttribute(
        'aria-label', label + ' price'
      );

      // Fix146: optional duration for this rate.
      // Existing price input remains unchanged.

      const duration = make('input');
      duration.type = 'number';
      duration.min = '1';
      duration.max = '1440';
      duration.step = '1';
      duration.placeholder = 'Minutes per unit';
      duration.style.maxWidth = '160px';

      duration.setAttribute(
        'aria-label',
        label + ' duration in minutes per unit'
      );

      line.append(name, price, duration);
      section.append(line);

      rows.set(unit, price);
      durations.set(unit, duration);
    }

    section.append(
      make('h3', 'Operating days')
    );

    const dayInputs = [];

    days.forEach((day, index) => {
      const label = make('label');
      label.style.display = 'inline-flex';
      label.style.alignItems = 'center';
      label.style.margin = '6px 10px 6px 0';

      const input = make('input');
      input.type = 'checkbox';
      input.checked = index >= 1 && index <= 5;
      input.style.width = 'auto';
      input.style.marginRight = '5px';

      label.append(input, make('span', day));
      section.append(label);
      dayInputs.push(input);
    });

    section.append(
      make('h3', 'Operating hours')
    );

    const start = make('input');
    start.type = 'time';
    start.value = '08:00';

    const finish = make('input');
    finish.type = 'time';
    finish.value = '17:00';

    const startLabel = make(
      'label', 'Available from'
    );
    startLabel.append(start);

    const finishLabel = make(
      'label', 'Available until'
    );
    finishLabel.append(finish);

    section.append(
      startLabel, finishLabel
    );

    const packageLabel = make(
      'label',
      'Package details (optional)'
    );

    const packageText = make('textarea');
    packageText.rows = 2;
    packageText.maxLength = 1000;
    packageText.placeholder =
      'Example: Four visits per month, ' +
      'three hours per visit';

    packageLabel.append(packageText);
    section.append(packageLabel);

    root.append(section);

    instances.set(id, {
      kind,
      rows,
      durations,
      dayInputs,
      start,
      finish,
      packageText
    });
  }

  function collect(id) {
    const instance = instances.get(id);

    if (!instance) {
      throw Error(
        'Service rate form unavailable.'
      );
    }

    const rates = [];

    for (const [unit, input] of
        instance.rows.entries()) {
      const raw = input.value.trim();
      if (!raw) continue;

      const amount = Number(raw);

      if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        amount > 9999999999
      ) {
        throw Error(
          'Enter a valid price for ' + unit
        );
      }

      // Fix146: collect duration only for
      // a rate with a supplied price.

      const durationInput =
        instance.durations.get(unit);

      const durationRaw =
        durationInput?.value.trim() || '';

      let durationMinutes = null;

      if (durationRaw) {
        durationMinutes = Number(durationRaw);

        if (
          !Number.isSafeInteger(durationMinutes) ||
          durationMinutes < 1 ||
          durationMinutes > 1440
        ) {
          throw Error(
            'Enter a valid duration of ' +
            '1 to 1440 minutes for ' + unit
          );
        }
      }

      rates.push({
        pricing_unit: unit,
        price_zar:
          Math.round(amount * 100) / 100,
        minimum_units: 1,
        booking_duration_minutes:
          durationMinutes
      });
    }

    if (
      instance.kind === 'dispatch' &&
      !rates.length
    ) {
      throw Error(
        'Enter at least one service rate.'
      );
    }

    const selectedDays =
      instance.dayInputs
        .map((input, index) =>
          input.checked ? index : null
        )
        .filter(index => index !== null);

    if (!selectedDays.length) {
      throw Error(
        'Choose at least one operating day.'
      );
    }

    const from = instance.start.value;
    const until = instance.finish.value;

    if (!from || !until || from === until) {
      throw Error(
        'Enter valid operating hours.'
      );
    }

    const details =
      instance.packageText.value.trim();

    return rates.map(rate => ({
      ...rate,
      availability_days: selectedDays,
      available_from_time: from,
      available_until_time: until,
      package_description: details || null
    }));
  }

  async function save(
    client, kind, advertisementId, rates
  ) {
    if (
      !client?.from ||
      !advertisementId
    ) {
      throw Error(
        'Service storage unavailable.'
      );
    }

    if (!Array.isArray(rates)) {
      throw Error('Invalid service rates.');
    }

    if (!rates.length) return 0;

    const parent = kind === 'service'
      ? 'service_id'
      : 'dispatch_advert_id';

    if (!['service', 'dispatch'].includes(kind)) {
      throw Error('Invalid service type.');
    }

    const records = rates.map(rate => ({
      ...rate,
      [parent]: advertisementId
    }));

    const { error } = await client
      .from('shopdrop_advert_service_rates')
      .insert(records);

    if (error) {
      throw Error(
        'Rates could not be saved: ' +
        error.message
      );
    }

    return records.length;
  }

  window.ShopDropSharedServiceRates =
    Object.freeze({
      mount,
      collect,
      save
    });
})();
