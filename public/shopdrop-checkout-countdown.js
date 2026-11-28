/* Shop&Drop A176: countdown from server-side reservation expiry; never reset on refresh. */
(function () {
  'use strict';
  const panel = document.createElement('section');
  panel.className = 'panel';
  panel.setAttribute('aria-label', 'Checkout reservation time');
  const label = document.createElement('strong');
  label.textContent = 'Checkout reservation';
  const display = document.createElement('p');
  display.style.cssText = 'font-size:2rem;font-weight:700;font-variant-numeric:tabular-nums;margin:8px 0';
  display.textContent = 'Awaiting inventory reservation';
  const note = document.createElement('p');
  note.setAttribute('role','status');
  note.textContent = 'The 30-minute countdown starts only when Supabase reserves your items.';
  panel.append(label, display, note);
  const host = document.querySelector('main') || document.body;
  host.insertBefore(panel, host.firstChild);
  const endpoint='https://dtkdvvxpwonywtsgqmdx.supabase.co';
  const key='sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';
  let clientPromise;
  const client=()=>clientPromise ||= import('https://esm.sh/@supabase/supabase-js@2')
    .then(m=>m.createClient(endpoint,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}))
    .catch(error=>{clientPromise=null;throw error;});
  let currentOrder='', expiryMs=0, lastSync=0;
  let reservationState='waiting', requestVersion=0;
  const storageKey='shopdrop_checkout_countdown_order_v1';
  const validId=value=>/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(String(value||''));
  function orderId(){
    const active=window.ShopDropPhase6CartAddress?.getPendingOrderId?.();
    if(validId(active))return active;
    // Used only to DISPLAY server-verified expiry after refresh.
    // Never restore payment/order-creation authority from browser storage.
    try {const saved=sessionStorage.getItem(storageKey);return validId(saved)?saved:'';}
    catch(_){return '';}
  }
  function resetDisplay(id=''){
    currentOrder=id;expiryMs=0;lastSync=0;reservationState='waiting';requestVersion++;
  }
  function remember(id){
    if(!validId(id))return;
    try{sessionStorage.setItem(storageKey,id);}catch(_){}
    resetDisplay(orderId());update();sync();
  }
  function clear(){
    try{sessionStorage.removeItem(storageKey);}catch(_){}
    resetDisplay(orderId());update();
  }
  function update() {
    const id=orderId();
    if(id!==currentOrder)resetDisplay(id);
    if(!id||!expiryMs){
      panel.dataset.expired='false';
      if(id&&reservationState==='error'){
        display.textContent='Reservation time unavailable';
        note.textContent='Unable to verify reservation expiry. Payment remains subject to server-side checks.';
      } else if(id&&reservationState==='none'){
        display.textContent='No active reservation';
        note.textContent='No reserved stock is currently recorded for this order. Check your checkout status.';
      } else {
        display.textContent='Awaiting inventory reservation';
        note.textContent='The 30-minute countdown starts only when Supabase reserves your items.';
      }
      return;
    }
    const seconds=Math.max(0,Math.ceil((expiryMs-Date.now())/1000));
    display.textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
    if(seconds===0){
      note.textContent='Reservation expired. Do not start a new payment. Refresh your checkout status.';
      panel.dataset.expired='true';
    } else {
      panel.dataset.expired='false';
      note.textContent=seconds<=300?'Less than five minutes remain. Complete payment now.':'Your items are temporarily reserved.';
    }
  }
  async function sync(){
    const id=orderId();
    if(!validId(id))return;
    if(id!==currentOrder)resetDisplay(id);
    const version=++requestVersion;
    lastSync=Date.now();
    try {
      const db=await client();
      const {data,error}=await db.rpc('shopdrop_a176_checkout_reservation_expiry',{p_order_id:id});
      if(error)throw error;
      if(version!==requestVersion||id!==orderId())return;
      if(data?.order_id!==id||!Object.hasOwn(data,'expires_at'))throw Error('Invalid reservation response');
      const expiry=data.expires_at;
      const parsed=typeof expiry==='string'?Date.parse(expiry):NaN;
      if(expiry!==null&&!Number.isFinite(parsed))throw Error('Invalid reservation expiry');
      expiryMs=Number.isFinite(parsed)?parsed:0;
      reservationState=expiry===null?'none':'verified';
      lastSync=Date.now();
      update();
    } catch (_) {
      if(version!==requestVersion||id!==orderId())return;
      expiryMs=0;reservationState='error';lastSync=Date.now();update();
    }
  }
  window.ShopDropReservationCountdown=Object.freeze({
    mayStartPayment:()=>Boolean(expiryMs && Date.now()<expiryMs && currentOrder===orderId()),
    refresh:sync, remember, clear
  });
  setInterval(()=>{
    update();
    if(orderId() && Date.now()-lastSync>15000){lastSync=Date.now();sync();}
  },1000);
  update();
})();