(() => {
  'use strict';

  const base=
    'https://dtkdvvxpwonywtsgqmdx.supabase.co';

  const key=
    'sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';

  const labels={
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

  const weekdays=[
    'Sunday','Monday','Tuesday',
    'Wednesday','Thursday',
    'Friday','Saturday'
  ];

  function node(tag,text){
    const el=document.createElement(tag);
    if(text!==undefined)el.textContent=text;
    return el;
  }

  function money(cents){
    return new Intl.NumberFormat('en-ZA',{
      style:'currency',
      currency:'ZAR'
    }).format(cents/100);
  }

  function unitCents(price){
    const cents=Math.round(Number(price)*100);
    if(!Number.isSafeInteger(cents)||
       cents<=0)return null;

    const commission=cents<100000
      ?Math.round(cents*0.10)
      :Math.round(cents*0.07);

    return cents+commission;
  }

  async function rpc(name,body){
    const response=await fetch(
      base+'/rest/v1/rpc/'+name,
      {
        method:'POST',
        headers:{
          apikey:key,
          'Content-Type':'application/json',
          Accept:'application/json'
        },
        body:JSON.stringify(body),
        credentials:'omit'
      }
    );

    if(!response.ok){
      throw Error(
        'Approved dispatch advertisements unavailable.'
      );
    }

    const data=await response.json();
    return Array.isArray(data)?data:[];
  }

  function renderRate(card,rates){
    const valid=rates.filter(rate=>
      labels[rate.pricing_unit]&&
      unitCents(rate.price_zar)!==null&&
      Number(rate.minimum_units)>0
    );

    if(!valid.length){
      card.append(node(
        'p','No rates currently available.'
      ));
      return;
    }

    const label=node('label','Choose provider rate');
    const select=node('select');

    valid.forEach((rate,index)=>{
      const option=node(
        'option',
        money(unitCents(rate.price_zar))+
        ' per '+labels[rate.pricing_unit]
      );
      option.value=String(index);
      select.append(option);
    });

    label.append(select);

    const quantityLabel=node(
      'label','Number of units'
    );
    const quantity=node('input');
    quantity.type='number';
    quantity.step='1';
    quantity.style.maxWidth='160px';
    quantityLabel.append(quantity);

    const schedule=node('p');
    const total=node('p');
    total.setAttribute('aria-live','polite');

    function update(){
      const rate=valid[Number(select.value)];
      if(!rate)return;

      const minimum=Math.max(
        1,Math.ceil(Number(rate.minimum_units))
      );
      quantity.min=String(minimum);

      const n=Number(quantity.value);
      const cents=unitCents(rate.price_zar);

      if(!Number.isSafeInteger(n)||
         n<minimum||n>100000){
        total.textContent=
          'Enter at least '+minimum+' whole unit(s).';
      }else if(!Number.isSafeInteger(n*cents)){
        total.textContent='Amount too large.';
      }else{
        total.textContent=
          'Estimated customer price: '+
          money(n*cents);
      }

      const days=Array.isArray(
        rate.availability_days
      )
        ?rate.availability_days
          .filter(d=>Number.isInteger(d)&&
                     d>=0&&d<=6)
          .map(d=>weekdays[d])
          .join(', ')
        :'';

      schedule.textContent=
        (days?'Available: '+days+'. ':'')+
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

    const note=node(
      'p',
      'Price preview only. Availability and '+
      'booking require confirmation. '+
      'No payment has been made.'
    );
    note.className='muted';

    card.append(
      label,quantityLabel,
      schedule,total,note
    );

    select.dispatchEvent(new Event('change'));
  }

  async function start(){
    const main=document.querySelector('main');
    if(!main)return;

    const section=node('section');
    section.className='panel';

    section.append(node(
      'h2','Available Dispatching Services'
    ));

    section.append(node(
      'p',
      'Browse approved transport and '+
      'equipment services for hire.'
    ));

    const refresh=node('button','Refresh providers');
    refresh.type='button';

    const status=node('p');
    status.setAttribute('role','status');

    const results=node('div');

    section.append(refresh,status,results);
    main.append(section);

    async function load(){
      refresh.disabled=true;
      status.textContent='Loading approved providers…';
      results.replaceChildren();

      try{
        const adverts=await rpc(
          'shopdrop_public_dispatch_adverts',{}
        );

        status.textContent=adverts.length
          ?adverts.length+' provider(s) found.'
          :'No approved dispatch providers yet.';

        for(const advert of adverts){
          const card=node('article');
          card.className='panel';

          card.append(node(
            'h3',
            advert.vehicle_title||
            'Dispatch service'
          ));

          if(advert.vehicle_description){
            card.append(node(
              'p',advert.vehicle_description
            ));
          }

          card.append(node(
            'p',
            [
              advert.vehicle_type,
              advert.base_town,
              advert.base_province
            ].filter(Boolean).join(' · ')
          ));

          results.append(card);

          try{
            const rates=await rpc(
              'shopdrop_public_dispatch_rate_options',
              {p_advert_id:advert.id}
            );
            renderRate(card,rates);
          }catch(error){
            card.append(node(
              'p','Rates temporarily unavailable.'
            ));
          }
        }
      }catch(error){
        status.textContent=error.message;
      }finally{
        refresh.disabled=false;
      }
    }

    refresh.addEventListener('click',load);
    load();
  }

  if(document.readyState==='loading'){
    document.addEventListener(
      'DOMContentLoaded',start,{once:true}
    );
  }else{
    start();
  }
})();
