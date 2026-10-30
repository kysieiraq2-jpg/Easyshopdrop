/* Shop&Drop A153: cumulative Supabase product detail and authenticated cart integration.
   Only approved/in-stock product columns are selected. The old API handlers
   remain in product.html but are not invoked on GitHub Pages. Cart writes use authenticated Supabase; inventory is reserved at checkout. */
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
      notice.textContent='Add products to your shopping bag. Stock is reserved during secure checkout, not while browsing. Seller contact details remain private.';
      const cartControls=document.createElement('div');
      const qtyLabel=document.createElement('label');qtyLabel.textContent='Quantity ';
      const qtyInput=document.createElement('input');qtyInput.type='number';qtyInput.min='1';qtyInput.max=String(p.quantity);qtyInput.value='1';qtyInput.style.maxWidth='90px';
      const cartButton=document.createElement('button');cartButton.type='button';cartButton.textContent='Add to shopping bag';
      const cartStatus=document.createElement('p');cartStatus.className='muted';cartStatus.setAttribute('role','status');
      qtyLabel.append(qtyInput);cartControls.append(qtyLabel,cartButton,cartStatus);
      cartButton.addEventListener('click',async()=>{
        cartButton.disabled=true;
        try{
          const qty=Number(qtyInput.value);
          if(!Number.isSafeInteger(qty)||qty<1||qty>Number(p.quantity))throw Error('Select an available whole-number quantity.');
          const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2');
          const sb=createClient(endpoint,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
          const {data:{user},error:authError}=await sb.auth.getUser();
          if(authError||!user)throw Error('Please sign in before adding items.');
          const {data:existing,error:lookupError}=await sb.from('cart_items').select('id,quantity').eq('user_id',user.id).eq('product_id',p.id).limit(1);
          if(lookupError)throw lookupError;
          const prior=existing?.[0];
          const total=qty+Number(prior?.quantity||0);
          if(total>Number(p.quantity))throw Error('Requested quantity exceeds currently listed stock.');
          const result=prior
            ?await sb.from('cart_items').update({quantity:total}).eq('id',prior.id).eq('user_id',user.id)
            :await sb.from('cart_items').insert({user_id:user.id,product_id:p.id,quantity:qty});
          if(result.error)throw result.error;
          cartStatus.replaceChildren(document.createTextNode('Added to shopping bag. '));
          const checkoutLink=document.createElement('a');
          checkoutLink.href='./checkout.html';
          checkoutLink.textContent='Go to shopping bag / checkout';
          cartStatus.append(checkoutLink);
        }catch(e){cartStatus.textContent=e?.message||'Unable to update shopping bag.';}
        finally{cartButton.disabled=false;}
      });
      detail.replaceChildren(title,ref,price,stock,notice,cartControls);
      if(reviews)reviews.textContent='Verified customer reviews will appear when connected.';
    }catch(e){detail.textContent=e?.message||'Product details unavailable.';}
  }
  load();
})();
