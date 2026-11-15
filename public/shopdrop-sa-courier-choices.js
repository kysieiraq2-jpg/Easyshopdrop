/* Fix62: Display-only SA courier shortlist.
       Does not request quotes, bookings or payments. */
(()=>{
  'use strict';

  const grid=document.getElementById(
    'shopdropSaCourierGrid'
  );
  const message=document.getElementById(
    'shopdropSaCourierMessage'
  );

  if(!grid||!message)return;

  const companies=[
    {
      name:'The Courier Guy',
      service:'Direct door-to-door delivery'
    },
    {
      name:'Aramex',
      service:'Click-Way door-to-door delivery'
    },
    {
      name:'RAM Hand-to-Hand',
      service:'Door collection and direct delivery'
    }
  ];

  const buttons=[];

  for(const company of companies){
    const button=document.createElement('button');
    button.type='button';
    button.setAttribute('aria-pressed','false');

    const title=document.createElement('strong');
    title.textContent=company.name;

    const detail=document.createElement('small');
    detail.textContent=company.service;

    button.append(title,detail);

    button.addEventListener('click',()=>{
      for(const other of buttons){
        other.setAttribute(
          'aria-pressed',
          String(other===button)
        );
      }

      message.textContent=
        'Preferred courier: '+company.name+
        '. This is a preview only. '+
        'No quotation, payment or booking '+
        'has been requested.';
    });

    buttons.push(button);
    grid.append(button);
  }

  message.textContent=
    'Select a courier company to preview your preference. '+
    'Live quotations and bookings are not active.';
})();
