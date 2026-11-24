(() => {
  'use strict';
  const BASE = 'https://dtkdvvxpwonywtsgqmdx.supabase.co';
  const KEY = 'sb_publishable_yHOcyzuuSWDzshhcAF9N8Q_7JiGFq2q';
  const headers = {apikey: KEY, 'Content-Type': 'application/json'};
  const params = new URLSearchParams(location.search);
  const results = document.getElementById('transportResults');
  const status = document.getElementById('resultsStatus');
  const next = document.getElementById('nextPage');
  let offset = 0;
  const limit = 40;
  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function money(value) {
    return new Intl.NumberFormat('en-ZA', {style:'currency',currency:'ZAR'}).format(Number(value));
  }
  async function rpc(body) {
    const response = await fetch(BASE + '/rest/v1/rpc/shopdrop_search_transport_192a', {
      method:'POST', headers, body:JSON.stringify(body)
    });
    if (!response.ok) throw Error('Search unavailable');
    const data = await response.json();
    if (!Array.isArray(data)) throw Error('Invalid results');
    return data;
  }
  async function loadPhoto(photo, img) {
    try {
      if (photo.bucket !== 'shopdrop-vehicle-ad-gallery') throw Error('Invalid gallery');
      const path = String(photo.path || '').split('/').map(encodeURIComponent).join('/');
      const response = await fetch(BASE + '/storage/v1/object/sign/' + photo.bucket + '/' + path, {
        method:'POST', headers, body:JSON.stringify({expiresIn:3600})
      });
      if (!response.ok) throw Error('Photo unavailable');
      const data = await response.json();
      const url = new URL(BASE + '/storage/v1' + data.signedURL);
      if (url.origin !== BASE) throw Error('Invalid URL');
      img.src = url.href;
      img.hidden = false;
    } catch (_) {
      img.replaceWith(node('p','Photograph temporarily unavailable.','muted'));
    }
  }
  function photoElement(photo) {
    const img = node('img');
    img.alt = 'Transport advertisement photograph';
    img.loading = 'lazy';
    img.hidden = true;
    loadPhoto(photo,img);
    return img;
  }
  function render(advert) {
    const card = node('article');
    const photos = Array.isArray(advert.photos) ? advert.photos : [];
    const rates = Array.isArray(advert.rates) ? advert.rates : [];
    if (photos.length) card.append(photoElement(photos[0]));
    card.append(node('h2',advert.vehicle_title || 'Transport advertisement'));
    card.append(node('p',[advert.dispatch_category,advert.dispatch_subtype].filter(Boolean).join(' — ')));
    card.append(node('p',[advert.base_town,advert.base_province].filter(Boolean).join(', '),'muted'));
    if (rates.length) card.append(node('p','From '+money(rates[0].price_zar)+' / '+rates[0].pricing_unit.replaceAll('_',' ')));
    const details = node('details');
    details.append(node('summary','View Details & Photographs'));
    details.append(node('p',advert.vehicle_description || ''));
    const gallery = node('div',null,'gallery');
    for (const photo of photos) gallery.append(photoElement(photo));
    details.append(gallery);
    for (const rate of rates) details.append(node('p',money(rate.price_zar)+' / '+rate.pricing_unit.replaceAll('_',' ')+' — Minimum: '+rate.minimum_units));
    details.append(node('p','Advertisement reference: '+advert.id,'muted'));
    card.append(details);
    results.append(card);
  }
  async function load() {
    next.hidden = true;
    next.disabled = true;
    status.textContent = 'Searching advertisements...';
    try {
      const body = {p_limit:limit,p_offset:offset};
      for (const key of ['category','subtype','arrangement','province','town']) {
        if (params.get(key)) body['p_'+key] = params.get(key);
      }
      const adverts = await rpc(body);
      if (!adverts.length && offset === 0) {
        results.replaceChildren(node('div','No transport services or equipment hire advertisements are currently available for your selection. Please try another search or check again later.','empty'));
        status.textContent = '0 advertisements found.';
        return;
      }
      for (const advert of adverts) render(advert);
      offset += adverts.length;
      status.textContent = offset+' advertisement(s) displayed.';
      next.textContent = 'Load More Advertisements';
      next.hidden = adverts.length < limit;
    } catch (_) {
      status.textContent = 'Unable to load advertisements. Please try again.';
      next.hidden = false;
      next.textContent = 'Retry Search';
    } finally {
      next.disabled = false;
    }
  }
  next.addEventListener('click',load);
  load();
})();
