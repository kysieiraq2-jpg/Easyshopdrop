(() => {
  'use strict';
  const BASE='https://dtkdvvxpwonywtsgqmdx.supabase.co';
  const KEY='sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';
  // Use the same publishable key and session as the existing service connector.
  let clientPromise;
  const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
  const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  const money=v=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(Number(v));
  function link(text,href){const a=el('a',text);a.href=href;a.className='btn';return a;}
  function button(text,fn){const b=el('button',text);b.type='button';b.addEventListener('click',fn);return b;}
  function message(target,text){target.replaceChildren(document.createTextNode(text));}
  function errorMessage(target,error){
    if(error.needsSignIn){message(target,'Please sign in or register. Browsing is free.');target.append(link('Sign in','./sign-in.html'),link('Register','./register.html'));}
    else message(target,error.safeMessage||'Unable to complete this request. Please refresh and try again.');
  }
  async function rpc(name,args={}){
    if(!clientPromise)clientPromise=import('https://esm.sh/@supabase/supabase-js@2.49.4').then(({createClient})=>createClient(BASE,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}})).catch(e=>{clientPromise=undefined;throw e;});
    const db=await clientPromise;
    const {data:s,error:se}=await db.auth.getSession();
    if(se||!s?.session?.access_token)throw Object.assign(Error('Sign in required'),{needsSignIn:true});
    const {data:u,error:ue}=await db.auth.getUser(s.session.access_token);
    if(ue||!u?.user?.id)throw Object.assign(Error('Sign in required'),{needsSignIn:true});
    const {data,error}=await db.rpc(name,args);
    if(error){
      if(error.code==='28000'||error.code==='PGRST301')throw Object.assign(Error('Sign in required'),{needsSignIn:true});
      const allowed=['Choose a valid future date, time and quantity','Choose a valid South African town','Service unavailable or your own advertisement','Provider does not cover the selected location','Rate unavailable or below minimum','Provider unavailable on selected day','Outside operating hours','Invalid multi-day quantity','Selection exceeds operating hours','Selection already saved; remove it before changing details','Rate changed; remove and choose again','Provider changed; choose again','Provider has an overlapping booking','Provider booking capacity reached for this time slot'];
      throw Object.assign(Error('Request failed'),{safeMessage:allowed.includes(error.message)?error.message+'.':undefined});
    }
    return data;
  }
  async function add(selection){
    const id=await rpc('shopdrop_service_bag_add_193c',selection);
    if(!uuid(id))throw Error('No saved reference');
    return id;
  }
  function saved(target){message(target,'Saved in your Service Bag. No appointment has been confirmed and no payment has been collected.');target.append(link('Open My Service Bag','./service-bag-193c.html'));}
  window.ShopDropServiceBag193C=Object.freeze({add,saved,errorMessage});
  function showBag(){
    const list=document.getElementById('serviceBagItems193c'), status=document.getElementById('serviceBagStatus193c'), reload=document.getElementById('serviceBagReload193c');
    if(!list||!status||!reload)return;
    let busy=false;
    async function load(notice=''){
      if(busy)return;busy=true;reload.disabled=true;list.replaceChildren();message(status,'Loading your private Service Bag…');
      try{
        const rows=await rpc('shopdrop_service_bag_list_193c');
        if(!Array.isArray(rows))throw Error('Invalid bag response');
        message(status,(notice?notice+' ':'')+(rows.length?`${rows.length} service selection(s).`:'Your Service Bag is empty.'));
        for(const row of rows){
          const card=el('article');card.append(el('h2',row.title||'Service selection'));
          card.append(el('p','Requested date: '+row.booking_date),el('p','Requested time: '+String(row.booking_time).slice(0,5)+' SAST'),el('p','Service area: '+row.town+', '+row.province),el('p','Quantity: '+row.quantity+' × '+String(row.pricing_unit).replaceAll('_',' ')));
          card.append(el('p','Provider amount: '+money(row.provider_amount)),el('p','Shop&Drop service fee: '+money(row.commission)));
          const total=el('p');total.append(el('strong','Estimated total: '+money(row.total)));card.append(total);
          const labels={saved:'Saved only — not confirmed.',expired:'Expired — select a new appointment.',submitted:'Appointment request submitted. Check its current status in My Service Appointments.'};
          card.append(el('p',labels[row.status]||'Refresh to check status.'));
          const feedback=el('p');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
          async function act(fn,notice){
            if(busy)return;busy=true;reload.disabled=true;const controls=[...list.querySelectorAll('button')];const old=controls.map(x=>x.disabled);controls.forEach(x=>x.disabled=true);message(feedback,'Submitting…');let ok=false;
            try{await fn();ok=true;}catch(e){errorMessage(feedback,e);}finally{busy=false;reload.disabled=false;controls.forEach((x,i)=>x.disabled=old[i]);}
            if(ok)await load(notice);
          }
          if(row.status==='saved'&&!row.booking_id){
            card.append(button('Send appointment request',()=>act(async()=>{if(!uuid(await rpc('shopdrop_service_bag_submit_193c',{p_id:row.id})))throw Error('No booking reference');},'Appointment request sent. No payment collected.')));
          }
          if(!row.booking_id&&(row.status==='saved'||row.status==='expired'))card.append(button('Remove from Service Bag',()=>act(async()=>{if(await rpc('shopdrop_service_bag_remove_193c',{p_id:row.id})!==true)throw Error('Not removed');},'Selection removed.')));
          if(uuid(row.booking_id)){
            const ref=el('p','Booking reference: '+row.booking_id);ref.className='booking-reference';card.append(ref);
            card.append(button('Copy booking reference',async()=>{try{await navigator.clipboard.writeText(row.booking_id);message(feedback,'Booking reference copied.');}catch(e){message(feedback,'Select and copy the booking reference shown above.');}}));
            card.append(link('My Service Appointments','./account.html#shopdrop-service-schedule-ui'));
          }
          card.append(feedback);list.append(card);
        }
      }catch(e){errorMessage(status,e);}finally{busy=false;reload.disabled=false;}
    }
    reload.addEventListener('click',()=>load());load();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',showBag,{once:true});else showBag();
})();
