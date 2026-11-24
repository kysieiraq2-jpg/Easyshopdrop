
// Shop&Drop — Assigned dispatch provider job details.
// South Africa first; worldwide-compatible.
// No live payments, payouts or public contact disclosure.

(function () {
  'use strict';

  const URL =
    'https://dtkdvvxpwonywtsgqmdx.supabase.co';

  const KEY =
    'sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';

  const UUID =
    /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

  let clientPromise;

  async function client() {
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

    const db = await clientPromise;

    const { data, error } =
      await db.auth.getSession();

    if (error || !data?.session?.access_token) {
      throw new Error('Please sign in first.');
    }

    const { data: verified, error: authError } =
      await db.auth.getUser(
        data.session.access_token
      );

    if (authError || !verified?.user?.id) {
      throw new Error('Your session has expired.');
    }

    return db;
  }

  async function getJobDetails(bookingId) {
    if (!UUID.test(String(bookingId || ''))) {
      throw new Error('Enter a valid booking ID.');
    }

    const db = await client();

    const { data, error } = await db.rpc(
      'shopdrop_get_assigned_dispatch_job_details',
      { p_booking_id: bookingId }
    );

    if (error) {
      throw new Error(
        'Job details are unavailable. Check that ' +
        'you are the assigned provider and the ' +
        'booking payment is confirmed.'
      );
    }

    if (!data || typeof data !== 'object') {
      throw new Error('No authorized job details found.');
    }

    return data;
  }

  function element(tag, value) {
    const el = document.createElement(tag);

    if (value != null) {
      el.textContent = String(value);
    }

    return el;
  }

  function addDetail(container, label, value) {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) return;

    const row = element('p');
    const strong = element('strong', label + ': ');

    row.append(strong, document.createTextNode(
      String(value)
    ));

    container.append(row);
  }

  function showJob(container, job) {
    container.replaceChildren();

    container.append(
      element('h3', 'Authorized dispatch job')
    );

    addDetail(container, 'Booking ID', job.booking_id);
    addDetail(container, 'Vehicle', job.vehicle_type);
    addDetail(container, 'Load', job.load_description);
    addDetail(container, 'Collection time', job.required_at);
    addDetail(
      container,
      'Delivery deadline',
      job.delivery_required_at
    );

    container.append(
      element('h4', 'Collection')
    );

    addDetail(container, 'Area', job.pickup_area);
    addDetail(container, 'Province', job.pickup_province);
    addDetail(container, 'Town', job.pickup_town);
    addDetail(container, 'Street address', job.pickup_address);
    addDetail(container, 'Site', job.pickup_site_name);
    addDetail(container, 'Contact', job.pickup_contact_name);
    addDetail(
      container,
      'Contact mobile',
      job.pickup_contact_mobile
    );

    if (
      job.pickup_gps_lat != null &&
      job.pickup_gps_lon != null
    ) {
      addDetail(
        container,
        'GPS',
        job.pickup_gps_lat + ', ' +
        job.pickup_gps_lon
      );
    }

    container.append(
      element('h4', 'Delivery')
    );

    addDetail(container, 'Area', job.dropoff_area);
    addDetail(container, 'Province', job.dropoff_province);
    addDetail(container, 'Town', job.dropoff_town);
    addDetail(container, 'Street address', job.dropoff_address);
    addDetail(container, 'Site', job.dropoff_site_name);
    addDetail(container, 'Contact', job.dropoff_contact_name);
    addDetail(
      container,
      'Contact mobile',
      job.dropoff_contact_mobile
    );

    if (
      job.dropoff_gps_lat != null &&
      job.dropoff_gps_lon != null
    ) {
      addDetail(
        container,
        'GPS',
        job.dropoff_gps_lat + ', ' +
        job.dropoff_gps_lon
      );
    }

    container.append(
      element('h4', 'Job instructions')
    );

    addDetail(
      container,
      'Loading',
      job.loading_instructions
    );

    addDetail(
      container,
      'Unloading',
      job.unloading_instructions
    );

    addDetail(
      container,
      'Site access',
      job.site_access_instructions
    );

    addDetail(
      container,
      'Special requirements',
      job.special_requirements
    );

    container.append(
      element(
        'p',
        'All payments must remain within Shop&Drop.'
      )
    );
  }

  function initialize() {
    const container = document.getElementById(
      'shopdrop-provider-dispatch-job'
    );

    if (!container) return;

    const label = element(
      'label',
      'Assigned dispatch booking ID'
    );

    const input = element('input');
    input.type = 'text';
    input.placeholder = 'Booking ID';
    input.autocomplete = 'off';
    input.spellcheck = false;

    const button = element(
      'button',
      'View my assigned job'
    );

    button.type = 'button';

    const status = element('p');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    const details = element('div');

    label.append(input);
    container.append(
      label,
      button,
      status,
      details
    );

    button.addEventListener(
      'click',
      async function () {
        details.replaceChildren();
        button.disabled = true;
        status.textContent =
          'Checking provider authorization…';

        try {
          const job = await getJobDetails(
            input.value.trim()
          );

          showJob(details, job);

          status.textContent =
            'Authorized job details loaded.';
        } catch (error) {
          status.textContent =
            error?.message ||
            'Unable to load job details.';
        } finally {
          button.disabled = false;
        }
      }
    );
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

  window.ShopDropDispatchProviderJob =
    Object.freeze({
      getJobDetails
    });
})();

