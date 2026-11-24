/* Shared payment preview for services and dispatch.
   Never submits booking, payment, card or bank information. */
(()=>{
  'use strict';

  const methods=[
    ['visa_debit','Visa debit card'],
    ['visa_credit','Visa credit card'],
    ['mastercard_debit','Mastercard debit card'],
    ['mastercard_credit','Mastercard credit card'],
    ['instant_eft','Instant EFT (secure bank payment)']
  ];

  function mount(){
    document.querySelectorAll(
      '[data-shopdrop-payment-preview]'
    ).forEach(panel=>{
      const controls=panel.querySelector(
        '.shopdrop-preview-controls'
      );

      if(!controls||controls.dataset.ready==='yes')return;
      controls.dataset.ready='yes';

      const label=document.createElement('label');
      label.textContent='Choose a payment method';

      const select=document.createElement('select');
      select.setAttribute(
        'aria-label','Payment method preview only'
      );
      const placeholder=new Option(
      'Select payment method',''
    );
    placeholder.disabled=true;
    placeholder.hidden=true;
    placeholder.selected=true;
    select.append(placeholder);

      for(const [code,name] of methods){
        select.add(new Option(name,code));
      }

      const status=document.createElement('p');
      status.className='shopdrop-preview-status';
      status.setAttribute('role','status');
      status.textContent='Payment is not enabled. Do not transfer money.';

      select.addEventListener('change',()=>{
        status.textContent=select.value
          ?'Preview: '+select.selectedOptions[0].textContent+
           '. No payment will be collected.'
          :'Payment is not enabled. Do not transfer money.';
      });

      controls.append(label,select,status);
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener(
      'DOMContentLoaded',mount,{once:true}
    );
  }else{
    mount();
  }
})();
