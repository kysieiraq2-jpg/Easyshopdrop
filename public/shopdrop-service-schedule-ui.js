
/*
 * Shop&Drop — Service Scheduling Interface
 * Customer and provider appointment agreement.
 * No payment collection or contact disclosure.
 * Uses existing Supabase security functions.
 */
(() => {
  'use strict';

  const URL =
    'https://dtkdvvxpwonywtsgqmdx.supabase.co';

  const KEY =
    'sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';

  const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  let dbPromise;

  function getDb() {
    if (!dbPromise) {
      dbPromise = import(
        'https://esm.sh/@supabase/supabase-js@2'
      ).then(({ createClient }) =>
        createClient(URL, KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        })
      ).catch(error => {
        dbPromise = null;
        throw error;
      });
    }
    return dbPromise;
  }

  function node(tag, value) {
    const el = document.createElement(tag);
    if (value !== undefined) {
      el.textContent = value;
    }
    return el;
  }

  function line(parent, label, value) {
    parent.append(
      node('p', label + ': ' + (value || '—'))
    );
  }

  function makeButton(label, handler) {
    const button = node('button', label);
    button.type = 'button';
    button.addEventListener('click', handler);
    return button;
  }

  function clear(parent) {
    parent.replaceChildren();
  }

  function initialize() {
    if (
      document.getElementById(
        'shopdrop-service-schedule-ui'
      )
    ) return;

    const main = document.querySelector('main');
    if (!main) return;

    const panel = node('section');
    panel.className = 'panel';
    panel.id = 'shopdrop-service-schedule-ui';

    panel.append(
      node('h2', 'My Service Appointments'),
      node(
        'p',
        'Arrange a service date and arrival time ' +
        'privately before payment. ' +
        'The agreed service price does not change.'
      )
    );

    const input = node('input');
    input.type = 'text';
    input.placeholder = 'Service booking ID';
    input.autocomplete = 'off';
    input.spellcheck = false;

    const load = node('button', 'View Appointment');
    load.type = 'button';

    const status = node('p');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    const content = node('div');

    panel.append(input, load, status, content);

    const anchor = document.getElementById(
      'service-arrival-pin-panel'
    );

    if (anchor) {
      anchor.insertAdjacentElement(
        'beforebegin',
        panel
      );
    } else {
      main.append(panel);
    }

    async function authenticatedDb() {
      const db = await getDb();
      const { data, error } = await db.auth.getUser();

      if (error || !data?.user) {
        throw new Error('Please sign in first.');
      }

      return db;
    }

    async function rpc(name, args) {
      const db = await authenticatedDb();
      const { data, error } = await db.rpc(name, args);

      if (error) {
        throw new Error(
          'Unable to complete appointment action.'
        );
      }

      return data;
    }

    async function action(name, args) {
      status.textContent = 'Updating appointment…';

      try {
        const result = await rpc(name, args);

        if (!result || result.ok !== true) {
          throw new Error('Appointment update failed.');
        }

        await show();
      } catch (error) {
        status.textContent = error.message;
      }
    }

    async function show() {
      clear(content);

      const bookingId = input.value.trim();

      if (!UUID.test(bookingId)) {
        status.textContent =
          'Enter a valid service booking ID.';
        return;
      }

      load.disabled = true;
      status.textContent = 'Loading appointment…';

      try {
        const result = await rpc(
          'shopdrop_get_my_service_schedule',
          { p_booking_id: bookingId }
        );

        if (!result || result.ok !== true) {
          throw new Error('Appointment unavailable.');
        }

        status.textContent =
          'Appointment status: ' +
          result.agreement_status;

        line(
          content,
          'Requested date',
          result.requested_date
        );

        line(
          content,
          'Requested arrival',
          result.requested_arrival_time
        );

        if (result.proposed_date) {
          line(
            content,
            'Alternative date',
            result.proposed_date
          );

          line(
            content,
            'Alternative arrival',
            result.proposed_arrival_time
          );
        }

        if (result.confirmed_date) {
          line(
            content,
            'Confirmed date',
            result.confirmed_date
          );

          line(
            content,
            'Confirmed arrival',
            result.confirmed_arrival_time
          );
        }

        line(
          content,
          'Payment status',
          result.payment_status
        );

        if (result.payment_status !== 'pending') {
          return;
        }

        if (
          result.my_role === 'provider' &&
          result.agreement_status ===
            'awaiting_provider'
        ) {
          content.append(
            makeButton('Accept Requested Time', () =>
              action(
                'shopdrop_service_provider_schedule_response',
                {
                  p_booking_id: bookingId,
                  p_action: 'accept'
                }
              )
            ),

            makeButton('Decline Appointment', () =>
              action(
                'shopdrop_service_provider_schedule_response',
                {
                  p_booking_id: bookingId,
                  p_action: 'decline'
                }
              )
            )
          );

          const date = node('input');
          date.type = 'date';

          const time = node('input');
          time.type = 'time';

          content.append(
            node('p', 'Suggest another date and time:'),
            date,
            time,
            makeButton('Propose Alternative', () => {
              if (!date.value || !time.value) {
                status.textContent =
                  'Select a date and arrival time.';
                return;
              }

              action(
                'shopdrop_service_provider_schedule_response',
                {
                  p_booking_id: bookingId,
                  p_action: 'propose',
                  p_alternative_date: date.value,
                  p_alternative_time: time.value
                }
              );
            })
          );
        }

        if (
          result.my_role === 'customer' &&
          result.agreement_status ===
            'alternative_proposed'
        ) {
          content.append(
            makeButton('Accept Alternative', () =>
              action(
                'shopdrop_service_customer_schedule_response',
                {
                  p_booking_id: bookingId,
                  p_action: 'accept'
                }
              )
            ),

            makeButton('Reject Alternative', () =>
              action(
                'shopdrop_service_customer_schedule_response',
                {
                  p_booking_id: bookingId,
                  p_action: 'reject'
                }
              )
            )
          );
        }

        if (result.agreement_status === 'confirmed') {
          content.append(
            node(
              'p',
              'Appointment confirmed. ' +
              'Checkout may proceed once enabled.'
            )
          );
        }

      } catch (error) {
        status.textContent = error.message;
      } finally {
        load.disabled = false;
      }
    }

    load.addEventListener('click', show);
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

