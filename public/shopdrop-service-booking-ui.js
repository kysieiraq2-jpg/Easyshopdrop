
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
      'Select the province and town where you require ' +
      'the service. Shop&Drop will find providers ' +
      'operating in that area.'
    );

    const townLabel = createElement(
      'label',
      'Town or city'
    );

    const town = createElement('select');
    town.id = 'shopdropBuyerTown';
    town.required = true;
    town.disabled = true;
    town.add(new Option(
      'Choose province first', ''
    ));

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

    let townData = null;

    function updateTowns() {
      town.replaceChildren();

      const names = townData?.provinces?.[
        province.value
      ] || [];

      town.add(new Option(
        province.value
          ? (townData
              ? 'Choose town or city'
              : 'Loading towns...')
          : 'Choose province first',
        ''
      ));

      for (const name of [...new Set(names)]
        .sort((a,b)=>a.localeCompare(b))) {
        town.add(new Option(name, name));
      }

      town.disabled =
        !province.value || !names.length;
    }

    province.addEventListener(
      'change',
      updateTowns
    );

    fetch('./shopdrop-sa-towns-181.json?v=191a')
      .then(response => {
        if (!response.ok) {
          throw Error('Town data unavailable');
        }
        return response.json();
      })
      .then(data => {
        if (data.country !== 'ZA' ||
            !data.provinces) {
          throw Error('Invalid town data');
        }
        townData = data;
        updateTowns();
      })
      .catch(() => {
        town.replaceChildren(new Option(
          'Towns unavailable — refresh page',
          ''
        ));
        town.disabled = true;
      });

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
          'Choose your province and town first.';
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
      provinceLabel,
      townLabel,
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
        document.getElementById('shopdropServiceMenu193b') ? 'Add to Service Bag' : 'Prepare service booking'
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

        // Fix 193C: Other Services selections are saved before booking.
        // Preserve the original booking handler for any other page using this script.
        if (document.getElementById('shopdropServiceMenu193b')) {
          if (!window.ShopDropServiceBag193C) {
            status.textContent = 'Service Bag unavailable. Refresh the page and try again.';
            return;
          }
          button.disabled = true;
          status.textContent = 'Checking details and saving your service…';
          try {
            await window.ShopDropServiceBag193C.add({
              p_service_id: serviceId, p_rate_id: rateId, p_quantity: quantity,
              p_date: date.value, p_time: time.value,
              p_province: location.province, p_town: location.town
            });
            window.ShopDropServiceBag193C.saved(status);
          } catch (error) {
            window.ShopDropServiceBag193C.errorMessage(status,error);
          } finally {
            button.disabled = false;
          }
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
