/* Fix 198A: public category names, backwards-compatible stored pairs and search synonyms.
   No writes, no authentication, no checkout or financial logic. */
(function(root){
 'use strict';
 const publicDepartments=data=>data?.publicDepartments||data?.departments||[];
 const legacyRows=data=>Array.isArray(data?.legacyMap)?data.legacyMap:[];
 const hasPair=(data,c,s)=>publicDepartments(data).some(d=>d.name===c&&d.subcategories.includes(s));
 function label(data,c,s){
  const r=legacyRows(data).find(x=>x[0]===c&&x[1]===s);
  return r?[r[2],r[3]]:[c,s];
 }
 function pairs(data,c,s){
  const pub=publicDepartments(data).find(d=>d.name===c);
  // Old direct subcategory URLs are resolved to the same public choice.
  if(s&&!hasPair(data,c,s)){
   const r=legacyRows(data).find(x=>x[0]===c&&x[1]===s);
   if(r)return pairs(data,r[2],r[3]);
  }
  if(pub&&(!s||pub.subcategories.includes(s))){
   const result=(s?[s]:pub.subcategories).map(v=>[c,v]);
   for(const r of legacyRows(data))if(r[2]===c&&(!s||r[3]===s))result.push(r.slice(0,2));
   return result;
  }
  // Old category-only routes remain available; never accept arbitrary URL values.
  const old=(data?.departments||[]).find(d=>d.name===c);
  if(!old||(s&&!old.subcategories.includes(s)))throw Error('Choose a valid category and subcategory.');
  return (s?[s]:old.subcategories).map(v=>[c,v]);
 }
 const quoted=v=>JSON.stringify(String(v));
 function grouped(rows){
  const groups=new Map();
  for(const [c,s] of rows){if(!groups.has(c))groups.set(c,new Set());groups.get(c).add(s);}
  return groups;
 }
 function expressions(rows){
  return [...grouped(rows)].map(([c,ss])=>{
   const values=[...ss];
   const sub=values.length===1?'subcategory.eq.'+quoted(values[0]):'subcategory.in.('+values.map(quoted).join(',')+')';
   return 'and(category.eq.'+quoted(c)+','+sub+')';
  });
 }
 // Preserve independent logical filters when category aliases and text search are both selected.
 function addOr(p,terms){
  if(!terms.length)return;
  const next='('+terms.join(',')+')';
  if(p.has('and')){const prev=p.get('and');p.set('and',prev.slice(0,-1)+',or'+next+')');}
  else if(p.has('or')){const prev=p.get('or');p.delete('or');p.set('and','(or'+prev+',or'+next+')');}
  else p.set('or',next);
 }
 function applyCategory(p,data,c,s=''){
  if(!c)return;
  const rows=pairs(data,c,s),groups=grouped(rows);
  if(groups.size===1){const [name,ss]=[...groups][0],values=[...ss];
   p.set('category','eq.'+name);
   p.set('subcategory',values.length===1?'eq.'+values[0]:'in.('+values.map(quoted).join(',')+')');
  }else addOr(p,expressions(rows));
 }
 function applyHandmade(p,data){
  // Preserve the established handmade browse scope and include only explicitly
  // handmade/homemade new choices. General new categories are not assumed handmade.
  const terms=['category.eq.'+quoted('Arts, Crafts & Handmade'),'category.eq.'+quoted('Homemade Food & Pantry')];
  const rows=[];
  for(const d of publicDepartments(data))for(const s of d.subcategories){
   if(['Handmade Furniture','Homemade Food'].includes(d.name)||/\b(?:handmade|homemade)\b/i.test(s))rows.push([d.name,s]);
  }
  addOr(p,terms.concat(expressions(rows)));
 }
 const synonyms=[['braai','barbecue','bbq'],['fishing','angling'],['weed eater','weedeater','grass trimmer','strimmer'],['groeisout','fertiliser','fertilizer','plant food'],['e-bike','e bike','ebike','electric bicycle','electric bike'],['leash','lead'],['bakkie','pickup truck'],['4x4','four by four','4wd','off-road'],['tyre','tire'],['tyres','tires'],['cellphone','cell phone','mobile phone'],['fridge','refrigerator'],['spanner','wrench'],['air fryer','airfryer']];
 const safeTerm=v=>String(v||'').slice(0,100).replace(/[^\p{L}\p{N}\s'-]/gu,' ').replace(/\s+/g,' ').trim();
 const escapeRegex=v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 function expand(v){
  const term=safeTerm(v);if(!term)return [];
  const result=new Set([term]);
  for(const group of synonyms)for(const token of group){
   const re=new RegExp('(^|\\s)'+escapeRegex(token)+'(?=\\s|$)','i');
   if(re.test(term))for(const word of group){
    const candidate=term.replace(re,(_,prefix)=>prefix+word);
    if(![...result].some(x=>x.toLowerCase()===candidate.toLowerCase()))result.add(candidate);
    if(result.size>=8)return [...result];
   }
  }
  return [...result];
 }
 function applySearch(p,term){
  const terms=expand(term);if(!terms.length)return;
  addOr(p,terms.flatMap(t=>['title','description','category','subcategory'].map(field=>field+'.ilike.*'+t+'*')));
 }
 function related(data,c){return (data?.related?.[c]||[]).filter(n=>publicDepartments(data).some(d=>d.name===n));}
 function recover(data,c,s){const mapped=label(data,c,s);return hasPair(data,...mapped)?mapped:['',''];}
 function storedFor(data,c,s,original){
  if(original){const mapped=recover(data,...original);if(mapped[0]===c&&mapped[1]===s)return original;}
  return [c,s];
 }
 root.ShopDropCategory198a=Object.freeze({publicDepartments,label,pairs,applyCategory,applyHandmade,expand,applySearch,related,recover,storedFor,hasPair});
})(globalThis);
