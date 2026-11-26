(() => {
 'use strict';
 const BASE='https://dtkdvvxpwonywtsgqmdx.supabase.co',KEY='sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q',PAGE=20;
 const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
 function ownerQuery(db,uid,role,offset){
  if(!uuid(uid)||!['buyer','seller'].includes(role)||!Number.isSafeInteger(offset)||offset<0)throw Error('Invalid order request');
  return db.from('orders').select('id,order_reference,order_status,payment_status,fulfilment_status,product_total,currency,created_at').eq(role==='buyer'?'buyer_id':'seller_id',uid).order('created_at',{ascending:false}).order('id',{ascending:true}).range(offset,offset+PAGE-1);
 }
 function relatedQueries(db,uid,role,ids){
  if(!uuid(uid)||!['buyer','seller'].includes(role)||!ids.length||ids.length>PAGE||ids.some(id=>!uuid(id)))throw Error('Invalid order selection');
  const items=db.from('order_items').select('order_id,product_name,quantity,line_total').in('order_id',ids).limit(1000);
  const shipments=db.from('shipments').select('order_id,shipment_reference,shipment_status').eq(role==='buyer'?'buyer_id':'seller_id',uid).in('order_id',ids).limit(200);
  const payouts=role==='seller'?db.from('seller_payouts').select('order_id,payout_status,payout_amount,paid_at').eq('seller_id',uid).in('order_id',ids).limit(200):Promise.resolve({data:[],error:null});
  return [items,shipments,payouts];
 }
 const $=id=>document.getElementById(id),role=$('orderRole194f'),refresh=$('orderRefresh194f'),more=$('orderMore194f'),list=$('orderList194f'),status=$('orderStatus194f'),heading=$('orderHeading194f');
 if(!role||!refresh||!more||!list||!status||!heading)return;
 if(new URLSearchParams(location.search).get('role')==='seller')role.value='seller';
 const el=(tag,t)=>{const n=document.createElement(tag);if(t!==undefined)n.textContent=t;return n;};
 const link=(t,h)=>{const a=el('a',t);a.href=h;a.className='btn';return a;};
 const label=v=>String(v||'Not available').replaceAll('_',' ');
 const money=(v,c)=>{if(v==null||!Number.isFinite(Number(v)))return 'Not available';try{return new Intl.NumberFormat('en-ZA',{style:'currency',currency:c||'ZAR'}).format(Number(v));}catch{return 'Not available';}};
 let clientPromise,owner=null,offset=0,busy=false,current=role.value,generation=0,watching=false;
 function clearPrivate(){generation++;owner=null;offset=0;list.replaceChildren();more.hidden=true;}
 const authError=()=>Object.assign(Error('Sign in required'),{needsSignIn:true});
 async function session(){
  if(!clientPromise)clientPromise=import('https://esm.sh/@supabase/supabase-js@2.49.4').then(({createClient})=>createClient(BASE,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}})).catch(e=>{clientPromise=undefined;throw e;});
  const db=await clientPromise;
  if(!watching){watching=true;db.auth.onAuthStateChange((event,s)=>{if(event==='SIGNED_OUT'||(owner&&s?.user?.id!==owner)){clearPrivate();status.textContent='Sign-in changed. Refresh to view your orders.';}});}
  const {data:s,error:se}=await db.auth.getSession();if(se||!s?.session?.access_token)throw authError();
  const {data:u,error:ue}=await db.auth.getUser(s.session.access_token);if(ue||!uuid(u?.user?.id)||u.user.is_anonymous===true)throw authError();return {db,uid:u.user.id};
 }
 function card(o,kind,items,shipments,payouts){
  const a=el('article');a.append(el('h2',o.order_reference||'Product order'),el('p','Order: '+label(o.order_status)),el('p','Payment: '+label(o.payment_status)),el('p','Fulfilment: '+label(o.fulfilment_status)),el('p','Item total: '+money(o.product_total,o.currency)));
  if(o.created_at){const date=new Date(o.created_at);if(!Number.isNaN(date.getTime()))a.append(el('p',date.toLocaleDateString('en-ZA')));}
  if(items.error)a.append(el('p','Item details unavailable. Open order details to retry.'));
  else {const rows=items.data.filter(r=>r.order_id===o.id);if(rows.length){const ul=el('ul');for(const r of rows)ul.append(el('li',String(r.product_name||'Product')+' × '+String(r.quantity??'?')));a.append(ul);}else a.append(el('p','No item details returned.'));}
  a.append(link('View Order Details','./order.html?id='+encodeURIComponent(o.id)));
  if(kind==='buyer'&&o.order_reference)a.append(link('Track My Order','./tracking.html?order='+encodeURIComponent(o.order_reference)));
  if(kind==='seller'){
   if(shipments.error)a.append(el('p','Shipment details unavailable. Check the existing collection form.'));
   else {const rows=shipments.data.filter(r=>r.order_id===o.id);for(const r of rows)a.append(el('p','Shipment: '+(r.shipment_reference||'Reference unavailable')+' — '+label(r.shipment_status)));}
   if(o.payment_status==='paid'){a.append(el('p','After physical collection, choose the matching shipment in the existing courier reference form.'),link('Confirm Courier Collection','./account.html#seller-courier-pickup-panel'));}
   if(payouts.error)a.append(el('p','Payout information unavailable.'));
   else {const rows=payouts.data.filter(r=>r.order_id===o.id);if(!rows.length)a.append(el('p','No seller payout record is displayed yet. This does not confirm release.'));for(const r of rows)a.append(el('p','Recorded payout: '+label(r.payout_status)+' — '+money(r.payout_amount,o.currency)));}
   a.append(link('View Payout Statement','./payout-statement.html'));
  }
  return a;
 }
 function controls(on){busy=on;role.disabled=on;refresh.disabled=on;more.disabled=on;}
 function result(r){return {error:!!r.error,data:Array.isArray(r.data)?r.data:[]};}
 async function load(append=false){
  if(busy)return;if(!append){current=role.value;offset=0;list.replaceChildren();}controls(true);more.hidden=true;heading.textContent=current==='seller'?'My Sales':'My Purchases';status.textContent='Loading your private product orders…';
  try{const {db,uid}=await session();if(owner&&owner!==uid){clearPrivate();append=false;}owner=uid;const request=generation;
   const {data,error}=await ownerQuery(db,uid,current,offset);if(request!==generation)return;if(error||!Array.isArray(data)||data.some(o=>!uuid(o.id)))throw Error('Orders unavailable');
   const detail=data.length?await Promise.all(relatedQueries(db,uid,current,data.map(o=>o.id))):[];if(request!==generation)return;
   if(data.length){const [items,shipments,payouts]=detail.map(result);for(const o of data)list.append(card(o,current,items,shipments,payouts));}
   offset+=data.length;status.textContent=offset?offset+' order(s) displayed.':current==='seller'?'You have no product sales yet.':'You have no product purchases yet.';more.hidden=data.length<PAGE;
  }catch(e){if(e.needsSignIn){clearPrivate();status.replaceChildren(document.createTextNode('Please sign in to view your orders. '),link('Sign in','./sign-in.html'),link('Register','./register.html'));}else{status.textContent='Orders could not be loaded. Refresh or use Original My Orders.';more.hidden=!append;}}finally{controls(false);}
 }
 role.addEventListener('change',()=>load());refresh.addEventListener('click',()=>load());more.addEventListener('click',()=>load(true));window.addEventListener('pagehide',clearPrivate);window.addEventListener('pageshow',e=>{if(e.persisted)load();});load();
})();
