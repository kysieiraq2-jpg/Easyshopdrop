// Shop&Drop Phase 6C — Other Services public listings connector.
// Read-only. Does not create bookings, charge payments or expose provider contacts.
(function () {
  'use strict';
  const url = 'https://dtkdvvxpwonywtsgqmdx.supabase.co';
  const key = 'sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';
  async function search(term) {
    const query = new URLSearchParams();
    query.set('select', 'id,title,description,category,subcategory,pricing_unit,price,currency,country_code,location,listing_status');
    // Only explicitly approved listings are requested. Database RLS must independently
    // restrict anonymous reads; never expose provider_id or contact information.
    query.set('listing_status', 'eq.approved');
    query.set('order', 'created_at.desc');
    query.set('limit', '50');
    const response = await fetch(url + '/rest/v1/services?' + query, {
      headers: { apikey: key, Accept: 'application/json' }
    });
    if (!response.ok) throw new Error('Cannot load approved services (HTTP ' + response.status + ').');
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('Unexpected services response.');
    const needle = String(term || '').trim().toLocaleLowerCase();
    return rows.filter(row => !needle || [row.title,row.description,row.category,row.subcategory,row.location]
      .some(value => String(value || '').toLocaleLowerCase().includes(needle)))
      .map(row => ({
        title: row.title, description: row.description, category: row.category,
        pricing_unit: row.pricing_unit || 'service',
        unit_price_cents: Math.round(Number(row.price || 0) * 100),
        currency_code: row.currency || 'ZAR',
        minimum_units: 1, service_area: row.location || row.country_code || 'Location not specified'
      }));
  }
  window.ShopDropServicesConnector = Object.freeze({ search });
})();
