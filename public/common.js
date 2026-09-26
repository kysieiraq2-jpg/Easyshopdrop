window.ShopDrop={
 isStatic: location.hostname.endsWith('github.io'),
 apiBase:'',
 async api(path,options={}){
  if(this.isStatic) throw new Error('Preview mode: live account, order, payment and database features require the Shop&Drop backend.');
  const r=await fetch(path,{headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
  const type=r.headers.get('content-type')||'';
  if(!type.includes('application/json')) throw new Error('Shop&Drop service is temporarily unavailable. Please try again later.');
  const d=await r.json(); if(!r.ok) throw new Error(d.error||'Request failed'); return d;
 },
 money(c,cur='ZAR'){return (Number(c||0)/100).toLocaleString(undefined,{style:'currency',currency:cur||'ZAR'})},
 esc(x){return String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')},
 msg(el,text,kind='info'){el.textContent=text;el.className='message '+kind;el.hidden=false}
};
