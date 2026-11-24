(() => {
  'use strict';
  const base='https://dtkdvvxpwonywtsgqmdx.supabase.co';
  const key='sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';
  const role=document.getElementById('appointmentRole192dd');
  const reload=document.getElementById('appointmentReload192dd');
  const status=document.getElementById('appointmentStatus192dd');
  const list=document.getElementById('appointmentList192dd');
  if(!role||!reload||!status||!list) return;
  const params=new URLSearchParams(location.search);
  if(params.get('role')==='provider') role.value='provider';
  let clientPromise, locationsPromise, busy=false;
  const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  const money=n=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(Number(n));
  const date=v=>new Intl.DateTimeFormat('en-ZA',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Johannesburg'}).format(new Date(v))+' SAST';
  const labelStatus={saved:'Saved — send appointment request',expired:'Expired — select a new appointment',awaiting_provider:'Waiting for provider confirmation',alternative_proposed:'Alternative appointment proposed',confirmed:'Appointment confirmed',declined:'Appointment declined'};
  function link(text,href){const a=el('a',text);a.href=href;a.className='btn';return a;}
  function feedback(){const n=el('p');n.className='muted';n.setAttribute('role','status');n.setAttribute('aria-live','polite');return n;}
  function displayError(target,error){target.replaceChildren();if(error.needsSignIn){target.append(el('span','Please sign in to access your private appointments.'),link('Sign in','./sign-in.html'),link('Register','./register.html'));return;}target.textContent=error.safeMessage||'Unable to complete this request. Please refresh and try again.';}
  async function rpc(name,args){
    if(!clientPromise)clientPromise=import('https://esm.sh/@supabase/supabase-js@2.49.4').then(({createClient})=>createClient(base,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}})).catch(e=>{clientPromise=undefined;throw e;});
    const db=await clientPromise;
    const {data:s,error:se}=await db.auth.getSession();
    if(se||!s?.session?.access_token)throw Object.assign(new Error('Sign in required'),{needsSignIn:true});
    const {data:u,error:ue}=await db.auth.getUser(s.session.access_token);
    if(ue||!u?.user?.id)throw Object.assign(new Error('Sign in required'),{needsSignIn:true});
    const {data,error}=await db.rpc(name,args);
    if(error){
      if(error.code==='28000'||error.code==='PGRST301')throw Object.assign(new Error('Sign in required'),{needsSignIn:true});
      const messages=['Choose valid South African towns','Complete the required addresses and job description','Advertisement unavailable','Provider verification required','Pickup outside advertised coverage','Rate unavailable','Rate or availability changed; choose again','Selected appointment or rate is no longer available','Dispatch provider capacity already booked for this period'];
      const match=messages.find(m=>error.message===m);
      throw Object.assign(new Error('Request failed'),{safeMessage:match?match+'.':undefined});
    }
    return data;
  }
  async function locations(){
    if(!locationsPromise)locationsPromise=fetch('./shopdrop-sa-towns-181.json').then(async r=>{if(!r.ok)throw Error('Location data unavailable');const j=await r.json();if(!j.provinces||!Object.keys(j.provinces).length)throw Error('Location data unavailable');return j.provinces;}).catch(e=>{locationsPromise=undefined;throw e;});
    return locationsPromise;
  }
  function button(label,callback,secondary=false){const b=el('button',label);b.type='button';if(secondary)b.className='secondary';b.addEventListener('click',callback);return b;}
  function field(parent,label,control){const l=el('label',label);l.append(control);parent.append(l);return control;}
  function fill(select,values,placeholder){select.replaceChildren(new Option(placeholder,''));for(const value of values)select.add(new Option(value,value));}
  function place(parent,title,catalog){
    const f=el('fieldset');f.append(el('legend',title));parent.append(f);
    const province=field(f,'Province',el('select'));province.required=true;
    const town=field(f,'Town or city',el('select'));town.required=true;town.disabled=true;
    fill(province,Object.keys(catalog).sort(),'Choose a province');fill(town,[],'Choose a province first');
    province.addEventListener('change',()=>{fill(town,(catalog[province.value]||[]).slice().sort(),'Choose a town or city');town.disabled=!province.value;});
    const address=field(f,'Street address or site address',el('textarea'));address.required=true;address.maxLength=500;address.rows=2;
    return {f,province,town,address};
  }
  async function requestForm(card,row,openButton){
    if(card.querySelector('form'))return;
    openButton.disabled=true;
    const msg=feedback();msg.textContent='Loading location dropdowns…';card.append(msg);
    try{
      const catalog=await locations();msg.remove();
      const form=el('form');form.className='appointment-form';
      const pickup=place(form,'Collection or work location',catalog);
      const same=el('input');same.type='checkbox';const sameLabel=el('label');sameLabel.append(same,document.createTextNode('Same location for return, delivery or work'));form.append(sameLabel);
      const dropoff=place(form,'Delivery or return location',catalog);
      same.addEventListener('change',()=>{dropoff.f.hidden=same.checked;dropoff.f.disabled=same.checked;});
      const job=field(form,'What do you need the vehicle or equipment for?',el('textarea'));job.rows=3;job.required=true;job.maxLength=500;
      form.append(el('p','Your exact addresses and job instructions will not be shared before verified payment. The provider sees the town or city and appointment details.'));
      const send=el('button','Send appointment request');send.type='submit';const result=feedback();form.append(send,result);
      form.append(button('Close form',()=>{form.remove();openButton.disabled=false;},true));
      form.addEventListener('submit',async e=>{
        e.preventDefault();if(busy)return;
        if(!form.reportValidity())return;
        const end=same.checked?pickup:dropoff;
        if(!pickup.province.value||!pickup.town.value||!end.province.value||!end.town.value||!pickup.address.value.trim()||!end.address.value.trim()||!job.value.trim()){result.textContent='Complete the locations, addresses and job description.';return;}
        await action(result,async()=>{
          const id=await rpc('shopdrop_dispatch_bag_submit_192dd',{p_id:row.id,p_pickup_province:pickup.province.value,p_pickup_town:pickup.town.value,p_dropoff_province:end.province.value,p_dropoff_town:end.town.value,p_pickup_address:pickup.address.value.trim(),p_dropoff_address:end.address.value.trim(),p_job_description:job.value.trim()});
          if(typeof id!=='string'||!id)throw Error('No booking reference');
        },'Appointment request sent. No payment has been collected.');
      });
      card.append(form);
    }catch(e){displayError(msg,e);openButton.disabled=false;}
  }
  async function action(target,fn,success){
    if(busy)return;busy=true;role.disabled=true;reload.disabled=true;
    const controls=[...list.querySelectorAll('button,input,select,textarea')];const old=controls.map(c=>c.disabled);controls.forEach(c=>c.disabled=true);
    target.textContent='Submitting…';let ok=false;
    try{await fn();ok=true;}catch(e){displayError(target,e);}
    finally{busy=false;role.disabled=false;reload.disabled=false;controls.forEach((c,i)=>c.disabled=old[i]);}
    if(ok)await load(success);
  }
  function render(row,provider){
    const card=el('article');card.append(el('h2',row.title||'Transport appointment'));
    card.append(el('p','Requested start: '+date(row.starts_at)),el('p','Quantity: '+row.quantity));
    if(!row.booking_id)card.append(el('p','Estimated end: '+date(row.ends_at)));
    if(row.pickup_area)card.append(el('p','Collection / work area: '+row.pickup_area));
    if(row.dropoff_area)card.append(el('p','Delivery / return area: '+row.dropoff_area));
    card.append(el('p','Provider amount: '+money(row.provider_amount)));
    if(!provider){card.append(el('p','Shop&Drop service fee: '+money(row.commission)),el('p','Total: '+money(row.total)));}
    const state=el('p',labelStatus[row.status]||'Check appointment status');state.className='appointment-status';card.append(state);
    if(row.proposed_at&&row.status==='alternative_proposed')card.append(el('p','Proposed time: '+date(row.proposed_at)));
    if(row.confirmed_at&&row.status==='confirmed')card.append(el('p','Confirmed time: '+date(row.confirmed_at)));
    if(row.booking_id)card.append(el('p','Payment status: '+(row.payment_status||'pending').replaceAll('_',' ')));
    const pending=row.payment_status==='pending'&&row.booking_status==='pending_payment';
    const msg=feedback();const actions=el('div');actions.className='appointment-actions';
    const providerReply=(choice,at=null)=>action(msg,async()=>{const d=await rpc('shopdrop_dispatch_provider_schedule_response',{p_booking_id:row.booking_id,p_action:choice,p_alternative_at:at});if(d?.ok!==true)throw Error('Not saved');},choice==='accept'?'Appointment confirmed. No payment collected.':choice==='decline'?'Appointment declined.':'Alternative appointment sent.');
    const customerReply=choice=>action(msg,async()=>{const d=await rpc('shopdrop_dispatch_customer_schedule_response',{p_booking_id:row.booking_id,p_action:choice});if(d?.ok!==true)throw Error('Not saved');},choice==='accept'?'Alternative appointment confirmed.':'Alternative declined.');
    if(!provider&&row.status==='saved'&&!row.booking_id){const open=button('Complete details and request appointment',()=>requestForm(card,row,open));actions.append(open);}
    if(provider&&pending&&row.status==='awaiting_provider'&&Date.parse(row.starts_at)>Date.now()){
      actions.append(button('Confirm requested appointment',()=>providerReply('accept')),button('Decline request',()=>{if(window.confirm('Decline this appointment request?'))providerReply('decline');},true));
      const alt=field(actions,'Or choose another date and time (South Africa)',el('input'));alt.type='datetime-local';alt.min=new Date(Date.now()+7200000).toISOString().slice(0,16);
      actions.append(button('Suggest alternative appointment',()=>{const t=Date.parse(alt.value+'+02:00');if(!Number.isFinite(t)||t<=Date.now()){msg.textContent='Choose a valid future date and time.';return;}providerReply('propose',new Date(t).toISOString());},true));
    }
    if(!provider&&pending&&row.status==='alternative_proposed'&&Date.parse(row.proposed_at)>Date.now())actions.append(button('Accept alternative appointment',()=>customerReply('accept')),button('Decline alternative appointment',()=>{if(window.confirm('Decline the alternative appointment?'))customerReply('reject');},true));
    if(!provider&&pending&&row.status==='confirmed')card.append(el('p',Date.parse(row.confirmed_at)>Date.now()?'Appointment confirmed. Payment is not yet enabled on this screen.':'Confirmed appointment time has passed. Do not pay.'));
    if(row.booking_id){const ref=el('p','Booking reference: '+row.booking_id);ref.className='muted';card.append(ref);}
    card.append(actions,msg);list.append(card);
  }
  async function load(notice=''){
    if(busy)return;busy=true;role.disabled=true;reload.disabled=true;list.replaceChildren();status.textContent='Loading your private appointments…';
    try{const provider=role.value==='provider';const rows=await rpc('shopdrop_dispatch_bag_appointments_192dd',{p_as_provider:provider});if(!Array.isArray(rows))throw Error('Invalid response');status.textContent=(notice?notice+' ':'')+(rows.length?`${rows.length} appointment selection(s).`:provider?'No appointment requests for your advertisements.':'No Transport Bag selections yet.');if(!rows.length&&!provider)list.append(link('Search Transport Services & Equipment Hire','./transport-search.html'));const target=params.get('item');const ordered=target&&!provider?[...rows].sort((a,b)=>Number(b.id===target)-Number(a.id===target)):rows;for(const row of ordered)render(row,provider);}
    catch(e){displayError(status,e);}finally{busy=false;role.disabled=false;reload.disabled=false;}
  }
  role.addEventListener('change',()=>load());reload.addEventListener('click',()=>load());load();
})();
