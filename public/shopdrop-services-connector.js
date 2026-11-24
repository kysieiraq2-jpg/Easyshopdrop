
 // Shop&Drop Phase 6C — Other Services connector.
 // Approved public listings and service-area matching.
 // Existing authenticated booking safeguards preserved.
 // Fix142: additive rated-service booking.
 // No live payments, payouts or provider activation.

(function () {
  'use strict';

  const url =
    'https://dtkdvvxpwonywtsgqmdx.supabase.co';

  const key =
    'sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';

  // Public location helpers.
  // Never expose private provider addresses.

  function normalized(value) {
    return String(value || '')
      .trim()
      .toLocaleLowerCase();
  }

  function coversCustomerArea(row, town, province) {
    if (!normalized(town)) return true;

    if (
      !row.base_town ||
      !row.base_province ||
      !row.coverage_mode
    ) {
      return false;
    }

    if (row.coverage_mode === 'nationwide') {
      return true;
    }

    const baseMatches =
      normalized(row.base_town) === normalized(town) &&
      (
        !normalized(province) ||
        normalized(row.base_province) ===
          normalized(province)
      );

    if (baseMatches) return true;

    const extras = Array.isArray(row.covered_areas)
      ? row.covered_areas.map(normalized)
      : [];

    return (
      extras.includes(normalized(town)) ||
      (
        row.coverage_mode === 'selected' &&
        Boolean(normalized(province)) &&
        extras.includes(normalized(province))
      )
    );
  }

  function describeCoverage(row) {
    const base =
      row.base_town && row.base_province
        ? row.base_town + ', ' + row.base_province
        : row.location || 'Base town not supplied';

    const names = {
      local: 'Local and listed nearby towns',
      selected: 'Selected towns or provinces',
      nationwide: 'Anywhere in South Africa'
    };

    const coverage =
      names[row.coverage_mode] ||
      'Coverage not specified';

    const extras =
      row.coverage_mode !== 'nationwide' &&
      Array.isArray(row.covered_areas)
        ? row.covered_areas.filter(Boolean)
        : [];

    return (
      'Based in: ' + base +
      ' · Operating area: ' + coverage +
      (
        extras.length
          ? ' (' + extras.join(', ') + ')'
          : ''
      )
    );
  }

  // Approved-service search.
  // Uses the customer's selected town and province.
  // Supabase RLS remains authoritative.

  async function search(term, location = {}, filters = {}) {
    const query = new URLSearchParams();

    query.set(
      'select',
      'id,title,description,category,subcategory,' +
      'pricing_unit,price,currency,country_code,' +
      'location,listing_status,base_town,' +
      'base_province,coverage_mode,covered_areas,' +
      'minimum_booking_units,service_photo_url'
    );

    query.set('listing_status', 'eq.approved');
    query.set('order', 'created_at.desc,id.asc');
    query.set('limit', '50');
    if (filters.category) query.set('category', 'eq.' + filters.category);
    if (filters.subcategory) query.set('subcategory', 'eq.' + filters.subcategory);

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
      throw new Error(
        'Unexpected services response.'
      );
    }

    const needle = normalized(term);

    // Read the location selected in the existing
    // customer service booking interface.

    const town = String(
      location?.town ??
      document.getElementById(
        'shopdropBuyerTown'
      )?.value ??
      ''
    ).trim();

    const province = String(
      location?.province ??
      document.getElementById(
        'shopdropBuyerProvince'
      )?.value ??
      ''
    ).trim();

    return rows
      .filter(row =>
        (
          !needle ||
          [
            row.title,
            row.description,
            row.category,
            row.subcategory,
            row.location,
            row.base_town,
            row.base_province,
            ...(
              Array.isArray(row.covered_areas)
                ? row.covered_areas
                : []
            )
          ].some(value =>
            normalized(value).includes(needle)
          )
        ) &&
        coversCustomerArea(
          row,
          town,
          province
        )
      )
      .map(row => {
        const providerCents = Math.round(
          Number(row.price || 0) * 100
        );

        const rate =
          Number(row.price || 0) < 1000
            ? 0.10
            : 0.07;

        const feeCents = Math.round(
          providerCents * rate
        );

        return {
          id: row.id,
          photo_url: row.service_photo_url || null,
          title: row.title,
          description: row.description,
          category: row.category,
          subcategory: row.subcategory,

          pricing_unit:
            row.pricing_unit || 'service',

          provider_amount_cents:
            providerCents,

          shopdrop_fee_cents:
            feeCents,

          // Existing customer display preserved.
          // Backend calculation remains authoritative.
          unit_price_cents:
            providerCents + feeCents,

          currency_code:
            row.currency || 'ZAR',

          minimum_units:
            Number(row.minimum_booking_units) > 0
              ? Number(row.minimum_booking_units)
              : 1,

          base_town:
            row.base_town || null,

          base_province:
            row.base_province || null,

          coverage_mode:
            row.coverage_mode || null,

          covered_areas:
            row.covered_areas || [],

          service_area:
            describeCoverage(row)
        };
      });
  }

  // Original secure booking preparation.
  // Preserved for compatibility.
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

    if (
      error ||
      !data?.session?.access_token
    ) {
      throw new Error(
        'Please sign in before booking a service.'
      );
    }

    const {
      data: verified,
      error: authError
    } = await client.auth.getUser(
      data.session.access_token
    );

    if (
      authError ||
      !verified?.user?.id
    ) {
      throw new Error(
        'Your session has expired. Please sign in again.'
      );
    }

    return client;
  }

  function validUuid(value) {
    return (
      typeof value === 'string' &&
      /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
        .test(value)
    );
  }

  function validDate(value) {
    if (
      value == null ||
      value === ''
    ) {
      return true;
    }

    if (
      typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      return false;
    }

    const d = new Date(
      value + 'T00:00:00Z'
    );

    return (
      !Number.isNaN(d.getTime()) &&
      d.toISOString().slice(0, 10) === value
    );
  }

  function validTime(value) {
    return (
      value == null ||
      value === '' ||
      (
        typeof value === 'string' &&
        /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/
          .test(value)
      )
    );
  }

  async function createBooking({
    serviceId,
    requestId,
    bookingDate = null,
    bookingTime = null,
    serviceTown = '',
    serviceProvince = ''
  } = {}) {
    if (!validUuid(serviceId)) {
      throw new Error(
        'Invalid service reference.'
      );
    }

    if (!validUuid(requestId)) {
      throw new Error(
        'A valid booking request reference is required.'
      );
    }

    if (!validDate(bookingDate)) {
      throw new Error(
        'Invalid booking date.'
      );
    }

    if (!validTime(bookingTime)) {
      throw new Error(
        'Invalid booking time.'
      );
    }

    const town = String(
      serviceTown || ''
    ).trim();

    const province = String(
      serviceProvince || ''
    ).trim();

    if (
      town.length < 2 ||
      town.length > 120 ||
      province.length < 2 ||
      province.length > 120
    ) {
      throw new Error(
        'Enter a valid service town and province before booking.'
      );
    }

    const client =
      await authenticatedClient();

    // Supabase checks provider coverage, ownership,
    // booking reference and existing booking safeguards.

    const { data, error } = await client.rpc(
      'shopdrop_create_located_service_booking',
      {
        p_service_id: serviceId,
        p_request_id: requestId,
        p_booking_date:
          bookingDate || null,
        p_booking_time:
          bookingTime || null,
        p_service_town: town,
        p_service_province: province
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
      service_town: town,
      service_province: province,
      payment_status: 'pending',
      payment_provider_status:
        'not_activated',
      payment_collected: false
    });
  }

  // Fix142 — Additional rated booking method.
  // The original createBooking remains unchanged.

  async function createRatedBooking({
    serviceId,
    requestId,
    rateId,
    quantity,
    bookingDate,
    bookingTime,
    serviceTown,
    serviceProvince
  } = {}) {
    if (
      !validUuid(serviceId) ||
      !validUuid(requestId) ||
      !validUuid(rateId)
    ) {
      throw new Error(
        'Invalid service, request or rate reference.'
      );
    }

    const units = Number(quantity);

    if (
      !Number.isSafeInteger(units) ||
      units < 1 ||
      units > 100000
    ) {
      throw new Error(
        'Enter a valid number of booking units.'
      );
    }

    if (
      !bookingDate ||
      !validDate(bookingDate) ||
      !bookingTime ||
      !validTime(bookingTime)
    ) {
      throw new Error(
        'Choose a valid booking date and time.'
      );
    }

    const town = String(
      serviceTown || ''
    ).trim();

    const province = String(
      serviceProvince || ''
    ).trim();

    if (
      town.length < 2 ||
      town.length > 120 ||
      province.length < 2 ||
      province.length > 120
    ) {
      throw new Error(
        'Enter a valid service town and province.'
      );
    }

    const client =
      await authenticatedClient();

    // Server verifies user, listing, rate,
    // quantity, date, time, location and price.
    // No customer-supplied amount is trusted.

    const { data, error } = await client.rpc(
      'shopdrop_create_rated_service_booking_141',
      {
        p_service_id: serviceId,
        p_request_id: requestId,
        p_rate_id: rateId,
        p_quantity: units,
        p_booking_date: bookingDate,
        p_booking_time: bookingTime,
        p_service_town: town,
        p_service_province: province
      }
    );

    if (error) {
      throw new Error(
        error.message ||
        'Secure rated booking could not be created.'
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
      rate_id: rateId,
      quantity: units,
      service_town: town,
      service_province: province,
      booking_date: bookingDate,
      booking_time: bookingTime,
      payment_status: 'pending',
      payment_provider_status: 'not_activated',
      payment_collected: false
    });
  }

  window.ShopDropServicesConnector =
    Object.freeze({
      search,
      createBooking,
      createRatedBooking
    });
})();
