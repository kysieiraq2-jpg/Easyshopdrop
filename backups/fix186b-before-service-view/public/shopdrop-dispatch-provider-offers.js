
 // Shop&Drop — Dispatch provider offers.
 // South Africa first; international architecture preserved.
 // Vehicle base location and operating coverage integration.
 // No payment collection, payouts or private contact disclosure.

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

    const baseTown = String(input.baseTown || '').trim();
    const baseProvince = String(input.baseProvince || '').trim();
    const coverageMode = String(input.coverageMode || '').trim();

    const areas = String(input.coveredAreas || '')
      .split(',')
      .map(x => x.trim())
      .filter(Boolean);

    if (
      baseTown.length < 2 ||
      baseTown.length > 120 ||
      baseProvince.length < 2 ||
      baseProvince.length > 120
    ) {
      throw new Error(
        'Enter the vehicle base town and province.'
      );
    }

    if (
      !['local', 'selected', 'nationwide']
        .includes(coverageMode)
    ) {
      throw new Error(
        'Choose where the vehicle can operate.'
      );
    }

    if (
      coverageMode === 'selected' &&
      areas.length === 0
    ) {
      throw new Error(
        'Enter the towns or provinces you cover.'
      );
    }

    if (
      areas.length > 30 ||
      areas.some(x => x.length < 2 || x.length > 120)
    ) {
      throw new Error(
        'Enter up to 30 valid service areas.'
      );
    }

    // Existing dispatch submission remains authoritative.
    // New backend wrapper checks coverage before creating the offer.
    const { data, error } = await client.rpc(
      'shopdrop_submit_dispatch_located_offer',
      {
        p_request_id: input.requestId,
        p_vehicle_description: description,
        p_provider_amount: amount,
        p_currency: currency,
        p_base_town: baseTown,
        p_base_province: baseProvince,
        p_coverage_mode: coverageMode,
        p_covered_areas:
          coverageMode === 'nationwide' ? [] : areas
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
        el(
          'h3',
          'Dispatch ' +
          (job.request_reference || job.request_id)
        )
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

      // Vehicle location is the operating base.
      // Exact private street addresses are not requested here.
      const baseTownLabel = el(
        'label',
        'Vehicle based in — town'
      );

      const baseTown = el('input');
      baseTown.type = 'text';
      baseTown.maxLength = 120;
      baseTown.required = true;
      baseTown.placeholder = 'e.g. Pretoria';

      baseTownLabel.append(baseTown);

      const baseProvinceLabel = el(
        'label',
        'Vehicle based in — province'
      );

      const baseProvince = el('select');
      baseProvince.required = true;

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
        const option = el(
          'option',
          name || 'Choose province'
        );

        option.value = name;
        baseProvince.append(option);
      }

      baseProvinceLabel.append(baseProvince);

      const coverageLabel = el(
        'label',
        'Where can this vehicle operate?'
      );

      const coverageMode = el('select');

      for (const [value, name] of [
        ['local', 'Base town and surrounding areas'],
        ['selected', 'Selected towns or provinces'],
        ['nationwide', 'Anywhere in South Africa']
      ]) {
        const option = el('option', name);
        option.value = value;
        coverageMode.append(option);
      }

      coverageLabel.append(coverageMode);

      const areasLabel = el(
        'label',
        'Additional towns or provinces (comma-separated)'
      );

      const areas = el('input');
      areas.type = 'text';
      areas.placeholder = 'e.g. Centurion, Midrand';
      areas.maxLength = 1500;

      areasLabel.append(areas);

      const help = el(
        'p',
        'Only public town/province information is shown. ' +
        'Use local for your base town, or add surrounding towns. ' +
        'Nationwide providers may quote travel costs in their offer.'
      );

      help.className = 'muted';

      coverageMode.addEventListener(
        'change',
        () => {
          areasLabel.hidden =
            coverageMode.value === 'nationwide';
        }
      );

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

        status.textContent =
          'Submitting offer securely…';

        try {
          const offerId = await submitOffer({
            requestId: job.request_id,
            description: description.value,
            amount: price.value,
            currency: currency.value,
            baseTown: baseTown.value,
            baseProvince: baseProvince.value,
            coverageMode: coverageMode.value,
            coveredAreas: areas.value
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
        baseTownLabel,
        baseProvinceLabel,
        coverageLabel,
        areasLabel,
        help,
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
