(() => {
  'use strict';

  const provinces = [
    'Eastern Cape', 'Free State', 'Gauteng',
    'KwaZulu-Natal', 'Limpopo', 'Mpumalanga',
    'North West', 'Northern Cape', 'Western Cape'
  ];

  const pairs = [
    ['pickupRegion', 'pickup', 'pickupCountry'],
    ['dropoffRegion', 'dropoff', 'dropoffCountry']
  ];

  function fill(select, values, prompt) {
    select.replaceChildren(new Option(prompt, ''));
    values.forEach(value => {
      select.add(new Option(value, value));
    });
  }

  function start(data) {
    pairs.forEach(([regionId, townId, countryId]) => {
      const country = document.getElementById(countryId);
      if (!country) return;

      let region = document.getElementById(regionId);
      let town = document.getElementById(townId);

      if (!region || !town) return;

      const originalRegion = region.cloneNode(true);
      const originalTown = town.cloneNode(true);

      function isSA() {
        const value = String(country.value).toLowerCase();
        return value === 'za' || value === 'south africa';
      }

      function makeSelect(old) {
        const next = document.createElement('select');

        for (const attr of old.attributes) {
          if (!['type', 'value', 'placeholder'].includes(attr.name)) {
            next.setAttribute(attr.name, attr.value);
          }
        }

        next.id = old.id;
        next.style.width = '100%';
        next.style.minHeight = '46px';

        old.replaceWith(next);
        return next;
      }

      function updateTowns(selected = '') {
        const available = data.provinces[region.value] || [];

        fill(
          town,
          available,
          region.value ? 'Choose town or area' : 'Choose province first'
        );

        town.disabled = !available.length;

        if (available.includes(selected)) {
          town.value = selected;
        }
      }

      function setup() {
        region = document.getElementById(regionId);
        town = document.getElementById(townId);

        if (!region || !town) return;

        if (!isSA()) {
          if (town.tagName === 'SELECT') {
            town.replaceWith(originalTown.cloneNode(true));
          }
          return;
        }

        const previousRegion = region.value;
        const previousTown = town.value;

        if (region.tagName !== 'SELECT') {
          region = makeSelect(region);
        }

        if (town.tagName !== 'SELECT') {
          town = makeSelect(town);
        }

        fill(region, provinces, 'Choose province');

        if (provinces.includes(previousRegion)) {
          region.value = previousRegion;
        }

        region.addEventListener('change', () => updateTowns());
        updateTowns(previousTown);
      }

      country.addEventListener('change', setup);
      setup();
    });
  }

  window.addEventListener('load', () => {
    fetch('./shopdrop-sa-towns-181.json', {
      cache: 'no-store'
    })
      .then(response => {
        if (!response.ok) throw Error('Town data unavailable');
        return response.json();
      })
      .then(data => {
        if (data.country !== 'ZA' || !data.provinces) {
          throw Error('Invalid South African town data');
        }
        start(data);
      })
      .catch(error => {
        console.warn('Transport dropdowns unavailable:', error);
      });
  });
})();
