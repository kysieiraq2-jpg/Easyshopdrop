(() => {
  'use strict';
  const BASE = 'https://dtkdvvxpwonywtsgqmdx.supabase.co';
  const KEY = 'sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';
  let clientPromise;
  function el(tag, content) {
    const item = document.createElement(tag);
    if (content !== undefined) item.textContent = content;
    return item;
  }
  function link(text, href) {
    const item = el('a', text);
    item.href = href; item.className = 'btn';
    return item;
  }
  function message(parent, text) {
    parent.replaceChildren(document.createTextNode(text));
  }
  function authMessage(parent) {
    message(parent, 'Please sign in or register to use your Transport Bag. You can browse without an account.');
    parent.append(link('Sign in', './sign-in.html'), link('Register', './register.html'));
  }
  function live() {
    const p = el('div'); p.className = 'muted';
    p.setAttribute('role', 'status'); p.setAttribute('aria-live', 'polite');
    return p;
  }
  async function client() {
    if (!clientPromise) {
      clientPromise = import('https://esm.sh/@supabase/supabase-js@2.49.4')
        .then(({createClient}) => createClient(BASE, KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}}))
        .catch(error => { clientPromise = undefined; throw error; });
    }
    return clientPromise;
  }
  async function rpc(name, args) {
    const db = await client();
    const {data: session, error: sessionError} = await db.auth.getSession();
    if (sessionError || !session?.session?.access_token) throw Object.assign(new Error('Sign in required'),{needsSignIn:true});
    const {data: verified, error: authError} = await db.auth.getUser(session.session.access_token);
    if (authError || !verified?.user?.id) throw Object.assign(new Error('Sign in required'),{needsSignIn:true});
    const {data,error} = await db.rpc(name,args);
    if (error) {
      if (error.code === '28000' || error.code === 'PGRST301') throw Object.assign(new Error('Sign in required'),{needsSignIn:true});
      throw new Error('Transport request failed');
    }
    return data;
  }
  const money = value => new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(Number(value));
  const date = value => new Intl.DateTimeFormat('en-ZA',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Johannesburg'}).format(new Date(value));
  function attach(details, advert, select, quantity, appointment) {
    if (!details || details.dataset.dispatchBag192dc) return;
    details.dataset.dispatchBag192dc = '1';
    const add = el('button','Add to Transport Bag'); add.type='button';
    const status = live();
    let busy = false;
    function selection() {
      const rate = (Array.isArray(advert.rates) ? advert.rates : []).find(r => String(r.id) === select.value);
      const n = Number(quantity.value);
      const start = Date.parse(appointment.value + '+02:00');
      if (!rate || !Number.isSafeInteger(n) || n < Math.max(1, Math.ceil(Number(rate.minimum_units))) || n > 365 || !Number.isFinite(start) || start <= Date.now()) return null;
      return {p_advert_id:advert.id,p_rate_id:rate.id,p_quantity:n,p_start:new Date(start).toISOString()};
    }
    function refresh() { add.disabled = busy || !selection(); }
    for (const control of [select,quantity,appointment]) {
      for (const event of ['input','change']) control.addEventListener(event, () => { if (!busy) {message(status,'');refresh();} });
    }
    add.addEventListener('click', async () => {
      const args = selection(); if (!args || busy) return;
      busy=true; refresh();
      const controls=[select,quantity,appointment];
      const previous=controls.map(c=>c.disabled); controls.forEach(c=>{c.disabled=true;});
      message(status,'Checking availability and saving your selection…');
      try {
        const id = await rpc('shopdrop_transport_bag_add_192dc',args);
        if (typeof id !== 'string' || !id) throw new Error('Selection not saved');
        message(status,'Saved to your Transport Bag. Not reserved or confirmed. No payment has been taken.');
        status.append(link('Open Transport Bag','./dispatch-bag-192dc.html'));
      } catch(error) {
        if(error.needsSignIn) authMessage(status);
        else message(status,'Could not save this selection. Check availability again, confirm the quantity and time, or remove an earlier selection for the same appointment in your Transport Bag.');
      } finally {
        controls.forEach((c,i)=>{c.disabled=previous[i];}); busy=false; refresh();
      }
    });
    details.append(add,status); refresh();
  }
  async function showBag() {
    const list=document.getElementById('dispatchBagItems192dc');
    const status=document.getElementById('dispatchBagStatus192dc');
    const reload=document.getElementById('dispatchBagReload192dc');
    if(!list || !status || !reload) return;
    let loading=false;
    async function load() {
      if(loading) return;
      loading=true;reload.disabled=true;list.replaceChildren();message(status,'Loading your private Transport Bag…');
      try {
        const rows=await rpc('shopdrop_dispatch_bag_appointments_192dd',{p_as_provider:false});
        if(!Array.isArray(rows)) throw new Error('Invalid bag response');
      await window.ShopDropReferences199dc?.dispatch(rows,rpc);
        message(status,rows.length ? `${rows.length} saved selection${rows.length===1?'':'s'}.` : 'Your Transport Bag is empty.');
        for(const row of rows) {
          const card=el('article');
          card.append(el('h2',row.title||'Transport selection'));
    window.ShopDropReferences199dc?.lines(card,row);
          card.append(el('p',`Requested start: ${date(row.starts_at)} SAST`),el('p',`Quantity: ${row.quantity}`));
          if(!row.booking_id) card.append(el('p',`Estimated end: ${date(row.ends_at)} SAST`));
          if(row.confirmed_at&&row.status==='confirmed') card.append(el('p',`Confirmed appointment: ${date(row.confirmed_at)} SAST`));
          card.append(el('p',`Provider price: ${money(row.provider_amount)}`),el('p',`Shop&Drop service fee: ${money(row.commission)}`));
          const total=el('p');total.append(el('strong',`Estimated total: ${money(row.total)}`));card.append(total);
          const appointmentLabels={saved:'Saved — send appointment request.',expired:'Expired — choose a new appointment.',awaiting_provider:'Awaiting provider confirmation.',alternative_proposed:'Provider has proposed another appointment.',confirmed:'Appointment confirmed.',declined:'Appointment declined.'};
          card.append(el('p',appointmentLabels[row.status]||'Check appointment status.'));
          if(row.booking_id) card.append(el('p','Payment status: '+(row.payment_status||'pending')));
          if(row.status==='saved'||row.booking_id) card.append(link(row.booking_id?'View appointment':'Request appointment','./dispatch-appointments-192dd.html?item='+encodeURIComponent(row.id)));
          if(row.booking_id){list.append(card);continue;}
          const remove=el('button','Remove from Transport Bag');remove.type='button';
          const feedback=live();
          remove.addEventListener('click',async()=>{
            remove.disabled=true;message(feedback,'Removing…');
            try {const ok=await rpc('shopdrop_transport_bag_remove_192dc',{p_id:row.id});if(ok!==true) throw new Error('Not removed');await load();}
            catch(error){if(error.needsSignIn)authMessage(feedback);else message(feedback,'Could not remove this selection. Refresh your Bag and try again.');remove.disabled=false;}
          });
          card.append(remove,feedback);list.append(card);
        }
      } catch(error){if(error.needsSignIn)authMessage(status);else message(status,'Unable to load your Transport Bag. Select Refresh and try again.');}
      finally{loading=false;reload.disabled=false;}
    }
    reload.addEventListener('click',load);await load();
  }
  window.ShopDropDispatchBag192DC=Object.freeze({attach});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',showBag,{once:true});
  else showBag();
})();
