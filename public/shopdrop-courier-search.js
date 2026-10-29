/* Shop&Drop Phase6C A96: non-booking courier discovery UI.
   Never expose pickup/delivery addresses to a searched or unverified carrier.
   Replace the empty verified catalog with backend-approved results in a later step. */
(function(){
  'use strict';
  const input=document.getElementById('phase6CourierQuery');
  const results=document.getElementById('phase6CourierResults');
  const selection=document.getElementById('phase6CourierSelection');
  if(!input||!results||!selection)return;
  const catalog=[]; // Only backend-verified, serviceable couriers may populate this.
  let chosen=null;
  window.ShopDropCourierSelection=Object.freeze({
    getSelected:()=>chosen ? {...chosen} : null,
    isBookingEnabled:()=>false
  });
  function render(){
    chosen=null;
    selection.textContent='No courier selected. Live quotations and bookings are not enabled.';
    results.replaceChildren();
    const q=input.value.trim().toLocaleLowerCase();
    if(!q){results.textContent='Enter a courier name to search verified providers.';return;}
    const matches=catalog.filter(c=>c.name.toLocaleLowerCase().includes(q)).slice(0,10);
    if(!matches.length){
      results.textContent='No verified courier is available for this search yet. Shop&Drop will add supported courier networks before launch.';
      return;
    }
    for(const c of matches){
      const b=document.createElement('button');
      b.type='button';
      b.textContent=c.name;
      b.addEventListener('click',()=>{
        chosen={provider_code:c.provider_code,service_code:c.service_code};
        selection.textContent='Courier selected for quotation only. Booking remains disabled until a verified live quote is received.';
      });
      results.appendChild(b);
    }
  }
  input.addEventListener('input',render);
  render();
})();
