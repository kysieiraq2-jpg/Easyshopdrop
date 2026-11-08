
// Shop&Drop — Dispatch provider offers.
// South Africa launch; international architecture preserved.
// No payment collection or private customer disclosure.

(function () {
  'use strict';

  const URL =
    'https://dtkdvvxpwonywtsgqmdx.supabase.co';

  const KEY =
    'sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';

  let clientPromise;

  async function getClient() {
    if (!clientPromise) {
      clientPromise = import(
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
        clientPromise = null;
        throw error;
      });
    }

    const client = await clientPromise;

    const { data, error } =
      await client.auth.getSession();

    if (error || !data?.session?.access_token) {
      throw new Error('Please sign in first.');
    }

    const { data: verified, error: authError } =
      await client.auth.getUser(
        data.session.access_token
      );

    if (authError || !verified?.user?.id) {
      throw new Error('Session expired. Sign in again.');
    }

    return client;
  }

  async function getAvailableRequests() {
    const client = await getClient();

    const { data, error } = await client.rpc(
      'shopdrop_get_available_dispatch_requests',
      { p_limit: 25 }
    );

    if (error) {
      throw new Error(
        error.message ||
        'Unable to load available dispatch jobs.'
      );
    }

    return Array.isArray(data) ? data : [];
  }

  async function submitOffer(input) {
    const client = await getClient();

    const amount = Number(input.amount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 999999999
    ) {
      throw new Error('Enter a valid provider price.');
    }

    const currency = String(
      input.currency || ''
    ).trim().toUpperCase();

    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new Error('Invalid currency.');
    }

    const description = String(
      input.description || ''
    ).trim();

    if (!description || description.length > 500) {
      throw new Error(
        'Enter a vehicle description (maximum 500 characters).'
      );
    }

    const { data, error } = await client.rpc(
      'shopdrop_submit_dispatch_offer',
      {
        p_request_id: input.requestId,
        p_vehicle_description: description,
        p_provider_amount: amount,
        p_currency: currency,
        p_valid_until: null
      }
    );

    if (error) {
      throw new Error(
        error.message ||
        'Dispatch offer could not be submitted.'
      );
    }

    return data;
  }

  function el(tag, text) {
    const node = document.createElement(tag);

    if (text != null) {
      node.textContent = String(text);
    }

    return node;
  }

  function detail(container, label, value) {
    if (value == null || value === '') return;

    const p = el('p');
    const strong = el('strong', label + ': ');

    p.append(
      strong,
      document.createTextNode(String(value))
    );

    container.append(p);
  }

  function render(container, jobs) {
    container.replaceChildren();

    if (!jobs.length) {
      container.append(
        el('p', 'No available dispatch jobs at present.')
      );
      return;
    }

    jobs.forEach(job => {
      const card = el('section');
      card.className = 'panel';

      card.append(
        el('h3', 'Dispatch ' +
          (job.request_reference || job.request_id))
      );

      detail(card, 'Vehicle required', job.vehicle_type);
      detail(card, 'Collection area', job.pickup_area);
      detail(card, 'Delivery area', job.dropoff_area);
      detail(card, 'Collection date', job.required_at);
      detail(card, 'Load', job.load_description);
      detail(card, 'Weight', job.approximate_weight);
      detail(card, 'Dimensions', job.approximate_size);

      const descriptionLabel = el(
        'label',
        'Vehicle / service offered'
      );

      const description = el('input');
      description.type = 'text';
      description.maxLength = 500;
      description.required = true;
      description.placeholder = 'Describe your vehicle';

      descriptionLabel.append(description);

      const priceLabel = el(
        'label',
        'Your desired payment amount'
      );

      const price = el('input');
      price.type = 'number';
      price.min = '0.01';
      price.step = '0.01';
      price.required = true;

      priceLabel.append(price);

      const currencyLabel = el(
        'label',
        'Currency'
      );

      const currency = el('input');
      currency.type = 'text';
      currency.maxLength = 3;
      currency.value = 'ZAR';
      currency.required = true;

      currencyLabel.append(currency);

      const button = el(
        'button',
        'Submit transport offer'
      );
      button.type = 'button';

      const status = el('p');
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');

      button.addEventListener('click', async () => {
        button.disabled = true;
        status.textContent = 'Submitting offer securely…';

        try {
          const offerId = await submitOffer({
            requestId: job.request_id,
            description: description.value,
            amount: price.value,
            currency: currency.value
          });

          status.textContent =
            'Offer submitted. Reference: ' +
            offerId +
            '. Awaiting customer acceptance.';

          button.textContent = 'Offer submitted';
        } catch (error) {
          status.textContent =
            error?.message ||
            'Unable to submit offer.';

          button.disabled = false;
        }
      });

      card.append(
        descriptionLabel,
        priceLabel,
        currencyLabel,
        button,
        status
      );

      container.append(card);
    });
  }

  async function load(container) {
    container.replaceChildren(
      el('p', 'Loading available dispatch jobs…')
    );

    try {
      const jobs = await getAvailableRequests();
      render(container, jobs);
    } catch (error) {
      container.replaceChildren(
        el(
          'p',
          error?.message ||
          'Unable to load dispatch jobs.'
        )
      );
    }
  }

  function initialize() {
    const panel = document.getElementById(
      'shopdrop-dispatch-provider-offers'
    );

    if (!panel) return;

    const refresh = el(
      'button',
      'Refresh available dispatch jobs'
    );

    refresh.type = 'button';

    const results = el('div');

    refresh.addEventListener(
      'click',
      () => load(results)
    );

    panel.append(refresh, results);

    load(results);
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

  window.ShopDropDispatchProviderOffers =
    Object.freeze({
      getAvailableRequests,
      submitOffer
    });
})();

