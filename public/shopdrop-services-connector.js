
// Shop&Drop Phase 6C — Other Services connector.
// Preserves approved public service listings.
// Adds authenticated service booking preparation.
// No live payments, payouts or provider activation.

(function () {
  'use strict';

  const url =
    'https://dtkdvvxpwonywtsgqmdx.supabase.co';

  const key =
    'sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';

  // Existing approved-service search preserved.
  async function search(term) {
    const query = new URLSearchParams();

    query.set(
      'select',
      'id,title,description,category,subcategory,pricing_unit,price,currency,country_code,location,listing_status'
    );

    // Only approved listings are requested.
    // Supabase RLS remains authoritative.
    query.set('listing_status', 'eq.approved');
    query.set('order', 'created_at.desc');
    query.set('limit', '50');

    const response = await fetch(
      url + '/rest/v1/services?' + query,
      {
        headers: {
          apikey: key,
          Accept: 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        'Cannot load approved services (HTTP ' +
        response.status + ').'
      );
    }

    const rows = await response.json();

    if (!Array.isArray(rows)) {
      throw new Error('Unexpected services response.');
    }

    const needle = String(term || '')
      .trim()
      .toLocaleLowerCase();

    return rows
      .filter(row =>
        !needle ||
        [
          row.title,
          row.description,
          row.category,
          row.subcategory,
          row.location
        ].some(value =>
          String(value || '')
            .toLocaleLowerCase()
            .includes(needle)
        )
      )
      .map(row => ({
        id: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        pricing_unit: row.pricing_unit || 'service',
        unit_price_cents:
          Math.round(Number(row.price || 0) * 100),
        currency_code: row.currency || 'ZAR',
        minimum_units: 1,
        service_area:
          row.location ||
          row.country_code ||
          'Location not specified'
      }));
  }

  // Secure booking preparation.
  // Uses the existing Supabase booking RPC.
  // No payment session or charge is created.

  let clientPromise = null;

  async function authenticatedClient() {
    if (!clientPromise) {
      clientPromise = import(
        'https://esm.sh/@supabase/supabase-js@2'
      ).then(({ createClient }) =>
        createClient(url, key, {
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
        'Please sign in before booking a service.'
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

  function validUuid(value) {
    return typeof value === 'string' &&
      /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
        .test(value);
  }

  function validDate(value) {
    if (value == null || value === '') return true;

    if (
      typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) return false;

    const d = new Date(value + 'T00:00:00Z');

    return !Number.isNaN(d.getTime()) &&
      d.toISOString().slice(0, 10) === value;
  }

  function validTime(value) {
    return value == null ||
      value === '' ||
      (
        typeof value === 'string' &&
        /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/
          .test(value)
      );
  }

  async function createBooking({
    serviceId,
    requestId,
    bookingDate = null,
    bookingTime = null
  } = {}) {
    if (!validUuid(serviceId)) {
      throw new Error('Invalid service reference.');
    }

    if (!validUuid(requestId)) {
      throw new Error(
        'A valid booking request reference is required.'
      );
    }

    if (!validDate(bookingDate)) {
      throw new Error('Invalid booking date.');
    }

    if (!validTime(bookingTime)) {
      throw new Error('Invalid booking time.');
    }

    const client = await authenticatedClient();

    const { data, error } = await client.rpc(
      'shopdrop_create_service_booking',
      {
        p_service_id: serviceId,
        p_request_id: requestId,
        p_booking_date: bookingDate || null,
        p_booking_time: bookingTime || null
      }
    );

    if (error) {
      throw new Error(
        error.message ||
        'Secure service booking could not be created.'
      );
    }

    if (!validUuid(data)) {
      throw new Error(
        'Booking reference was not returned.'
      );
    }

    return Object.freeze({
      ok: true,
      booking_id: data,
      service_id: serviceId,
      request_id: requestId,
      payment_status: 'pending',
      payment_provider_status: 'not_activated',
      payment_collected: false
    });
  }

  window.ShopDropServicesConnector = Object.freeze({
    search,
    createBooking
  });
})();
