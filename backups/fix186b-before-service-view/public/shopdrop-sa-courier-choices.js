/* Fix63: Official courier information links.
   No booking, payment or tracking is initiated here. */
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
      service:'Direct door-to-door delivery',
      url:'https://thecourierguy.co.za/direct-courier-services/'
    },
    {
      name:'Aramex',
      service:'Click-Way door-to-door delivery',
      url:'https://aramex.co.za/services/click-way-couriers/'
    },
    {
      name:'RAM Hand-to-Hand',
      service:'Door collection and direct delivery',
      url:'https://www.ram.co.za/'
    }
  ];

  for(const company of companies){
    const link=document.createElement('a');

    link.href=company.url;
    link.target='_blank';
    link.rel='noopener noreferrer';

    link.setAttribute(
      'aria-label',
      company.name+' official website — information only'
    );

    const title=document.createElement('strong');
    title.textContent=company.name;

    const detail=document.createElement('small');
    detail.textContent=company.service;

    const note=document.createElement('small');
    note.textContent='View official website — information only';

    link.append(title,detail,note);
    grid.append(link);
  }

  message.textContent=
    'These links open the couriers official websites. '+
    'Do not book, pay or disclose private buyer or seller '+
    'details there. Shop&Drop will handle approved '+
    'courier bookings and tracking when activated.';
})();
