// Shop&Drop Phase 6C - additive checkout order connector.
// NOT activated on the live checkout page. No payment, reservation or booking.
// Requires the A9 supabase-adapter.js to be loaded first. Auth token comes from the verified Supabase session.
(function () {
  'use strict';
  const KEY = 'shopdrop_checkout_request_v1';
  function canonical(items) {
    if (!Array.isArray(items) || !items.length || items.length > 50) throw Error('Invalid shopping bag');
    const found = new Set();
    return items.map(item => {
      const product_id = String(item.product_id || '').toLowerCase();
      const quantity = item.quantity;
      if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(product_id) ||
          !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000 || found.has(product_id)) {
        throw Error('Invalid or duplicate shopping bag item');
      }
      found.add(product_id);
      return {product_id, quantity};
    }).sort((a,b) => a.product_id.localeCompare(b.product_id));
  }
  function requestFor(items) {
    const signature = JSON.stringify(items);
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (_) { saved = null; }
    if (saved && saved.signature === signature && saved.request_id) return saved.request_id;
    const request_id = crypto.randomUUID();
    sessionStorage.setItem(KEY, JSON.stringify({signature, request_id}));
    return request_id;
  }
  async function createOrder(items) {
    const clean = canonical(items);
    if (!window.ShopDropSupabaseAdapter) throw Error('Supabase adapter not loaded');
    const request_id = requestFor(clean);
    const createCheckoutOrder = window.ShopDropSupabaseAdapter.authenticatedFunctions?.createCheckoutOrder;
    if (typeof createCheckoutOrder !== 'function') throw Error('Authenticated checkout adapter unavailable');
    return createCheckoutOrder({ request_id, items: clean });
  }
  // Only call reset when a checkout is safely completed or deliberately abandoned.
  function reset() { sessionStorage.removeItem(KEY); }
  window.ShopDropCheckoutConnector = Object.freeze({createOrder, reset});
})();
