(() => {
 'use strict';
 const BASE='https://dtkdvvxpwonywtsgqmdx.supabase.co',KEY='sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';
 const PAGE=24;
 const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
 function ownerQuery(db,uid,filter,offset){
  if(!uuid(uid)||!Number.isSafeInteger(offset)||offset<0||!['all','available','pending','out','other'].includes(filter))throw Error('Invalid listing request');
  let q=db.from('products').select('id,title,category,subcategory,condition,price,currency,country_code,quantity,listing_status,listing_reference,created_at').eq('seller_id',uid).eq('country_code','ZA');
  if(filter==='available')q=q.eq('listing_status','active').gt('quantity',0);
  else if(filter==='pending')q=q.eq('listing_status','pending');
  else if(filter==='out')q=q.eq('listing_status','active').lte('quantity',0);
  else if(filter==='other')q=q.not('listing_status','in','(active,pending)');
  return q.order('created_at',{ascending:false}).order('id',{ascending:true}).range(offset,offset+PAGE-1);
 }
 const $=id=>document.getElementById(id), filter=$('sellerAdsFilter194d'),refresh=$('sellerAdsRefresh194d'),status=$('sellerAdsStatus194d'),list=$('sellerAdsList194d'),more=$('sellerAdsMore194d');
 if(!filter||!refresh||!status||!list||!more)return;
 const el=(tag,t)=>{const n=document.createElement(tag);if(t!==undefined)n.textContent=t;return n;};
 const link=(t,h)=>{const a=el('a',t);a.href=h;a.className='btn';return a;};
 const label=s=>({active:'Active',pending:'Unfinished / pending',draft:'Draft',approved:'Approved',archived:'Archived',suspended:'Suspended',rejected:'Rejected',sold:'Sold'})[s]||String(s||'Unknown').replaceAll('_',' ');
 let clientPromise,owner=null,offset=0,busy=false,current='all',sessionGeneration=0,watching=false;
 function authRequired(){return Object.assign(Error('Sign in required'),{needsSignIn:true});}
 function clearPrivate(){sessionGeneration++;owner=null;offset=0;list.replaceChildren();more.hidden=true;}
 async function session(){
  if(!clientPromise)clientPromise=import('https://esm.sh/@supabase/supabase-js@2.49.4').then(({createClient})=>createClient(BASE,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}})).catch(e=>{clientPromise=undefined;throw e;});
  const db=await clientPromise;
  if(!watching){watching=true;db.auth.onAuthStateChange((event,s)=>{if(event==='SIGNED_OUT'||(owner&&s?.user?.id!==owner)){clearPrivate();status.textContent='Your sign-in changed. Refresh to view your advertisements.';}});}
  const {data:s,error:se}=await db.auth.getSession();if(se||!s?.session?.access_token)throw authRequired();
  const {data:u,error:ue}=await db.auth.getUser(s.session.access_token);if(ue||!uuid(u?.user?.id)||u.user.is_anonymous===true)throw authRequired();
  return {db,uid:u.user.id};
 }
 async function photos(db,rows){
  const ids=rows.filter(r=>r.listing_status==='active'&&Number(r.quantity)>0).map(r=>r.id).filter(uuid),result=new Map();
  if(!ids.length)return result;
  try{const {data,error}=await db.from('listing_images').select('product_id,storage_bucket,storage_path,is_primary,image_position').in('product_id',ids).order('image_position',{ascending:true});if(error||!Array.isArray(data))return result;
   for(const r of data){const path=String(r.storage_path||'');if(!ids.includes(r.product_id)||r.storage_bucket!=='listing-images'||!path||path.startsWith('/')||path.split('/').includes('..'))continue;
    if(!result.has(r.product_id)||(!result.get(r.product_id).primary&&r.is_primary===true))result.set(r.product_id,{url:BASE+'/storage/v1/object/public/listing-images/'+path.split('/').map(encodeURIComponent).join('/'),primary:r.is_primary===true});}
  }catch{}return result;
 }
 function card(p,photo){const a=el('article');
  if(photo){const im=el('img');im.src=photo.url;im.alt='Photograph of '+(p.title||'product');im.loading='lazy';im.referrerPolicy='no-referrer';im.addEventListener('error',()=>im.remove(),{once:true});a.append(im);}
  a.append(el('h2',p.title||'Product advertisement'),el('p',[p.category,p.subcategory,p.condition].filter(Boolean).join(' · ')),el('p','Publication status: '+label(p.listing_status)),el('p','Listed quantity: '+String(p.quantity??'Unavailable')));
  if(p.listing_reference)a.append(el('p','Item reference: '+p.listing_reference));
  if(p.price!==null&&p.price!==undefined&&Number.isFinite(Number(p.price))&&p.currency==='ZAR')a.append(el('p','Your advertised price: '+new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(Number(p.price))));
  if(p.listing_status==='active'&&Number(p.quantity)>0)a.append(link('View public advertisement','./product.html?id='+encodeURIComponent(p.id)));
  else if(p.listing_status==='pending'){a.append(el('p','Choose this saved item in the original selling form.'),link('Open unfinished advertisements','./sell-item.html'));}
  return a;
 }
 function controls(value){busy=value;filter.disabled=value;refresh.disabled=value;more.disabled=value;}
 async function load(append=false){
  if(busy)return;controls(true);more.hidden=true;status.textContent='Checking your private advertisements…';
  if(!append){clearPrivate();current=filter.value;}
  const generation=sessionGeneration;
  try{const {db,uid}=await session();if(generation!==sessionGeneration)return;if(owner&&owner!==uid){clearPrivate();throw authRequired();}owner=uid;
   const {data,error}=await ownerQuery(db,uid,current,offset);
   if(error||!Array.isArray(data)||data.some(p=>!uuid(p.id)))throw Error('Listings unavailable');
   const pictures=await photos(db,data);
   if(generation!==sessionGeneration||owner!==uid)return;
   for(const p of data)list.append(card(p,pictures.get(p.id)));
   offset+=data.length;more.hidden=data.length<PAGE;
   status.textContent=offset?offset+' of your advertisement(s) displayed.':'No advertisements match this selection.';
  }catch(e){clearPrivate();status.textContent=e?.needsSignIn?'Sign in to view your private advertisements.':'Your advertisements are temporarily unavailable. Refresh to try again.';if(e?.needsSignIn)status.append(link('Sign in','./sign-in.html?next=my-product-advertisements-194d.html'));}
  finally{controls(false);}
 }
 filter.addEventListener('change',()=>load());refresh.addEventListener('click',()=>load());more.addEventListener('click',()=>load(true));window.addEventListener('pagehide',clearPrivate);window.addEventListener('pageshow',e=>{if(e.persisted)load();});load();
})();
