(() => {
  'use strict';
  const BASE='https://dtkdvvxpwonywtsgqmdx.supabase.co';
  const KEY='sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';
  const get=id=>document.getElementById(id);
  const summary=get('serviceCheckoutSummary193e'),prepare=get('serviceCheckoutPrepare193e'),status=get('serviceCheckoutStatus193e'),reload=get('serviceCheckoutReload193e');
  if(!summary||!prepare||!status||!reload)return;
  const booking=new URLSearchParams(location.search).get('booking_id');
  const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
  const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  const money=v=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(v/100);
  const safe=message=>Object.assign(Error(message),{safeMessage:message});
  const authError=()=>Object.assign(Error('Sign in required'),{needsSignIn:true});
  function cents(v){if(typeof v!=='number'&&typeof v!=='string')throw Error('Invalid amount');const x=Number(v),n=Math.round(x*100);if(String(v).trim()===''||!Number.isSafeInteger(n)||n<0||Math.abs(x*100-n)>0.0001)throw Error('Invalid amount');return n;}
  const future=(d,t)=>typeof d==='string'&&typeof t==='string'&&Date.parse(d+'T'+t.slice(0,5)+':00+02:00')>Date.now();
  let clientPromise,busy=false,current=null,prepared=false;
  function message(text){status.replaceChildren(document.createTextNode(text));}
  function link(text,href){const a=el('a',text);a.href=href;a.className='btn';return a;}
  function fail(e){if(e?.needsSignIn){message('Please sign in to view your private checkout.');status.append(link('Sign in','./sign-in.html'),link('Register','./register.html'));}else message(e?.safeMessage||'Unable to prepare checkout. Refresh and try again. No payment has been collected.');}
  async function session(){
    if(!clientPromise)clientPromise=import('https://esm.sh/@supabase/supabase-js@2.49.4').then(({createClient})=>createClient(BASE,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}})).catch(e=>{clientPromise=undefined;throw e;});
    const db=await clientPromise;
    const {data:s,error:se}=await db.auth.getSession();if(se||!s?.session?.access_token)throw authError();
    const {data:u,error:ue}=await db.auth.getUser(s.session.access_token);if(ue||!u?.user?.id)throw authError();return db;
  }
  async function rpc(db,name,args){const {data,error}=await db.rpc(name,args);if(error){if(error.code==='28000'||error.code==='PGRST301')throw authError();throw safe('Booking or payment preparation is unavailable. Return to My Service Appointments or refresh and try again.');}return data;}
  async function verify(db){
    const rows=await rpc(db,'shopdrop_service_appointments_193d',{p_as_provider:false});
    if(!Array.isArray(rows))throw Error('Invalid appointments');
    const row=rows.find(r=>r.booking_id===booking);
    if(!row)throw safe('This booking is not available in your account. Return to My Service Appointments.');
    if(row.status!=='confirmed'||row.booking_status!=='pending'||row.payment_status!=='pending'||!future(row.confirmed_date,row.confirmed_time))throw safe('A confirmed future appointment awaiting payment is required. Return to My Service Appointments.');
    const locationState=await rpc(db,'shopdrop_service_location_state_193f',{p_booking_id:booking});
    if(typeof locationState?.ready!=='boolean'||typeof locationState.customer_ready!=='boolean'||typeof locationState.provider_ready!=='boolean')throw safe('Private address readiness could not be verified. Refresh and try again.');
    if(!locationState.ready)throw safe(!locationState.customer_ready?'Save your private service address in My Service Appointments before checkout.':'The provider still needs to save their private service address. Return to My Service Appointments and try again later.');
    const ready=await rpc(db,'shopdrop_service_checkout_readiness',{p_booking_id:booking});
    if(ready?.ok!==true||ready.ready_for_checkout!==true||ready.booking_id!==booking||ready.currency!=='ZAR'||ready.payment_collected!==false||ready.funds_moved!==false||ready.confirmed_date!==row.confirmed_date||String(ready.confirmed_arrival_time).slice(0,5)!==String(row.confirmed_time).slice(0,5))throw safe('This appointment is not ready for payment. Refresh and check your booking.');
    const provider=cents(ready.provider_amount),fee=cents(ready.commission_amount),total=cents(ready.customer_total);
    if(provider<=0||fee!==Math.round(provider*(provider<100000?10:7)/100)||total!==provider+fee||provider!==cents(row.provider_amount)||fee!==cents(row.commission)||total!==cents(row.total))throw safe('The service price could not be verified. Do not pay.');
    return {row,provider,fee,total};
  }
  function draw(s){
    const dl=el('dl');[['Provider amount',money(s.provider)],['Shop&Drop service fee ('+(s.provider<100000?'10%':'7%')+')',money(s.fee)],['Total payable',money(s.total)]].forEach(([label,value],i)=>{const d=el('div');if(i===2)d.className='total';d.append(el('dt',label),el('dd',value));dl.append(d);});
    summary.replaceChildren(el('h2',s.row.title||'Service booking'),el('p','Confirmed appointment: '+s.row.confirmed_date+' at '+String(s.row.confirmed_time).slice(0,5)+' SAST'),el('p','Service area: '+[s.row.town,s.row.province].filter(Boolean).join(', ')),dl,el('p','No courier charges. Card and EFT payments will become available after the financial service provider is activated.'));
    summary.hidden=false;
  }
  function controls(){reload.disabled=busy;prepare.disabled=busy||!current||prepared;prepare.hidden=!current;}
  async function load(){if(busy)return;busy=true;current=null;prepared=false;summary.hidden=true;summary.replaceChildren();controls();message('Checking your confirmed appointment…');try{if(!uuid(booking))throw safe('Choose a booking in My Service Appointments.');current=await verify(await session());draw(current);message('Review the total. You may prepare payment, but no money will be collected.');}catch(e){current=null;fail(e);}finally{busy=false;controls();}}
  async function submit(){
    if(busy||!current||prepared)return;busy=true;controls();message('Verifying your appointment and preparing checkout…');
    try{const db=await session(),fresh=await verify(db);
      if(fresh.total!==current.total||fresh.provider!==current.provider||fresh.fee!==current.fee||fresh.row.confirmed_date!==current.row.confirmed_date||fresh.row.confirmed_time!==current.row.confirmed_time){current=fresh;draw(fresh);throw safe('Booking details changed. Review the updated booking before preparing payment.');}
      const d=await rpc(db,'shopdrop_prepare_service_checkout_193e',{p_booking_id:booking});
      if(d?.ok!==true||d.booking_id!==booking||!uuid(d.checkout_reference)||d.currency!=='ZAR'||cents(d.provider_amount)!==fresh.provider||cents(d.commission_amount)!==fresh.fee||cents(d.customer_total)!==fresh.total||d.checkout_status!=='pending'||d.payment_provider_status!=='not_activated'||d.payment_url!==null||d.payment_collected!==false)throw safe('The checkout response could not be verified. Do not pay.');
      prepared=true;message('Checkout prepared successfully. No money has been collected. The financial service provider is not yet activated.');status.append(el('p','Checkout reference: '+d.checkout_reference));
    }catch(e){fail(e);}finally{busy=false;controls();}
  }
  prepare.addEventListener('click',submit);reload.addEventListener('click',load);load();
})();
