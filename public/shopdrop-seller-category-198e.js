/* Fix 198E: suggestions only. The seller must confirm the actual category and subcategory. */
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
   const base=words(category);
   let best=0;
   for(const sub of ['',...subs]){
    const terms=base.concat(words(sub));
    const score=tokens.filter(t=>terms.some(w=>w.startsWith(t))).length;
    best=Math.max(best,score);
   }
   if(best)ranked.push([category,best]);
  }
  const max=Math.max(0,...ranked.map(r=>r[1]));
  return ranked.filter(r=>r[1]===max).map(r=>r[0]);
 }
 function bind(catalog){
  const el=id=>document.getElementById(id);
  const title=el('n'),category=el('c'),sub=el('subcat');
  const catInput=el('shopdropSellerCategory198eInput'),subInput=el('shopdropSellerSubcategory198eInput');
  const catResults=el('shopdropSellerCategory198eResults'),subResults=el('shopdropSellerSubcategory198eResults');
  const catStatus=el('shopdropSellerCategory198eStatus'),subStatus=el('shopdropSellerSubcategory198eStatus');
  const catClear=el('shopdropSellerCategory198eClear'),subClear=el('shopdropSellerSubcategory198eClear');
  if(![title,category,sub,catInput,subInput,catResults,subResults,catStatus,subStatus,catClear,subClear].every(Boolean))return {reset(){}};
  let showTitle=false;
  function draw(host,status,values,active,choose){
   host.replaceChildren();host.hidden=!active||!values.length;
   status.textContent=!active?'':values.length?`${values.length} matching ${host===catResults?'categories':'subcategories'}. Tap one to select.`:'No matches. Try another letter or use the full dropdown.';
   if(!active)return;
   for(const name of values){const b=document.createElement('button');b.type='button';b.textContent=name;b.addEventListener('click',()=>choose(name));host.append(b);}
  }
  function renderCat(){
   const typed=normal(catInput.value),fromTitle=showTitle&&normal(title.value);
   catClear.hidden=!catInput.value&&!showTitle;
   const values=typed?prefix([...catalog.keys()],typed):fromTitle?titleMatches(catalog,title.value):[];
   draw(catResults,catStatus,values,Boolean(typed||fromTitle),name=>{
    if(category.value!==name){category.value=name;category.dispatchEvent(new Event('change',{bubbles:true}));}
    catInput.value='';showTitle=false;renderCat();subInput.focus();
   });
  }
  function renderSub(){
   const available=catalog.get(category.value)||[];
   subInput.disabled=!available.length;subClear.hidden=!subInput.value;
   const q=normal(subInput.value);
   draw(subResults,subStatus,prefix(available,q),Boolean(q&&available.length),name=>{
    if(!available.includes(name))return;
    sub.value=name;sub.dispatchEvent(new Event('change',{bubbles:true}));subInput.value='';renderSub();sub.focus();
   });
  }
  function reset(){showTitle=false;catInput.value='';subInput.value='';renderCat();renderSub();}
  title.addEventListener('input',()=>{showTitle=true;renderCat();});
  catInput.addEventListener('input',()=>{showTitle=false;renderCat();});
  subInput.addEventListener('input',renderSub);
  for(const input of [catInput,subInput]){input.addEventListener('search',()=>input===catInput?renderCat():renderSub());input.addEventListener('keydown',e=>{if(e.key==='Enter')e.preventDefault();});}
  catClear.addEventListener('click',()=>{catInput.value='';showTitle=false;renderCat();catInput.focus();});
  subClear.addEventListener('click',()=>{subInput.value='';renderSub();subInput.focus();});
  category.addEventListener('change',reset);
  sub.addEventListener('change',()=>{subInput.value='';renderSub();});
  // No changes to the real selects until a seller explicitly selects a suggestion.
  reset();return {reset};
 }
 root.ShopDropSellerCategory198e=Object.freeze({bind,titleMatches,prefix});
})(globalThis);
