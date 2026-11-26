/* Fix 198F: one searchable field per choice, backed by the original required selects. */
(function(root){
 'use strict';
 const normal=v=>String(v||'').normalize('NFKC').trim().toLocaleLowerCase('en-ZA').replace(/\s+/g,' ');
 const words=v=>normal(v).match(/[\p{L}\p{N}]+/gu)||[];
 const ignored=new Set(['a','an','the','new','used','second','hand','secondhand','homemade','handmade','in','good','great','excellent','condition','for','sale','with','and','very','like','of']);
 const prefix=(names,q)=>names.filter(n=>normal(n).startsWith(normal(q)));
 function titleMatches(catalog,value){
  const q=normal(value);if(!q)return [];
  const direct=prefix([...catalog.keys()],q);
  if(direct.length||q.length<=2)return direct;
  const tokens=words(q).filter(w=>!ignored.has(w)&&w.length>=2);if(!tokens.length)return [];
  const ranked=[];
  for(const [category,subs] of catalog){
   const base=words(category);let best=0;
   for(const sub of ['',...subs]){const terms=base.concat(words(sub));best=Math.max(best,tokens.filter(t=>terms.some(w=>w.startsWith(t))).length);}
   if(best)ranked.push([category,best]);
  }
  const max=Math.max(0,...ranked.map(r=>r[1]));return ranked.filter(r=>r[1]===max).map(r=>r[0]);
 }
 function bind(catalog){
  const el=id=>document.getElementById(id),form=el('itemForm'),title=el('n'),category=el('c'),sub=el('subcat');
  const make=(prefix,select)=>({select,input:el(prefix+'Input'),results:el(prefix+'Results'),status:el(prefix+'Status'),clear:el(prefix+'Clear'),label:document.querySelector('label[for="'+select.id+'"]')});
  if(!form||!title||!category||!sub||!catalog.size)return {reset(){}};
  const cat=make('shopdropSellerCategory198e',category),child=make('shopdropSellerSubcategory198e',sub);
  if(![cat,child].every(p=>p.input&&p.results&&p.status&&p.clear&&p.label))return {reset(){}};
  let internal=false,skipFocus=false;
  const names=()=>[...catalog.keys()];const children=()=>catalog.get(category.value)||[];
  function close(p){p.results.hidden=true;p.results.replaceChildren();p.status.textContent='';p.input.setAttribute('aria-expanded','false');}
  function valid(){
   const catOK=names().includes(category.value)&&cat.input.value===category.value;
   const subOK=catOK&&children().includes(sub.value)&&child.input.value===sub.value;
   cat.input.setCustomValidity(catOK?'':'Choose a main category from the list.');
   child.input.disabled=!catOK;child.input.required=catOK;
   child.input.setCustomValidity(!catOK||subOK?'':'Choose a subcategory from the list.');
   cat.clear.hidden=!cat.input.value;child.clear.hidden=child.input.disabled||!child.input.value;
  }
  function reset(){cat.input.value=category.value;child.input.value=sub.value;close(cat);close(child);valid();}
  function setSelect(p,value){
   internal=true;
   try{p.select.value=value;if(!value)p.select.selectedIndex=-1;p.select.dispatchEvent(new Event('change',{bubbles:true}));}
   finally{internal=false;}
  }
  function choose(p,name){
   if(!(p===cat?names():children()).includes(name))return;
   if(p.select.value!==name){setSelect(p,name);if(p===cat){child.input.value=sub.value;close(child);}}
   p.input.value=name;close(p);valid();
   // Return focus to the confirmed field without reopening its choices.
   skipFocus=true;try{p.input.focus({preventScroll:true});}finally{skipFocus=false;}
  }
  function draw(p,values){
   if(p.input.disabled)return;
   const other=p===cat?child:cat;close(other);p.results.replaceChildren();
   p.results.hidden=!values.length;p.input.setAttribute('aria-expanded',String(Boolean(values.length)));
   p.status.textContent=values.length?`${values.length} matching ${p===cat?'categories':'subcategories'}. Tap one to select.`:'No matches. Try another letter or clear the field.';
   for(const name of values){const b=document.createElement('button');b.type='button';b.textContent=name;b.addEventListener('pointerdown',e=>e.preventDefault());b.addEventListener('click',()=>choose(p,name));p.results.append(b);}
  }
  function options(p,all=false){const list=p===cat?names():children();draw(p,all?list:prefix(list,p.input.value));}
  function edit(p){
   if(p.select.value&&p.input.value!==p.select.value){setSelect(p,'');if(p===cat){child.input.value='';close(child);}}
   valid();options(p);
  }
  function clear(p){p.input.value='';edit(p);p.input.focus();options(p,true);}
  for(const p of [cat,child]){
   p.input.required=p===cat;
   p.input.addEventListener('focus',()=>{if(!skipFocus)options(p,!!p.select.value);});
   p.input.addEventListener('click',()=>{if(p.results.hidden)options(p,!!p.select.value);});
   p.input.addEventListener('input',()=>edit(p));
   p.input.addEventListener('search',()=>edit(p));
   p.clear.addEventListener('click',()=>clear(p));
   p.input.addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();if(p.results.hidden)options(p,!!p.select.value);}
    if(e.key==='Escape'){e.preventDefault();close(p);}
    if(e.key==='ArrowDown'){e.preventDefault();if(p.results.hidden)options(p,!!p.select.value);p.results.querySelector('button')?.focus();}
   });
   p.results.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close(p);skipFocus=true;try{p.input.focus();}finally{skipFocus=false;}}});
   // Original required selects remain authoritative; the visible fields report validity.
   p.select.addEventListener('invalid',e=>e.preventDefault());
  }
  title.addEventListener('input',()=>{if(!category.value&&!cat.input.value){const matches=titleMatches(catalog,title.value);if(matches.length)draw(cat,matches);else close(cat);}});
  category.addEventListener('change',()=>{if(!internal)reset();});
  sub.addEventListener('change',()=>{if(!internal){child.input.value=sub.value;close(child);valid();}});
  function outside(e){for(const p of [cat,child]){const block=p.input.closest('.shopdrop-seller-search198e');if(!block.contains(e.target)&&!(p===cat&&e.target===title))close(p);}}
  document.addEventListener('pointerdown',outside);document.addEventListener('focusin',outside);
  reset();
  for(const p of [cat,child]){p.select.hidden=true;p.label.hidden=true;}
  form.classList.add('shopdrop-seller-picker198f');
  return {reset};
 }
 root.ShopDropSellerCategory198e=Object.freeze({bind,titleMatches,prefix});
})(globalThis);
