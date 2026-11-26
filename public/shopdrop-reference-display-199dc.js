/* Fix 199D-C: display server-issued references only; never create or alter a transaction. */
(()=>{
 'use strict';
 const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
 const ref=v=>typeof v==='string'&&v.trim().length>0&&v.length<=256?v.trim():null;
 const list=v=>Array.isArray(v)?v:[];
 const ids=v=>[...new Set(list(v).filter(uuid))];
 const chunks=v=>{const a=ids(v),r=[];for(let i=0;i<a.length;i+=60)r.push(a.slice(i,i+60));return r;};
 async function collect(rpc,kind,keys){
  const map=new Map();
  if(!['service_bag','transport_bag','service_booking','dispatch_booking'].includes(kind))return map;
  for(const batch of chunks(keys)){
   try{
    const data=await rpc('shopdrop_my_advert_references_199dc3',{p_kind:kind,p_ids:batch});
    const permitted=new Set(batch);
    for(const row of list(data))if(permitted.has(row?.record_id))map.set(row.record_id,{advertisement_reference:ref(row.advertisement_reference),offer_reference:ref(row.offer_reference)});
   }catch(_){/* Existing page remains usable; unavailable reference is not invented. */}
  }
  return map;
 }
 function dbRPC(db){return async(name,args)=>{const {data,error}=await db.rpc(name,args);if(error)throw error;return data;};}
 async function attach(rows,rpc,kind,key){
  const map=await collect(rpc,kind,list(rows).map(row=>row[key]));
  for(const row of list(rows)){
   const r=map.get(row[key]);
   row.advertisement_reference=r?.advertisement_reference||null;
   row.offer_reference=r?.offer_reference||null;
  }
  return rows;
 }
 async function dispatch(rows,rpc){
  await attach(list(rows).filter(r=>uuid(r.booking_id)),rpc,'dispatch_booking','booking_id');
  await attach(list(rows).filter(r=>!uuid(r.booking_id)),rpc,'transport_bag','id');
  return rows;
 }
 function lines(parent,row){
  const p=document.createElement('p');p.className='muted';p.textContent='Advertisement reference: '+(ref(row?.advertisement_reference)||'Not available');parent.append(p);
  if(ref(row?.offer_reference)){const q=document.createElement('p');q.className='muted';q.textContent='Transport offer reference: '+row.offer_reference;parent.append(q);}
 }
 async function orderRefs(db,keys){
  const map=new Map();
  for(const batch of chunks(keys)){
   try{
    const {data,error}=await db.from('order_items').select('order_id,listing_reference_snapshot').in('order_id',batch).limit(1000);
    if(error)continue;
    const permitted=new Set(batch);
    for(const row of list(data))if(permitted.has(row?.order_id)&&ref(row.listing_reference_snapshot)){
     if(!map.has(row.order_id))map.set(row.order_id,new Set());map.get(row.order_id).add(row.listing_reference_snapshot);
    }
   }catch(_){}
  }
  return new Map([...map].map(([k,v])=>[k,[...v].sort().join(', ')]));
 }
 async function financial(db,view){
  try{
   const data=await dbRPC(db)('shopdrop_my_provider_financial_references_199dc4',{p_view:view});
   if(!Array.isArray(data))throw Error('Unavailable');
   const kinds=view==='payout'?['service_release_request','dispatch_release_request']:['dispatch_customer_payment','dispatch_provider_payment_record','service_release_request','dispatch_release_request'];
   return {error:false,data:data.filter(r=>kinds.includes(r?.record_kind)&&uuid(r.record_id)&&uuid(r.booking_id))};
  }catch(_){return {error:true,data:[]};}
 }
 const kindLabel=k=>({dispatch_customer_payment:'Transport customer payment',dispatch_provider_payment_record:'Transport provider payment record',service_release_request:'Service release request',dispatch_release_request:'Transport release request'}[k]||'Financial record');
 window.ShopDropReferences199dc=Object.freeze({collect,dbRPC,attach,dispatch,lines,orderRefs,financial,kindLabel,ref});
})();
