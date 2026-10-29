// Phase 6C A75: authenticated cart/address bridge; no payment or order creation.
(function () {
  'use strict';
  const URL = 'https://dtkdvvxpwonywtsgqmdx.supabase.co';
  const KEY = 'sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';
  const $ = id => document.getElementById(id);
  const say = message => { $('orderStatus').textContent = message; };
  let clientPromise;
  let cart = [];
  function client() {
    if (!clientPromise) clientPromise = import('https://esm.sh/@supabase/supabase-js@2').then(m => m.createClient(URL, KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));
    return clientPromise;
  }
  async function current() {
    const db = await client();
    const {data,error} = await db.auth.getUser();
    if (error || !data?.user?.id) throw new Error('Sign in to view your shopping bag and addresses.');
    return {db, uid:data.user.id};
  }
  async function load() {
    try {
      const {db,uid} = await current();
      const [c,a] = await Promise.all([
        db.from('cart_items').select('id,product_id,quantity').eq('user_id',uid).order('created_at'),
        db.from('addresses').select('id,address_label,address_line_1,city,country_code,is_default').eq('user_id',uid).order('created_at')
      ]);
      if(c.error) throw c.error;
      if(a.error) throw a.error;
      cart = c.data || [];
      const list = $('items'); list.replaceChildren();
      if (!cart.length) list.textContent = 'Your shopping bag is empty.';
      for (const item of cart) {
        const div=document.createElement('div'); div.className='item';
        div.append(document.createTextNode('Product '+item.product_id+' — quantity '+item.quantity+' '));
        for(const [symbol,qty] of [['−',item.quantity-1],['+',item.quantity+1]]){
          const btn=document.createElement('button');btn.type='button';btn.textContent=symbol;
          btn.addEventListener('click',()=>change(item,qty));div.append(btn);
        }
        list.append(div);
      }
      $('total').textContent='Product prices and totals: awaiting trusted server quotation.';
      $('quote').textContent='Delivery fee and final payable total: not yet quoted.';
      const select=$('addresses');select.replaceChildren(new Option('Choose delivery address',''));
      for(const addr of a.data||[]){
        select.add(new Option([addr.address_label,addr.address_line_1,addr.city,addr.country_code].filter(Boolean).join(' — '),addr.id));
        if(addr.is_default) select.value=addr.id;
      }
      say('Cart and addresses loaded securely. Checkout/payment is not enabled.');
    } catch(e) {say('Cannot load cart/addresses: '+e.message);}
  }
  async function change(item,quantity){
    try{
      const {db,uid}=await current();
      const result=quantity<=0
        ?await db.from('cart_items').delete().eq('id',item.id).eq('user_id',uid)
        :await db.from('cart_items').update({quantity}).eq('id',item.id).eq('user_id',uid);
      if(result.error)throw result.error;
      await load();
    }catch(e){say('Cart update failed: '+e.message);}
  }
  async function saveAddress(){
    try{
      const {db,uid}=await current();
      const required=['recipient','line1','city','country'];
      if(required.some(id=>!$(id).value.trim()))throw new Error('Enter recipient, street, city and country.');
      const data={user_id:uid,address_label:$('label').value.trim()||'Delivery',recipient_name:$('recipient').value.trim(),address_line_1:$('line1').value.trim(),city:$('city').value.trim(),state_province:$('region').value.trim()||null,postal_code:$('postal').value.trim()||null,country_code:$('country').value.trim().toUpperCase(),is_default:false};
      const {error}=await db.from('addresses').insert(data);
      if(error)throw error;
      await load();say('Delivery address saved. Payment remains disabled.');
    }catch(e){say('Address save failed: '+e.message);}
  }
  function place(){
    const method=window.ShopDropPaymentSelection?.read();
    say(!method?'Choose a payment method. Payment remains disabled.':'Payment remains disabled until verified courier quotes, trusted totals and inventory reservation are connected. No order was placed.');
  }
  window.saveAddress=saveAddress;
  window.place=place;
  window.ShopDropPhase6CartAddress=Object.freeze({load});
  if(window.ShopDropGeo?.countryOptions) $('country').innerHTML=window.ShopDropGeo.countryOptions('ZA');
  load();
})();
