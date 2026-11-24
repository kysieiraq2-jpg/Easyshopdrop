(() => {
  'use strict';
  const BASE='https://dtkdvvxpwonywtsgqmdx.supabase.co',KEY='sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';
  const get=id=>document.getElementById(id), status=get('locationStatus'), form=get('locationForm'), details=get('paidDetails'), province=get('province'),town=get('town'),address=get('streetAddress'),save=get('saveLocation'),refresh=get('refreshLocation'),back=get('backAppointments');
  if(!status||!form||!details||!province||!town||!address||!save||!refresh||!back)return;
  const params=new URLSearchParams(location.search),booking=params.get('booking_id'),provider=params.get('role')==='provider';
  const valid=typeof booking==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(booking);
  back.href='./service-appointments-193d.html?role='+(provider?'provider':'customer')+(valid?'&booking_id='+encodeURIComponent(booking):'');
  const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
  const safe=message=>Object.assign(Error(message),{safeMessage:message});
  const authError=()=>Object.assign(Error('Sign in required'),{needsSignIn:true});
  let clientPromise,catalogPromise,busy=false,row=null,catalog=null;
  function message(text){status.replaceChildren(document.createTextNode(text));}
  function fail(e){message(e?.needsSignIn?'Please sign in to view your private appointment.':e?.safeMessage||'Unable to load or save private details. Refresh and try again.');if(e?.needsSignIn){const a=el('a','Sign in');a.href='./sign-in.html';a.className='btn';status.append(a);}}
  async function session(){
    if(!clientPromise)clientPromise=import('https://esm.sh/@supabase/supabase-js@2.49.4').then(({createClient})=>createClient(BASE,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}})).catch(e=>{clientPromise=undefined;throw e;});
    const db=await clientPromise;
    const {data:s,error:se}=await db.auth.getSession();if(se||!s?.session?.access_token)throw authError();
    const {data:u,error:ue}=await db.auth.getUser(s.session.access_token);if(ue||!u?.user?.id)throw authError();return db;
  }
  async function rpc(db,name,args){const {data,error}=await db.rpc(name,args);if(error){if(error.code==='28000'||error.code==='PGRST301')throw authError();const allowed=['Choose a valid location and enter the street address','Customer address must match the booked service area','Booking not editable','Payment already started'];throw safe(allowed.includes(error.message)?error.message+'.':'Private booking details are unavailable.');}return data;}
  async function locations(){if(!catalogPromise)catalogPromise=fetch('./shopdrop-sa-towns-181.json').then(async r=>{if(!r.ok)throw Error('Location data unavailable');const j=await r.json();if(!j.provinces||!Object.keys(j.provinces).length)throw Error('Location data unavailable');return j.provinces;}).catch(e=>{catalogPromise=undefined;throw e;});return catalogPromise;}
  function fill(select,items,prompt){select.replaceChildren(new Option(prompt,''));for(const value of items)select.add(new Option(value,value));}
  function towns(selected=''){fill(town,(catalog?.[province.value]||[]).slice().sort(),'Choose a town or city');if([...town.options].some(x=>x.value===selected))town.value=selected;town.disabled=busy||!provider||!province.value;}
  function lock(on){busy=on;refresh.disabled=on;save.disabled=on;province.disabled=on||!provider;town.disabled=on||!provider||!province.value;address.disabled=on;}
  async function selected(db){const rows=await rpc(db,'shopdrop_service_appointments_193d',{p_as_provider:provider});if(!Array.isArray(rows))throw Error('Invalid response');const match=rows.find(r=>r.booking_id===booking);if(!match)throw safe('This appointment is not available in your account.');return match;}
  function showPaid(d){details.replaceChildren();details.hidden=false;if(d?.contacts_released!==true){details.append(el('p','The other party’s details are not available until payment is independently verified.'));return;}
    details.append(el('h2',provider?'Customer contact and service address':'Provider contact and service address'));
    const other=d.other_party||{},where=d.other_location||{};
    for(const [label,value] of [['Name',other.name],['Mobile number',other.mobile_number],['Street address',where.street_address],['Town or city',where.town],['Province',where.province]])if(typeof value==='string'&&value.trim())details.append(el('p',label+': '+value));
    if(!where.street_address)details.append(el('p','No private service address was saved for this booking.'));
  }
  async function load(notice=''){
    if(busy)return;lock(true);form.hidden=true;details.hidden=true;details.replaceChildren();address.value='';row=null;message('Checking your private appointment…');
    try{if(!valid)throw safe('Choose an appointment first.');const db=await session();row=await selected(db);const s=await rpc(db,'shopdrop_service_location_state_193f',{p_booking_id:booking});if(typeof s?.ready!=='boolean'||typeof s.customer_ready!=='boolean'||typeof s.provider_ready!=='boolean')throw Error('Invalid location state');
      if(row.payment_status==='paid'){showPaid(await rpc(db,'shopdrop_service_paid_details_193f',{p_booking_id:booking}));message('Private appointment details.');return;}
      if(row.booking_status!=='pending'||row.payment_status!=='pending'||!['awaiting_provider','alternative_proposed','confirmed'].includes(row.status)){message('This appointment is not open for address changes.');return;}
      catalog=await locations();fill(province,Object.keys(catalog).sort(),'Choose a province');const own=s.own_location||{};
      province.value=provider?(own.province||''):(row.province||'');towns(provider?(own.town||''):(row.town||''));
      if(!provider&&(!province.value||!town.value))throw safe('The booked service area is unavailable. Return to your appointments.');address.value=own.street_address||'';
      get('addressLabel').textContent=provider?'Your service or business address':'Address where the service is required';form.hidden=false;
      message((notice?notice+' ':'')+(s.ready?'Both private addresses have been saved.':(provider?s.customer_ready:s.provider_ready)?'The other party has saved their address. Please save yours.':(provider?s.provider_ready:s.customer_ready)?'Your address is saved. Waiting for the other party.':'Both parties must save their private service addresses.'));
    }catch(e){form.hidden=true;details.hidden=true;fail(e);}finally{lock(false);}
  }
  province.addEventListener('change',()=>towns());
  form.addEventListener('submit',async e=>{e.preventDefault();if(busy||!row)return;if(!province.value||!town.value||!address.value.trim()||address.value.trim().length>500){message('Choose a province and town, and enter the street address.');return;}lock(true);let ok=false;try{const db=await session();const result=await rpc(db,'shopdrop_service_save_location_193f',{p_booking_id:booking,p_province:province.value,p_town:town.value,p_address:address.value.trim()});if(result!==true)throw Error('Address not saved');ok=true;}catch(e){fail(e);}finally{lock(false);}if(ok)await load('Your private address was saved.');});
  refresh.addEventListener('click',()=>load());load();
})();
