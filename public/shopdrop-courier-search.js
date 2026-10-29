/* Shop&Drop Phase6C A96: non-booking courier discovery UI.
   Never expose pickup/delivery addresses to a searched or unverified carrier.
   Replace the empty verified catalog with backend-approved results in a later step. */
(function(){
  'use strict';
  const input=document.getElementById('phase6CourierQuery');
  const results=document.getElementById('phase6CourierResults');
  const selection=document.getElementById('phase6CourierSelection');
  if(!input||!results||!selection)return;
  let catalog=[]; // Only active providers returned by the approved Supabase directory.
  const API='https://dtkdvvxpwonywtsgqmdx.supabase.co/rest/v1/rpc/shopdrop_search_courier_directory';
  const KEY='sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';
  let searchSequence=0;
  async function searchDirectory(q){
    const seq=++searchSequence;
    if(!q){catalog=[];render();return;}
    results.textContent='Searching approved courier directory…';
    try{
      const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','apikey':KEY},body:JSON.stringify({p_query:q})});
      if(!response.ok)throw Error('Courier directory unavailable');
      const data=await response.json();
      if(seq!==searchSequence)return;
      catalog=Array.isArray(data)?data.filter(x=>typeof x.provider_name==='string' && typeof x.provider_code==='string').map(x=>({name:x.provider_name,provider_code:x.provider_code,service_code:null})):[];
      render();
    }catch(e){if(seq!==searchSequence)return;catalog=[];results.textContent='Courier directory temporarily unavailable. Please try again.';}
  }
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
      results.textContent='No active courier matches. Coverage, real quotes and bookings must be verified before selection.';
      return;
    }
    for(const c of matches){
      const b=document.createElement('button');
      b.type='button';
      b.textContent=c.name;
      b.disabled=true; // Directory match alone is not a serviceable live quote.
      b.title='Available only after coverage and real quote verification';
      results.appendChild(b);
    }
  }
  input.addEventListener('input',()=>searchDirectory(input.value.trim()));
  render();
})();
