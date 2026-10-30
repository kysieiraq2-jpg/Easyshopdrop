/* ShopDrop A155: quote an existing authenticated order. Browser quotes are display-only. */
(function(){
  'use strict';
  const status=document.getElementById('phase6CourierSelection');
  const results=document.getElementById('phase6CourierResults');
  const section=document.getElementById('phase6CourierSearch');
  if(!status||!results||!section)return;
  const button=document.createElement('button');
  button.type='button';button.textContent='Get courier quotes for my order';
  const quoteList=document.createElement('div');quoteList.setAttribute('role','status');
  section.append(button,quoteList);
  let chosen=null;
  // Quotes must be persisted and priced by trusted backend before enabling payment.
  window.ShopDropCourierSelection=Object.freeze({
    getSelected:()=>chosen?{...chosen}:null,
    isBookingEnabled:()=>false
  });
  button.addEventListener('click',async()=>{
    button.disabled=true;chosen=null;quoteList.replaceChildren();
    try{
      const orderId=window.ShopDropPhase6CartAddress?.getPendingOrderId?.();
      if(!orderId)throw Error('Create your secure order first.');
      const bridge=window.ShopDropCourierQuoteBridge;
      if(typeof bridge?.requestQuotes!=='function')throw Error('Courier quote connector unavailable.');
      status.textContent='Requesting verified courier quotations…';
      const response=await bridge.requestQuotes(orderId);
      const quotes=response.quotes||[];
      if(!quotes.length)throw Error('No courier quotes are available for this route.');
      status.textContent='Choose a quoted courier. Payment remains protected until server-side quote confirmation is connected.';
      quotes.forEach(q=>{
        const amount=Number(q.amount), currency=String(q.currency||'');
        if(!Number.isFinite(amount)||amount<=0||!/^[A-Z]{3}$/.test(currency))return;
        const row=document.createElement('button');row.type='button';
        const name=String(q.service_name||q.provider||'Courier');
        row.textContent=name+' — '+new Intl.NumberFormat(undefined,{style:'currency',currency}).format(amount);
        row.addEventListener('click',()=>{
          chosen={provider:q.provider,quote_reference:q.quote_reference,service_code:q.service_code,amount,currency,order_id:orderId};
          status.textContent='Selected: '+row.textContent+'. Awaiting trusted checkout price confirmation.';
        });
        quoteList.append(row,document.createTextNode(' '));
      });
    }catch(e){status.textContent=e?.message||'Courier quotation unavailable.';}
    finally{button.disabled=false;}
  });
})();
