/* Fix 198G: optional searchable buyer filters; original selects remain authoritative. */
(function(root){
 'use strict';
 const norm=v=>String(v||'').normalize('NFKC').trim().toLocaleLowerCase('en-ZA').replace(/\s+/g,' ');
 function bind(){
  const by=id=>document.getElementById(id),form=by('productSearch194b');
  if(!form)return {reset(){}};
  const make=(id,selectId)=>({input:by(id+'Input'),results:by(id+'Results'),status:by(id+'Status'),clear:by(id+'Clear'),select:by(selectId),label:document.querySelector('label[for="'+selectId+'"]')});
  const cat=make('shopdropBuyerCategory198g','category194b'),sub=make('shopdropBuyerSubcategory198g','subcategory194b');
  if(![cat,sub].every(p=>p.input&&p.results&&p.status&&p.clear&&p.select&&p.label)||cat.select.options.length<2)return {reset(){}};
  let internal=false,skipFocus=false;
  const entries=p=>Array.from(p.select.options).filter(o=>!o.disabled).map(o=>({name:o.textContent,value:o.value}));
  const chosen=p=>Array.from(p.select.options).find(o=>o.value===p.select.value&&o.value!=='');
  function close(p){p.results.hidden=true;p.results.replaceChildren();p.status.textContent='';p.input.setAttribute('aria-expanded','false');}
  function sync(p){p.input.value=chosen(p)?.textContent||'';p.input.disabled=p.select.disabled;close(p);}
  function valid(p){
   const q=p.input.value.trim(),o=chosen(p);
   p.input.setCustomValidity(p.input.disabled||(!q&&!o)||(o&&p.input.value===o.textContent)?'':'Choose an option from the list, or clear this filter.');
   p.clear.hidden=p.input.disabled||!p.input.value;
  }
  function reset(){sync(cat);sync(sub);valid(cat);valid(sub);}
  function setValue(p,value){
   internal=true;try{p.select.value=value;p.select.dispatchEvent(new Event('change',{bubbles:true}));}finally{internal=false;}
  }
  function choose(p,entry){
   if(!entries(p).some(o=>o.name===entry.name&&o.value===entry.value))return;
   if(p.select.value!==entry.value)setValue(p,entry.value);
   sync(p);if(p===cat)sync(sub);valid(cat);valid(sub);
   skipFocus=true;try{p.input.focus({preventScroll:true});}finally{skipFocus=false;}
  }
  function show(p,all=false){
   if(p.input.disabled)return;
   close(p===cat?sub:cat);
   const q=norm(p.input.value),items=entries(p).filter(o=>all||!q||norm(o.name).startsWith(q));
   p.results.replaceChildren();p.results.hidden=!items.length;p.input.setAttribute('aria-expanded',String(!!items.length));
   p.status.textContent=items.length?'Tap an option to choose.':'No matches. Try another letter or clear the field.';
   for(const o of items){const b=document.createElement('button');b.type='button';b.textContent=o.name;b.addEventListener('pointerdown',e=>e.preventDefault());b.addEventListener('click',()=>choose(p,o));p.results.append(b);}
  }
  function edit(p){
   if(p.select.value&&p.input.value!==chosen(p)?.textContent){setValue(p,'');if(p===cat)sync(sub);}
   valid(cat);valid(sub);show(p);
  }
  for(const p of [cat,sub]){
   p.input.addEventListener('focus',()=>{if(!skipFocus)show(p,!!p.select.value);});
   p.input.addEventListener('click',()=>{if(p.results.hidden)show(p,!!p.select.value);});
   p.input.addEventListener('input',()=>edit(p));p.input.addEventListener('search',()=>edit(p));
   p.clear.addEventListener('click',()=>{p.input.value='';edit(p);p.input.focus();show(p,true);});
   p.input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(p.results.hidden)show(p,!!p.select.value);}if(e.key==='Escape'){e.preventDefault();close(p);}if(e.key==='ArrowDown'){e.preventDefault();if(p.results.hidden)show(p,!!p.select.value);p.results.querySelector('button')?.focus();}});
   p.results.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close(p);skipFocus=true;try{p.input.focus();}finally{skipFocus=false;}}});
   p.select.addEventListener('change',()=>{if(!internal)reset();});
  }
  function outside(e){for(const p of [cat,sub])if(!p.input.closest('.shopdrop-buyer-picker198g').contains(e.target))close(p);}
  document.addEventListener('pointerdown',outside);document.addEventListener('focusin',outside);
  // Restore form values when navigating back. Native selects are the fallback if initialization fails.
  window.addEventListener('pageshow',e=>{if(e.persisted)reset();});
  reset();for(const p of [cat,sub]){p.select.hidden=true;p.label.hidden=true;}
  form.classList.add('shopdrop-buyer-enhanced198g');return {reset};
 }
 root.ShopDropBuyerPicker198g=Object.freeze({bind});
})(globalThis);
