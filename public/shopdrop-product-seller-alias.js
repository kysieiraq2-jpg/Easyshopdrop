/* Shop&Drop A147: public seller alias display, no direct profile reads.
   Requires restricted RPC public_product_seller_alias(uuid), added in a later backend step. */
(function(){
  'use strict';
  const endpoint='https://dtkdvvxpwonywtsgqmdx.supabase.co';
  const key='sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';
  const panel=document.getElementById('shopdropSellerAliasPanel');
  const content=document.getElementById('shopdropSellerAliasContent');
  const productId=new URLSearchParams(location.search).get('id');
  if(!panel||!content||!productId||!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(productId))return;
  (async()=>{
    try{
      const r=await fetch(endpoint+'/rest/v1/rpc/public_product_seller_alias',{
        method:'POST',headers:{'Content-Type':'application/json',apikey:key},
        body:JSON.stringify({p_product_id:productId})
      });
      if(!r.ok)return; // No public disclosure until the restricted RPC is installed.
      const rows=await r.json();
      const alias=Array.isArray(rows)?rows[0]?.seller_alias:rows?.seller_alias;
      if(typeof alias!=='string'||!alias.trim())return;
      const name=document.createElement('a');name.textContent=alias;name.href='./seller-products.html?alias='+encodeURIComponent(alias);name.setAttribute('aria-label','View all products from '+alias);
      const note=document.createElement('p');note.className='muted';
      note.textContent='Public seller name. Personal and business contact details remain private.';
      content.replaceChildren(name,note);
      panel.hidden=false;
    }catch(_){/* fail closed; never show raw seller identifiers */}
  })();
})();
