(() => {
  'use strict';
  const form=document.getElementById('shopdropSupportForm199b');
  const status=document.getElementById('supportStatus199b');
  if(!form||!status)return;
  const kind=form.dataset.supportKind;
  if(!['cancellation','report'].includes(kind))return;
  const fields=form.querySelector('fieldset');
  const button=form.querySelector('button[type="submit"]');
  const type=document.getElementById('supportType199b');
  const reference=document.getElementById('supportReference199b');
  if(!fields||!button||!type||!reference)return;
  const allowed=kind==='cancellation'?['product','service','transport']:['product','service','transport','dispatch_offer'];
  const params=new URLSearchParams(location.search);
  const preset=params.get('kind');
  if(allowed.includes(preset))type.value=preset;
  const ref=params.get('reference');
  if(ref&&ref.length<=100)reference.value=ref;
  const method=kind==='cancellation'?'cancellations':'listingReports';
  const prefix=kind==='cancellation'?'SD-CAN-':'SD-RPT-';
  let busy=false;
  function show(text,error=false){status.textContent=text;status.className=error?'error':'muted';}
  const submit=window.ShopDropSupabaseAdapter?.authenticatedFunctions?.[method];
  if(typeof submit!=='function'){show('Secure connection unavailable. Refresh this page before submitting.',true);return;}
  button.disabled=false;
  show('Complete the fields and submit your request.');
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(busy||!form.reportValidity())return;
    const data=Object.fromEntries(new FormData(form).entries());
    const t=String(data[kind==='cancellation'?'transaction_type':'listing_type']||'').trim();
    const r=String(data[kind==='cancellation'?'transaction_reference':'listing_reference']||'').trim();
    const reason=String(data.reason||'').trim();
    const details=String(data.details||'').trim();
    if(!allowed.includes(t)||!r||r.length>100||!reason||reason.length>500||details.length>3000){show('Choose a type and enter a reference and reason.',true);return;}
    const body=kind==='cancellation'?{transaction_type:t,transaction_reference:r,reason,details}:{listing_type:t,listing_reference:r,reason,details};
    busy=true;fields.disabled=true;button.disabled=true;show('Submitting securely…');
    try{
      const result=await submit(body);
      if(result?.ok!==true||typeof result.reference!=='string'||!result.reference.startsWith(prefix)||!/^SD-(CAN|RPT)-[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(result.reference)||result.status!=='submitted')throw Error('Submission confirmation was not received. Please retry; duplicate requests are checked.');
      show((kind==='cancellation'?'Cancellation request received. This is not confirmation that the transaction has been cancelled.':'Listing report received. Thank you for reporting the problem.')+' Reference: '+result.reference);
    }catch(error){
      const message=typeof error?.message==='string'?error.message:'';
      if(/sign in|authentication|session expired|jwt/i.test(message))show('Please sign in to Shop&Drop, then return to this page and submit.',true);
      else if(/^[a-z_]+$/.test(message))show('Your request could not be submitted. Check the reference and reason, then retry.',true);
      else show(message||'Your request could not be submitted. Please retry.',true);
    }finally{busy=false;fields.disabled=false;button.disabled=false;}
  });
})();
