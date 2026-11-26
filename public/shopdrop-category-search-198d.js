/* Fix 198D: filter only visible main-category rows; never change category data or history. */
(function(){
 'use strict';
 const normal=value=>String(value||'').normalize('NFKC').trim().toLocaleLowerCase('en-ZA').replace(/\s+/g,' ');
 function bind(prefix,hostId,rowSelector,getName){
  const input=document.getElementById(prefix+'Input'),clear=document.getElementById(prefix+'Clear'),status=document.getElementById(prefix+'Status'),host=document.getElementById(hostId);
  if(!input||!clear||!status||!host)return;
  function filter(){
   const query=normal(input.value);
   const rows=Array.from(host.children).filter(row=>row.matches(rowSelector));
   let count=0;
   for(const row of rows){
    const match=normal(getName(row)).startsWith(query);
    row.toggleAttribute('data-shopdrop-category-filtered198d',!match);
    if(match)count++;
   }
   clear.hidden=!input.value;
   const message=!query||!rows.length?'':count?`${count} matching ${count===1?'category':'categories'}`:'No matching categories. Try another letter or clear your search.';
   if(status.textContent!==message)status.textContent=message;
  }
  input.addEventListener('input',filter);
  input.addEventListener('search',filter);
  clear.addEventListener('click',()=>{input.value='';filter();input.focus();});
  // Reapply if either existing menu renderer or the category page replaces its rows.
  new MutationObserver(filter).observe(host,{childList:true,subtree:true,characterData:true});
  window.addEventListener('pageshow',filter);
  filter();
 }
 bind('shopdropMenuCategory198d','mainMenuCategories','details',row=>row.querySelector('summary')?.textContent);
 bind('shopdropPageCategory198d','cats','.cat',row=>row.dataset.name);
})();
