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
      // A152: display approved product names and trusted catalogue prices.
      // This is informational; the server must independently calculate checkout totals.
      const productIds = [...new Set(cart.map(row => row.product_id))];
      let productMap = new Map();
      if (productIds.length) {
        const {data: products, error: productError} = await db.from('products')
          .select('id,title,price,currency,quantity,listing_status')
          .in('id', productIds);
        if (productError) throw productError;
        productMap = new Map((products || []).map(product => [product.id, product]));
      }
      let subtotal = 0;
      let subtotalCurrency = null;
      let totalsAvailable = cart.length > 0;
      const list = $('items'); list.replaceChildren();
      if (!cart.length) list.textContent = 'Your shopping bag is empty.';
      for (const item of cart) {
        const div=document.createElement('div'); div.className='item';
        const product = productMap.get(item.product_id);
        const available = product && product.listing_status === 'active' &&
          Number(product.quantity) >= Number(item.quantity);
        const currency = String(product?.currency || '');
        const price = Number(product?.price);
        const validPrice = Number.isFinite(price) && price >= 0 && /^[A-Z]{3}$/.test(currency);
        if (!available || !validPrice) totalsAvailable = false;
        if (validPrice) {
          if (subtotalCurrency && subtotalCurrency !== currency) totalsAvailable = false;
          subtotalCurrency ||= currency;
          subtotal += price * Number(item.quantity);
        }
        let line = product?.title || 'Unavailable product';
        line += ' — quantity ' + item.quantity;
        if (validPrice) {
          try { line += ' — ' + new Intl.NumberFormat(undefined, {style:'currency',currency}).format(price * item.quantity); }
          catch (_) { totalsAvailable = false; }
        }
        if (!available) line += ' — unavailable or insufficient stock';
        div.append(document.createTextNode(line + ' '));
        for(const [symbol,qty] of [['−',item.quantity-1],['+',item.quantity+1]]){
          const btn=document.createElement('button');btn.type='button';btn.textContent=symbol;
          btn.addEventListener('click',()=>change(item,qty));div.append(btn);
        }
        list.append(div);
      }
      $('total').textContent = totalsAvailable
        ? 'Indicative product subtotal: ' + new Intl.NumberFormat(undefined,{style:'currency',currency:subtotalCurrency}).format(subtotal)
        : 'Product subtotal unavailable; check item availability and currency.';
      $('quote').textContent='Delivery fee and final payable total: not yet quoted.';
      const select=$('addresses');select.replaceChildren(new Option('Choose delivery address',''));
      for(const addr of a.data||[]){
        select.add(new Option([addr.address_label,addr.address_line_1,addr.city,addr.country_code].filter(Boolean).join(' — '),addr.id));
        if(addr.is_default) select.value=addr.id;
      }
      say('Cart and addresses loaded securely. Secure order creation available; payment is not yet enabled.');
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
  let creatingOrder = false;
  let pendingOrderId = null;
  async function place(){
    if (creatingOrder) return;
    const button=$('previewOrderButton');
    creatingOrder=true;
    if(button) button.disabled=true;
    try {
      await current();
      if (!cart.length) throw Error('Add a product to your shopping bag first.');
      if (!$('addresses').value) throw Error('Select a delivery address first.');
      if (!window.ShopDropCheckoutConnector?.createOrder) throw Error('Secure order connector is unavailable.');
      if (pendingOrderId) {
        const method=window.ShopDropPaymentSelection?.read();
        if (!method) throw Error('Choose a payment method first.');
        const courier=window.ShopDropCourierSelection;
        if (!courier?.isBookingEnabled?.() || !courier?.getSelected?.()) {
          throw Error('A verified courier quote is required before payment. Courier integration is the next activation step.');
        }
        const createSession=window.ShopDropSupabaseAdapter?.authenticatedFunctions?.createPaymentSession;
        if (typeof createSession!=='function') throw Error('Secure payment connector unavailable.');
        const payment=await createSession({order_id:pendingOrderId,delivery_method:'integrated_courier'});
        if (payment?.ok===false || payment?.error) throw Error(payment.error||'Payment session was not created.');
        const checkoutUrl=payment?.checkout_url||payment?.redirect_url||payment?.url;
        if (checkoutUrl) {
          const parsed=new URL(checkoutUrl);
          if (parsed.protocol!=='https:') throw Error('Payment provider returned an invalid checkout URL.');
          say('Payment session created. Opening secure payment provider.');
          window.location.assign(parsed.href);
        } else {
          say('Payment session response received. Awaiting supported provider checkout URL; no payment taken on this page.');
        }
        return;
      }
      const items=cart.map(x=>({product_id:x.product_id,quantity:Number(x.quantity)}));
      const result=await window.ShopDropCheckoutConnector.createOrder(items);
      const order=result?.order || result?.data?.order || result;
      const reference=order?.id || result?.order_id || result?.id;
      if (reference && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(String(reference))) {
        pendingOrderId=String(reference);
        if(button) button.textContent='Continue to secure payment';
      }
      say(reference ? 'Secure order created: '+reference+'. Select a verified courier quote, then continue to payment.' : 'Secure order request accepted. No payment taken. Check your order status before trying again.');
      // Keep the stable request ID until checkout/payment is safely completed.
    } catch(e) {say('Order creation failed: '+(e?.message||'Please try again.'));}
    finally {creatingOrder=false;if(button)button.disabled=false;}
  }
  const button=$('previewOrderButton');
  if(button) button.textContent='Create secure order';
  window.saveAddress=saveAddress;
  window.place=place;
  window.ShopDropPhase6CartAddress=Object.freeze({load,getPendingOrderId:()=>pendingOrderId});
  if(window.ShopDropGeo?.countryOptions) $('country').innerHTML=window.ShopDropGeo.countryOptions('ZA');
  load();
})();
