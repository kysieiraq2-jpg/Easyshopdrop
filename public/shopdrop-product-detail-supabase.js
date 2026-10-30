/* Shop&Drop A152: read-only Supabase product detail integration.
   Only approved/in-stock product columns are selected. The old API handlers
   remain in product.html but are not invoked on GitHub Pages. Cart/payment
   are deliberately not enabled by this read-only bridge. */
(function(){
  'use strict';
  const endpoint='https://dtkdvvxpwonywtsgqmdx.supabase.co';
  const key='sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';
  const id=new URLSearchParams(location.search).get('id')||'';
  const detail=document.getElementById('detail');
  const reviews=document.getElementById('reviews');
  if(!detail)return;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)){
    detail.textContent='Invalid product reference.';return;
  }
  async function load(){
    try{
      const url=endpoint+'/rest/v1/products?select=id,title,price,currency,quantity,listing_reference,listing_status&id=eq.'+encodeURIComponent(id)+'&listing_status=eq.active&quantity=gt.0&limit=1';
      const r=await fetch(url,{headers:{apikey:key,Accept:'application/json'}});
      if(!r.ok)throw Error('Product details are currently unavailable.');
      const rows=await r.json();const p=Array.isArray(rows)?rows[0]:null;
      if(!p){detail.textContent='This product is unavailable.';return;}
      const title=document.createElement('h1');title.textContent=p.title||'Product';
      const ref=document.createElement('p');ref.className='muted';ref.textContent='Listing reference: '+(p.listing_reference||'Pending');
      const price=document.createElement('h2');
      const amount=Number(p.price),cur=String(p.currency||'');
      price.textContent=Number.isFinite(amount)&&/^[A-Z]{3}$/.test(cur)?
        new Intl.NumberFormat(undefined,{style:'currency',currency:cur}).format(amount):'Price unavailable';
      const stock=document.createElement('p');stock.textContent='Available quantity: '+Number(p.quantity||0);
      const notice=document.createElement('p');notice.className='muted';
      notice.textContent='Shopping bag and payment are not yet enabled on this integration preview. Seller contact details remain private.';
      detail.replaceChildren(title,ref,price,stock,notice);
      if(reviews)reviews.textContent='Verified customer reviews will appear when connected.';
    }catch(e){detail.textContent=e?.message||'Product details unavailable.';}
  }
  load();
})();
