
 // Phase 6C A75: authenticated cart/address bridge; no payment or order creation.
(function () {
  'use strict';
  const URL = 'https://dtkdvvxpwonywtsgqmdx.supabase.co';
  const KEY = 'sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';
  const $ = id => document.getElementById(id);
  const say = (message, error) => {
    const status = $('orderStatus');
    status.textContent = message;
    if (!error?.needsSignIn) return;
    for (const [page, label] of [['sign-in.html','Sign in'],['register.html','Create account']]) {
      const link = document.createElement('a');
      link.href = window.ShopDropReturn199h?.authLink(page) || './'+page+'?next=checkout.html';
      link.textContent = label;
      status.append(document.createTextNode(' '),link);
    }
  };
  let clientPromise;
  let cart = [];
  let checkoutOwner200b=null,checkoutEpoch200b=0,checkoutLocked200b=false,checkoutReady200b=false,loadSequence200b=0;
  function clearCheckoutDisplay200b(){
    checkoutReady200b=false;cart=[];
    $('items').replaceChildren();$('items').textContent='Shopping bag not available. Refresh or sign in again.';
    $('addresses').replaceChildren();$('selectedAddressSummary').textContent='';
    $('savedAddressArea').hidden=true;$('savedAddressPicker').hidden=true;$('newAddressFields').hidden=true;
    $('cancelAddAddress').hidden=true;$('total').textContent='Product subtotal unavailable.';
    $('quote').textContent='Delivery fee and final payable total: not yet quoted.';
    $('previewOrderButton').disabled=true;
    window.ShopDropSingleCourier199da?.clear('Verify your shopping bag and delivery address before continuing.');
  }
  function lockCheckout200b(preserveCountdown=false){
    if(checkoutLocked200b)return;
    checkoutLocked200b=true;checkoutEpoch200b++;loadSequence200b++;checkoutOwner200b=null;
    pendingOrderId=null;pendingOrderAddressId=null;pendingOrderCartSignature=null;
    clearCheckoutDisplay200b();if(!preserveCountdown)window.ShopDropReservationCountdown?.clear?.();
    for(const id of ['label','recipient','line1','city','region','postal']){
      const field=$(id);if(field)field.value='';
    }
    $('saveDeliveryAddressButton').disabled=true;$('addAnotherAddressButton').disabled=true;
    $('addressStatus').textContent='Sign-in changed. Reload this page before continuing.';
    say('Sign-in changed. Please reload or sign in again.',{needsSignIn:true});
  }
  function assertCheckout200b(epoch){
    if(checkoutLocked200b||epoch!==checkoutEpoch200b)throw Object.assign(Error('Sign-in changed. Reload checkout.'),{needsSignIn:true});
  }
  function client() {
    if (!clientPromise) clientPromise = import('https://esm.sh/@supabase/supabase-js@2').then(m => {
      const db=m.createClient(URL, KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      db.auth.onAuthStateChange((event,session)=>{
        if(event==='SIGNED_OUT'||(checkoutOwner200b&&session?.user?.id!==checkoutOwner200b))lockCheckout200b();
      });
      return db;
    }).catch(error=>{clientPromise=null;throw error;});
    return clientPromise;
  }
  async function current() {
    const epoch=checkoutEpoch200b;assertCheckout200b(epoch);
    const db = await client();
    const {data,error} = await db.auth.getUser();
    assertCheckout200b(epoch);
    if (error || !data?.user?.id || (checkoutOwner200b&&checkoutOwner200b!==data.user.id)) {
      if(checkoutOwner200b)lockCheckout200b();
      throw Object.assign(new Error('Sign in to view your shopping bag and addresses.'),{needsSignIn:true});
    }
    checkoutOwner200b=data.user.id;
    return {db, uid:data.user.id,epoch};
  }
  async function load(preferredAddressId = '') {
    if(checkoutLocked200b)return false;
    const seq=++loadSequence200b;checkoutReady200b=false;$('previewOrderButton').disabled=true;
    try {
      const {db,uid,epoch} = await current();
      const [c,a] = await Promise.all([
        db.from('cart_items').select('id,product_id,quantity').eq('user_id',uid).order('created_at'),
        db.from('addresses').select('id,address_label,address_line_1,city,country_code,is_default').eq('user_id',uid).order('created_at')
      ]);
      if(c.error) throw c.error;
      if(a.error) throw a.error;
      const nextCart = c.data || [];
      // A152: display approved product names and trusted catalogue prices.
      // This is informational; the server must independently calculate checkout totals.
      // Listing reference added for permanent item identification.
      const productIds = [...new Set(nextCart.map(row => row.product_id))];
      let productMap = new Map();
      if (productIds.length) {
        const {data: products, error: productError} = await db.from('products')
          .select('id,title,price,currency,quantity,listing_status,listing_reference')
          .in('id', productIds);
        if (productError) throw productError;
        productMap = new Map((products || []).map(product => [product.id, product]));
      }
      // Fix 14: Public seller aliases only, resolved through the restricted product RPC.
      // Never read private seller profiles or expose seller identifiers in the bag.
      const aliasMap = new Map();
      if (productIds.length) {
        await Promise.all(productIds.map(async productId => {
          try {
            const {data, error} = await db.rpc('public_product_seller_alias', {p_product_id:productId});
            if (error) return; // Fail closed if RPC is unavailable.
            const row = Array.isArray(data) ? data[0] : data;
            const alias = row?.seller_alias;
            if (typeof alias === 'string' && alias.trim()) aliasMap.set(productId,alias.trim());
          } catch (_) { /* Optional display only; checkout remains unchanged. */ }
        }));
      }
      await current();assertCheckout200b(epoch);
      if(seq!==loadSequence200b)return false;
      cart=nextCart;checkoutReady200b=true;
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

        // Permanent listing reference shown beneath each bag item.
        // Never substitute a different reference or expose seller IDs.
        if (product?.listing_reference) {
          const referenceLine=document.createElement('div');
          referenceLine.className='muted';
          referenceLine.textContent='Item reference: '+product.listing_reference;
          div.append(referenceLine);
        }

        const sellerAlias = aliasMap.get(item.product_id);
        if (sellerAlias) {
          const sellerLine = document.createElement('div');
          sellerLine.className = 'muted';
          sellerLine.append(document.createTextNode('Seller: ' + sellerAlias + ' — '));
          const sellerLink = document.createElement('a');
          sellerLink.href = './seller-products.html?alias=' + encodeURIComponent(sellerAlias);
          sellerLink.textContent = 'View this seller\'s items';
          sellerLink.setAttribute('aria-label', 'View all products from ' + sellerAlias);
          sellerLine.append(sellerLink);
          div.append(sellerLine);
        }
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
      const saved=a.data||[];
      const select=$('addresses');
      const previous=preferredAddressId||select.value||'';
      select.replaceChildren();
      for(const addr of saved){
        const shortLabel=[addr.address_label||'Delivery',addr.city].filter(Boolean).join(' — ');
        select.add(new Option(shortLabel,addr.id));
      }
      const chosen=saved.find(x=>x.id===previous)||saved.find(x=>x.is_default)||saved[0];
      select.value=chosen?.id||'';
      $('savedAddressArea').hidden=!chosen;
      $('savedAddressPicker').hidden=saved.length<2;
      $('selectedAddressSummary').textContent=chosen
        ?'Deliver to: '+[chosen.address_label||'Delivery',chosen.city].filter(Boolean).join(' — ')
        :'';
      $('newAddressFields').hidden=Boolean(chosen);
      $('cancelAddAddress').hidden=true;
      $('previewOrderButton').disabled=!chosen||!cart.length||Boolean(pendingOrderId);
      if(pendingOrderId&&!isCurrentCheckout())window.ShopDropSingleCourier199da?.clear('Checkout changed. Prepare a new order before obtaining a quotation.');
      $('addressStatus').textContent=chosen?'Your delivery address is selected.':'Complete the address fields above, then tap Save delivery address.';
      say('One seller per checkout. You may purchase multiple items from this seller. Payment is not yet enabled.');
      return true;
    } catch(e) {
      if(!checkoutLocked200b&&seq===loadSequence200b){clearCheckoutDisplay200b();say('Cannot load cart/addresses: '+e.message,e);}
      return false;
    }
  }
  async function change(item,quantity){
    if(!checkoutReady200b||checkoutLocked200b)return;
    try{
      const {db,uid,epoch}=await current();
      assertCheckout200b(epoch);
      if(!checkoutReady200b||!cart.some(row=>row.id===item.id))return;
      const result=quantity<=0
        ?await db.from('cart_items').delete().eq('id',item.id).eq('user_id',uid)
        :await db.from('cart_items').update({quantity}).eq('id',item.id).eq('user_id',uid);
      assertCheckout200b(epoch);await current();assertCheckout200b(epoch);
      if(result.error)throw result.error;
      window.ShopDropReservationCountdown?.clear?.();
      await load();
    }catch(e){if(!checkoutLocked200b)say('Cart update failed: '+e.message,e);}
  }
  async function saveAddress(){
    const saveButton=$('saveDeliveryAddressButton');
    if(saveButton.disabled||checkoutLocked200b||!checkoutReady200b)return;
    saveButton.disabled=true;
    try{
      const {db,uid,epoch}=await current();assertCheckout200b(epoch);
      // South African delivery addresses require a province.
      if($('country').value.trim().toUpperCase()==='ZA'&&!$('region').value.trim())throw new Error('Choose your province before saving the delivery address.');
      const required=['recipient','line1','city','country'];
      if(required.some(id=>!$(id).value.trim()))throw new Error('Enter recipient, street, city and country.');
      const data={user_id:uid,address_label:$('label').value.trim()||'Delivery',recipient_name:$('recipient').value.trim(),address_line_1:$('line1').value.trim(),city:$('city').value.trim(),state_province:$('region').value.trim()||null,postal_code:$('postal').value.trim()||null,country_code:$('country').value.trim().toUpperCase(),is_default:false};
      const {data:saved,error}=await db.from('addresses').insert(data).select('id').single();
      assertCheckout200b(epoch);await current();assertCheckout200b(epoch);
      if(error)throw error;
      if(!saved?.id)throw Error('Address save confirmation unavailable. Refresh before trying again.');
      window.ShopDropReservationCountdown?.clear?.();
      const loaded=await load(saved.id);assertCheckout200b(epoch);
      if(!loaded||$('addresses').value!==saved.id){
        $('addressStatus').textContent='Address saved, but selection could not be verified. Refresh before continuing.';
        say('Delivery address saved, but checkout must be refreshed.');return;
      }
      $('addressStatus').textContent='Address saved and selected.';
      say('Delivery address saved. Payment remains disabled.');
    }catch(e){
      if(checkoutLocked200b)return;
      $('addressStatus').textContent='Address not saved: '+e.message;
      say('Address save failed: '+e.message,e);
    }finally{if(!checkoutLocked200b)saveButton.disabled=false;}
  }
  let creatingOrder = false;
  let pendingOrderId = null;
  // Fix 23H: preserve the address bound to the created order.
  let pendingOrderAddressId = null;
  // Fix 23I: freeze the bag represented by the pending order.
  let pendingOrderCartSignature = null;
  function cartSignature() {
    return JSON.stringify(cart.map(item => ({
      product_id: String(item.product_id).toLowerCase(),
      quantity: Number(item.quantity)
    })).sort((a,b) => a.product_id.localeCompare(b.product_id)));
  }
  function isCurrentCheckout(){return Boolean(checkoutReady200b&&!checkoutLocked200b&&pendingOrderId&&pendingOrderAddressId&&$('addresses').value===pendingOrderAddressId&&pendingOrderCartSignature===cartSignature()&&$('newAddressFields').hidden);}
  async function place(){
    if (creatingOrder||!checkoutReady200b||checkoutLocked200b) return;
    const button=$('previewOrderButton');
    creatingOrder=true;
    if(button) button.disabled=true;
    $('refreshCheckout200c').disabled=true;
    try {
      const {epoch}=await current();assertCheckout200b(epoch);
      if(!checkoutReady200b)throw Error('Refresh checkout before continuing.');
      if (!cart.length) throw Error('Add a product to your shopping bag first.');
      if (!$('addresses').value) throw Error('Select a delivery address first.');
      if (!window.ShopDropCheckoutConnector?.createOrder) throw Error('Secure order connector is unavailable.');
      if (pendingOrderId) {
        if (!pendingOrderCartSignature || cartSignature() !== pendingOrderCartSignature)
          throw Error('Shopping bag changed after order creation. Start a new checkout before payment.');
        if (!pendingOrderAddressId || $('addresses').value !== pendingOrderAddressId)
          throw Error('Delivery address changed after order creation. Re-select the original address or start a new checkout.');
        if($('country').value==='ZA'&&!window.ShopDropSingleCourier199da?.canPay())throw Error('A valid courier quotation and activated payment provider are required.');
        const method=window.ShopDropPaymentSelection?.read();
        if (!method) throw Error('Choose a payment method first.');
        const courier=window.ShopDropCourierSelection;
        // Fix 23A: support one verified selection for EACH seller shipment.
        // Selection is persisted by courier-quotes; the payment backend independently
        // checks selected_quote_id and each trusted courier allocation/amount.
        const selections=courier?.getSelections?.();
        if (!Array.isArray(selections) || selections.length===0 ||
            selections.some(s=>s.order_id!==pendingOrderId || !s.fulfilment_group_id || !s.quote_id) ||
            new Set(selections.map(s=>s.fulfilment_group_id)).size!==selections.length) {
          throw Error('Select a confirmed courier quote for every seller shipment before continuing.');
        }
        // The backend creates the inventory reservation during payment-session
        // creation. Do not require a reservation before invoking that backend.
        // The server must enforce reservation expiry and payment eligibility.
        await window.ShopDropReservationCountdown?.refresh?.();
        const createSession=window.ShopDropSupabaseAdapter?.authenticatedFunctions?.createPaymentSession;
        if (typeof createSession!=='function') throw Error('Secure payment connector unavailable.');
        await current();assertCheckout200b(epoch);
        if(!isCurrentCheckout())throw Error('Checkout changed. Refresh before continuing.');
        const payment=await createSession({order_id:pendingOrderId,delivery_method:'integrated_courier',method_code:method.method_code,country_code:method.country_code});
        assertCheckout200b(epoch);await current();assertCheckout200b(epoch);
        if (payment?.ok===false || payment?.error) throw Error(payment.error||'Payment session was not created.');
        // Reservation begins inside create-payment-session. Read its real expiry now.
        await window.ShopDropReservationCountdown?.refresh?.();
        assertCheckout200b(epoch);
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
      // Fix 23J: freeze the selections before the asynchronous order request.
      const requestedAddressId=$('addresses').value;
      const requestedCartSignature=cartSignature();
      const result=await window.ShopDropCheckoutConnector.createOrder(items, requestedAddressId);
      assertCheckout200b(epoch);await current();assertCheckout200b(epoch);
      if ($('addresses').value!==requestedAddressId || cartSignature()!==requestedCartSignature)
        throw Error('Checkout details changed while creating the order. Refresh your bag before continuing.');
      const order=result?.order || result?.data?.order || result;
      const reference=order?.id || result?.order_id || result?.id;
      if (reference && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(String(reference))) {
        pendingOrderId=String(reference);
        pendingOrderAddressId=requestedAddressId;
        pendingOrderCartSignature=requestedCartSignature;
        window.ShopDropReservationCountdown?.remember?.(pendingOrderId);
        if(button){button.textContent='Proceed to secure payment';button.disabled=true;}
        await window.ShopDropSingleCourier199da?.refresh();
      }
      assertCheckout200b(epoch);
      say(reference ? 'Secure order created: '+reference+'. Select the appointed courier to obtain a quotation. No payment has been made.' : 'Secure order request accepted. No payment taken. Check your order status before trying again.');
      // Keep the stable request ID until checkout/payment is safely completed.
    } catch(e) {if(checkoutLocked200b)return;const msg=String(e?.message||'');say(msg.includes('one_seller_per_checkout')?'Only one seller is permitted per checkout. Please purchase from each seller separately.':'Order creation failed: '+(msg||'Please try again.'),e);}
    finally {creatingOrder=false;$('refreshCheckout200c').disabled=false;if(button)button.disabled=checkoutLocked200b||!checkoutReady200b||!cart.length||(pendingOrderId?!window.ShopDropSingleCourier199da?.canPay():!$('addresses').value);}
  }
  const button=$('previewOrderButton');
  if(button) button.textContent='Prepare order';
  // Refresh only: retain the existing idempotency key and server-side order state.
  // Do not reset, cancel, create an order or start a payment from this control.
  $('refreshCheckout200c').addEventListener('click',()=>{
    if(creatingOrder)return;
    location.reload();
  });
  function recheckOriginalCheckout200c(){
    // Run after the courier address-change listener has invalidated its old quote.
    Promise.resolve().then(()=>{
      if(!creatingOrder&&isCurrentCheckout())return window.ShopDropSingleCourier199da?.refresh();
    }).catch(()=>{if(!checkoutLocked200b)say('Unable to recheck the prepared order. Refresh checkout and try again.');});
  }
  $('addAnotherAddressButton').addEventListener('click',()=>{
    if(checkoutLocked200b||!checkoutReady200b)return;
    $('newAddressFields').hidden=false;
    $('cancelAddAddress').hidden=false;
    if(button)button.disabled=true;
    $('addressStatus').textContent='Complete the new address fields above, then tap Save delivery address.';
  });
  $('cancelAddAddress').addEventListener('click',()=>{
    if(checkoutLocked200b||!checkoutReady200b)return;
    $('newAddressFields').hidden=true;
    $('cancelAddAddress').hidden=true;
    if(button)button.disabled=Boolean(pendingOrderId)||!cart.length||!$('addresses').value;
    $('addressStatus').textContent='Your saved delivery address is selected.';
    recheckOriginalCheckout200c();
  });
  $('addresses').addEventListener('change',()=>{
    const option=$('addresses').selectedOptions[0];
    $('selectedAddressSummary').textContent=option?.value?'Deliver to: '+option.textContent:'Choose a delivery address';
    recheckOriginalCheckout200c();
  });
  window.saveAddress=saveAddress;
  window.place=place;
  window.ShopDropPhase6CartAddress=Object.freeze({load,getPendingOrderId:()=>pendingOrderId,isCurrentCheckout});
  if(window.ShopDropGeo?.countryOptions) $('country').innerHTML=window.ShopDropGeo.countryOptions('ZA');
  window.addEventListener('pagehide',()=>lockCheckout200b(true));
  window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
  load();
})();
