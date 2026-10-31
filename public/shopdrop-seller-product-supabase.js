/* Shop&Drop Phase6C A123 — additive product submission bridge.
   Seller target price remains the seller's full proceeds; fees are added at checkout.
   Supabase RLS is authoritative. Other seller/service handlers remain unchanged. */
(function(){
  'use strict';
  const URL='https://dtkdvvxpwonywtsgqmdx.supabase.co';
  const KEY='sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';
  let clientPromise;
  function client(){
    return clientPromise ||= import('https://esm.sh/@supabase/supabase-js@2')
      .then(m=>m.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}))
      .catch(e=>{clientPromise=null;throw e;});
  }
  const el=id=>document.getElementById(id);
  function value(id){return String(el(id)?.value??'').trim();}
  function positive(id,label){
    const n=Number(value(id));
    if(!value(id)||!Number.isFinite(n)||n<=0)throw Error('Enter a valid '+label+'.');
    return n;
  }
  // Optional private collection address; no address details are published on the listing.
  async function preparePickupAddresses(sb,userId){
    if(el('shopdropPickupAddress'))return;
    const anchor=el('shippingWeightKg');
    if(!anchor)return;
    const wrapper=document.createElement('div');
    wrapper.id='shopdropPickupAddressWrapper';
    const label=document.createElement('label');
    label.htmlFor='shopdropPickupAddress';
    label.textContent='Courier collection address (optional)';
    const select=document.createElement('select');
    select.id='shopdropPickupAddress';
    const fallback=new Option('Use my default registered address','');
    select.add(fallback);
    const {data,error}=await sb.from('addresses')
      .select('id,address_label,city,country_code,is_default')
      .eq('user_id',userId).order('is_default',{ascending:false});
    if(error)throw Error('Cannot load your private collection addresses: '+error.message);
    for(const a of data||[]){
      select.add(new Option([a.address_label||'Saved address',a.city,a.country_code]
        .filter(Boolean).join(' — '),a.id));
    }
    // Keep the default choice as an explicit saved address ID for item-level linkage.
    const defaultAddress=(data||[]).find(a=>a.is_default);
    if(defaultAddress){fallback.value=defaultAddress.id;}
    else if((data||[]).length){fallback.textContent='Choose a saved collection address';}
    else {fallback.textContent='Save a collection address in My Account first';}

    const hint=document.createElement('small');
    hint.textContent='To collect from another location, save that address privately in My Account first.';
    wrapper.append(label,select,hint);
    anchor.closest('label')?.after(wrapper) || anchor.parentElement?.after(wrapper);
  }
  async function initPickupAddress(){
    try{
      const sb=await client();
      const {data:{user}}=await sb.auth.getUser();
      if(user)await preparePickupAddresses(sb,user.id);
    }catch(e){console.warn('ShopDrop pickup address selector:',e);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initPickupAddress,{once:true});
  else initPickupAddress();
  async function submitProduct(){
    const status=el('productStatus');
    status.hidden=false;
    const button=document.querySelector('button[onclick="add()"]');
    if(button)button.disabled=true;
    try{
      const sb=await client();
      const {data:{user},error:authError}=await sb.auth.getUser();
      if(authError||!user)throw Error('Sign in to your seller account first.');
      const {data:profile,error:profileError}=await sb.from('profiles').select('role').eq('id',user.id).single();
      if(profileError||profile?.role!=='seller')throw Error('An approved seller account is required to list products.');
      const title=value('n'),category=value('mainCategory'),subcategory=value('c');
      const categoryName=el('mainCategory')?.selectedOptions?.[0]?.textContent?.trim();
      const subcategoryName=el('c')?.selectedOptions?.[0]?.dataset?.name || el('c')?.selectedOptions?.[0]?.textContent?.trim();
      if(!title||!category||!subcategory)throw Error('Enter product name and select both categories.');
      if(!el('releaseConfirm')?.checked)throw Error('Confirm you can hand the item to a courier.');
      const sellerTarget=positive('p','seller asking price');
      const quantity=Number(value('s'));
      if(!Number.isSafeInteger(quantity)||quantity<1)throw Error('Enter a whole-number stock quantity of at least 1.');
      const country=value('productCountry'),currency=value('productCurrency');
      if(!/^[A-Z]{2}$/.test(country)||!/^[A-Z]{3}$/.test(currency))throw Error('Select a valid country and currency.');
      const payload={
        seller_id:user.id,title,category:categoryName,subcategory:subcategoryName,
        condition:value('condition'),price:sellerTarget,currency,country_code:country,
        location:[value('productRegion'),value('productCity')].filter(Boolean).join(', ')||null,
        quantity,listing_status:'pending',
        shipping_weight_kg:positive('shippingWeightKg','packed weight'),
        shipping_length_cm:positive('shippingLengthCm','packed length'),
        shipping_width_cm:positive('shippingWidthCm','packed width'),
        shipping_height_cm:positive('shippingHeightCm','packed height')
      };
      const pickupAddressId=value('shopdropPickupAddress');
      if(el('shopdropPickupAddress') && !pickupAddressId){
        throw Error('Save or select a private courier collection address in My Account before listing.');
      }
      if(pickupAddressId){
        const {data:owned,error:addressError}=await sb.from('addresses')
          .select('id').eq('id',pickupAddressId).eq('user_id',user.id).maybeSingle();
        if(addressError||!owned)throw Error('Select a collection address belonging to your account.');
        payload.pickup_address_id=pickupAddressId;
      }
      const {data,error}=await sb.from('products').insert(payload).select('id,listing_reference,listing_status').single();
      if(error)throw Error('Listing could not be saved: '+error.message);
      status.textContent='Product submitted for approval. Reference: '+(data.listing_reference||data.id)+'. Seller asking price preserved.';
    }catch(e){status.textContent=e?.message||'Unable to submit product.';}
    finally{if(button)button.disabled=false;}
  }
  // This overrides only product submission, leaving services, photos, category and profile UI intact.
  window.add=submitProduct;
})();
