/*
 Shop&Drop Fix95
 Isolated approved-service browsing component.

 Not connected to any website page yet.
 Uses the existing service connector.
 Does not create bookings or payments.
*/
(() => {
  'use strict';

  function createElement(tag,className,text){
    const el=document.createElement(tag);
    if(className)el.className=className;
    if(text!=null)el.textContent=String(text);
    return el;
  }

  function validPhoto(value){
    try{
      const url=new URL(value);
      return (
        url.origin===
          'https://dtkdvvxpwonywtsgqmdx.supabase.co' &&
        url.pathname.startsWith(
          '/storage/v1/object/public/'
        )
      );
    }catch(_){
      return false;
    }
  }

  function formatMoney(cents,currency){
    const amount=Number(cents)/100;
    if(!Number.isFinite(amount))return '';

    try{
      return new Intl.NumberFormat(
        'en-ZA',{
          style:'currency',
          currency:currency||'ZAR'
        }
      ).format(amount);
    }catch(_){
      return 'R '+amount.toFixed(2);
    }
  }

  function createCard(service){
    const card=createElement(
      'article',
      'shopdrop-combined-service-card'
    );

    const badge=createElement(
      'small',
      'shopdrop-ad-type',
      'OTHER SERVICES'
    );

    const heading=createElement(
      'h3',
      '',
      service.title||'Service advertisement'
    );

    card.append(badge);

    if(validPhoto(service.photo_url)){
      const photo=document.createElement('img');
      photo.src=service.photo_url;
      photo.alt='Service advertisement photograph';
      photo.loading='lazy';
      photo.decoding='async';
      photo.className='shopdrop-service-card-image';
      card.append(photo);
    }

    const area=createElement(
      'p',
      'muted',
      service.service_area||
        'Service area specified by provider'
    );

    const price=createElement(
      'strong',
      '',
      formatMoney(
        service.unit_price_cents,
        service.currency_code
      )+' per '+(service.pricing_unit||'service')
    );

    const description=createElement(
      'p',
      '',
      service.description||''
    );

    const link=document.createElement('a');
    link.href='./services.html';
    link.textContent='Browse and book services';
    link.className='btn';

    // Do not pretend this is an individual
    // advertisement link. Exact listing
    // navigation will be connected later.
    card.append(
      heading,area,price,description,link
    );

    if(service.id){
      card.dataset.serviceId=service.id;
    }

    return card;
  }

  async function render(container){
    if(!(container instanceof Element)){
      throw Error('Valid container required.');
    }

    const connector=
      window.ShopDropServicesConnector;

    if(!connector?.search){
      throw Error(
        'Existing service connector unavailable.'
      );
    }

    const services=await connector.search('');

    if(!Array.isArray(services)){
      throw Error(
        'Unexpected approved services response.'
      );
    }

    const fragment=document.createDocumentFragment();

    services.forEach(service=>{
      fragment.append(createCard(service));
    });

    container.replaceChildren(fragment);

    return services.length;
  }

  window.ShopDropCombinedServiceCards=
    Object.freeze({render});
})();
