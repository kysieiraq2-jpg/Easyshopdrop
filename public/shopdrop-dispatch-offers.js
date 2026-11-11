
 // Shop&Drop — Dispatch customer offers integration.
 // Additive location and coverage improvement.
 // Existing dispatch, booking and checkout logic preserved.
 // No live payments or payouts.
 // Provider identity and private contact details remain hidden.

(function () {
  'use strict';

  const SUPABASE_URL =
    'https://dtkdvvxpwonywtsgqmdx.supabase.co';

  const SUPABASE_KEY =
    'sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';

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

    const requests = Array.isArray(data) ? data : [];

    // Retrieve only the vehicle location details associated
    // with this customer's own dispatch requests.
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

      const offers = Array.isArray(request.offers)
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

      offers.forEach(offer => {
        const card = createElement(
          'div',
          null,
          'panel'
        );

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

        // Show the vehicle's publicly declared
        // operating base and service coverage.

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
                loc.vehicle_covered_areas
                  .join(', ')
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

        // Prevent accepting an offer that does
        // not yet contain verified location fields.
        button.disabled = !hasLocation;

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
              status.textContent =
                'Accepting dispatch offer…';

              const bookingId =
                await acceptOffer(
                  offer.offer_id
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
              button.disabled = false;
            }
          }
        );

        card.append(
          button,
          status
        );

        section.append(card);
      });

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

    const results =
      createElement('div');

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

  window.ShopDropDispatchOffers =
    Object.freeze({
      getMyOffers,
      acceptOffer,
      prepareCheckout
    });
})();
