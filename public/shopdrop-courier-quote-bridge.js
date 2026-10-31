// Phase 6C A160: authenticated courier quote transport for existing orders.
// No private pickup/delivery address is sent by the browser.
(function(){
  'use strict';
  const URL='https://dtkdvvxpwonywtsgqmdx.supabase.co';
  const KEY='sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';
  let clientPromise;
  function client(){
    return clientPromise ||= import('https://esm.sh/@supabase/supabase-js@2')
      .then(m=>m.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}))
      .catch(e=>{clientPromise=null;throw e;});
  }
  async function requestQuotes(orderId, fulfilmentGroupId){
    if(fulfilmentGroupId != null && !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(String(fulfilmentGroupId)))
      throw Error('Invalid fulfilment group reference.');
    if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(String(orderId||'')))
      throw Error('Invalid order reference.');
    const sb=await client();
    const {data:{session},error:authError}=await sb.auth.getSession();
    if(authError||!session?.access_token)throw Error('Please sign in to request a courier quotation.');
    const response=await fetch(URL+'/functions/v1/courier-quotes',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':KEY},
      body:JSON.stringify({order_id:orderId,...(fulfilmentGroupId?{fulfilment_group_id:fulfilmentGroupId}:{})})
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok||result.ok!==true)throw Error(result.error||'Courier quotations unavailable.');
    if(result.order_id!==orderId||!Array.isArray(result.quotes))throw Error('Invalid courier quotation response.');
    if(fulfilmentGroupId && result.fulfilment_group_id !== fulfilmentGroupId)
      throw Error('Courier service has not confirmed the requested seller group.');
    return result; // Informational only. Never trust browser quotes for charging.
  }
  async function listFulfilmentGroups(orderId){
    if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(String(orderId||'')))
      throw Error('Invalid order reference.');
    const sb=await client();
    const {data:{user},error:authError}=await sb.auth.getUser();
    if(authError||!user)throw Error('Please sign in to view shipment groups.');
    const {data,error}=await sb.from('fulfilment_groups')
      .select('id,seller_id,order_id').eq('order_id',orderId).order('id');
    if(error)throw Error('Shipment groups are not accessible yet: '+error.message);
    return data||[];
  }
  window.ShopDropCourierQuoteBridge=Object.freeze({requestQuotes,listFulfilmentGroups});
})();
