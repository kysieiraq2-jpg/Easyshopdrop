// Shop&Drop Phase 6C A72 — payment selection boundary. No live payments.
(function(){
  'use strict';
  const allowed = new Set(['visa_debit','visa_credit','mastercard_debit','mastercard_credit','paypal_wallet']);
  function read(){
    const el=document.getElementById('phase6PaymentMethod');
    const method_code=el?.value || '';
    if(!allowed.has(method_code)) return null;
    const country_code=String(document.getElementById('country')?.value || '').trim().toUpperCase();
    return Object.freeze({method_code,country_code});
  }
  window.ShopDropPaymentSelection=Object.freeze({read});
})();
