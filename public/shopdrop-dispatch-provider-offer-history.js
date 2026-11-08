
// Shop&Drop — Provider dispatch offer history.
// Additive integration: preserves all existing functions.
// Country-neutral and international-ready.
// No payment activation or customer contact disclosure.

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
      await client.auth.getUser();

    if (error || !data?.user?.id) {
      throw new Error(
        'Please sign in to view your dispatch offers.'
      );
    }

    return client;
  }

  async function getMyOffers() {
    const client = await getClient();

    const { data, error } = await client.rpc(
      'shopdrop_get_my_dispatch_provider_offers',
      { p_limit: 50 }
    );

    if (error) {
      throw new Error(
        error.message ||
        'Unable to retrieve your dispatch offers.'
      );
    }

    if (!Array.isArray(data)) {
      throw new Error(
        'Unexpected dispatch offer response.'
      );
    }

    return data;
  }

  function element(tag, value) {
    const node = document.createElement(tag);

    if (value !== undefined && value !== null) {
      node.textContent = String(value);
    }

    return node;
  }

  function field(parent, label, value) {
    if (value === undefined ||
        value === null ||
        value === '') {
      return;
    }

    const paragraph = element('p');
    const heading = element('strong', label + ': ');

    paragraph.append(
      heading,
      document.createTextNode(String(value))
    );

    parent.append(paragraph);
  }

  function dateText(value) {
    if (!value) return 'Not specified';

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleString();
  }

  function money(amount, currency) {
    const value = Number(amount);
    const code = String(currency || '')
      .trim()
      .toUpperCase();

    if (!Number.isFinite(value)) {
      return 'Amount unavailable';
    }

    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: code
      }).format(value);
    } catch {
      return code + ' ' + value.toFixed(2);
    }
  }

  function render(container, offers) {
    container.replaceChildren();

    if (offers.length === 0) {
      container.append(
        element('p', 'You have no submitted dispatch offers.')
      );
      return;
    }

    offers.forEach(offer => {
      const card = element('article');
      card.className = 'panel';

      const heading = element(
        'h3',
        'Dispatch ' +
        (offer.request_reference || offer.request_id)
      );

      card.append(heading);

      field(
        card,
        'Offer reference',
        offer.offer_id
      );

      field(
        card,
        'Vehicle required',
        offer.vehicle_type
      );

      field(
        card,
        'Collection area',
        offer.pickup_area
      );

      field(
        card,
        'Delivery area',
        offer.dropoff_area
      );

      field(
        card,
        'Required date',
        dateText(offer.required_at)
      );

      field(
        card,
        'Vehicle offered',
        offer.vehicle_description
      );

      field(
        card,
        'Your offered amount',
        money(
          offer.provider_amount,
          offer.currency
        )
      );

      field(
        card,
        'Offer status',
        offer.offer_status
      );

      field(
        card,
        'Offer expiry',
        offer.valid_until
          ? dateText(offer.valid_until)
          : 'No expiry specified'
      );

      field(
        card,
        'Submitted',
        dateText(offer.created_at)
      );

      if (offer.booking_id) {
        field(
          card,
          'Booking reference',
          offer.booking_id
        );

        field(
          card,
          'Booking status',
          offer.booking_status
        );

        field(
          card,
          'Payment status',
          offer.payment_status
        );
      } else {
        field(
          card,
          'Booking',
          'Not yet booked'
        );
      }

      container.append(card);
    });
  }

  async function load(container, refreshButton) {
    refreshButton.disabled = true;

    container.replaceChildren(
      element('p', 'Loading your submitted offers…')
    );

    try {
      const offers = await getMyOffers();
      render(container, offers);
    } catch (error) {
      container.replaceChildren(
        element(
          'p',
          error?.message ||
          'Unable to load dispatch offers.'
        )
      );
    } finally {
      refreshButton.disabled = false;
    }
  }

  function initialize() {
    const panel = document.getElementById(
      'shopdrop-dispatch-provider-offer-history'
    );

    if (!panel) return;

    if (panel.dataset.shopdropInitialized === 'true') {
      return;
    }

    panel.dataset.shopdropInitialized = 'true';

    const refreshButton = element(
      'button',
      'Refresh my submitted offers'
    );

    refreshButton.type = 'button';

    const results = element('div');
    results.setAttribute('role', 'status');
    results.setAttribute('aria-live', 'polite');

    refreshButton.addEventListener(
      'click',
      () => load(results, refreshButton)
    );

    panel.append(refreshButton, results);

    load(results, refreshButton);
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

  window.ShopDropDispatchProviderOfferHistory =
    Object.freeze({
      getMyOffers
    });
})();

