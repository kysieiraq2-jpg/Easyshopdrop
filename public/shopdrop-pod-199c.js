(() => {
 'use strict';
 const BASE='https://dtkdvvxpwonywtsgqmdx.supabase.co';
 const KEY='sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';
 const $=id=>document.getElementById(id);
 const form=$('podForm199c'),input=$('podOrderInput199c'),button=$('podLoad199c'),status=$('podStatus199c'),results=$('podResults199c');
 const tracking=$('podBackTracking199c'),orderLink=$('podBackOrder199c'),problem=$('podProblem199c');
 if(!form||!input||!button||!status||!results||!tracking||!orderLink||!problem)return;
 const params=new URLSearchParams(location.search);
 const supplied=params.get('order')||'';
 let selected=params.get('shipment')||'';
 let clientPromise,generation=0,owner=null,watching=false;
 const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
 const el=(tag,text)=>{const x=document.createElement(tag);if(text!=null)x.textContent=String(text);return x;};
 const array=v=>Array.isArray(v)?v:[];
 const value=v=>v==null||v===''?'Not recorded':String(v);
 const date=v=>{if(!v)return 'Not recorded';const d=new Date(v);return Number.isNaN(d.getTime())?'Not available':d.toLocaleString('en-ZA',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Johannesburg'})+' SAST';};
 function line(dl,k,v){dl.append(el('dt',k),el('dd',value(v)));}
 function show(s,error=false){status.textContent=s;status.className=error?'error':'muted';}
 function clear(){results.hidden=true;results.replaceChildren();tracking.href='./tracking.html';orderLink.href='./product-orders-194f.html';problem.href='./returns.html';orderLink.textContent='My Purchases';}
 function invalidate(){generation++;owner=null;clear();button.disabled=false;}
 async function client(){
  if(!clientPromise)clientPromise=import('https://esm.sh/@supabase/supabase-js@2.49.4').then(({createClient})=>createClient(BASE,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}})).catch(e=>{clientPromise=undefined;throw e;});
  const db=await clientPromise;
  if(!watching){watching=true;db.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||(owner&&session?.user?.id!==owner)){invalidate();show('Sign-in changed. Load your order again.',true);}});}
  return db;
 }
 async function verifiedUser(db){const {data,error}=await db.auth.getUser();if(error||!uuid(data?.user?.id)||data.user.is_anonymous===true)throw new Error('Sign in to view your own order.');return data.user.id;}
 function recentLocation(data,shipment){return [...array(data.tracking_events),...array(data.courier_updates)].filter(e=>e?.shipment_id===shipment.id&&e.location&&Number.isFinite(Date.parse(e.event_time))).sort((a,b)=>Date.parse(b.event_time)-Date.parse(a.event_time))[0];}
 function render(data,shipments,providerRefs,available){
  results.append(el('h2','Order '+value(data.order_reference||data.order_id)));
  if(!shipments.length)results.append(el('p','No courier shipment has been recorded for this order yet.'));
  for(const shipment of shipments){
   const card=el('article');card.append(el('h3','Shipment '+value(shipment.shipment_reference||shipment.id)));
   const dl=el('dl');line(dl,'Shop&Drop shipment reference',shipment.shipment_reference||shipment.id);line(dl,'Courier',shipment.courier_name);line(dl,'Courier tracking reference',shipment.tracking_number);line(dl,'Shipment status',shipment.shipment_status);line(dl,'Recorded delivery status',shipment.delivery_status);line(dl,'Courier-reported delivery time',date(shipment.delivered_at));line(dl,'Shop&Drop delivery verified at',date(shipment.delivery_verified_at));
   const loc=recentLocation(data,shipment);line(dl,'Last recorded tracking location',loc?.location);if(loc)line(dl,'Tracking location recorded at',date(loc.event_time));
   const podRef=providerRefs.get(shipment.id);line(dl,'Recorded provider POD reference',available?podRef:'Temporarily unavailable');card.append(dl);
   const confirmed=array(data.delivery_confirmations).filter(c=>c?.shipment_id===shipment.id);
   card.append(el('p',shipment.delivery_verified_at?'Shop&Drop delivery verification is recorded.':shipment.delivered_at?'Courier delivery reported; Shop&Drop delivery verification not yet recorded.':'Delivery verification not yet recorded.'));
   if(confirmed.length){const cdl=el('dl');for(const c of confirmed){line(cdl,'Recorded confirmation method',c.confirmation_method);line(cdl,'Confirmation status',c.delivery_status);line(cdl,'Confirmation time',date(c.confirmed_at));}card.append(cdl);}
   card.append(el('p','Private evidence files are not displayed here. For a delivery problem, use Returns & Disputes.'));
   results.append(card);
  }
  results.hidden=false;
  const ref=String(data.order_reference||data.order_id);
  tracking.href='./tracking.html?order='+encodeURIComponent(ref);orderLink.href='./order.html?id='+encodeURIComponent(data.order_id);orderLink.textContent='Back to Order Details';problem.href='./returns.html?order='+encodeURIComponent(ref);
 }
 async function load(){
  const request=++generation;clear();button.disabled=true;const ref=input.value.trim(),ship=selected;
  if(!ref||ref.length>80||ship.length>100){show('Enter a valid order reference.',true);button.disabled=false;return;}
  show('Loading your delivery information…');
  try{
   const db=await client();const uid=await verifiedUser(db);if(request!==generation)return;owner=uid;
   const {data,error}=await db.rpc('shopdrop_buyer_tracking_snapshot',{p_order_reference:ref});
   if(request!==generation)return;
   if(error||!data||!uuid(data.order_id))throw new Error('No matching order is available to your account, or tracking is temporarily unavailable.');
   const all=array(data.shipments).filter(s=>uuid(s?.id));
   const shipments=ship?all.filter(s=>s.id===ship||s.shipment_reference===ship):all;
   if(ship&&shipments.length!==1)throw new Error('That shipment is not available for this order. Open tracking and select the correct shipment.');
   let refs=new Map(),available=true;
   if(shipments.length){
    try{const {data:rows,error:err}=await db.from('shipments').select('id,pod_reference').eq('order_id',data.order_id).eq('buyer_id',uid).limit(1000);if(err||!Array.isArray(rows))throw Error('Unavailable');refs=new Map(rows.filter(r=>uuid(r.id)).map(r=>[r.id,r.pod_reference]));}catch(_){available=false;}
   }
   if(request!==generation)return;
   if(await verifiedUser(db)!==uid||request!==generation){if(request===generation)invalidate();return;}
   render(data,shipments,refs,available);show('Delivery information loaded.');
  }catch(e){if(request===generation){clear();show(e?.message==='Sign in to view your own order.'||String(e?.message||'').startsWith('No matching order')||String(e?.message||'').startsWith('That shipment')?e.message:'Unable to load delivery information. Please try again.',true);}}
  finally{if(request===generation)button.disabled=false;}
 }
 form.addEventListener('submit',e=>{e.preventDefault();if(form.reportValidity())load();});
 input.addEventListener('input',()=>{selected='';invalidate();show('Enter your order reference and load delivery information.');});
 window.addEventListener('pagehide',invalidate);window.addEventListener('pageshow',e=>{if(e.persisted&&input.value.trim())load();});
 button.disabled=false;
 if(supplied&&supplied.length<=80){input.value=supplied;load();}else{selected='';show('Enter your Shop&Drop order reference.');}
})();
