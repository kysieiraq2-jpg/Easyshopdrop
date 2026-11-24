(() => {
  'use strict';
  const BASE='https://dtkdvvxpwonywtsgqmdx.supabase.co',KEY='sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';
  const get=id=>document.getElementById(id),params=new URLSearchParams(location.search),kind=params.get('booking_type'),booking=params.get('booking_id');
  const title=get('completionTitle193g'),status=get('completionStatus193g'),actions=get('completionActions193g'),reveal=get('completionReveal193g'),code=get('completionCode193g'),submit=get('completionSubmit193g'),refresh=get('completionRefresh193g'),back=get('completionBack193g');
  const valid=['service','dispatch'].includes(kind)&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(booking||'');
  let clientPromise,busy=false,generation=0;
  const signIn=()=>Object.assign(Error('Sign in required'),{signIn:true});
  const message=t=>{status.textContent=t;};
  function clearCode(){generation++;code.textContent='';code.hidden=true;reveal.textContent='Show my Completion PIN';}
  function clear(){clearCode();actions.hidden=true;reveal.hidden=true;submit.hidden=true;submit.removeAttribute('href');}
  function fail(e){clear();message(e?.signIn?'Please sign in to view your private booking.':'Completion information unavailable. Refresh or return to your appointments.');if(e?.signIn){const a=document.createElement('a');a.href='./sign-in.html';a.textContent=' Sign in';status.append(a);}}
  async function rpc(name){
    if(!clientPromise)clientPromise=import('https://esm.sh/@supabase/supabase-js@2.49.4').then(({createClient})=>createClient(BASE,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}})).catch(e=>{clientPromise=undefined;throw e;});
    const db=await clientPromise;
    const {data:s,error:se}=await db.auth.getSession();if(se||!s?.session?.access_token)throw signIn();
    const {data:u,error:ue}=await db.auth.getUser(s.session.access_token);if(ue||!u?.user?.id)throw signIn();
    const {data,error}=await db.rpc(name,{p_booking_type:kind,p_booking_id:booking});if(error){if(error.code==='28000'||error.code==='PGRST301')throw signIn();throw Error('Unavailable');}return data;
  }
  async function state(){const s=await rpc('shopdrop_completion_state_193g');if(s?.booking_id!==booking||s.booking_type!==kind||!['customer','provider'].includes(s.my_role)||typeof s.payment_verified!=='boolean'||typeof s.completion_verified!=='boolean'||typeof s.pin_available!=='boolean')throw Error('Invalid response');return s;}
  const releaseLabels={awaiting_activation:'Release request prepared. Financial provider activation pending.',eligible:'Release request eligible; settlement not confirmed.',held:'Release request on hold.',processing:'Release request processing.',submitted:'Release request submitted; settlement not confirmed.',confirmed:'Payment release confirmed.',failed:'Release request failed. Contact Shop&Drop support.'};
  async function load(){
    if(busy)return;busy=true;refresh.disabled=true;clear();message('Checking your private booking…');
    try{if(!valid)throw Error('Invalid booking');const s=await state();title.textContent=kind==='service'?'Other Services':'Transport Services & Equipment Hire';
      back.href=(kind==='service'?'./service-appointments-193d.html':'./dispatch-appointments-192dd.html')+(s.my_role==='provider'?'?role=provider':'');
      if(!s.payment_verified){message('Completion PIN and payout are unavailable until payment has been verified.');return;}
      if(s.completion_verified){message('Completion verified. '+(releaseLabels[s.release_status]||'Payment release status unavailable. Contact Shop&Drop support.'));return;}
      if(s.my_role==='customer'){if(!s.pin_available){message('Your Completion PIN is not available or has expired. Contact Shop&Drop support.');return;}actions.hidden=false;reveal.hidden=false;message('Your Completion PIN is private. Reveal it only when you need it. Give it to the provider only after satisfactory completion.');}
      else{actions.hidden=false;submit.hidden=false;submit.href='./shopdrop-provider-completion.html?booking_type='+encodeURIComponent(kind)+'&booking_id='+encodeURIComponent(booking);message('When the agreed work is complete, request the customer’s six-digit PIN and submit it.');}
    }catch(e){fail(e);}finally{busy=false;refresh.disabled=false;}
  }
  reveal.addEventListener('click',async()=>{if(busy)return;if(!code.hidden){clearCode();return;}busy=true;refresh.disabled=true;reveal.disabled=true;const request=generation;try{const s=await state();if(!s.pin_available||s.my_role!=='customer'||!s.payment_verified||s.completion_verified)throw Error('PIN unavailable');const pin=await rpc('shopdrop_customer_completion_pin_193g');if(typeof pin!=='string'||!/^[0-9]{6}$/.test(pin))throw Error('Invalid PIN');if(request!==generation||document.hidden)return;code.textContent=pin;code.hidden=false;reveal.textContent='Hide my Completion PIN';}catch(e){fail(e);}finally{busy=false;refresh.disabled=false;reveal.disabled=false;}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearCode();});window.addEventListener('pagehide',clearCode);
  refresh.addEventListener('click',load);load();
})();
