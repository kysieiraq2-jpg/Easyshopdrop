
// Shop&Drop — Paid booking contact viewer.
// Other Services and Dispatching only.
// Contacts come exclusively from the secure
// Supabase backend after payment verification.
// Does not change product buyer/seller privacy.

(function () {
  'use strict';

  const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const SUPABASE_URL =
    'https://dtkdvvxpwonywtsgqmdx.supabase.co';

  const SUPABASE_KEY =
    'sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';

  let clientPromise;

  async function client() {
    if (!clientPromise) {
      clientPromise = import(
        'https://esm.sh/@supabase/supabase-js@2'
      ).then(({ createClient }) =>
        createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        })
      ).catch(error => {
        clientPromise = null;
        throw error;
      });
    }

    return clientPromise;
  }

  function element(tag, text) {
    const node = document.createElement(tag);

    if (text !== undefined) {
      node.textContent = text;
    }

    return node;
  }

  async function loadContacts(type, bookingId) {
    const db = await client();

    const { data: auth, error: authError } =
      await db.auth.getUser();

    if (authError || !auth?.user) {
      throw new Error(
        'Please sign in to view booking contacts.'
      );
    }

    const { data, error } = await db.rpc(
      'shopdrop_get_paid_booking_contacts',
      {
        p_booking_type: type,
        p_booking_id: bookingId
      }
    );

    if (error) {
      throw new Error(
        'Contact information is unavailable.'
      );
    }

    if (
      !data ||
      data.ok !== true ||
      data.contacts_released !== true
    ) {
      throw new Error(
        'Contact details become available only ' +
        'after confirmed payment.'
      );
    }

    return data;
  }

  function initialize() {
    if (
      document.getElementById(
        'shopdrop-paid-booking-contacts'
      )
    ) return;

    const main = document.querySelector('main');

    if (!main) return;

    const panel = element('section');
    panel.id = 'shopdrop-paid-booking-contacts';
    panel.className = 'panel';

    panel.append(
      element('h2', 'Paid Booking Contact Details'),
      element(
        'p',
        'For Other Services and Dispatching. ' +
        'Contact information is available only ' +
        'to the booking participants after ' +
        'confirmed payment.'
      )
    );

    const typeLabel = element(
      'label',
      'Booking type'
    );

    const type = element('select');

    [
      ['service', 'Other Services'],
      ['dispatch', 'Dispatching']
    ].forEach(([value, label]) => {
      const option = element('option', label);
      option.value = value;
      type.append(option);
    });

    typeLabel.append(type);

    const bookingLabel = element(
      'label',
      'Booking reference'
    );

    const booking = element('input');
    booking.type = 'text';
    booking.placeholder = 'Enter booking ID';
    booking.autocomplete = 'off';
    booking.spellcheck = false;

    bookingLabel.append(booking);

    const button = element(
      'button',
      'View Booking Contacts'
    );

    button.type = 'button';

    const status = element('p');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    const details = element('div');

    panel.append(
      typeLabel,
      bookingLabel,
      button,
      status,
      details
    );

    const anchor = document.getElementById(
      'dispatch-arrival-pin-panel'
    );

    if (anchor) {
      anchor.insertAdjacentElement(
        'afterend',
        panel
      );
    } else {
      main.append(panel);
    }

    button.addEventListener('click', async () => {
      details.replaceChildren();
      status.textContent = '';

      const bookingId = booking.value.trim();

      if (!UUID.test(bookingId)) {
        status.textContent =
          'Enter a valid booking reference.';
        return;
      }

      button.disabled = true;
      status.textContent =
        'Verifying your paid booking…';

      try {
        const result = await loadContacts(
          type.value,
          bookingId
        );

        status.textContent =
          'Authorized booking contacts:';

        const other = result.other_party || {};

        details.append(
          element(
            'p',
            'Name: ' +
            (other.name || 'Not supplied')
          ),
          element(
            'p',
            'Mobile: ' +
            (other.mobile_number ||
              'Not supplied')
          )
        );

        if (type.value === 'dispatch') {
          [
            ['Pickup address', 'pickup_address'],
            ['Pickup contact', 'pickup_contact_name'],
            ['Pickup mobile', 'pickup_contact_mobile'],
            ['Drop-off address', 'dropoff_address'],
            ['Drop-off contact', 'dropoff_contact_name'],
            ['Drop-off mobile', 'dropoff_contact_mobile']
          ].forEach(([label, field]) => {
            if (result[field]) {
              details.append(
                element(
                  'p',
                  label + ': ' + result[field]
                )
              );
            }
          });
        }
      } catch (error) {
        status.textContent =
          error?.message ||
          'Unable to retrieve booking contacts.';
      } finally {
        button.disabled = false;
      }
    });
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

