/* Shop&Drop Fix54: publicly accessible seller product photographs and cards.
   Existing seller-directory RPC, public aliases and private-data controls retained. */
(()=>{
  'use strict';
  const endpoint='https://dtkdvvxpwonywtsgqmdx.supabase.co';
  const key='sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';
  const headers={apikey:key,Accept:'application/json'};
  const alias=new URLSearchParams(location.search).get('alias')?.trim()||'';
  const title=document.getElementById('sellerTitle');
  const status=document.getElementById('sellerStatus');
  const container=document.getElementById('sellerProducts');
  const more=document.getElementById('sellerLoadMore');
  const valid=id=>/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(String(id||''));
  const pageSize=20;
  let products=[],offset=0,busy=false;
  if(!title||!status||!container||!more)return;
  if(!alias||alias.length<2||alias.length>80){status.textContent='Invalid seller name.';return;}
  title.textContent='Products from '+alias;

  function storageUrl(image){
    if(image.storage_bucket!=='listing-images')return null;
    const path=String(image.storage_path||'');
    const segments=path.split('/');
    if(!path||segments.some(s=>!s||s==='.'||s==='..'))return null;
    return endpoint+'/storage/v1/object/public/listing-images/'+
      segments.map(encodeURIComponent).join('/');
  }
  function photoPlaceholder(message){
    const div=document.createElement('div');
    div.className='shopdrop-photo-pending';
    div.textContent=message;
    return div;
  }
  function createCard(p){
    const article=document.createElement('article');
    article.className='item shopdrop-seller-product-card';
    const destination='./product.html?id='+encodeURIComponent(p.product_id);
    const photo=document.createElement('a');
    photo.className='shopdrop-seller-photo';
    photo.href=destination;
    photo.setAttribute('aria-label','View photographs and details for '+(p.product_title||'product'));
    photo.append(photoPlaceholder('Loading photograph…'));
    const heading=document.createElement('h2');
    heading.className='shopdrop-seller-title';
    const link=document.createElement('a');
    link.href=destination;
    link.textContent=String(p.product_title||'View product');
    heading.append(link);
    const price=document.createElement('p');
    price.className='shopdrop-seller-price';
    const amount=Number(p.product_price);
    price.textContent=Number.isFinite(amount)&&/^[A-Z]{3}$/.test(String(p.product_currency||''))
      ?new Intl.NumberFormat('en-ZA',{style:'currency',currency:p.product_currency}).format(amount)
      :'Price shown on product page';
    const reference=document.createElement('p');
    reference.className='muted shopdrop-seller-reference';
    reference.textContent='Item reference: '+String(p.product_reference||'Not available');
    article.append(photo,heading,price,reference);
    container.append(article);
    return {id:p.product_id,title:p.product_title,photo};
  }
  async function attachPhotos(cards){
    if(!cards.length)return;
    const ids=cards.map(c=>c.id);
    const params=new URLSearchParams({
      select:'product_id,storage_bucket,storage_path,is_primary,image_position',
      product_id:'in.('+ids.join(',')+')',
      order:'is_primary.desc,image_position.asc'
    });
    const pictures=new Map();
    try{
      const response=await fetch(endpoint+'/rest/v1/listing_images?'+params,{headers});
      if(!response.ok)throw Error('Photographs unavailable');
      const rows=await response.json();
      if(!Array.isArray(rows))throw Error('Invalid photograph response');
      for(const image of rows){
        const url=storageUrl(image);
        if(url&&!pictures.has(image.product_id))pictures.set(image.product_id,url);
      }
    }catch(error){console.warn('ShopDrop seller photographs:',error);}
    for(const card of cards){
      const url=pictures.get(card.id);
      if(!url){card.photo.replaceChildren(photoPlaceholder('Photograph unavailable'));continue;}
      const img=document.createElement('img');
      img.loading='lazy';img.decoding='async';
      img.alt='Photograph of '+(card.title||'product');
      img.onerror=()=>card.photo.replaceChildren(photoPlaceholder('Photograph unavailable'));
      img.src=url;
      card.photo.replaceChildren(img);
    }
  }
  async function showMore(){
    if(busy||offset>=products.length)return;
    busy=true;
    more.disabled=true;
    try{
      const next=products.slice(offset,offset+pageSize);
      const cards=next.map(createCard);
      offset+=next.length;
      more.hidden=offset>=products.length;
      status.textContent='Showing '+offset+' of '+products.length+' available products.';
      await attachPhotos(cards);
    }finally{busy=false;more.disabled=false;}
  }
  more.addEventListener('click',showMore);
  (async()=>{
    try{
      const response=await fetch(endpoint+'/rest/v1/rpc/shopdrop_public_seller_products',{
        method:'POST',headers:{...headers,'Content-Type':'application/json'},
        body:JSON.stringify({p_alias:alias})
      });
      if(!response.ok)throw Error('Seller products are currently unavailable.');
      const rows=await response.json();
      if(!Array.isArray(rows))throw Error('Unexpected seller product response.');
      products=rows.filter(p=>valid(p.product_id));
      if(!products.length){status.textContent='No available products from this seller.';return;}
      await showMore();
    }catch(error){status.textContent=error?.message||'Unable to load seller products.';}
  })();
})();
