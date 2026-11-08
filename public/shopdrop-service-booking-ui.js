
// Shop&Drop — Other Services booking interface.
// Additive frontend integration.
// No payments, payouts or courier bookings.

(function () {
  'use strict';

  const pendingRequests = new Map();

  function validUuid(value) {
    return typeof value === 'string' &&
      /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
        .test(value);
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

      const section = document.createElement('div');
      section.className = 'shopdrop-service-booking';

      const dateLabel = document.createElement('label');
      dateLabel.textContent = 'Preferred booking date';

      const date = document.createElement('input');
      date.type = 'date';
      date.min = new Date().toLocaleDateString('en-CA');

      const timeLabel = document.createElement('label');
      timeLabel.textContent = 'Preferred arrival time';

      const time = document.createElement('input');
      time.type = 'time';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn';
      button.textContent = 'Prepare service booking';

      const status = document.createElement('p');
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
        if (!date.value) {
          status.textContent = 'Select a booking date.';
          return;
        }

        if (!time.value) {
          status.textContent = 'Select an arrival time.';
          return;
        }

        if (!window.ShopDropServicesConnector?.createBooking) {
          status.textContent =
            'Secure service booking is unavailable.';
          return;
        }

        const signature = JSON.stringify({
          serviceId,
          date: date.value,
          time: time.value
        });

        if (!pendingRequests.has(signature)) {
          pendingRequests.set(
            signature,
            crypto.randomUUID()
          );
        }

        button.disabled = true;

        try {
          status.textContent = 'Preparing secure booking…';

          const booking =
            await window.ShopDropServicesConnector.createBooking({
              serviceId,
              requestId: pendingRequests.get(signature),
              bookingDate: date.value,
              bookingTime: time.value
            });

          status.textContent =
            'Booking prepared. Reference: ' +
            booking.booking_id +
            '. Payment is not yet activated.';

          button.textContent = 'Booking prepared';
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

