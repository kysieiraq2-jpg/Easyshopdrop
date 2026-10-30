// Phase 6C A77: authenticated order-creation bridge (staged, fail-closed).
// No payment, reservation, courier booking or order creation occurs on page load.
// Activation must follow verified inventory reservation and trusted courier totals.
(function () {
  'use strict';
  function cartItems(rows) {
    if (!Array.isArray(rows) || rows.length === 0 || rows.length > 50) throw Error('Shopping bag is empty or invalid');
    const seen = new Set();
    return rows.map(row => {
      const product_id = String(row.product_id || '').toLowerCase();
      const quantity = Number(row.quantity);
      if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(product_id) ||
          !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000 || seen.has(product_id)) {
        throw Error('Invalid shopping bag item');
      }
      seen.add(product_id);
      return {product_id, quantity};
    });
  }
  async function prepareOrder({cart, addressId, methodCode} = {}) {
    // Validate the request shape for future integration, but NEVER accept
    // browser-provided flags as proof of stock reservation or courier pricing.
    cartItems(cart);
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(String(addressId || '')))
      throw Error('Choose a delivery address.');
    const methods = ['visa_debit','visa_credit','mastercard_debit','mastercard_credit','paypal_wallet'];
    if (!methods.includes(methodCode)) throw Error('Choose a supported payment method.');
    // Only a trusted backend orchestration step may authorize order creation,
    // inventory reservation, confirmed courier pricing, and payment initiation.
    throw Error('Checkout remains disabled until backend inventory and courier gates are connected.');
  }
  // Not connected to a click handler. Activation is deliberately blocked until backend gates are implemented.

  // A160: Quote an already-created checkout order. This does NOT create an
  // order, reserve stock, select a courier, or authorize payment/booking.
  async function quoteForOrder(orderId) {
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(String(orderId || '')))
      throw Error('A valid existing order ID is required for courier quotations.');
    if (typeof window.ShopDropCourierQuoteBridge?.requestQuotes !== 'function')
      throw Error('Courier quotation bridge unavailable.');
    return window.ShopDropCourierQuoteBridge.requestQuotes(orderId);
  }
  window.ShopDropOrderStage = Object.freeze({prepareOrder,quoteForOrder});
})();
