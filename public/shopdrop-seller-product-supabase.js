
/* Shop&Drop Phase 6C — Product and service listing bridge.
   Existing product submission preserved.
   Adds service location, coverage and Supabase submission.
   Seller receives their requested net amount; buyer fee is separate.
   Supabase RLS and server-side approval remain authoritative. */
(function(){
  'use strict';

  const URL='https://dtkdvvxpwonywtsgqmdx.supabase.co';
  const KEY='sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';
  let clientPromise;

  function client(){
    return clientPromise ||= import('https://esm.sh/@supabase/supabase-js@2')
      .then(m=>m.createClient(URL,KEY,{
        auth:{
          persistSession:true,
          autoRefreshToken:true,
          detectSessionInUrl:true
        }
      }))
      .catch(e=>{clientPromise=null;throw e;});
  }

  const el=id=>document.getElementById(id);

  function value(id){
    return String(el(id)?.value??'').trim();
  }

  function positive(id,label){
    const n=Number(value(id));
    if(!value(id)||!Number.isFinite(n)||n<=0)
      throw Error('Enter a valid '+label+'.');
    return n;
  }

  // Existing seller verification.
  async function verifySeller(sb,userId){
    const {data,error}=await sb
      .from('seller_verification_status')
      .select(
        'identity_verified,account_verified,'+
        'payout_verified,suspended_at'
      )
      .eq('seller_id',userId)
      .maybeSingle();

    if(error){
      throw Error(
        'Seller verification could not be checked: '+
        error.message
      );
    }

    if(!data){
      throw Error(
        'Seller verification is not yet available for this account.'
      );
    }

    if(data.suspended_at){
      throw Error('This seller account is suspended.');
    }

    if(
      data.identity_verified!==true||
      data.account_verified!==true||
      data.payout_verified!==true
    ){
      throw Error(
        'Seller identity, account or payout verification is incomplete.'
      );
    }

    return true;
  }

  // Existing private courier collection address.
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

    const fallback=new Option(
      'Use my default registered address',''
    );
    select.add(fallback);

    const {data,error}=await sb.from('addresses')
      .select(
        'id,address_label,city,country_code,is_default'
      )
      .eq('user_id',userId)
      .order('is_default',{ascending:false});

    if(error){
      throw Error(
        'Cannot load your private collection addresses: '+
        error.message
      );
    }

    for(const a of data||[]){
      select.add(new Option(
        [
          a.address_label||'Saved address',
          a.city,
          a.country_code
        ].filter(Boolean).join(' — '),
        a.id
      ));
    }

    const defaultAddress=(data||[])
      .find(a=>a.is_default);

    if(defaultAddress){
      fallback.value=defaultAddress.id;
    }else if((data||[]).length){
      fallback.textContent=
        'Choose a saved collection address';
    }else{
      fallback.textContent=
        'Save a collection address in My Account first';
    }

    const hint=document.createElement('small');
    hint.textContent=
      'To collect from another location, save that '+
      'address privately in My Account first.';

    wrapper.append(label,select,hint);

    anchor.closest('label')?.after(wrapper) ||
      anchor.parentElement?.after(wrapper);
  }

  async function initPickupAddress(){
    try{
      const sb=await client();
      const {data:{user}}=await sb.auth.getUser();

      if(user){
        await preparePickupAddresses(sb,user.id);
      }
    }catch(e){
      console.warn(
        'ShopDrop pickup address selector:',e
      );
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener(
      'DOMContentLoaded',
      initPickupAddress,
      {once:true}
    );
  }else{
    initPickupAddress();
  }

  // Existing product submission preserved.
  async function submitProduct(){
    const status=el('productStatus');
    status.hidden=false;

    const button=document.querySelector(
      'button[onclick="add()"]'
    );

    if(button)button.disabled=true;

    try{
      const sb=await client();

      const {
        data:{user},
        error:authError
      }=await sb.auth.getUser();

      if(authError||!user){
        throw Error(
          'Sign in to your seller account first.'
        );
      }

      await verifySeller(sb,user.id);

      const title=value('n');
      const category=value('mainCategory');
      const subcategory=value('c');

      const categoryName=
        el('mainCategory')?.selectedOptions
          ?.[0]?.textContent?.trim();

      const subcategoryName=
        el('c')?.selectedOptions?.[0]?.dataset?.name ||
        el('c')?.selectedOptions?.[0]
          ?.textContent?.trim();

      if(!title||!category||!subcategory){
        throw Error(
          'Enter product name and select both categories.'
        );
      }

      if(!el('releaseConfirm')?.checked){
        throw Error(
          'Confirm you can hand the item to a courier.'
        );
      }

      const sellerTarget=positive(
        'p','seller asking price'
      );

      const quantity=Number(value('s'));

      if(
        !Number.isSafeInteger(quantity)||
        quantity<1
      ){
        throw Error(
          'Enter a whole-number stock quantity of at least 1.'
        );
      }

      const country=value('productCountry');
      const currency=value('productCurrency');

      if(
        !/^[A-Z]{2}$/.test(country)||
        !/^[A-Z]{3}$/.test(currency)
      ){
        throw Error(
          'Select a valid country and currency.'
        );
      }

      const payload={
        seller_id:user.id,
        title,
        category:categoryName,
        subcategory:subcategoryName,
        condition:value('condition'),
        price:sellerTarget,
        currency,
        country_code:country,
        location:[
          value('productRegion'),
          value('productCity')
        ].filter(Boolean).join(', ')||null,
        quantity,
        listing_status:'pending',
        shipping_weight_kg:
          positive('shippingWeightKg','packed weight'),
        shipping_length_cm:
          positive('shippingLengthCm','packed length'),
        shipping_width_cm:
          positive('shippingWidthCm','packed width'),
        shipping_height_cm:
          positive('shippingHeightCm','packed height')
      };

      const pickupAddressId=value(
        'shopdropPickupAddress'
      );

      if(
        el('shopdropPickupAddress') &&
        !pickupAddressId
      ){
        throw Error(
          'Save or select a private courier collection '+
          'address in My Account before listing.'
        );
      }

      if(pickupAddressId){
        const {
          data:owned,
          error:addressError
        }=await sb.from('addresses')
          .select('id')
          .eq('id',pickupAddressId)
          .eq('user_id',user.id)
          .maybeSingle();

        if(addressError||!owned){
          throw Error(
            'Select a collection address belonging to your account.'
          );
        }

        payload.pickup_address_id=pickupAddressId;
      }

      const {data,error}=await sb.from('products')
        .insert(payload)
        .select(
          'id,listing_reference,listing_status'
        )
        .single();

      if(error){
        throw Error(
          'Listing could not be saved: '+
          error.message
        );
      }

      status.textContent=
        'Product saved. Reference: '+
        (data.listing_reference||data.id)+
        '. Status: '+data.listing_status+
        '. Seller asking price preserved.';

    }catch(e){
      status.textContent=
        e?.message||'Unable to submit product.';
    }finally{
      if(button)button.disabled=false;
    }
  }

  window.add=submitProduct;

  // Other Services: operating location and coverage.
  function initServiceCoverage(){
    const area=el('sarea');

    if(
      !area||
      el('shopdropServiceCoverageMode')
    )return;

    const areaLabel=area.closest('label');
    if(!areaLabel)return;

    const label=document.createElement('label');
    label.className='field';

    const heading=document.createElement('span');
    heading.textContent=
      'Where can you provide this service?';

    const select=document.createElement('select');
    select.id='shopdropServiceCoverageMode';

    for(const [key,name] of [
      [
        'local',
        'My base town and listed surrounding towns'
      ],
      [
        'selected',
        'Selected towns or provinces'
      ],
      [
        'nationwide',
        'Anywhere in South Africa'
      ]
    ]){
      select.add(new Option(name,key));
    }

    label.append(heading,select);
    areaLabel.before(label);

    const areaHeading=areaLabel.querySelector(
      'span'
    );

    if(areaHeading){
      areaHeading.textContent=
        'Additional towns or provinces (comma-separated)';
    }

    area.placeholder='e.g. Centurion, Midrand';

    const note=document.createElement('p');
    note.className='helper';
    note.textContent=
      'Your base town and province appear publicly, '+
      'never your street address. For local coverage, '+
      'list nearby towns you serve. Nationwide providers '+
      'can quote travel charges before booking.';

    areaLabel.after(note);

    select.onchange=()=>{
      areaLabel.hidden=
        select.value==='nationwide';
    };

    select.onchange();
  }

  // Display the established Shop&Drop buyer fee.
  // Final charges remain backend-authoritative.
  function serviceFeePreviewLive(){
    const target=Math.round(
      Number(value('sp')||0)*100
    );

    const box=el('serviceFeeBox');
    if(!box)return;

    if(
      !Number.isFinite(target)||
      target<=0
    ){
      box.textContent=
        'Enter your desired amount to see the customer price.';
      return;
    }

    const fee=Math.round(
      target*(target<100000?0.10:0.07)
    );

    box.textContent=
      'You receive '+ShopDrop.money(target)+
      ' per '+value('su')+
      ' · Shop&Drop buyer-paid fee '+
      ShopDrop.money(fee)+
      ' · Customer pays '+
      ShopDrop.money(target+fee)+
      ' per '+value('su')+
      ' (excluding any separately agreed travel charges).';
  }

  function selectedServiceAreas(){
    const raw=value('sarea');

    const areas=[
      ...new Set(
        raw.split(',')
          .map(x=>x.trim())
          .filter(Boolean)
      )
    ];

    if(
      areas.length>30||
      areas.some(x=>
        x.length<2||x.length>120
      )
    ){
      throw Error(
        'Enter up to 30 valid towns or provinces, '+
        'separated by commas.'
      );
    }

    return areas;
  }

  function serviceDate(id){
    const raw=value(id);
    if(!raw)return null;

    const d=new Date(raw);

    if(Number.isNaN(d.getTime())){
      throw Error(
        'Enter valid service availability dates.'
      );
    }

    return d.toISOString();
  }

  async function submitService(){
    const status=el('serviceStatus');
    if(!status)return;

    status.hidden=false;

    const button=document.querySelector(
      'button[onclick="addService()"]'
    );

    if(button)button.disabled=true;

    try{
      const sb=await client();

      const {
        data:{user},
        error:authError
      }=await sb.auth.getUser();

      if(authError||!user){
        throw Error(
          'Sign in before advertising a service.'
        );
      }

      const title=value('sn');
      const category=value('sc');
      const subcategory=value('ssc');
      const description=value('sd');

      const price=Math.round(
        positive('sp','service amount')*100
      )/100;

      const minUnits=positive(
        'smin','minimum booking units'
      );

      const country=value('serviceCountry');
      const currency=value('serviceCurrency');

      const baseTown=value('serviceCity');
      const baseProvince=value('serviceRegion');

      const mode=value(
        'shopdropServiceCoverageMode'
      );

      const areas=
        mode==='nationwide'
          ?[]
          :selectedServiceAreas();

      if(
        title.length<3||
        title.length>200
      ){
        throw Error(
          'Enter a valid service title.'
        );
      }

      if(!category||!subcategory){
        throw Error(
          'Choose a service category and subcategory.'
        );
      }

      if(!description){
        throw Error(
          'Describe what the service includes.'
        );
      }

      if(
        country!=='ZA'||
        currency!=='ZAR'
      ){
        throw Error(
          'South Africa and ZAR are required for the initial launch.'
        );
      }

      if(
        baseTown.length<2||
        baseTown.length>120||
        baseProvince.length<2||
        baseProvince.length>120
      ){
        throw Error(
          'Enter the service provider base town and province.'
        );
      }

      if(
        ![
          'local',
          'selected',
          'nationwide'
        ].includes(mode)
      ){
        throw Error(
          'Choose where you are willing to provide the service.'
        );
      }

      if(
        mode==='selected'&&
        !areas.length
      ){
        throw Error(
          'Enter the towns or provinces where you provide this service.'
        );
      }

      const from=serviceDate('sfrom');
      const until=serviceDate('sto');

      if(
        from&&
        until&&
        new Date(until)<=new Date(from)
      ){
        throw Error(
          'Availability end must be after availability start.'
        );
      }

      const photoUrl=value('sphoto');

      if(
        photoUrl&&
        (
          !photoUrl.startsWith('https://')||
          photoUrl.length>2000
        )
      ){
        throw Error(
          'Service photo link must be a valid HTTPS URL.'
        );
      }

      const payload={
        provider_id:user.id,
        title,
        description,
        category,
        subcategory,
        pricing_unit:value('su')||'job',
        price,
        currency,
        country_code:country,
        location:baseTown+', '+baseProvince,
        base_town:baseTown,
        base_province:baseProvince,
        coverage_mode:mode,
        covered_areas:areas,
        minimum_booking_units:minUnits,
        service_photo_url:photoUrl||null,
        available_from:from,
        available_until:until,
        listing_status:'pending'
      };

      status.textContent=
        'Saving your service advertisement securely…';

      const {data,error}=await sb.from('services')
        .insert(payload)
        .select('id,listing_status')
        .single();

      if(error){
        throw Error(
          'Service could not be saved: '+
          error.message
        );
      }

      status.textContent=
        'Service saved. Reference: '+
        data.id+
        '. Status: '+data.listing_status+
        '. Eligible verified providers are published automatically. '+
        'Your public location is '+
        baseTown+', '+baseProvince+'.';

      el('sn').value='';
      el('sp').value='';

      serviceFeePreviewLive();

    }catch(e){
      status.textContent=
        e?.message||
        'Unable to submit service.';
    }finally{
      if(button)button.disabled=false;
    }
  }

  function initService(){
    if(!el('sarea'))return;

    initServiceCoverage();

    window.addService=submitService;
    window.serviceFeePreview=serviceFeePreviewLive;

    if(el('su')){
      el('su').onchange=
        serviceFeePreviewLive;
    }

    serviceFeePreviewLive();
  }

  if(document.readyState==='loading'){
    document.addEventListener(
      'DOMContentLoaded',
      initService,
      {once:true}
    );
  }else{
    initService();
  }
})();
