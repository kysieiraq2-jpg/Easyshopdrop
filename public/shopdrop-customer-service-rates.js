(() => {
  'use strict';

  const base=
    'https://dtkdvvxpwonywtsgqmdx.supabase.co';

  const key=
    'sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';

  const uuid=
    /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

  const units={
    hour:'hour',
    half_day:'half-day',
    day:'day',
    night:'night',
    week:'week',
    month:'month',
    kilometre:'kilometre',
    trip:'trip',
    load:'load',
    visit:'visit',
    job:'completed job',
    square_metre:'square metre'
  };

  const days=[
    'Sun','Mon','Tue','Wed',
    'Thu','Fri','Sat'
  ];

  function money(cents){
    return new Intl.NumberFormat('en-ZA',{
      style:'currency',
      currency:'ZAR'
    }).format(cents/100);
  }

  function customerCents(price){
    const cents=Math.round(Number(price)*100);

    if(!Number.isSafeInteger(cents)||
       cents<=0)return null;

    // Display provider price only.
    // Commission is added at checkout.
    return cents;
  }

  function element(tag,text){
    const node=document.createElement(tag);
    if(text!==undefined){
      node.textContent=text;
    }
    return node;
  }

  async function load(serviceId){
    if(!uuid.test(serviceId))return [];

    const params=new URLSearchParams({
      select:
        'id,service_id,pricing_unit,'+
        'price_zar,minimum_units,'+
        'availability_days,'+
        'available_from_time,'+
        'available_until_time,'+
        'package_description',
      service_id:'eq.'+serviceId,
      order:'price_zar.asc',
      limit:'30'
    });

    const response=await fetch(
      base+
      '/rest/v1/shopdrop_advert_service_rates?'+
      params.toString(),
      {
        headers:{
          apikey:key,
          Accept:'application/json'
        },
        credentials:'omit'
      }
    );

    if(!response.ok){
      throw Error('Approved rates unavailable');
    }

    const data=await response.json();
    return Array.isArray(data)?data:[];
  }

  function attach(card,rates){
    if(!card.isConnected||
       card.querySelector(
         '.shopdrop-approved-rates'
       ))return;

    const valid=rates.filter(rate=>
      units[rate.pricing_unit]&&
      customerCents(rate.price_zar)!==null&&
      Number.isFinite(
        Number(rate.minimum_units)
      )&&
      Number(rate.minimum_units)>0
    );

    if(!valid.length)return;

    const section=element('section');
    section.className='shopdrop-approved-rates';

    section.style.marginTop='12px';
    section.style.padding='12px';
    section.style.border='1px solid #dbe3ea';
    section.style.borderRadius='8px';

    const heading=element(
      'h4','Provider rate options'
    );

    const label=element(
      'label','Choose an offered rate'
    );

    const select=element('select');
    select.setAttribute(
      'aria-label','Choose service rate'
    );

    valid.forEach((rate,index)=>{
      const option=element(
        'option',
        money(customerCents(rate.price_zar))+
        ' per '+units[rate.pricing_unit]
      );
      option.value=String(index);
      select.append(option);
    });

    label.append(select);

    const quantityLabel=element(
      'label','Number of units'
    );
    const quantity=element('input');
    quantity.type='number';
    quantity.step='1';
    quantity.style.maxWidth='120px';
    quantityLabel.append(quantity);

    const schedule=element('p');
    const total=element('p');
    total.setAttribute('aria-live','polite');

    const note=element(
      'p',
      'Preview only. Dates, availability '+
      'and booking require confirmation.'
    );
    note.className='muted';

    function update(){
      const rate=valid[Number(select.value)];
      if(!rate)return;

      const minimum=Math.max(
        1,Math.ceil(Number(rate.minimum_units))
      );

      quantity.min=String(minimum);

      const amount=customerCents(
        rate.price_zar
      );

      const n=Number(quantity.value);

      if(!Number.isSafeInteger(n)||
         n<minimum||n>100000){
        total.textContent=
          'Enter at least '+minimum+
          ' whole unit(s).';
      }else if(
        !Number.isSafeInteger(amount*n)
      ){
        total.textContent=
          'Amount exceeds preview limit.';
      }else{
        total.textContent=
          'Service booking price: '+
          money(amount*n);
      }

      const available=Array.isArray(
        rate.availability_days
      )
        ?rate.availability_days
          .filter(d=>Number.isInteger(d)&&
                     d>=0&&d<=6)
          .map(d=>days[d]).join(', ')
        :'';

      schedule.textContent=
        (available
          ?'Days: '+available+'. '
          :'')+
        (rate.available_from_time&&
         rate.available_until_time
          ?'Hours: '+
           rate.available_from_time.slice(0,5)+
           '–'+
           rate.available_until_time.slice(0,5)
          :'')+
        (rate.package_description
          ?'. '+rate.package_description
          :'');
    }

    select.addEventListener('change',()=>{
      const rate=valid[Number(select.value)];
      quantity.value=String(Math.max(
        1,Math.ceil(Number(rate.minimum_units))
      ));
      update();
    });

    quantity.addEventListener('input',update);

    section.append(
      heading,label,quantityLabel,
      schedule,total,note
    );

    card.append(section);
    select.dispatchEvent(new Event('change'));
  }

  async function refresh(){
    const cards=[
      ...document.querySelectorAll(
        '#results [data-service-id]'
      )
    ];

    await Promise.all(cards.map(async card=>{
      const id=card.dataset.serviceId;
      if(!uuid.test(id))return;

      try{
        const rates=await load(id);
        if(card.isConnected&&
           card.dataset.serviceId===id){
          attach(card,rates);
        }
      }catch(error){
        // Keep the existing service card usable.
        console.warn(
          'Service rates unavailable:',
          error.message
        );
      }
    }));
  }

  function start(){
    const results=document.getElementById(
      'results'
    );
    if(!results)return;

    let scheduled=false;

    const observer=new MutationObserver(()=>{
      if(scheduled)return;
      scheduled=true;
      queueMicrotask(()=>{
        scheduled=false;
        refresh();
      });
    });

    observer.observe(results,{
      childList:true
    });

    refresh();
  }

  if(document.readyState==='loading'){
    document.addEventListener(
      'DOMContentLoaded',start,{once:true}
    );
  }else{
    start();
  }
})();
