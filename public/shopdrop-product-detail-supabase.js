
/* Shop&Drop A153: cumulative Supabase product detail and authenticated cart integration.
   Only approved/in-stock product columns are selected. The old API handlers
   remain in product.html but are not invoked on GitHub Pages. Cart writes use authenticated Supabase; inventory is reserved at checkout.

   Product detail enhancement:
   - Up to six listing photographs
   - Primary photograph first
   - Product condition, description, category and location
   - Existing shopping bag functionality preserved
   - No private seller contact information exposed
*/
(function(){
  'use strict';

  const endpoint='https://dtkdvvxpwonywtsgqmdx.supabase.co';
  const key='sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';

  const id=new URLSearchParams(location.search).get('id')||'';
  const detail=document.getElementById('detail');
  const reviews=document.getElementById('reviews');

  if(!detail)return;

  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)){
    detail.textContent='Invalid product reference.';
    return;
  }

  const headers={
    apikey:key,
    Accept:'application/json'
  };

  function imageUrl(image){
    if(!image||image.storage_bucket!=='listing-images'){
      return null;
    }

    const path=String(image.storage_path||'');

    if(
      !path||
      path.startsWith('/')||
      path.split('/').includes('..')
    ){
      return null;
    }

    return endpoint+
      '/storage/v1/object/public/'+
      encodeURIComponent(image.storage_bucket)+'/'+
      path.split('/').map(encodeURIComponent).join('/');
  }

  async function loadProductImages(productId){
    const params=new URLSearchParams({
      select:'storage_bucket,storage_path,image_position,is_primary',
      product_id:'eq.'+productId,
      order:'image_position.asc',
      limit:'6'
    });

    const response=await fetch(
      endpoint+'/rest/v1/listing_images?'+params.toString(),
      {headers}
    );

    if(!response.ok){
      throw Error('Product photographs could not be loaded.');
    }

    const rows=await response.json();

    if(!Array.isArray(rows)){
      throw Error('Invalid product photograph response.');
    }

    return rows
      .map(image=>({
        ...image,
        url:imageUrl(image)
      }))
      .filter(image=>image.url)
      .sort((a,b)=>
        Number(b.is_primary===true)-
        Number(a.is_primary===true)||
        Number(a.image_position)-
        Number(b.image_position)
      )
      .slice(0,6);
  }

  function buildGallery(images,productTitle){
    const gallery=document.createElement('section');
    gallery.setAttribute('aria-label','Product photographs');

    gallery.style.display='grid';
    gallery.style.gridTemplateColumns=
      'repeat(auto-fit,minmax(125px,1fr))';
    gallery.style.gap='10px';
    gallery.style.marginBottom='20px';

    if(!images.length){
      const empty=document.createElement('p');
      empty.className='muted';
      empty.textContent='Product photograph unavailable.';
      gallery.append(empty);
      return gallery;
    }

    images.forEach((image,index)=>{
      const link=document.createElement('a');
      link.href=image.url;
      link.target='_blank';
      link.rel='noopener noreferrer';
      link.title='View photograph '+(index+1);

      const img=document.createElement('img');
      img.src=image.url;
      img.alt=
        productTitle+' — photograph '+(index+1);
      img.loading=index===0?'eager':'lazy';
      img.decoding='async';

      img.style.width='100%';
      img.style.height=index===0?'240px':'150px';
      img.style.objectFit='contain';
      img.style.background='#f1f5f9';
      img.style.borderRadius='9px';
      img.style.display='block';

      img.onerror=()=>{
        link.textContent='Photograph unavailable';
        link.removeAttribute('href');
      };

      link.append(img);
      gallery.append(link);
    });

    return gallery;
  }

  function infoLine(label,value){
    const line=document.createElement('p');

    const strong=document.createElement('strong');
    strong.textContent=label+': ';

    line.append(
      strong,
      document.createTextNode(String(value||'Not specified'))
    );

    return line;
  }

  async function load(){
    try{
      const params=new URLSearchParams({
        select:'id,title,description,category,subcategory,condition,location,price,currency,quantity,listing_reference,listing_status',
        id:'eq.'+id,
        listing_status:'eq.active',
        quantity:'gt.0',
        country_code:'eq.ZA',
        limit:'1'
      });

      const url=endpoint+
        '/rest/v1/products?'+params.toString();

      const r=await fetch(url,{headers});

      if(!r.ok){
        throw Error('Product details are currently unavailable.');
      }

      const rows=await r.json();
      const p=Array.isArray(rows)?rows[0]:null;

      if(!p){
        detail.textContent='This product is unavailable.';
        return;
      }

      const title=document.createElement('h1');
      title.textContent=p.title||'Product';

      const ref=document.createElement('p');
      ref.className='muted';
      ref.textContent=
        'Listing reference: '+
        (p.listing_reference||'Pending');

      const gallery=buildGallery(
        await loadProductImages(p.id).catch(error=>{
          console.warn('ShopDrop product photographs:',error);
          return [];
        }),
        p.title||'Product'
      );

      const productInfo=document.createElement('section');

      productInfo.append(
        infoLine('Category',p.category),
        infoLine('Subcategory',p.subcategory),
        infoLine('Condition',p.condition),
        infoLine('Location',p.location)
      );

      const descriptionHeading=document.createElement('h2');
      descriptionHeading.textContent='Product Description';

      const description=document.createElement('p');
      description.textContent=
        p.description||'No additional description provided.';

      const price=document.createElement('h2');
      const amount=Number(p.price);
      const cur=String(p.currency||'');

      price.textContent=
        Number.isFinite(amount)&&
        /^[A-Z]{3}$/.test(cur)
          ?new Intl.NumberFormat(undefined,{
            style:'currency',
            currency:cur
          }).format(amount)
          :'Price unavailable';

      const stock=document.createElement('p');
      stock.textContent=
        'Available quantity: '+Number(p.quantity||0);

      const notice=document.createElement('p');
      notice.className='muted';
      notice.textContent=
        'Shop from one seller per shopping bag. '+
        'Stock is reserved during secure checkout, '+
        'not while browsing. '+
        'Seller contact details remain private.';

      const cartControls=document.createElement('div');

      const qtyLabel=document.createElement('label');
      qtyLabel.textContent='Quantity ';

      const qtyInput=document.createElement('input');
      qtyInput.type='number';
      qtyInput.min='1';
      qtyInput.max=String(p.quantity);
      qtyInput.value='1';
      qtyInput.style.maxWidth='90px';

      const cartButton=document.createElement('button');
      cartButton.type='button';
      cartButton.textContent='Add to shopping bag';

      const cartStatus=document.createElement('p');
      cartStatus.className='muted';
      cartStatus.setAttribute('role','status');

      qtyLabel.append(qtyInput);

      cartControls.append(
        qtyLabel,
        cartButton,
        cartStatus
      );

      cartButton.addEventListener('click',async()=>{
        cartButton.disabled=true;

        try{
          const qty=Number(qtyInput.value);

          if(
            !Number.isSafeInteger(qty)||
            qty<1||
            qty>Number(p.quantity)
          ){
            throw Error(
              'Select an available whole-number quantity.'
            );
          }

          const {createClient}=await import(
            'https://esm.sh/@supabase/supabase-js@2'
          );

          const sb=createClient(endpoint,key,{
            auth:{
              persistSession:true,
              autoRefreshToken:true,
              detectSessionInUrl:true
            }
          });

          const {
            data:{user},
            error:authError
          }=await sb.auth.getUser();

          if(authError||!user){
            throw Error(
              'Please sign in before adding items.'
            );
          }

          const {
            data:existing,
            error:lookupError
          }=await sb.from('cart_items')
            .select('id,quantity')
            .eq('user_id',user.id)
            .eq('product_id',p.id)
            .limit(1);

          if(lookupError)throw lookupError;

          const prior=existing?.[0];
          const total=
            qty+Number(prior?.quantity||0);

          if(total>Number(p.quantity)){
            throw Error(
              'Requested quantity exceeds currently listed stock.'
            );
          }

          const result=prior
            ?await sb.from('cart_items')
              .update({quantity:total})
              .eq('id',prior.id)
              .eq('user_id',user.id)
            :await sb.from('cart_items')
              .insert({
                user_id:user.id,
                product_id:p.id,
                quantity:qty
              });

          if(result.error)throw result.error;

          cartStatus.replaceChildren(
            document.createTextNode(
              'Added to shopping bag. '
            )
          );

          const checkoutLink=document.createElement('a');
          checkoutLink.href='./checkout.html';
          checkoutLink.textContent=
            'Go to shopping bag / checkout';

          cartStatus.append(checkoutLink);

        }catch(e){
          cartStatus.textContent=
            String(e?.message||'').includes('one_seller_per_bag')
              ? 'Your bag contains items from another seller. Complete that purchase or remove those items first.'
              : (e?.message||'Unable to update shopping bag.');
        }finally{
          cartButton.disabled=false;
        }
      });

      detail.replaceChildren(
        title,
        ref,
        gallery,
        productInfo,
        descriptionHeading,
        description,
        price,
        stock,
        notice,
        cartControls
      );

      if(reviews){
        reviews.textContent=
          'Verified customer reviews will appear when connected.';
      }

    }catch(e){
      detail.textContent=
        e?.message||'Product details unavailable.';
    }
  }

  load();
})();
