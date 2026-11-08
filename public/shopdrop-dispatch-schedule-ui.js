
/*
 * Shop&Drop — Dispatch Appointment Interface
 * Customer/provider scheduling before payment.
 * No contact disclosure or payment processing.
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

  function formatTime(value) {
    if (!value) return '—';

    const date = new Date(value);

    if (!Number.isFinite(date.getTime())) {
      return 'Unavailable';
    }

    return date.toLocaleString('en-ZA', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Africa/Johannesburg'
    });
  }

  function makeButton(label, handler) {
    const button = node('button', label);
    button.type = 'button';
    button.addEventListener('click', handler);
    return button;
  }

  function initialize() {
    if (
      document.getElementById(
        'shopdrop-dispatch-schedule-ui'
      )
    ) return;

    const main = document.querySelector('main');
    if (!main) return;

    const panel = node('section');
    panel.className = 'panel';
    panel.id = 'shopdrop-dispatch-schedule-ui';

    panel.append(
      node('h2', 'My Dispatch Appointments'),
      node(
        'p',
        'Confirm the vehicle arrival time before ' +
        'payment. Providers may propose an alternative. ' +
        'The agreed transport price cannot change.'
      )
    );

    const input = node('input');
    input.type = 'text';
    input.placeholder = 'Dispatch booking ID';
    input.autocomplete = 'off';
    input.spellcheck = false;

    const load = node('button', 'View Dispatch Appointment');
    load.type = 'button';

    const status = node('p');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    const content = node('div');

    panel.append(input, load, status, content);

    const anchor = document.getElementById(
      'dispatch-arrival-pin-panel'
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
      content.replaceChildren();

      const bookingId = input.value.trim();

      if (!UUID.test(bookingId)) {
        status.textContent =
          'Enter a valid dispatch booking ID.';
        return;
      }

      load.disabled = true;
      status.textContent = 'Loading appointment…';

      try {
        const result = await rpc(
          'shopdrop_get_my_dispatch_schedule',
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
          'Requested arrival',
          formatTime(result.requested_arrival_at)
        );

        if (result.proposed_arrival_at) {
          line(
            content,
            'Alternative arrival',
            formatTime(result.proposed_arrival_at)
          );
        }

        if (result.confirmed_arrival_at) {
          line(
            content,
            'Confirmed arrival',
            formatTime(result.confirmed_arrival_at)
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
            makeButton('Accept Requested Arrival', () =>
              action(
                'shopdrop_dispatch_provider_schedule_response',
                {
                  p_booking_id: bookingId,
                  p_action: 'accept'
                }
              )
            ),

            makeButton('Decline Appointment', () =>
              action(
                'shopdrop_dispatch_provider_schedule_response',
                {
                  p_booking_id: bookingId,
                  p_action: 'decline'
                }
              )
            )
          );

          const alternative = node('input');
          alternative.type = 'datetime-local';

          content.append(
            node('p', 'Propose another arrival time:'),
            alternative,
            makeButton('Propose Alternative', () => {
              if (!alternative.value) {
                status.textContent =
                  'Select an alternative arrival time.';
                return;
              }

              const timestamp =
                new Date(alternative.value);

              if (
                !Number.isFinite(timestamp.getTime()) ||
                timestamp.getTime() <= Date.now()
              ) {
                status.textContent =
                  'Choose a future arrival time.';
                return;
              }

              action(
                'shopdrop_dispatch_provider_schedule_response',
                {
                  p_booking_id: bookingId,
                  p_action: 'propose',
                  p_alternative_at:
                    timestamp.toISOString()
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
                'shopdrop_dispatch_customer_schedule_response',
                {
                  p_booking_id: bookingId,
                  p_action: 'accept'
                }
              )
            ),

            makeButton('Reject Alternative', () =>
              action(
                'shopdrop_dispatch_customer_schedule_response',
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
              'Arrival time confirmed. Checkout may ' +
              'proceed when the payment integration ' +
              'is activated.'
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

