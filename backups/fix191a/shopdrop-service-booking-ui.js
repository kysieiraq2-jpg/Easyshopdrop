
 // Shop&Drop — Other Services booking interface.
 // Customer location and coverage integration.
 // Preserves existing booking dates, references and safeguards.
 // Fix142: selected rate and quantity integration.
 // No live payments, payouts or courier bookings.

(function () {
  'use strict';

  const pendingRequests = new Map();

  function validUuid(value) {
    return typeof value === 'string' &&
      /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
        .test(value);
  }

  function createElement(tag, text) {
    const node = document.createElement(tag);

    if (text != null) {
      node.textContent = text;
    }

    return node;
  }

  function customerLocation() {
    return {
      town: String(
        document.getElementById('shopdropBuyerTown')
          ?.value || ''
      ).trim(),

      province: String(
        document.getElementById('shopdropBuyerProvince')
          ?.value || ''
      ).trim()
    };
  }

  function attachLocationControls(results) {
    if (document.getElementById('shopdropBuyerTown')) {
      return;
    }

    const panel = createElement('section');
    panel.className = 'panel';
    panel.id = 'shopdropServiceLocationPanel';

    const heading = createElement(
      'h2',
      'Where do you need the service?'
    );

    const explanation = createElement(
      'p',
      'Enter the South African town and province where ' +
      'the service must be performed. Shop&Drop will ' +
      'match providers who operate in that area.'
    );

    const townLabel = createElement(
      'label',
      'Service required in — town or city'
    );

    const town = createElement('input');
    town.id = 'shopdropBuyerTown';
    town.type = 'text';
    town.maxLength = 120;
    town.placeholder = 'e.g. Gqeberha';
    town.required = true;
    town.autocomplete = 'address-level2';

    townLabel.append(town);

    const provinceLabel = createElement(
      'label',
      'Province'
    );

    const province = createElement('select');
    province.id = 'shopdropBuyerProvince';
    province.required = true;

    const provinces = [
      '',
      'Eastern Cape',
      'Free State',
      'Gauteng',
      'KwaZulu-Natal',
      'Limpopo',
      'Mpumalanga',
      'North West',
      'Northern Cape',
      'Western Cape'
    ];

    for (const name of provinces) {
      const option = new Option(
        name || 'Choose province',
        name
      );

      province.add(option);
    }

    provinceLabel.append(province);

    const searchButton = createElement(
      'button',
      'Find services in this area'
    );

    searchButton.type = 'button';
    searchButton.className = 'btn';

    const message = createElement('p');
    message.setAttribute('role', 'status');
    message.setAttribute('aria-live', 'polite');

    searchButton.addEventListener('click', () => {
      const location = customerLocation();

      if (
        location.town.length < 2 ||
        !location.province
      ) {
        message.textContent =
          'Enter your town and select a province.';
        return;
      }

      message.textContent =
        'Searching services that cover ' +
        location.town + ', ' + location.province + '.';

      // Use the existing category and service-search UI.
      // The connector will apply the selected area.
      document.getElementById('go')?.click();
    });

    panel.append(
      heading,
      explanation,
      townLabel,
      provinceLabel,
      searchButton,
      message
    );

    results.before(panel);
  }

  function attachBookingUI() {
    const results = document.getElementById('results');

    if (!results) return;

    const cards = results.querySelectorAll(
      '.result:not([data-booking-attached])'
    );

    cards.forEach(card => {
      const serviceId = card.dataset.serviceId;

      if (!validUuid(serviceId)) return;

      card.dataset.bookingAttached = 'true';

      const section = createElement('div');
      section.className = 'shopdrop-service-booking';

      const dateLabel = createElement(
        'label',
        'Preferred booking date'
      );

      const date = createElement('input');
      date.type = 'date';
      date.min = new Date().toLocaleDateString('en-CA');

      const timeLabel = createElement(
        'label',
        'Preferred arrival time'
      );

      const time = createElement('input');
      time.type = 'time';

      const button = createElement(
        'button',
        'Prepare service booking'
      );

      button.type = 'button';
      button.className = 'btn';

      const status = createElement('p');
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');

      dateLabel.append(date);
      timeLabel.append(time);

      section.append(
        dateLabel,
        timeLabel,
        button,
        status
      );

      card.append(section);

      button.addEventListener('click', async () => {
        const location = customerLocation();

        if (
          location.town.length < 2 ||
          location.town.length > 120 ||
          !location.province
        ) {
          status.textContent =
            'Enter the service town and province ' +
            'above before booking.';
          return;
        }

        if (!date.value) {
          status.textContent =
            'Select a booking date.';
          return;
        }

        if (!time.value) {
          status.textContent =
            'Select an arrival time.';
          return;
        }

        // Fix142: use the existing provider-rate controls.
        // Do not create another rate selector.

        const rateSection = card.querySelector(
          '.shopdrop-approved-rates'
        );

        const rateSelect = rateSection?.querySelector(
          '.shopdrop-selected-service-rate'
        );

        const rateOption =
          rateSelect?.selectedOptions?.[0];

        const rateId = rateOption?.dataset?.rateId;

        const unitsInput = rateSection?.querySelector(
          '.shopdrop-selected-service-quantity'
        );

        const quantity = Number(unitsInput?.value);

        if (
          !validUuid(rateId) ||
          !Number.isSafeInteger(quantity) ||
          quantity < 1 ||
          quantity > 100000 ||
          !unitsInput?.checkValidity()
        ) {
          status.textContent =
            'Choose an available provider rate ' +
            'and a valid number of units.';
          return;
        }

        if (
          !window.ShopDropServicesConnector
            ?.createRatedBooking
        ) {
          status.textContent =
            'Secure rated service booking is unavailable.';
          return;
        }

        // Preserve existing idempotent request handling.
        // Different dates, times, rates, quantities or
        // locations must use different request references.

        const signature = JSON.stringify({
          serviceId,
          date: date.value,
          time: time.value,
          town: location.town.toLowerCase(),
          province: location.province.toLowerCase(),
          rateId,
          quantity
        });

        if (!pendingRequests.has(signature)) {
          pendingRequests.set(
            signature,
            crypto.randomUUID()
          );
        }

        button.disabled = true;

        try {
          status.textContent =
            'Checking service coverage, provider rate ' +
            'and preparing secure booking…';

          const booking =
            await window.ShopDropServicesConnector
              .createRatedBooking({
                serviceId,
                requestId: pendingRequests.get(signature),
                rateId,
                quantity,
                bookingDate: date.value,
                bookingTime: time.value,
                serviceTown: location.town,
                serviceProvince: location.province
              });

          status.textContent =
            'Booking prepared for ' +
            location.town + ', ' +
            location.province +
            '. Reference: ' +
            booking.booking_id +
            '. Payment is not yet activated.';

          button.textContent =
            'Booking prepared';

        } catch (error) {
          status.textContent =
            error?.message ||
            'Booking preparation failed.';
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  function initialize() {
    const results = document.getElementById('results');

    if (!results) return;

    attachLocationControls(results);

    const observer = new MutationObserver(
      attachBookingUI
    );

    observer.observe(results, {
      childList: true
    });

    attachBookingUI();
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
