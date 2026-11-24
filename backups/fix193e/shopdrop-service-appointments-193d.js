(() => {
  'use strict';
  const BASE='https://dtkdvvxpwonywtsgqmdx.supabase.co';
  const KEY='sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';
  const byId=id=>document.getElementById(id);
  const role=byId('serviceAppointmentRole193d'),heading=byId('serviceAppointmentHeading193d'),reload=byId('serviceAppointmentReload193d'),status=byId('serviceAppointmentStatus193d'),list=byId('serviceAppointmentList193d');
  if(!role||!heading||!reload||!status||!list)return;
  const params=new URLSearchParams(location.search);
  if(params.get('role')==='provider')role.value='provider';
  const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
  const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  const money=v=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(Number(v));
  const future=(d,t)=>typeof d==='string'&&typeof t==='string'&&Date.parse(d+'T'+t.slice(0,5)+':00+02:00')>Date.now();
  const format=(d,t)=>d&&t?d+' at '+String(t).slice(0,5)+' SAST':'Not supplied';
  let clientPromise,busy=false;
  function link(text,href){const a=el('a',text);a.className='btn';a.href=href;return a;}
  function button(text,fn,secondary=false){const b=el('button',text);b.type='button';if(secondary)b.className='secondary';b.addEventListener('click',fn);return b;}
  function message(target,text){target.replaceChildren(document.createTextNode(text));}
  function fail(target,error){
    if(error.needsSignIn){message(target,'Please sign in or register to view your private appointments.');target.append(link('Sign in','./sign-in.html'),link('Register','./register.html'));}
    else message(target,error.safeMessage||'Unable to complete this request. Refresh and try again.');
  }
  async function rpc(name,args){
    if(!clientPromise)clientPromise=import('https://esm.sh/@supabase/supabase-js@2.49.4').then(({createClient})=>createClient(BASE,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}})).catch(e=>{clientPromise=undefined;throw e;});
    const db=await clientPromise;
    const {data:s,error:se}=await db.auth.getSession();
    if(se||!s?.session?.access_token)throw Object.assign(Error('Sign in required'),{needsSignIn:true});
    const {data:u,error:ue}=await db.auth.getUser(s.session.access_token);
    if(ue||!u?.user?.id)throw Object.assign(Error('Sign in required'),{needsSignIn:true});
    const {data,error}=await db.rpc(name,args);
    if(error){
      if(error.code==='28000'||error.code==='PGRST301')throw Object.assign(Error('Sign in required'),{needsSignIn:true});
      const allowed=['Appointment date and time must be in the future (South Africa time)','Provider unavailable on selected day','Appointment starts before operating hours','Appointment starts after operating hours','Appointment extends beyond selected day','Appointment ends after operating hours','Confirmed appointment exceeds provider booking capacity'];
      throw Object.assign(Error('Appointment request failed'),{safeMessage:allowed.includes(error.message)?error.message+'.':undefined});
    }
    return data;
  }
  const labels={awaiting_provider:'Waiting for provider confirmation',alternative_proposed:'Alternative appointment proposed',confirmed:'Appointment confirmed',declined:'Appointment declined'};
  async function act(target,fn,notice){
    if(busy)return;busy=true;role.disabled=true;reload.disabled=true;
    const controls=[...list.querySelectorAll('button,input,select')],old=controls.map(c=>c.disabled);controls.forEach(c=>c.disabled=true);message(target,'Submitting…');let ok=false;
    try{const result=await fn();if(result?.ok!==true)throw Error('No confirmation returned');ok=true;}
    catch(e){fail(target,e);}finally{busy=false;role.disabled=false;reload.disabled=false;controls.forEach((c,i)=>c.disabled=old[i]);}
    if(ok)await load(notice);
  }
  function render(row,provider){
    if(!uuid(row.booking_id))return;
    const card=el('article');card.id='service-booking-'+row.booking_id;
    card.append(el('h2',row.title||'Service appointment'),el('p','Requested: '+format(row.requested_date,row.requested_time)));
    if(row.town||row.province)card.append(el('p','Service area: '+[row.town,row.province].filter(Boolean).join(', ')));
    if(row.quantity!=null)card.append(el('p','Quantity: '+row.quantity+' × '+String(row.pricing_unit||'unit').replaceAll('_',' ')));
    card.append(el('p','Provider amount: '+money(row.provider_amount)));
    if(!provider){card.append(el('p','Shop&Drop service fee: '+money(row.commission)));const total=el('p');total.append(el('strong','Total: '+money(row.total)));card.append(total);}
    const inactive=['cancelled','canceled','disputed','refunded','rejected','expired','completed'].includes(row.booking_status);
    const state=el('p',inactive?'Booking '+row.booking_status:(labels[row.status]||'Check appointment status'));state.className='appointment-state';card.append(state);
    if(row.status==='alternative_proposed')card.append(el('p','Alternative: '+format(row.proposed_date,row.proposed_time)));
    if(row.status==='confirmed')card.append(el('p','Confirmed: '+format(row.confirmed_date,row.confirmed_time)));
    card.append(el('p','Payment status: '+String(row.payment_status||'unknown').replaceAll('_',' ')));
    const feedback=el('p');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
    const actions=el('div');
    const pending=!inactive&&row.booking_status==='pending'&&row.payment_status==='pending';
    const providerReply=(choice,d=null,t=null)=>act(feedback,()=>rpc('shopdrop_service_provider_schedule_response',{p_booking_id:row.booking_id,p_action:choice,p_alternative_date:d,p_alternative_time:t}),choice==='accept'?'Appointment confirmed. No payment collected.':choice==='decline'?'Appointment declined.':'Alternative appointment sent.');
    const customerReply=choice=>act(feedback,()=>rpc('shopdrop_service_customer_schedule_response',{p_booking_id:row.booking_id,p_action:choice}),choice==='accept'?'Alternative confirmed. No payment collected.':'Alternative declined.');
    if(provider&&pending&&row.status==='awaiting_provider'){
      if(future(row.requested_date,row.requested_time))actions.append(button('Confirm requested appointment',()=>providerReply('accept')));
      else actions.append(el('p','The original requested time has passed. Suggest another time or decline.'));
      const alternative=el('div');alternative.className='appointment-form';
      const dl=el('label','Alternative date (South Africa)'),d=el('input');d.type='date';d.min=new Date(Date.now()+7200000).toISOString().slice(0,10);dl.append(d);
      const tl=el('label','Alternative arrival time (South Africa)'),t=el('input');t.type='time';tl.append(t);
      alternative.append(dl,tl,button('Suggest alternative appointment',()=>{if(!future(d.value,t.value)){message(feedback,'Choose a future date and time.');return;}providerReply('propose',d.value,t.value);},true));
      actions.append(alternative,button('Decline request',()=>{if(window.confirm('Decline this appointment request?'))providerReply('decline');},true));
    }
    if(!provider&&pending&&row.status==='alternative_proposed'){
      if(future(row.proposed_date,row.proposed_time))actions.append(button('Accept alternative appointment',()=>customerReply('accept')));
      else actions.append(el('p','The proposed time has passed. Do not accept it.'));
      actions.append(button('Decline alternative appointment',()=>{if(window.confirm('Decline this alternative appointment?'))customerReply('reject');},true));
    }
    if(!provider&&pending&&row.status==='confirmed')actions.append(el('p',future(row.confirmed_date,row.confirmed_time)?'Appointment confirmed. Service checkout is not yet connected. No payment is required now.':'Confirmed appointment time has passed. Do not pay.'));
    if(!inactive&&row.payment_status==='paid'){
      actions.append(link('My Account – completion information','./account.html#service-arrival-pin-panel'));
      if(provider)actions.append(link('Optional completion photographs','./shopdrop-service-completion.html?booking_id='+encodeURIComponent(row.booking_id)),link('Submit Completion PIN','./shopdrop-provider-completion.html?booking_type=service'));
    }
    card.append(actions,feedback);list.append(card);
  }
  async function load(notice=''){
    if(busy)return;busy=true;role.disabled=true;reload.disabled=true;list.replaceChildren();message(status,'Loading your private appointments…');
    const provider=role.value==='provider';heading.textContent=provider?'Requests for My Service Advertisements':'My Service Appointments';
    try{
      const rows=await rpc('shopdrop_service_appointments_193d',{p_as_provider:provider});
      if(!Array.isArray(rows))throw Error('Invalid appointment response');
      message(status,(notice?notice+' ':'')+(rows.length?rows.length+' appointment(s).':provider?'No requests for your service advertisements.':'You have no service appointments yet.'));
      if(!rows.length&&!provider)list.append(link('Search Other Services','./services.html?view=search'));
      const target=params.get('booking_id');const ordered=uuid(target)&&!provider?[...rows].sort((a,b)=>Number(b.booking_id===target)-Number(a.booking_id===target)):rows;
      for(const row of ordered)render(row,provider);
    }catch(e){fail(status,e);}finally{busy=false;role.disabled=false;reload.disabled=false;}
  }
  role.addEventListener('change',()=>load());reload.addEventListener('click',()=>load());load();
})();
