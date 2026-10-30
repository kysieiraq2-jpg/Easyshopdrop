/* Shop&Drop A150 — public alias product directory. No private profile reads. */
(function(){'use strict';
const endpoint='https://dtkdvvxpwonywtsgqmdx.supabase.co';
const key='sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';
const alias=new URLSearchParams(location.search).get('alias')?.trim()||'';
const title=document.getElementById('sellerTitle');
const status=document.getElementById('sellerStatus');
const container=document.getElementById('sellerProducts');
if(!alias||alias.length<2||alias.length>80){status.textContent='Invalid seller name.';return;}
title.textContent='Products from '+alias;
(async()=>{try{
 const response=await fetch(endpoint+'/rest/v1/rpc/shopdrop_public_seller_products',{
  method:'POST',headers:{'Content-Type':'application/json',apikey:key},
  body:JSON.stringify({p_alias:alias})
 });
 if(!response.ok)throw Error('Seller products are currently unavailable.');
 const products=await response.json();
 if(!Array.isArray(products))throw Error('Unexpected directory response.');
 status.textContent=products.length?'Showing '+products.length+' available products.':'No available products for this seller.';
 for(const p of products){
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(p.product_id||'')))continue;
  const article=document.createElement('article');article.className='item';
  const link=document.createElement('a');link.href='./product.html?id='+encodeURIComponent(p.product_id);
  link.textContent=String(p.product_title||'View product');
  const ref=document.createElement('p');ref.className='muted';ref.textContent='Listing: '+String(p.product_reference||'');
  const price=document.createElement('p');
  const amount=Number(p.product_price);
  price.textContent=Number.isFinite(amount)&&/^[A-Z]{3}$/.test(String(p.product_currency||''))?
   new Intl.NumberFormat(undefined,{style:'currency',currency:p.product_currency}).format(amount):'Price shown on product page';
  article.append(link,ref,price);container.append(article);
 }
}catch(e){status.textContent=e.message||'Unable to load products.';}
})();
})();