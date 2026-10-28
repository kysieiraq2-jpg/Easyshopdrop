/*
 * Shop&Drop Phase 6C — Checkout Connector V2
 * Additive browser module. It does not attach itself to checkout buttons.
 * No payment, courier booking or inventory reservation occurs here.
 * Requires public/supabase-adapter.js to load first.
 * The caller supplies a verified Supabase access token and user ID.
 */
(function () {
  'use strict';

  const VERSION = 'SHOPDROP-PHASE6C-CHECKOUT-CONNECTOR-V2';
  const STORAGE_KEY = 'shopdrop_checkout_request_v2';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let inFlight = null;
  let inFlightKey = null;

  function validUuid(value) {
    return typeof value === 'string' && UUID.test(value);
  }

  function normalizeItems(items) {
    if (!Array.isArray(items) || items.length < 1 || items.length > 50) {
      throw new Error('invalid_cart');
    }
    const seen = new Set();
    const normalized = items.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item) ||
          !validUuid(item.product_id) ||
          !Number.isSafeInteger(item.quantity) ||
          item.quantity < 1 || item.quantity > 10000) {
        throw new Error('invalid_cart_item');
      }
      const product_id = item.product_id.toLowerCase();
      if (seen.has(product_id)) throw new Error('duplicate_cart_product');
      seen.add(product_id);
      return { product_id, quantity: item.quantity };
    });
    normalized.sort((a, b) => a.product_id.localeCompare(b.product_id));
    return normalized;
  }

  function readSaved() {
    try {
      return JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || 'null');
    } catch (_) {
      return null;
    }
  }

  function getOrCreateRequestId(buyerId, normalizedItems) {
    if (!validUuid(buyerId)) throw new Error('invalid_buyer_id');
    const buyer = buyerId.toLowerCase();
    const signature = JSON.stringify(normalizedItems);
    const saved = readSaved();
    if (saved && saved.buyer === buyer && saved.signature === signature &&
        validUuid(saved.request_id)) {
      return saved.request_id;
    }
    if (!window.crypto || typeof window.crypto.randomUUID !== 'function') {
      throw new Error('secure_request_id_unavailable');
    }
    const request_id = window.crypto.randomUUID();
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      buyer, signature, request_id
    }));
    return request_id;
  }

  async function createOrder(accessToken, buyerId, items) {
    if (typeof accessToken !== 'string' || !accessToken.trim()) {
      throw new Error('authenticated_session_required');
    }
    const normalized = normalizeItems(items);
    const request_id = getOrCreateRequestId(buyerId, normalized);
    const adapter = window.ShopDropSupabaseAdapter;
    if (!adapter || typeof adapter.invoke !== 'function') {
      throw new Error('supabase_adapter_not_loaded');
    }
    const key = buyerId.toLowerCase() + ':' + request_id;
    if (inFlight) {
      if (inFlightKey === key) return inFlight;
      throw new Error('checkout_request_already_in_progress');
    }
    inFlightKey = key;
    inFlight = (async () => {
      const result = await adapter.invoke('create-checkout-order', accessToken, {
        request_id,
        items: normalized
      });
      if (!result || result.ok !== true || !validUuid(result.order_id) ||
          typeof result.order_reference !== 'string' ||
          !result.order_reference.startsWith('SD-ORD-')) {
        throw new Error('invalid_checkout_order_response');
      }
      // Keep request ID after success so retries cannot create a second order.
      return result;
    })();
    try {
      return await inFlight;
    } finally {
      inFlight = null;
      inFlightKey = null;
    }
  }

  function clearRequest() {
    // Call only after completed checkout or deliberate, safe abandonment.
    if (inFlight) throw new Error('checkout_request_in_progress');
    window.sessionStorage.removeItem(STORAGE_KEY);
  }

  window.ShopDropCheckoutConnector = Object.freeze({
    version: VERSION,
    createOrder,
    validateItems: normalizeItems,
    clearRequest,
    reset: clearRequest
  });
})();
