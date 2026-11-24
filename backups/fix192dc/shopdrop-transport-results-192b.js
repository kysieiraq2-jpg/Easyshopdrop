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
      const signed = data.signedURL || data.signedUrl;
        if (typeof signed !== 'string' || !signed) throw Error('Missing photograph URL');
        const url = new URL(signed.startsWith('/object/') ? '/storage/v1' + signed : signed, BASE);
        if (!url.pathname.startsWith('/storage/v1/object/sign/')) throw Error('Invalid photograph URL');
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
      if (advert.hire_arrangement) details.append(node('p','Arrangement: '+advert.hire_arrangement.replaceAll('_',' ')));
      if (advert.coverage_mode) details.append(node('p','Coverage: '+advert.coverage_mode.replaceAll('_',' ')));
      if (rates.length) {
        const label = node('label','Select advertised rate');
        const select = node('select');
        select.append(new Option('Choose a rate',''));
        for (const rate of rates) select.append(new Option(money(rate.price_zar)+' / '+rate.pricing_unit.replaceAll('_',' '),rate.id));
        label.append(select);
        const quantityLabel = node('label','Number of units');
        const quantity = node('input');
        quantity.type = 'number'; quantity.min = '1'; quantity.step = '1'; quantity.value = '1';
        quantityLabel.append(quantity);
        const summary = node('p','Choose a rate to preview the price.','muted');
        function update(reset) {
          const rate = rates.find(r => r.id === select.value);
          if (!rate) { summary.textContent = 'Choose a rate to preview the price.'; return; }
          const minimum = Math.max(1,Math.ceil(Number(rate.minimum_units)));
          quantity.min = String(minimum);
          if (reset) quantity.value = String(minimum);
          const n = Number(quantity.value);
          if (!Number.isSafeInteger(n) || n < minimum || n > 100000) { summary.textContent = 'Enter a valid quantity of at least '+minimum+'.'; return; }
          const amount = Math.round(Number(rate.price_zar)*n*100)/100;
          summary.textContent = 'Provider price: '+money(amount)+' (before Shop&Drop fee). Booking and availability not yet confirmed.';
          if (rate.available_from_time && rate.available_until_time) summary.textContent += ' Advertised hours: '+rate.available_from_time.slice(0,5)+'–'+rate.available_until_time.slice(0,5)+'.';
          if (rate.package_description) summary.textContent += ' '+rate.package_description;
        }
        select.addEventListener('change',()=>update(true));
        quantity.addEventListener('input',()=>update(false));
        const dateLabel = node('label','Requested booking date and time (South Africa)');
        const appointment = node('input');
        appointment.type = 'datetime-local';
        appointment.required = true;
        appointment.min = new Date(Date.now()+7200000).toISOString().slice(0,16);
        dateLabel.append(appointment);
        const check = node('p','Choose a rate, quantity and future appointment.','muted');
        function checkAppointment() {
          const rate = rates.find(r => r.id === select.value);
          const n = Number(quantity.value);
          const value = appointment.value;
          const time = Date.parse(value+'+02:00');
          if (!rate || !Number.isSafeInteger(n) || n < Math.max(1,Math.ceil(Number(rate.minimum_units))) || n > 100000 || !value || !Number.isFinite(time) || time <= Date.now()) {
            check.textContent = 'Choose a valid rate, quantity and future appointment.'; return;
          }
          const day = new Date(value+'Z').getUTCDay();
          const clock = value.slice(11,16);
          if (Array.isArray(rate.availability_days) && rate.availability_days.length && !rate.availability_days.map(Number).includes(day)) {
            check.textContent = 'The selected day is outside the advertised operating days.'; return;
          }
          if (rate.available_from_time && rate.available_until_time) {
            const from = rate.available_from_time.slice(0,5), until = rate.available_until_time.slice(0,5);
            const within = from < until ? clock >= from && clock < until : from > until && (clock >= from || clock < until);
            if (!within) { check.textContent = 'Choose a time within the advertised operating hours.'; return; }
          }
          check.textContent = 'Requested appointment: '+value.replace('T',' ')+' SAST. This is a preliminary selection only; provider confirmation and server availability checks are still required.';
        }
        select.addEventListener('change',checkAppointment);
        quantity.addEventListener('input',checkAppointment);
        appointment.addEventListener('input',checkAppointment);
        details.append(label,quantityLabel,summary,dateLabel,check);
        const verify = node('button','Check availability');
        verify.type = 'button';
        const serverStatus = node('p','','muted');
        let revision = 0;
        for (const control of [select,quantity,appointment]) {
          control.addEventListener('input',()=>{revision++;serverStatus.textContent='';});
          control.addEventListener('change',()=>{revision++;serverStatus.textContent='';});
        }
        verify.addEventListener('click',async()=>{
          const n = Number(quantity.value);
          const start = Date.parse(appointment.value+'+02:00');
          if (!select.value || !Number.isInteger(n) || n<1 || n>365 || !Number.isFinite(start) || start<=Date.now()) {
            serverStatus.textContent='Choose a rate, future appointment and 1–365 units.'; return;
          }
          const token = ++revision;
          verify.disabled = true;
          serverStatus.textContent='Checking availability…';
          try {
            const response = await fetch(BASE+'/rest/v1/rpc/shopdrop_transport_availability_192db',{
              method:'POST',headers,body:JSON.stringify({p_advert_id:advert.id,p_rate_id:select.value,p_quantity:n,p_start:new Date(start).toISOString()})
            });
            if (!response.ok) throw Error('Availability check failed');
            const data = await response.json();
            if (token!==revision) return;
            serverStatus.textContent = data.ok===true ? 'Available at time of check. Provider amount: '+money(data.provider_amount_zar)+'. Not reserved; provider confirmation required.' : 'Unavailable: '+(data.reason||'Please choose another appointment.');
          } catch (_) {
            if(token===revision) serverStatus.textContent='Unable to check availability. Please retry.';
          } finally {verify.disabled=false;}
        });
        details.append(verify,serverStatus);

      }
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
