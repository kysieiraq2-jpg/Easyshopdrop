/* Fix52: public names and references only, never private profile fields. */
(()=>{
 'use strict';
 const endpoint='https://dtkdvvxpwonywtsgqmdx.supabase.co';
 const key='sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';
 const seen=new WeakSet();
 let scheduled=false;
 const valid=id=>/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(String(id||''));
 function productId(card){
  const a=card.matches('a[href*="product.html?id="]')?card:card.querySelector('a[href*="product.html?id="]');
  if(!a)return '';
  try{return new URL(a.href,location.href).searchParams.get('id')||'';}catch(_){return '';}
 }
 const candidates=[
  {kind:'product',selector:'#items a.item, #shopdropPublicProductResults a.card, #productGrid article.card, #sellerProducts article.item',getId:productId},
  {kind:'service',selector:'#results article.result[data-service-id]',getId:el=>el.dataset.serviceId},
  {kind:'dispatch_offer',selector:'#shopdrop-dispatch-offers [data-shopdrop-offer-id]',getId:el=>el.dataset.shopdropOfferId}
 ];
 async function bearer(){
  try{
   const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2');
   const client=createClient(endpoint,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
   const {data}=await client.auth.getSession();
   return data?.session?.access_token||'';
  }catch(_){return '';}
 }
 async function lookup(kind,ids){
  const auth=kind==='dispatch_offer'?await bearer():'';
  if(kind==='dispatch_offer'&&!auth)return [];
  const headers={apikey:key,Accept:'application/json','Content-Type':'application/json'};
  if(auth)headers.Authorization='Bearer '+auth;
  const response=await fetch(endpoint+'/rest/v1/rpc/shopdrop_public_listing_identity',{
   method:'POST',headers,body:JSON.stringify({p_kind:kind,p_listing_ids:ids})
  });
  if(!response.ok)throw Error('Public advertiser details unavailable');
  const rows=await response.json();
  return Array.isArray(rows)?rows:[];
 }
 function syncProductDetailIdentity(){
      const detail=document.getElementById('detail');
      const gallery=detail?.querySelector('section[aria-label="Product photographs"]');
      const source=document.getElementById('shopdropSellerAliasContent')?.querySelector('.shopdrop-public-identity');
      if(!gallery||!source||detail.querySelector('.shopdrop-detail-advertiser'))return;
      const banner=source.cloneNode(true);
      banner.classList.add('shopdrop-detail-advertiser','shopdrop-identity-top');
      gallery.before(banner);
    }
    function present(element,kind,row){
  const box=document.createElement('div');
  box.className='shopdrop-public-identity';
  const name=document.createElement('strong');
  const noun=kind==='service'?'Service provider':kind==='dispatch_offer'?'Transport provider':'Seller';
  name.textContent=noun+': '+(row?.advertiser_alias||'Public name not yet set');
  box.append(name);
  if(row?.advertiser_reference){
   const ref=document.createElement('small');
   ref.textContent='Advertiser reference: '+row.advertiser_reference;
   box.append(ref);
  }
  if(row?.listing_reference){
   const item=document.createElement('small');
   item.textContent=(kind==='product'?'Item':kind==='service'?'Service':'Transport offer')+' reference: '+row.listing_reference;
   box.append(item);
  }
  if(!row){
   const note=document.createElement('small');
   note.textContent='Verified public advertiser information unavailable';
   box.append(note);
  }
  if(kind==='product'&&element.id==='shopdropSellerAliasPanel'&&row?.advertiser_alias){
   const link=document.createElement('a');
   link.href='./seller-products.html?alias='+encodeURIComponent(row.advertiser_alias);
   link.textContent='View more products from this seller';
   box.append(link);
  }
  if(element.id==='shopdropSellerAliasPanel'){
   const content=document.getElementById('shopdropSellerAliasContent');
   if(content){content.replaceChildren(box);element.hidden=false;syncProductDetailIdentity();}
  }else{
   const heading=element.querySelector('h2,h3');
   element.prepend(box);
  }
 }
 async function scan(){
  const groups=new Map();
  for(const c of candidates){
   for(const node of document.querySelectorAll(c.selector)){
    if(seen.has(node))continue;
    const id=c.getId(node);
    if(!valid(id))continue;
    seen.add(node);
    if(!groups.has(c.kind))groups.set(c.kind,[]);
    groups.get(c.kind).push({node,id});
   }
  }
  const detail=document.getElementById('shopdropSellerAliasPanel');
  const product=new URLSearchParams(location.search).get('id');
  if(detail&&valid(product)&&!seen.has(detail)){
   seen.add(detail);
   if(!groups.has('product'))groups.set('product',[]);
   groups.get('product').push({node:detail,id:product});
  }
  for(const [kind,items] of groups){
   for(let i=0;i<items.length;i+=50){
    const batch=items.slice(i,i+50);
    try{
     const rows=await lookup(kind,[...new Set(batch.map(x=>x.id))]);
     const byId=new Map(rows.map(row=>[row.listing_id,row]));
     for(const item of batch)present(item.node,kind,byId.get(item.id));
    }catch(error){
     console.warn('ShopDrop advertiser display:',error);
     for(const item of batch)present(item.node,kind,null);
    }
   }
  }
  syncProductDetailIdentity();
 }
 function schedule(){
  if(scheduled)return;
  scheduled=true;
  queueMicrotask(()=>{scheduled=false;scan().catch(console.error);});
 }
 function start(){
  const observer=new MutationObserver(schedule);
  observer.observe(document.body,{subtree:true,childList:true});
  schedule();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
 else start();
})();
