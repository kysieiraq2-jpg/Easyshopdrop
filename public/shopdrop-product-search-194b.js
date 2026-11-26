(() => {
 'use strict';
 const BASE='https://dtkdvvxpwonywtsgqmdx.supabase.co',KEY='sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';
 const PAGE=24, headers={apikey:KEY,Accept:'application/json'};
 const HANDMADE_GROUP='__handmade_194c__';
 let tax198a=null;
 // Query only public catalogue fields; no account, cart, payment or address writes.
 function queryFor(f,offset){
  const p=new URLSearchParams({select:'id,title,category,subcategory,condition,price,currency,location',listing_status:'eq.active',quantity:'gt.0',country_code:'eq.ZA',order:'created_at.desc,id.asc',limit:String(PAGE),offset:String(offset)});
  if(f.category===HANDMADE_GROUP)ShopDropCategory198a.applyHandmade(p,tax198a);
  else if(f.category)ShopDropCategory198a.applyCategory(p,tax198a,f.category,f.subcategory);
  if(f.condition==='preowned')p.set('condition','not.ilike.new');
  else if(['new','used','like_new','refurbished'].includes(f.condition))p.set('condition','eq.'+f.condition);
  const like=s=>s.replace(/[\\%_]/g,c=>'\\'+c);
  if(f.province)p.set('location','ilike.'+(f.town?like(f.town)+', '+like(f.province):'*, '+like(f.province)));
  ShopDropCategory198a.applySearch(p,f.term);
  return p;
 }
 const $=id=>document.getElementById(id), form=$('productSearch194b'), category=$('category194b'),sub=$('subcategory194b'),condition=$('condition194b'),province=$('province194b'),town=$('town194b'),term=$('term194b'),search=$('search194b'),clear=$('clear194b'),more=$('more194b'),status=$('status194b'),results=$('shopdropPublicProductResults');
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
 const sorted=a=>[...new Set(a.filter(x=>typeof x==='string'&&x.trim()))].sort((a,b)=>a.localeCompare(b,'en-ZA',{sensitivity:'base'}));
 function fill(s,values,label){s.replaceChildren(new Option(label,''));for(const value of sorted(values))s.add(new Option(value,value));}
 const catalog=new Map();let places={},current=null,offset=0,busy=false,buyerPicker198g=null;
 async function get(url,opts){const r=await fetch(url,opts);if(!r.ok)throw Error('Catalogue unavailable');return r.json();}
 function updateSubs(){const values=catalog.get(category.value)||[];fill(sub,values,'All subcategories');sub.disabled=!category.value||category.value===HANDMADE_GROUP;}
 function updateTowns(){const values=places[province.value]||[];fill(town,values,'All towns in province');town.disabled=!province.value;}
 function filters(){return {category:category.value,subcategory:sub.value,condition:condition.value,province:province.value,town:town.value,term:term.value};}
 function imageUrl(row){const path=String(row.storage_path||'');if(row.storage_bucket!=='listing-images'||!path||path.startsWith('/')||path.split('/').includes('..'))return null;return BASE+'/storage/v1/object/public/listing-images/'+path.split('/').map(encodeURIComponent).join('/');}
 async function photos(rows){const ids=rows.map(x=>x.id).filter(uuid),m=new Map();if(!ids.length)return m;const p=new URLSearchParams({select:'product_id,storage_bucket,storage_path,is_primary,image_position',product_id:'in.('+ids.join(',')+')',order:'image_position.asc'});try{const data=await get(BASE+'/rest/v1/listing_images?'+p,{headers});if(Array.isArray(data))for(const row of data){const url=imageUrl(row);if(url&&(!m.has(row.product_id)||(!m.get(row.product_id).primary&&row.is_primary===true)))m.set(row.product_id,{url,primary:row.is_primary===true});}}catch{}return m;}
 const names={new:'New',used:'Second-hand / Used',like_new:'Like new',refurbished:'Refurbished'};
 function card(p,img){const a=el('a');a.className='card';a.href='./product.html?id='+encodeURIComponent(p.id);const placeholder=el('div','Photograph unavailable');placeholder.className='photo-empty';if(img?.url){const i=el('img');i.src=img.url;i.alt='Photograph of '+(p.title||'product');i.loading='lazy';i.decoding='async';i.referrerPolicy='no-referrer';i.addEventListener('error',()=>i.replaceWith(placeholder),{once:true});a.append(i);}else a.append(placeholder);a.append(el('h3',p.title||'Product'),el('p',[...ShopDropCategory198a.label(tax198a,p.category,p.subcategory),names[p.condition]||p.condition,p.location].filter(Boolean).join(' · ')));const value=Number(p.price);const price=el('p',Number.isFinite(value)?new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(value):'Price unavailable');price.className='price';a.append(price,el('p','View product details'));return a;}
 function controls(on){busy=on;search.disabled=on;clear.disabled=on;more.disabled=on;}
 async function load(append=false){if(busy)return;if(!append){current=filters();offset=0;results.replaceChildren();}if(!current)return;controls(true);more.hidden=true;status.textContent='Loading available products…';try{const rows=await get(BASE+'/rest/v1/products?'+queryFor(current,offset),{headers});if(!Array.isArray(rows)||rows.some(p=>!uuid(p.id)))throw Error('Invalid catalogue response');const images=await photos(rows);for(const p of rows)results.append(card(p,images.get(p.id)));offset+=rows.length;status.textContent=offset?offset+' product(s) displayed.':'No available products match your filters. Try fewer filters.';more.hidden=rows.length<PAGE;}catch{status.textContent='Products are temporarily unavailable. Search again or use the original categories page.';more.hidden=!append;}finally{controls(false);}}
 category.addEventListener('change',updateSubs);province.addEventListener('change',updateTowns);form.addEventListener('submit',e=>{e.preventDefault();load();});more.addEventListener('click',()=>load(true));clear.addEventListener('click',()=>{if(busy)return;form.reset();updateSubs();updateTowns();buyerPicker198g?.reset();load();});
 async function init(){const incomingTerm=(new URLSearchParams(location.search).get('q')||'').trim().slice(0,100);if(incomingTerm)term.value=incomingTerm;try{const [tax,loc]=await Promise.all([get('./taxonomy.json',{cache:'no-store'}),get('./shopdrop-sa-towns-181.json')]);if(!Array.isArray(tax.departments)||loc.country!=='ZA'||!loc.provinces||typeof loc.provinces!=='object')throw Error('Invalid search options');tax198a=tax;for(const d of ShopDropCategory198a.publicDepartments(tax))if(typeof d.name==='string'&&Array.isArray(d.subcategories))catalog.set(d.name,d.subcategories);places=loc.provinces;fill(category,[...catalog.keys()],'All categories');const handmadeAvailable=['Arts, Crafts & Handmade','Homemade Food & Pantry'].every(name=>tax.departments.some(d=>d.name===name));if(handmadeAvailable)category.add(new Option('Handmade & homemade categories (both)',HANDMADE_GROUP),1);fill(province,Object.keys(places),'All provinces');const view=new URLSearchParams(location.search).get('view');if(['new','preowned'].includes(view))condition.value=view;else if(view==='handmade'){if(!handmadeAvailable)throw Error('Handmade categories unavailable');category.value=HANDMADE_GROUP;}updateSubs();updateTowns();buyerPicker198g=window.ShopDropBuyerPicker198g?.bind();controls(false);await load();}catch{status.textContent='Search options are unavailable. Use the original product categories or refresh this page.';}finally{if(incomingTerm){document.getElementById('shopdropSearchResults197a')?.scrollIntoView({behavior:'auto',block:'start'});}}}
 init();
})();
