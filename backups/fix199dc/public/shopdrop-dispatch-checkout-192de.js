(() => {
  'use strict';
  const BASE='https://dtkdvvxpwonywtsgqmdx.supabase.co';
  const KEY='sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';
  const summary=document.getElementById('dispatchCheckoutSummary192de');
  const prepare=document.getElementById('dispatchCheckoutPrepare192de');
  const status=document.getElementById('dispatchCheckoutStatus192de');
  const reload=document.getElementById('dispatchCheckoutReload192de');
  if(!summary||!prepare||!status||!reload)return;
  const booking=new URLSearchParams(location.search).get('booking_id');
  const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  const money=n=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(n/100);
  const date=v=>new Intl.DateTimeFormat('en-ZA',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Johannesburg'}).format(new Date(v))+' SAST';
  function cents(value){
    if(typeof value!=='number'&&typeof value!=='string')throw Error('Invalid amount');
    const n=Number(value), c=Math.round(n*100);
    if(String(value).trim()===''||!Number.isFinite(n)||!Number.isSafeInteger(c)||c<0||Math.abs(n*100-c)>0.0001)throw Error('Invalid amount');
    return c;
  }
  let clientPromise,busy=false,current=null,prepared=false;
  function message(text){status.replaceChildren(document.createTextNode(text));}
  function link(label,href){const a=el('a',label);a.href=href;a.className='btn';return a;}
  function fail(error){
    if(error?.needsSignIn){message('Please sign in to view your private checkout.');status.append(link('Sign in','./sign-in.html'),link('Register','./register.html'));}
    else message(error?.safeMessage||'Unable to complete checkout. Refresh and try again. No payment has been collected by this screen.');
  }
  const safe=message=>Object.assign(new Error(message),{safeMessage:message});
  async function session(){
    if(!clientPromise)clientPromise=import('https://esm.sh/@supabase/supabase-js@2.49.4').then(({createClient})=>createClient(BASE,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}})).catch(e=>{clientPromise=undefined;throw e;});
    const db=await clientPromise;
    const {data:s,error:se}=await db.auth.getSession();
    if(se||!s?.session?.access_token)throw Object.assign(new Error('Sign in required'),{needsSignIn:true});
    const {data:u,error:ue}=await db.auth.getUser(s.session.access_token);
    if(ue||!u?.user?.id)throw Object.assign(new Error('Sign in required'),{needsSignIn:true});
    return {db,token:s.session.access_token};
  }
  async function verifiedSelection(db){
    const {data,error}=await db.rpc('shopdrop_dispatch_bag_appointments_192dd',{p_as_provider:false});
    if(error||!Array.isArray(data))throw safe('Your appointment could not be verified. Refresh and try again.');
    const row=data.find(r=>r.booking_id===booking);
    if(!row)throw safe('This booking is not available in your account. Return to My Transport Appointments.');
    if(row.payment_status==='paid')throw safe('This booking is already paid. Return to My Transport Appointments.');
    if(row.status!=='confirmed'||row.booking_status!=='pending_payment'||row.payment_status!=='pending'||!(Date.parse(row.confirmed_at)>Date.now()))throw safe('A confirmed future appointment awaiting payment is required. Return to My Transport Appointments.');
    const {data:locationState,error:locationError}=await db.rpc('shopdrop_dispatch_location_state_192df',{p_booking_id:booking});
    if(locationError||typeof locationState?.ready!=='boolean')throw safe('Unable to verify the private service address. Refresh checkout and try again.');
    if(locationState.ready!==true)throw safe('The provider still needs to save the service address. Return to My Transport Appointments and try again later.');
    const provider=cents(row.provider_amount), fee=cents(row.commission), total=cents(row.total);
    if(provider<=0||fee!==Math.round(provider*(provider<100000?10:7)/100)||total!==provider+fee)throw safe('The booking amount could not be verified. Do not pay.');
    return {row,provider,fee,total};
  }
  function draw(s){
    const dl=el('dl');
    const entries=[['Provider amount',money(s.provider)],['Shop&Drop service fee ('+(s.provider<100000?'10%':'7%')+')',money(s.fee)],['Total payable',money(s.total)]];
    entries.forEach(([label,value],i)=>{const d=el('div');if(i===2)d.className='total';d.append(el('dt',label),el('dd',value));dl.append(d);});
    summary.replaceChildren(el('h2',s.row.title||'Transport booking'),el('p','Confirmed appointment: '+date(s.row.confirmed_at)),el('p','Quantity: '+s.row.quantity),dl,el('p','No courier charges. Payment provider activation is pending. Card and EFT payments are not yet available.'));
    summary.hidden=false;
  }
  function controls(){reload.disabled=busy;prepare.disabled=busy||!current||prepared;prepare.hidden=!current;}
  async function load(){
    if(busy)return;
    busy=true;current=null;prepared=false;summary.hidden=true;summary.replaceChildren();controls();message('Checking your confirmed appointment…');
    try{if(!uuid(booking))throw safe('No valid booking selected. Return to My Transport Appointments.');const {db}=await session();if(!window.ShopDropPaidConfirmation199db?.check)throw safe('Secure payment confirmation is unavailable. Refresh checkout.');if(await window.ShopDropPaidConfirmation199db.check(db,'dispatch',booking,status,reload))return;current=await verifiedSelection(db);draw(current);message('Review the total. You can prepare the checkout, but no money will be collected until the financial service provider is activated.');}
    catch(e){current=null;fail(e);}finally{busy=false;controls();}
  }
  async function submit(){
    if(busy||!current||prepared)return;
    busy=true;controls();message('Verifying the appointment and preparing checkout…');
    try{
      const {db,token}=await session();const fresh=await verifiedSelection(db);
      if(fresh.total!==current.total||fresh.provider!==current.provider||fresh.fee!==current.fee||fresh.row.confirmed_at!==current.row.confirmed_at){current=fresh;draw(fresh);throw safe('Booking details changed. Review the updated details before preparing payment.');}
      const response=await fetch(BASE+'/functions/v1/create-dispatch-checkout',{method:'POST',headers:{Authorization:'Bearer '+token,apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({booking_id:booking})});
      if(!response.ok)throw safe('Checkout could not be prepared. Refresh your booking and try again.');
      const result=await response.json();
      if(result?.ok!==true||result.booking_id!==booking||!uuid(result.checkout_reference)||result.currency!=='ZAR'||cents(result.expected_amount)!==fresh.total||result.checkout_status!=='pending'||result.payment_provider_status!=='not_activated'||result.payment_url!==null)throw safe('The checkout response could not be verified. Do not pay. Refresh and try again.');
      prepared=true;message('Checkout prepared successfully. No payment has been collected. The financial service provider is not yet activated.');
      status.append(el('p','Checkout reference: '+result.checkout_reference));
    }catch(e){fail(e);}finally{busy=false;controls();}
  }
  prepare.addEventListener('click',submit);reload.addEventListener('click',load);load();
})();
