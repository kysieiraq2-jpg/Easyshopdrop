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
  async function prepareOrder({cart, addressId, methodCode, quoteVerified, inventoryGateVerified} = {}) {
    // The backend must reserve all items atomically BEFORE payment. A77 does not claim that gate is wired.
    if (quoteVerified !== true || inventoryGateVerified !== true) {
      throw Error('Checkout order creation is disabled until trusted courier quotation and pre-payment inventory reservation are verified.');
    }
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(String(addressId || ''))) throw Error('Choose a delivery address.');
    const methods = ['visa_debit','visa_credit','mastercard_debit','mastercard_credit','paypal_wallet'];
    if (!methods.includes(methodCode)) throw Error('Choose a supported payment method.');
    if (typeof window.ShopDropCheckoutConnector?.createOrder !== 'function') throw Error('Checkout connector unavailable.');
    return window.ShopDropCheckoutConnector.createOrder(cartItems(cart));
  }
  // Not connected to a click handler. Activation is deliberately blocked until backend gates are implemented.
  window.ShopDropOrderStage = Object.freeze({prepareOrder});
})();
