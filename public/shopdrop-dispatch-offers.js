
 // Shop&Drop — Dispatch customer offers integration.
 // Existing dispatch, booking and checkout preserved.
 // Fix160 — secure offer-specific rate selection.
 // No live payments or payouts.
 // Private provider details remain hidden.

(function () {
  'use strict';

  const SUPABASE_URL =
    'https://dtkdvvxpwonywtsgqmdx.supabase.co';

  const SUPABASE_KEY =
    'sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';

  const validUuid = value =>
    typeof value === 'string' &&
    /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
      .test(value);

  const unitNames = {
    hour: 'hour',
    half_day: 'half-day',
    day: 'day',
    night: 'night',
    week: 'week',
    month: 'month',
    kilometre: 'kilometre',
    trip: 'trip',
    load: 'load',
    visit: 'visit',
    job: 'completed job',
    square_metre: 'square metre'
  };

  let clientPromise = null;

  async function getClient() {
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

    const client = await clientPromise;

    const { data, error } =
      await client.auth.getSession();

    if (error || !data?.session?.access_token) {
      throw new Error(
        'Please sign in to view your dispatch offers.'
      );
    }

    const { data: verified, error: authError } =
      await client.auth.getUser(
        data.session.access_token
      );

    if (authError || !verified?.user?.id) {
      throw new Error(
        'Your session has expired. Please sign in again.'
      );
    }

    return client;
  }

  async function getMyOffers(requestId = null) {
    const client = await getClient();

    const { data, error } = await client.rpc(
      'shopdrop_get_my_dispatch_offers',
      { p_request_id: requestId }
    );

    if (error) {
      throw new Error(
        error.message ||
        'Unable to retrieve dispatch offers.'
      );
    }

    const requests = Array.isArray(data)
      ? data
      : [];

    // Retrieve only the vehicle location details
    // associated with this customer's requests.
    // No private provider addresses are exposed.

    const {
      data: locations,
      error: locationError
    } = await client.rpc(
      'shopdrop_get_my_dispatch_offer_locations',
      { p_request_id: requestId }
    );

    if (
      locationError ||
      !Array.isArray(locations)
    ) {
      throw new Error(
        'Vehicle locations are temporarily unavailable. Please try again.'
      );
    }

    const byOffer = new Map(
      locations.map(row => [
        row.offer_id,
        row
      ])
    );

    return requests.map(request => ({
      ...request,
      offers: (
        Array.isArray(request.offers)
          ? request.offers
          : []
      ).map(offer => ({
        ...offer,
        vehicleLocation:
          byOffer.get(offer.offer_id) || null
      }))
    }));
  }

  // Original offer acceptance preserved for
  // existing integrations and compatibility.

  async function acceptOffer(offerId) {
    const client = await getClient();

    const { data, error } = await client.rpc(
      'shopdrop_accept_dispatch_offer',
      { p_offer_id: offerId }
    );

    if (error) {
      throw new Error(
        error.message ||
        'Dispatch offer could not be accepted.'
      );
    }

    return data;
  }

  // Original checkout preparation preserved.

  async function prepareCheckout(bookingId) {
    const adapter =
      window.ShopDropSupabaseAdapter;

    if (
      !adapter?.authenticatedFunctions
        ?.createDispatchCheckout
    ) {
      throw new Error(
        'Secure dispatch checkout is unavailable.'
      );
    }

    return adapter.authenticatedFunctions
      .createDispatchCheckout({
        booking_id: bookingId
      });
  }

  // Fix160 — retrieve rates for this exact offer.

  async function getOfferRates(offerId) {
    if (!validUuid(offerId)) {
      throw new Error('Invalid dispatch offer.');
    }

    const client = await getClient();

    const { data, error } = await client.rpc(
      'shopdrop_get_dispatch_offer_rates_159',
      { p_offer_id: offerId }
    );

    if (error) {
      throw new Error(
        error.message ||
        'Provider rates could not be loaded.'
      );
    }

    return Array.isArray(data) ? data : [];
  }

  // Fix160 — atomic rate validation, offer
  // acceptance and booking-rate binding.

  async function acceptRatedOffer(
    offerId,
    rateId,
    quantity
  ) {
    if (
      !validUuid(offerId) ||
      !validUuid(rateId)
    ) {
      throw new Error(
        'Invalid dispatch offer or rate.'
      );
    }

    if (
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      quantity > 100000
    ) {
      throw new Error(
        'Enter a valid number of units.'
      );
    }

    const client = await getClient();

    const { data, error } = await client.rpc(
      'shopdrop_accept_rated_dispatch_offer_158',
      {
        p_offer_id: offerId,
        p_rate_id: rateId,
        p_quantity: quantity
      }
    );

    if (error) {
      throw new Error(
        error.message ||
        'Rated dispatch offer could not be accepted.'
      );
    }

    if (!validUuid(data)) {
      throw new Error(
        'Secure dispatch booking reference unavailable.'
      );
    }

    return data;
  }

  function createElement(tag, text, className) {
    const el = document.createElement(tag);

    if (text != null) {
      el.textContent = String(text);
    }

    if (className) {
      el.className = className;
    }

    return el;
  }

  function money(amount) {
    const value = Number(amount);

    if (!Number.isFinite(value)) {
      return 'Amount unavailable';
    }

    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(value);
  }

  // Fix160 — controls are attached to the
  // existing offer card, not public adverts.

  async function attachOfferRates(
    card,
    offer,
    button,
    hasLocation
  ) {
    const panel = createElement(
      'div',
      null,
      'shopdrop-dispatch-offer-rates'
    );

    const message = createElement(
      'p',
      'Loading this provider’s rates…'
    );

    message.setAttribute('role', 'status');
    panel.append(message);

    card.insertBefore(panel, button);

    button.disabled = true;

    try {
      const rates = await getOfferRates(
        offer.offer_id
      );

      const valid = rates.filter(rate =>
        validUuid(rate.rate_id) &&
        unitNames[rate.pricing_unit] &&
        Number(rate.price_zar) > 0 &&
        Number(rate.minimum_units) > 0
      );

      if (!valid.length) {
        message.textContent =
          'No selectable rates are available ' +
          'for this offer.';
        return;
      }

      const label = createElement(
        'label',
        'Choose the provider’s offered rate'
      );

      const select = createElement('select');
      select.setAttribute(
        'aria-label',
        'Dispatch provider rate'
      );

      valid.forEach((rate, index) => {
        const option = createElement(
          'option',
          money(rate.price_zar) +
          ' per ' +
          unitNames[rate.pricing_unit]
        );

        option.value = String(index);
        option.dataset.rateId = rate.rate_id;
        select.append(option);
      });

      label.append(select);

      const quantityLabel = createElement(
        'label',
        'Number of units'
      );

      const quantity = createElement('input');
      quantity.type = 'number';
      quantity.min = '1';
      quantity.max = '100000';
      quantity.step = '1';
      quantity.setAttribute(
        'aria-label',
        'Dispatch booking quantity'
      );

      quantityLabel.append(quantity);

      const preview = createElement('p');
      preview.setAttribute(
        'aria-live',
        'polite'
      );

      const schedule = createElement(
        'p',
        null,
        'muted'
      );

      const note = createElement(
        'p',
        'The selected rate and quantity must ' +
        'match the provider’s quoted offer. ' +
        'No payment is collected at this stage.',
        'muted'
      );

      function update() {
        const rate = valid[
          Number(select.value)
        ];

        if (!rate) {
          button.disabled = true;
          return;
        }

        const minimum = Math.max(
          1,
          Math.ceil(
            Number(rate.minimum_units)
          )
        );

        quantity.min = String(minimum);

        const units = Number(quantity.value);

        const cents = Math.round(
          Number(rate.price_zar) * 100
        );

        const offerCents = Math.round(
          Number(offer.provider_amount) * 100
        );

        const amountCents = units * cents;

        const validQuantity =
          Number.isSafeInteger(units) &&
          units >= minimum &&
          units <= 100000 &&
          quantity.checkValidity();

        const amountMatches =
          validQuantity &&
          Number.isSafeInteger(amountCents) &&
          Number.isSafeInteger(offerCents) &&
          amountCents === offerCents;

        if (!validQuantity) {
          preview.textContent =
            'Enter at least ' +
            minimum +
            ' whole unit(s).';
        } else {
          preview.textContent =
            'Selected provider total: ' +
            money(amountCents / 100) +
            '. Quoted offer: ' +
            money(offerCents / 100) +
            (
              amountMatches
                ? '. Amounts match.'
                : '. Amounts do not match.'
            );
        }

        const days = Array.isArray(
          rate.availability_days
        )
          ? rate.availability_days.join(', ')
          : '';

        schedule.textContent =
          (
            days
              ? 'Operating day numbers: ' +
                days + '. '
              : ''
          ) +
          (
            rate.available_from_time &&
            rate.available_until_time
              ? 'Hours: ' +
                String(
                  rate.available_from_time
                ).slice(0, 5) +
                '–' +
                String(
                  rate.available_until_time
                ).slice(0, 5)
              : ''
          ) +
          (
            rate.package_description
              ? '. ' +
                rate.package_description
              : ''
          );

        button.disabled =
          !hasLocation ||
          !amountMatches;
      }

      select.addEventListener(
        'change',
        () => {
          const rate = valid[
            Number(select.value)
          ];

          quantity.value = String(
            Math.max(
              1,
              Math.ceil(
                Number(rate.minimum_units)
              )
            )
          );

          update();
        }
      );

      quantity.addEventListener(
        'input',
        update
      );

      panel.replaceChildren(
        label,
        quantityLabel,
        schedule,
        preview,
        note
      );

      card.dataset.ratedOfferReady = 'true';

      // The button reads these same controls
      // at the moment of acceptance.
      card.shopdropRateSelection = () => {
        const rate = valid[
          Number(select.value)
        ];

        const units = Number(quantity.value);

        if (
          !rate ||
          !validUuid(rate.rate_id) ||
          !Number.isSafeInteger(units) ||
          !quantity.checkValidity()
        ) {
          throw new Error(
            'Choose a valid provider rate and quantity.'
          );
        }

        const selectedCents =
          Math.round(
            Number(rate.price_zar) * 100
          ) * units;

        const offeredCents =
          Math.round(
            Number(offer.provider_amount) * 100
          );

        if (
          !Number.isSafeInteger(selectedCents) ||
          selectedCents !== offeredCents
        ) {
          throw new Error(
            'Selected rate does not match the provider’s offer.'
          );
        }

        return {
          rateId: rate.rate_id,
          quantity: units
        };
      };

      select.dispatchEvent(
        new Event('change')
      );

    } catch (error) {
      message.textContent =
        error?.message ||
        'Provider rates unavailable.';

      button.disabled = true;
    }
  }

  function renderOffers(container, requests) {
    container.replaceChildren();

    if (!requests.length) {
      container.append(
        createElement(
          'p',
          'No dispatch requests found.'
        )
      );
      return;
    }

    requests.forEach(request => {
      const section = createElement(
        'section',
        null,
        'panel'
      );

      section.append(
        createElement(
          'h3',
          'Dispatch request: ' +
          (
            request.request_reference ||
            request.request_id
          )
        )
      );

      section.append(
        createElement(
          'p',
          'Request status: ' +
          request.request_status
        )
      );

      const offers = Array.isArray(
        request.offers
      )
        ? request.offers
        : [];

      if (!offers.length) {
        section.append(
          createElement(
            'p',
            'No eligible provider offers available yet.'
          )
        );
      }

      const offerGrid = createElement(
        'div',
        null,
        'shopdrop-dispatch-offer-grid'
      );

      offers.forEach(offer => {
        const card = createElement(
          'div',
          null,
          'panel'
        );

        card.dataset.shopdropOfferId =
          offer.offer_id;

        card.append(
          createElement(
            'p',
            offer.vehicle_description ||
              'Dispatch transport offer'
          )
        );

        card.append(
          createElement(
            'p',
            'Provider amount: ' +
            offer.provider_amount +
            ' ' +
            offer.currency
          )
        );

        // Preserve public location and
        // operating coverage checks.

        const loc = offer.vehicleLocation;

        const hasLocation = Boolean(
          loc &&
          loc.vehicle_base_town &&
          loc.vehicle_base_province &&
          [
            'local',
            'selected',
            'nationwide'
          ].includes(
            loc.vehicle_coverage_mode
          )
        );

        const locationHeading = createElement(
          'p',
          hasLocation
            ? 'Vehicle based in: ' +
              loc.vehicle_base_town +
              ', ' +
              loc.vehicle_base_province
            : 'Vehicle base location not available'
        );

        card.append(locationHeading);

        if (hasLocation) {
          const coverageLabels = {
            local:
              'Base town and listed surrounding areas',
            selected:
              'Selected towns or provinces',
            nationwide:
              'Anywhere in South Africa'
          };

          card.append(
            createElement(
              'p',
              'Operating area: ' +
              coverageLabels[
                loc.vehicle_coverage_mode
              ]
            )
          );

          if (
            loc.vehicle_coverage_mode !==
              'nationwide' &&
            Array.isArray(
              loc.vehicle_covered_areas
            ) &&
            loc.vehicle_covered_areas.length
          ) {
            card.append(
              createElement(
                'p',
                'Additional areas: ' +
                loc.vehicle_covered_areas.join(', ')
              )
            );
          }

          card.append(
            createElement(
              'p',
              'Confirm any travel or vehicle ' +
              'repositioning charges in the ' +
              'offered total before booking.'
            )
          );
        } else {
          card.append(
            createElement(
              'p',
              'This offer cannot be accepted ' +
              'until its vehicle location and ' +
              'service coverage are recorded.'
            )
          );
        }

        const button = createElement(
          'button',
          'Accept offer and prepare checkout'
        );

        button.type = 'button';

        // Preserve location safeguard.
        // Fix160 also requires valid rate selection.
        button.disabled = true;

        const status = createElement('p');

        status.setAttribute(
          'role',
          'status'
        );

        status.setAttribute(
          'aria-live',
          'polite'
        );

        button.addEventListener(
          'click',
          async function () {
            button.disabled = true;

            try {
              if (!hasLocation) {
                throw new Error(
                  'Verified vehicle location is required.'
                );
              }

              if (
                typeof card.shopdropRateSelection !==
                'function'
              ) {
                throw new Error(
                  'Choose an available provider rate first.'
                );
              }

              const selection =
                card.shopdropRateSelection();

              status.textContent =
                'Validating and accepting dispatch offer…';

              const bookingId =
                await acceptRatedOffer(
                  offer.offer_id,
                  selection.rateId,
                  selection.quantity
                );

              status.textContent =
                'Preparing secure checkout…';

              const checkout =
                await prepareCheckout(
                  bookingId
                );

              status.textContent =
                'Booking reference: ' +
                bookingId +
                '. Checkout reference: ' +
                checkout.checkout_reference +
                '. Expected total: ' +
                checkout.expected_amount +
                ' ' +
                checkout.currency +
                '. Payment provider not activated.';

              button.textContent =
                'Offer accepted';

            } catch (error) {
              status.textContent =
                error?.message ||
                'Unable to prepare checkout.';
            } finally {
              // Preserve the ability to retry
              // after an unsuccessful request.
              button.disabled = false;
            }
          }
        );

        card.append(
          button,
          status
        );

        offerGrid.append(card);

        // Add rates without replacing the
        // existing offer card or checkout.
        attachOfferRates(
          card,
          offer,
          button,
          hasLocation
        );
      });

      section.append(offerGrid);
      container.append(section);
    });
  }

  async function loadOffers(container) {
    container.replaceChildren(
      createElement(
        'p',
        'Loading your dispatch offers…'
      )
    );

    try {
      const requests =
        await getMyOffers();

      renderOffers(
        container,
        requests
      );
    } catch (error) {
      container.replaceChildren(
        createElement(
          'p',
          error?.message ||
          'Unable to load dispatch offers.'
        )
      );
    }
  }

  function initialize() {
    const container =
      document.getElementById(
        'shopdrop-dispatch-offers'
      );

    if (!container) return;

    const refresh = createElement(
      'button',
      'Refresh my dispatch offers'
    );

    refresh.type = 'button';

    const results = createElement('div');

    refresh.addEventListener(
      'click',
      () => loadOffers(results)
    );

    container.append(
      refresh,
      results
    );

    loadOffers(results);
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

  // Preserve original public methods.
  // Add rated-offer methods without removing them.

  window.ShopDropDispatchOffers =
    Object.freeze({
      getMyOffers,
      acceptOffer,
      prepareCheckout,
      getOfferRates,
      acceptRatedOffer
    });
})();
