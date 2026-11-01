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
  let quotedOrderId=null;
  let selections=Object.create(null);
  let requiredGroups=[];
  // Quotes must be persisted and priced by trusted backend before enabling payment.
  window.ShopDropCourierSelection=Object.freeze({
    getSelected:()=>chosen && requiredGroups.length===1 && quotedOrderId===window.ShopDropPhase6CartAddress?.getPendingOrderId?.()?{...chosen}:null,
    getSelections:()=>quotedOrderId===window.ShopDropPhase6CartAddress?.getPendingOrderId?.() && requiredGroups.length && requiredGroups.every(id=>selections[id])?requiredGroups.map(id=>({...selections[id]})):[],
    isBookingEnabled:()=>false
  });
  button.addEventListener('click',async()=>{
    button.disabled=true;chosen=null;quotedOrderId=null;selections=Object.create(null);requiredGroups=[];quoteList.replaceChildren();
    try{
      const orderId=window.ShopDropPhase6CartAddress?.getPendingOrderId?.();
      if(!orderId)throw Error('Create your secure order first.');
      const bridge=window.ShopDropCourierQuoteBridge;
      if(typeof bridge?.requestQuotes!=='function')throw Error('Courier quote connector unavailable.');
      if(typeof bridge.listFulfilmentGroups!=='function')throw Error('Seller shipment groups are unavailable.');
      status.textContent='Loading seller shipment groups…';
      const groups=await bridge.listFulfilmentGroups(orderId);
      if(!Array.isArray(groups)||!groups.length)throw Error('No seller shipment groups are available for this order.');
      const ids=groups.map(g=>g.id);
      if(ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length)throw Error('Invalid seller shipment groups.');
      requiredGroups=ids;
      for(const [i,group] of groups.entries()){
        if(window.ShopDropPhase6CartAddress?.getPendingOrderId?.()!==orderId)throw Error('Order changed. Request new courier quotes.');
        const heading=document.createElement('div');
        heading.textContent='Seller shipment '+(i+1)+' of '+groups.length;
        quoteList.append(heading);
        const response=await bridge.requestQuotes(orderId,group.id);
        if(response.fulfilment_group_id!==group.id)throw Error('Courier quotation seller group mismatch.');
        const quotes=response.quotes||[];
        if(!Array.isArray(quotes)||!quotes.length){
          const message=document.createElement('div');message.textContent='No courier quotes available for this seller shipment.';quoteList.append(message);continue;
        }
        quotes.forEach(q=>{
          const amount=Number(q.amount), currency=String(q.currency||'');
          if(!Number.isFinite(amount)||amount<=0||!/^[A-Z]{3}$/.test(currency))return;
          const row=document.createElement('button');row.type='button';
          const name=String(q.service_name||q.provider||'Courier');
          row.textContent=name+' — '+new Intl.NumberFormat(undefined,{style:'currency',currency}).format(amount);
          row.addEventListener('click',async()=>{
            if(window.ShopDropPhase6CartAddress?.getPendingOrderId?.()!==orderId){status.textContent='Order changed. Request new quotes.';chosen=null;selections=Object.create(null);return;}
            if(!q.quote_reference||!q.provider){status.textContent='This quote lacks a provider reference. Select another quote.';return;}
            if(!q.quote_id){status.textContent='This quote has not been stored securely. Request new quotes.';return;}
            row.disabled=true;
            try{
              await bridge.selectQuote(orderId,group.id,q.quote_id);
            }catch(error){status.textContent=error?.message||'Courier selection not confirmed.';row.disabled=false;return;}
            const selection={provider:q.provider,quote_reference:q.quote_reference,quote_id:q.quote_id,service_code:q.service_code,amount,currency,order_id:orderId,fulfilment_group_id:group.id};
            selections[group.id]=selection;
            chosen=requiredGroups.length===1?selection:null;
            status.textContent=requiredGroups.every(id=>selections[id])?'Courier selected for every seller shipment. Awaiting trusted checkout price confirmation.':'Courier selected for seller shipment '+(i+1)+'. Choose couriers for remaining shipments.';
          });
          quoteList.append(row,document.createTextNode(' '));
        });
      }
      if(window.ShopDropPhase6CartAddress?.getPendingOrderId?.()!==orderId)throw Error('Order changed. Request new courier quotes.');
      quotedOrderId=orderId;
      status.textContent='Choose a courier for each seller shipment. Payment remains protected until server-side quote confirmation is connected.';
    }catch(e){chosen=null;quotedOrderId=null;selections=Object.create(null);requiredGroups=[];quoteList.replaceChildren();status.textContent=e?.message||'Courier quotation unavailable.';}
    finally{button.disabled=false;}
  });
})();
