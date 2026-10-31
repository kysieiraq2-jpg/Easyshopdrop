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
    .then(m=>m.createClient(endpoint,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));
  let currentOrder='', expiryMs=0, lastSync=0;
  function orderId(){return window.ShopDropPhase6CartAddress?.getPendingOrderId?.() || '';}
  function update() {
    const id=orderId();
    if(id!==currentOrder){currentOrder=id;expiryMs=0;lastSync=0;}
    if(!id){display.textContent='Awaiting inventory reservation';return;}
    if(!expiryMs){display.textContent='Reservation time unavailable';return;}
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
    if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))return;
    try {
      const db=await client();
      const {data,error}=await db.rpc('shopdrop_a176_checkout_reservation_expiry',{p_order_id:id});
      if(error)throw error;
      if(id!==orderId())return;
      const expiry=data?.expires_at;
      const parsed=expiry?Date.parse(expiry):NaN;
      expiryMs=Number.isFinite(parsed)?parsed:0;
      lastSync=Date.now();
      update();
    } catch (_) {
      note.textContent='Unable to verify reservation expiry. Payment remains subject to server-side checks.';
    }
  }
  window.ShopDropReservationCountdown=Object.freeze({
    mayStartPayment:()=>Boolean(expiryMs && Date.now()<expiryMs && currentOrder===orderId()),
    refresh:sync
  });
  setInterval(()=>{
    update();
    if(orderId() && Date.now()-lastSync>15000){lastSync=Date.now();sync();}
  },1000);
  update();
})();