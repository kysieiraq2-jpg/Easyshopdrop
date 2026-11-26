/* Shop&Drop Fix 199D-B: read-only payment confirmation and customer PIN display. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const panel=$('shopdropPaid199db'),intro=$('shopdropCheckoutIntro199db');
  const heading=$('shopdropPaidHeading199db'),notice=$('shopdropPaidNotice199db');
  const pin=$('shopdropPaidPin199db'),copy=$('shopdropPaidCopy199db');
  const warning=$('shopdropPaidWarning199db'),account=$('shopdropPaidAccount199db');
  const copied=$('shopdropPaidCopied199db'),language=$('shopdropPaidLanguage199db');
  if(![panel,intro,heading,notice,pin,copy,warning,account,copied,language].every(Boolean))return;
  const words={
    en:['Payment Successful','Your six-digit Completion PIN','Keep this PIN safe. Give it to the service provider only after all agreed work is complete.','Your PIN is also available in My Account.','Copy PIN','PIN copied.','Unable to copy. You can read or select the number above.'],
    af:['Betaling suksesvol','Jou sessyfer-voltooiings-PIN','Hou hierdie PIN veilig. Gee dit eers aan die diensverskaffer nadat al die ooreengekome werk voltooi is.','Jou PIN is ook in My Account beskikbaar.','Kopieer PIN','PIN gekopieer.','Kon nie kopieer nie. Lees of kies die nommer hierbo.'],
    zu:['Inkokhelo iphumelele','I-PIN yakho enamadijithi ayisithupha','Gcina le PIN iphephile. Yinike umhlinzeki wesevisi kuphela uma wonke umsebenzi enivumelene ngawo usuphelile.','I-PIN yakho iyatholakala naku-My Account.','Kopisha i-PIN','I-PIN ikopishiwe.','Ayikwazanga ukukopishwa. Funda noma ukhethe inombolo engenhla.'],
    xh:['Intlawulo iphumelele','I-PIN yakho enamanani amathandathu','Gcina le PIN ikhuselekile. Yinike umboneleli wenkonzo kuphela xa wonke umsebenzi ekuvunyelwene ngawo ugqityiwe.','I-PIN yakho iyafumaneka nakwi-My Account.','Kopa i-PIN','I-PIN ikotshiwe.','Ayikwazanga ukukotshwa. Funda okanye ukhethe inombolo engentla.'],
    st:['Tefo e atlehile','PIN ya hao ya dinomoro tse tsheletseng','Boloka PIN ena e bolokehile. E fe mofani wa tshebeletso feela ha mosebetsi wohle oo le dumellaneng ka wona o phethilwe.','PIN ya hao e fumaneha le ho My Account.','Kopitsa PIN','PIN e kopisitswe.','Ha e a kgona ho kopitswa. Bala kapa kgetha nomoro e ka hodimo.']
  };
  let lang='en';
  try{const preferred=localStorage.getItem('shopdrop-ui-language');if(words[preferred])lang=preferred;else{const l=(navigator.language||'en').toLowerCase().split('-')[0];if(words[l])lang=l;}}catch(_){}
  language.value=lang;
  let generation=0,owner=null,watchedDb=null,phase='idle',reloadButton=null;
  const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
  const safe=()=>Object.assign(Error('Payment status unavailable'),{safeMessage:'Payment status could not be verified. Refresh checkout. If you have already paid, do not pay again.'});
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  function clearPin(){pin.textContent='';pin.hidden=true;copy.hidden=true;copied.textContent='';}
  function clear(){clearPin();panel.hidden=true;intro.hidden=false;phase='idle';}
  function translate(){const w=words[lang];panel.lang=lang;if(phase==='pin'){heading.textContent=w[0];notice.textContent=w[1];warning.textContent=w[2];account.textContent=w[3];copy.textContent=w[4];}copied.textContent='';}
  language.addEventListener('change',()=>{if(words[language.value]){lang=language.value;translate();}});
  function display(next,text){phase=next;panel.hidden=false;intro.hidden=true;clearPin();panel.dataset.state=next;heading.textContent=next==='waiting'?'Checking payment':words[lang][0];notice.textContent=text;warning.textContent='';account.textContent='';}
  function invalidate(){generation++;owner=null;clearPin();if(phase!=='idle'){panel.hidden=true;intro.hidden=true;}}
  function watch(db){if(watchedDb===db)return;watchedDb=db;db.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||(owner&&session?.user?.id!==owner))invalidate();});}
  async function getOwner(db){const {data,error}=await db.auth.getUser();if(error||!uuid(data?.user?.id)||data.user.is_anonymous===true)throw safe();return data.user.id;}
  async function state(db,args){const {data,error}=await db.rpc('shopdrop_completion_state_193g',args);if(error||data?.booking_id!==args.p_booking_id||data.booking_type!==args.p_booking_type||data.my_role!=='customer'||typeof data.payment_verified!=='boolean'||typeof data.pin_available!=='boolean'||typeof data.completion_verified!=='boolean')throw safe();return data;}
  async function check(db,kind,booking,status,reload){
    const request=++generation;clear();reloadButton=reload;watch(db);
    if(!uuid(booking)||!['service','dispatch'].includes(kind))throw safe();
    const args={p_booking_type:kind,p_booking_id:booking};
    const uid=await getOwner(db);if(request!==generation)return true;owner=uid;
    const returned=new URLSearchParams(location.search).get('payment_return')==='1';
    let s=await state(db,args);if(request!==generation)return true;
    // A return flag only triggers read-only polling; never proves payment.
    if(returned&&!s.payment_verified){
      display('waiting','Waiting for verified payment confirmation. Do not pay again.');status.textContent='';
      for(let attempt=0;attempt<5&&!s.payment_verified;attempt++){
        await pause(2000);if(request!==generation)return true;s=await state(db,args);if(request!==generation)return true;
      }
      if(!s.payment_verified){notice.textContent='Payment has not yet been verified. Tap Refresh checkout to check again. Do not pay again until the status is confirmed.';return true;}
    }
    if(request!==generation)return true;
    if(!s.payment_verified)return false;
    // Do not show or retain a PIN for a completed or unavailable booking.
    if(await getOwner(db)!==uid||request!==generation)return true;
    status.textContent='';
    if(s.completion_verified){display('complete','Your completion has already been verified. View the booking in My Account.');return true;}
    if(!s.pin_available){display('unavailable','Payment is verified. Your PIN is not currently available. Refresh checkout or open your appointment in My Account. Do not pay again.');return true;}
    const {data:code,error}=await db.rpc('shopdrop_customer_completion_pin_193g',args);
    if(request!==generation)return true;
    if(error||typeof code!=='string'||!/^[0-9]{6}$/.test(code)){display('unavailable','Payment is verified, but the PIN could not be retrieved. Refresh checkout or open your appointment in My Account.');return true;}
    if(await getOwner(db)!==uid||request!==generation)return true;
    if(document.hidden){display('unavailable','Payment is verified. Refresh checkout to view your private PIN.');return true;}
    display('pin','');pin.textContent=code;pin.hidden=false;copy.hidden=false;translate();return true;
  }
  copy.addEventListener('click',async()=>{const code=pin.textContent;const request=generation;if(phase!=='pin'||pin.hidden||!/^[0-9]{6}$/.test(code))return;try{await navigator.clipboard.writeText(code);if(request===generation)copied.textContent=words[lang][5];}catch(_){if(request===generation)copied.textContent=words[lang][6];}});
  window.addEventListener('pagehide',invalidate);
  window.addEventListener('pageshow',e=>{if(e.persisted&&reloadButton&&!reloadButton.disabled)reloadButton.click();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&phase==='pin'){clearPin();phase='unavailable';notice.textContent='Your private PIN has been hidden. Refresh checkout to view it again.';} });
  window.ShopDropPaidConfirmation199db=Object.freeze({check});
})();
