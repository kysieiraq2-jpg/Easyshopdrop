// Phase6C A85: private, account-owned courier contact and address editor.
// No public listing, cross-user access, or courier disclosure is implemented here.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const sb = createClient('https://dtkdvvxpwonywtsgqmdx.supabase.co','sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const {data:{user},error:authError}=await sb.auth.getUser();
if(authError||!user) { /* Account page already handles signed-out users. */ }
else {
 const panel=document.createElement('section');panel.className='panel';
 const title=document.createElement('h2');title.textContent='Private courier contact and address';panel.append(title);
 const note=document.createElement('p');note.className='muted';note.textContent='Only you can edit these details. Shop&Drop may share necessary pickup or delivery details with your assigned courier after an authorized paid shipment.';panel.append(note);
 const form=document.createElement('form');form.autocomplete='on';panel.append(form);
 const field=(label,key,required=false,kind='text')=>{const l=document.createElement('label');l.textContent=label;l.style.display='block';const i=document.createElement('input');i.name=key;i.type=kind;i.required=required;i.style.width='min(100%,460px)';i.style.display='block';l.append(i);form.append(l);return i};
 const name=field('Full name','full_name',true);
 const phone=field('Mobile number (+country code)','mobile_number',true,'tel');
 const label=field('Address label (e.g. Home or Pickup)','address_label');
 const line1=field('Street address','address_line_1',true);
 const line2=field('Apartment / additional address','address_line_2');
 const city=field('City / town','city',true);
 const state=field('State / province','state_province');
 const postal=field('Postal code','postal_code');
 const country=field('Country code (ISO 2 letters, e.g. ZA)','country_code',true);
 const button=document.createElement('button');button.type='submit';button.textContent='Save private contact details';form.append(button);
 const message=document.createElement('p');message.setAttribute('role','status');message.setAttribute('aria-live','polite');panel.append(message);
 const host=document.querySelector('main');host?.append(panel);
 const [{data:profile,error:profileError},{data:addresses,error:addressError}]=await Promise.all([
  sb.from('profiles').select('full_name,mobile_number,country_code').eq('id',user.id).maybeSingle(),
  sb.from('addresses').select('id,recipient_name,mobile_number,address_label,address_line_1,address_line_2,city,state_province,postal_code,country_code,is_default').eq('user_id',user.id).eq('is_default',true).limit(1)
 ]);
 if(profileError||addressError){message.textContent='Unable to load contact details. Please try again later.';button.disabled=true}
 else {
  const a=addresses?.[0]||{};
  name.value=profile?.full_name||a.recipient_name||user.user_metadata?.full_name||'';
  phone.value=profile?.mobile_number||a.mobile_number||'';
  for(const input of [label,line1,line2,city,state,postal])input.value=a[input.name]||'';
  country.value=a.country_code||profile?.country_code||'';
  form.addEventListener('submit',async e=>{
   e.preventDefault();button.disabled=true;message.textContent='Saving…';
   try {
    const cc=country.value.trim().toUpperCase();const mobile=phone.value.trim();
    if(!/^[A-Z]{2}$/.test(cc))throw Error('Enter a valid two-letter country code.');
    if(!/^\+[1-9]\d{6,14}$/.test(mobile))throw Error('Enter a mobile number in international format, e.g. +27821234567.');
    const person=name.value.trim();if(!person||!line1.value.trim()||!city.value.trim())throw Error('Name, street and city are required.');
    const {error:pe}=await sb.from('profiles').update({full_name:person,mobile_number:mobile,country_code:cc}).eq('id',user.id);if(pe)throw pe;
    const record={user_id:user.id,recipient_name:person,mobile_number:mobile,address_label:label.value.trim()||'Primary',address_line_1:line1.value.trim(),address_line_2:line2.value.trim()||null,city:city.value.trim(),state_province:state.value.trim()||null,postal_code:postal.value.trim()||null,country_code:cc,is_default:true};
    const result=a.id?await sb.from('addresses').update(record).eq('id',a.id).eq('user_id',user.id).select('id').single():await sb.from('addresses').insert(record).select('id').single();
    if(result.error)throw result.error;a.id=result.data.id;message.textContent='Private contact details saved.';
   } catch(err){message.textContent='Save failed: '+(err?.message||'Please try again.')} finally{button.disabled=false}
  });
 }
}
