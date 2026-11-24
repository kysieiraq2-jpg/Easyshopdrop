(() => {
  'use strict';

  const provinces = [
    'Eastern Cape','Free State','Gauteng',
    'KwaZulu-Natal','Limpopo','Mpumalanga',
    'North West','Northern Cape','Western Cape'
  ];

  let installed = false;

  const fill = (el, values, prompt) => {
    el.replaceChildren(new Option(prompt, ''));
    values.forEach(v => el.add(new Option(v, v)));
  };

  function start(data) {
    if (installed) return;

    let region = document.getElementById('serviceRegion');
    let city = document.getElementById('serviceCity');
    const country = document.getElementById('serviceCountry');

    if (!region || !city || !country) return;

    const code = String(country.value).toLowerCase();
    if (code !== 'za' && code !== 'south africa') return;

    installed = true;

    function convert(old) {
      if (old.tagName === 'SELECT') return old;

      const next = document.createElement('select');
      for (const attr of old.attributes) {
        if (!['type','value','placeholder'].includes(attr.name)) {
          next.setAttribute(attr.name, attr.value);
        }
      }
      next.id = old.id;
      next.style.width = '100%';
      next.style.minHeight = '46px';
      old.replaceWith(next);
      return next;
    }

    const oldRegion = region.value;
    const oldCity = city.value;

    region = convert(region);
    city = convert(city);

    const update = (selected = '') => {
      const names = data.provinces[region.value] || [];
      fill(city, names,
        region.value ? 'Choose town' : 'Choose province first');
      city.disabled = !region.value;
      if (names.includes(selected)) city.value = selected;
    };

    fill(region, provinces, 'Choose province');
    if (provinces.includes(oldRegion)) region.value = oldRegion;
    region.addEventListener('change', () => update());
    update(oldCity);

    // Additional coverage uses the original sarea field.
    // Keep its existing multi-location storage untouched.
    const area = document.getElementById('sarea');
    if (!area) return;

    const wrap = document.createElement('div');
    wrap.id = 'shopdropCoverage182B';

    const heading = document.createElement('p');
    heading.textContent = 'Add a service coverage province and town';

    const province = document.createElement('select');
    const town = document.createElement('select');
    const add = document.createElement('button');
    add.type = 'button';
    add.textContent = 'Add coverage area';

    province.style.cssText =
      town.style.cssText =
      'display:block;width:100%;min-height:46px;margin:8px 0';

    fill(province, provinces, 'Choose coverage province');
    fill(town, [], 'Choose province first');

    province.addEventListener('change', () => {
      fill(town, data.provinces[province.value] || [],
        'Choose coverage town');
    });

    add.addEventListener('click', () => {
      if (!province.value || !town.value) return;
      const current = area.value.split(',')
        .map(s => s.trim()).filter(Boolean);
      if (!current.includes(town.value)) {
        current.push(town.value);
      }
      area.value = current.join(', ');
      area.dispatchEvent(new Event('input', {bubbles:true}));
    });

    wrap.append(heading, province, town, add);
    area.closest('label')?.after(wrap);
  }

  function boot() {
    fetch('./shopdrop-sa-towns-181.json?v=182b',
      {cache:'no-store'})
      .then(r => {
        if (!r.ok) throw Error('Town data unavailable');
        return r.json();
      })
      .then(data => {
        if (data.country !== 'ZA' || !data.provinces)
          throw Error('Invalid town data');

        start(data);

        if (!installed) {
          const observer = new MutationObserver(() => {
            start(data);
            if (installed) observer.disconnect();
          });
          observer.observe(document.body,
            {childList:true,subtree:true});
        }
      })
      .catch(error => {
        console.error('Other Services locations:', error);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  } else {
    boot();
  }
})();
