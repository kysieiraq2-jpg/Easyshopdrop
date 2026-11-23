(() => {
  'use strict';

  const provinces = [
    'Eastern Cape','Free State','Gauteng',
    'KwaZulu-Natal','Limpopo','Mpumalanga',
    'North West','Northern Cape','Western Cape'
  ];

  const province = document.getElementById('province');
  const town = document.getElementById('town');

  if (!province || !town) return;

  const fill = (select, values, prompt) => {
    select.replaceChildren(new Option(prompt, ''));
    values.forEach(v => select.add(new Option(v, v)));
  };

  function replaceWithSelect(old) {
    if (old.tagName === 'SELECT') return old;

    const select = document.createElement('select');

    for (const attr of old.attributes) {
      if (!['type','value','placeholder'].includes(attr.name)) {
        select.setAttribute(attr.name, attr.value);
      }
    }

    select.id = old.id;
    select.style.width = '100%';
    select.style.minHeight = '46px';
    old.replaceWith(select);
    return select;
  }

  const previousProvince = province.value;
  const previousTown = town.value;

  const region = replaceWithSelect(province);
  const city = replaceWithSelect(town);

  fill(region, provinces, 'Choose province');
  fill(city, [], 'Choose province first');
  city.disabled = true;

  if (provinces.includes(previousProvince)) {
    region.value = previousProvince;
  }

  function updateTowns(selected = '') {
    const values = window.shopdrop184aTowns?.[region.value] || [];

    fill(
      city,
      values,
      region.value ? 'Choose town' : 'Choose province first'
    );

    city.disabled = !values.length;

    if (values.includes(selected)) city.value = selected;
  }

  region.addEventListener('change', () => updateTowns());

  fetch('./shopdrop-sa-towns-181.json?v=184a', {
    cache:'no-store'
  })
    .then(response => {
      if (!response.ok) throw Error('Town data unavailable');
      return response.json();
    })
    .then(data => {
      if (data.country !== 'ZA' || !data.provinces) {
        throw Error('Invalid town data');
      }

      window.shopdrop184aTowns = data.provinces;
      updateTowns(previousTown);
    })
    .catch(error => {
      console.error('Provider location:', error);
    });
})();
