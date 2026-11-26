/* Fix 199D-A: physical goods only; the browser sends references, never private addresses or amounts. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const status=$('phase6CourierSelection'), company=$('shopdropAppointedCourier199da'),
    request=$('shopdropRequestQuote199da'), results=$('phase6CourierResults'),
    totals=$('shopdropCombinedTotal199da'), pay=$('previewOrderButton');
  if(!status||!company||!request||!results||!totals||!pay)return;
  const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
  const cents=v=>typeof v==='number'&&Number.isSafeInteger(Math.round(v*100))&&v>=0&&Math.abs(v*100-Math.round(v*100))<0.0001?Math.round(v*100):NaN;
  const money=v=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(v);
  const el=(tag,t)=>{const n=document.createElement(tag);if(t!==undefined)n.textContent=t;return n;};
  const pending=()=>window.ShopDropPhase6CartAddress?.getPendingOrderId?.();
  const current=()=>window.ShopDropPhase6CartAddress?.isCurrentCheckout?.()===true;
  let ctx=null,busy=false,generation=0,expiryTimer=null;
  function validQuote(q,c){return q&&uuid(q.quote_id)&&q.provider===c?.appointed_courier?.code&&q.currency==='ZAR'&&typeof q.quote_reference==='string'&&q.quote_reference.trim()&&Number.isSafeInteger(cents(q.amount))&&q.amount>0&&Date.parse(q.expires_at)>Date.now();}
  function selection(){
    if(!ctx||ctx.order_id!==pending()||!current()||!validQuote(ctx.selected_quote,ctx))return null;
    return {...ctx.selected_quote,order_id:ctx.order_id,fulfilment_group_id:ctx.fulfilment_group_id};
  }
  function controls(){
    const has=Boolean(pending());
    request.disabled=busy||!has||!current()||ctx?.quotation_enabled!==true||ctx?.selection_locked===true;
    if(has){pay.textContent='Proceed to secure payment';pay.disabled=busy||!selection()||ctx?.live_payment_activated!==true;}
  }
  function clear(message){generation++;ctx=null;clearTimeout(expiryTimer);results.replaceChildren();totals.replaceChildren();company.textContent='Appointed courier: to be confirmed';status.textContent=message;controls();}
  function line(label,value){const row=el('div');row.append(el('dt',label),el('dd',value));return row;}
  function draw(c){
    const q=c.selected_quote;
    company.textContent=c.appointed_courier?'Appointed courier: '+c.appointed_courier.name:'Appointed courier: to be confirmed';
    const dl=el('dl');dl.append(line('Item price',money(c.amounts.product)),line('Shop&Drop commission',money(c.amounts.shopdrop_commission)),line('Courier quotation',q?money(c.amounts.courier):'Not yet quoted'));
    const total=line('Total payable',q?money(c.amounts.total):'Awaiting quotation');total.className='shopdrop-total-199da';dl.append(total);
    totals.replaceChildren(dl);
    if(q)totals.append(el('p','Courier quotation reference: '+q.quote_reference));
    totals.append(el('p','One payment to the financial service provider. No separate courier payment.'));
    status.textContent=q?'Quotation confirmed. Review the total. Live payment is not active yet.':c.selection_locked?'The previous quotation is no longer valid. Start a new checkout before paying.':c.quotation_enabled?'Select Get courier quotation to request the price.':'Courier quotations will become available when the appointed company is connected.';
    clearTimeout(expiryTimer);
    if(q)expiryTimer=setTimeout(()=>{clear('Quotation expired. Refresh checkout before requesting another quotation.');},Math.max(0,Math.min(2147483647,Date.parse(q.expires_at)-Date.now())));
    controls();
  }
  async function readContext(orderId){
    const fn=window.ShopDropSupabaseAdapter?.authenticatedFunctions?.courierQuotes;
    if(typeof fn!=='function')throw Error('Secure checkout unavailable.');
    const c=await fn({action:'checkout_context',order_id:orderId});
    if(c?.ok!==true||c.order_id!==orderId||!uuid(c.fulfilment_group_id)||c.currency!=='ZAR'||typeof c.quotation_enabled!=='boolean'||typeof c.selection_locked!=='boolean'||typeof c.live_payment_activated!=='boolean')throw Error('Checkout details unavailable.');
    if(c.quotation_enabled&&(!c.appointed_courier||typeof c.appointed_courier.code!=='string'||typeof c.appointed_courier.name!=='string'))throw Error('Courier unavailable.');
    const a=c.amounts||{},p=cents(a.product),f=cents(a.shopdrop_commission);
    if(!Number.isSafeInteger(p)||p<=0||!Number.isSafeInteger(f))throw Error('Checkout price unavailable.');
    if(c.selected_quote){if(!validQuote(c.selected_quote,c)||!c.selection_locked||cents(a.courier)!==cents(c.selected_quote.amount)||!Number.isSafeInteger(cents(a.total))||cents(a.total)!==p+f+cents(a.courier))throw Error('Quotation could not be verified.');}
    else if(a.total!==null||a.courier!==null)throw Error('Unverified checkout amount.');
    return c;
  }
  async function refresh(){
    const id=pending(),seq=++generation;ctx=null;clearTimeout(expiryTimer);results.replaceChildren();totals.replaceChildren();controls();
    if(!uuid(id)||!current()){clear('Prepare your order using your saved delivery address first.');return null;}
    status.textContent='Checking your secure order…';
    try{const c=await readContext(id);if(seq!==generation||id!==pending()||!current())return null;ctx=c;draw(c);return c;}
    catch(_){if(seq===generation)clear('Could not verify checkout details. Refresh and try again.');return null;}
  }
  async function choose(q,id,group,seq){
    if(busy||seq!==generation||id!==pending()||!current()||!validQuote(q,ctx))return;
    busy=true;controls();for(const b of results.querySelectorAll('button'))b.disabled=true;
    try{await window.ShopDropCourierQuoteBridge.selectQuote(id,group,q.quote_id);if(seq!==generation||!current())return;const c=await refresh();if(!c||c.selected_quote?.quote_id!==q.quote_id)clear('Quotation selection could not be verified. Refresh checkout.');}
    catch(_){clear('Quotation selection could not be confirmed. Refresh checkout.');}
    finally{busy=false;controls();}
  }
  request.addEventListener('click',async()=>{
    if(busy||!current()||ctx?.quotation_enabled!==true||ctx?.selection_locked)return;
    const id=pending(),group=ctx.fulfilment_group_id,seq=generation;
    busy=true;controls();results.replaceChildren();status.textContent='Requesting quotation from the appointed courier…';
    try{
      const r=await window.ShopDropCourierQuoteBridge.requestQuotes(id,group);
      if(seq!==generation||!current()||id!==pending())return;
      if(r.order_id!==id||r.fulfilment_group_id!==group||!Array.isArray(r.quotes))throw Error('Invalid quote');
      const quotes=r.quotes.filter(q=>validQuote(q,ctx));
      if(!quotes.length){status.textContent='No valid quotation received. Payment cannot proceed.';return;}
      for(const q of quotes){const row=el('button',String(q.service_name||'Confirm courier quotation')+' — '+money(q.amount));row.type='button';row.addEventListener('click',()=>choose(q,id,group,seq));results.append(row,el('p','Quotation reference: '+q.quote_reference));}
      status.textContent='Confirm your quotation from the appointed courier.';
    }catch(_){if(seq===generation)status.textContent='Courier quotation unavailable. No payment can proceed. Please check the order or try again.';}
    finally{busy=false;controls();}
  });
  window.ShopDropCourierSelection=Object.freeze({getSelected:selection,getSelections:()=>{const q=selection();return q?[q]:[];},isBookingEnabled:()=>false});
  window.ShopDropSingleCourier199da=Object.freeze({refresh,clear,canPay:()=>Boolean(selection()&&ctx?.live_payment_activated===true)});
  $('addresses')?.addEventListener('change',()=>clear('Delivery address changed. Prepare a new checkout before requesting a quotation.'));
  $('addAnotherAddressButton')?.addEventListener('click',()=>clear('Save the delivery address before requesting a quotation.'));
  controls();
})();
