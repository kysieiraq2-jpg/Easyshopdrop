// Shop&Drop Phase 6C A72 — payment selection boundary. No live payments.
(function(){
  'use strict';
  const allowed = new Set(['visa_debit','visa_credit','mastercard_debit','mastercard_credit','instant_eft']);
  const PAYMENTS_ENABLED = false;
  function read(){
    const el=document.getElementById('phase6PaymentMethod');
    if (!el || el.disabled || !PAYMENTS_ENABLED) return null;
    const method_code=el?.value || '';
    if(!allowed.has(method_code)) return null;
    const country_code=String(document.getElementById('country')?.value || '').trim().toUpperCase();
    return Object.freeze({method_code,country_code});
  }
  window.ShopDropPaymentSelection=Object.freeze({read});
    function mountPreview(){
      const select=document.getElementById('phase6PaymentMethod');
      const note=document.getElementById('phase6PaymentNotice');
      if(!select||!note)return;
      select.addEventListener('change',()=>{
        const name=select.selectedOptions[0]?.textContent||'';
        note.textContent=select.value
          ?'Selected for preview: '+name+'. No payment can be made yet. Do not transfer money.'
          :'Select a method to preview. Payments are not active.';
      });
    }
    if(document.readyState==='loading')
      document.addEventListener('DOMContentLoaded',mountPreview,{once:true});
    else mountPreview();
})();
