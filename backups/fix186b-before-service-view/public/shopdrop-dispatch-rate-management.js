

/*
 Shop&Drop Fix171
 Dispatching provider rate management.
 Additive file: does not change advertisement,
 photograph, checkout or payment functions.
*/
(() => {
  'use strict';

  const URL =
    'https://dtkdvvxpwonywtsgqmdx.supabase.co';

  const KEY =
    'sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';

  let clientPromise;

  function element(tag, text) {
    const node = document.createElement(tag);
    if (text !== undefined) {
      node.textContent = String(text);
    }
    return node;
  }

  async function getClient() {
    if (!clientPromise) {
      clientPromise = import(
        'https://esm.sh/@supabase/supabase-js@2'
      ).then(({createClient}) =>
        createClient(URL, KEY, {
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

    const client = await clientPromise;

    const {data, error} =
      await client.auth.getUser();

    if (error || !data?.user?.id) {
      throw Error(
        'Please sign in to manage your rates.'
      );
    }

    return client;
  }

  async function getRates() {
    const client = await getClient();

    const {data, error} = await client.rpc(
      'shopdrop_get_my_dispatch_rates_170'
    );

    if (error) {
      throw Error(
        error.message ||
        'Could not retrieve your rates.'
      );
    }

    return Array.isArray(data) ? data : [];
  }

  async function retireRate(rateId) {
    const client = await getClient();

    const {data, error} = await client.rpc(
      'shopdrop_retire_dispatch_rate_169',
      {p_rate_id: rateId}
    );

    if (error || data !== true) {
      throw Error(
        error?.message ||
        'Could not retire this rate.'
      );
    }

    return true;
  }

  function money(value) {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(Number(value));
  }

  function initialize() {
    const main = document.querySelector('main');
    if (!main) return;

    if (document.getElementById(
      'shopdrop-dispatch-rate-manager'
    )) return;

    const section = element('section');
    section.id = 'shopdrop-dispatch-rate-manager';

    const heading = element(
      'h2',
      'Manage my existing Dispatching rates'
    );

    const explanation = element(
      'p',
      'Retire an old rate when you introduce a ' +
      'replacement. Existing booking references ' +
      'are preserved. Retired rates cannot be ' +
      'selected for new bookings.'
    );

    const refresh = element(
      'button',
      'Refresh my rates'
    );
    refresh.type = 'button';

    const status = element('p');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    const results = element('div');

    section.append(
      heading,
      explanation,
      refresh,
      status,
      results
    );

    main.append(section);

    async function load() {
      refresh.disabled = true;
      status.textContent = 'Loading your rates...';
      results.replaceChildren();

      try {
        const rates = await getRates();

        status.textContent = rates.length
          ? rates.length + ' rate(s) found.'
          : 'No existing Dispatching rates found.';

        for (const rate of rates) {
          const card = element('article');
          card.style.border = '1px solid #cbd5e1';
          card.style.borderRadius = '8px';
          card.style.padding = '12px';
          card.style.margin = '12px 0';

          card.append(
            element(
              'h3',
              rate.vehicle_title ||
              'Dispatching advertisement'
            ),
            element(
              'p',
              'Rate: ' +
              money(rate.price_zar) +
              ' per ' +
              rate.pricing_unit
            ),
            element(
              'p',
              'Advertisement: ' +
              rate.listing_status
            ),
            element(
              'p',
              rate.retired_at
                ? 'Status: Retired'
                : 'Status: Available'
            )
          );

          if (rate.used_in_booking) {
            card.append(
              element(
                'p',
                'This rate has booking history. ' +
                'Retirement preserves those references.'
              )
            );
          }

          if (!rate.retired_at) {
            const button = element(
              'button',
              'Retire this rate'
            );
            button.type = 'button';

            const feedback = element('p');
            feedback.setAttribute(
              'role',
              'status'
            );

            button.addEventListener(
              'click',
              async () => {
                const confirmed = window.confirm(
                  'Retire this rate from future ' +
                  'Dispatching bookings? Existing ' +
                  'booking records will be preserved.'
                );

                if (!confirmed) return;

                button.disabled = true;

                try {
                  await retireRate(rate.rate_id);

                  feedback.textContent =
                    'Rate retired successfully.';

                  button.remove();
                  await load();
                } catch (error) {
                  feedback.textContent =
                    error?.message ||
                    'Retirement failed.';

                  button.disabled = false;
                }
              }
            );

            card.append(button, feedback);
          }

          results.append(card);
        }
      } catch (error) {
        status.textContent =
          error?.message ||
          'Unable to load Dispatching rates.';
      } finally {
        refresh.disabled = false;
      }
    }

    refresh.addEventListener('click', load);
    load();
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

  window.ShopDropDispatchRateManagement =
    Object.freeze({
      getRates,
      retireRate
    });
})();
