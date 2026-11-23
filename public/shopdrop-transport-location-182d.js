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

  function makeSelect(old) {
    const next = document.createElement('select');

    for (const attr of old.attributes) {
      if (!['type', 'placeholder', 'value']
          .includes(attr.name)) {
        next.setAttribute(attr.name, attr.value);
      }
    }

    next.id = old.id;
    next.style.width = '100%';
    next.style.minHeight = '46px';

    old.replaceWith(next);
    return next;
  }

  function start() {
    const controls = [];

    for (const [regionId, townId, countryId] of pairs) {
      const country = document.getElementById(countryId);
      let region = document.getElementById(regionId);
      let town = document.getElementById(townId);

      if (!country || !region || !town) continue;

      const originalRegion = region.cloneNode(true);
      const originalTown = town.cloneNode(true);

      let townData = null;

      const isSA = () => {
        const value = String(country.value).toLowerCase();
        return value === 'za' ||
          value === 'south africa';
      };

      const updateTowns = (selected = '') => {
        const available =
          townData?.[region.value] || [];

        fill(
          town,
          available,
          region.value
            ? (townData
                ? 'Choose town or area'
                : 'Loading towns...')
            : 'Choose province first'
        );

        town.disabled = !townData || !region.value;

        if (available.includes(selected)) {
          town.value = selected;
        }
      };

      function setup() {
        region = document.getElementById(regionId);
        town = document.getElementById(townId);

        if (!region || !town) return;

        const previousRegion = region.value;
        const previousTown = town.value;

        if (!isSA()) {
          if (region.tagName === 'SELECT') {
            const input = originalRegion.cloneNode(true);
            input.value = previousRegion;
            region.replaceWith(input);
            region = input;
          }

          if (town.tagName === 'SELECT') {
            const input = originalTown.cloneNode(true);
            input.value = previousTown;
            town.replaceWith(input);
            town = input;
          }
          return;
        }

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

        region.onchange = () => updateTowns();
        updateTowns(previousTown);
      }

      controls.push({
        setData(data) {
          townData = data;
          const selected = town.value;
          updateTowns(selected);
        }
      });

      country.addEventListener('change', setup);
      setup();
    }

    fetch('./shopdrop-sa-towns-181.json?v=182d', {
      cache: 'no-store'
    })
      .then(response => {
        if (!response.ok) {
          throw Error('Town data unavailable');
        }
        return response.json();
      })
      .then(data => {
        if (data.country !== 'ZA' || !data.provinces) {
          throw Error('Invalid South African town data');
        }
        controls.forEach(control => {
          control.setData(data.provinces);
        });
      })
      .catch(error => {
        console.error('Transport towns:', error);
        document.querySelectorAll(
          '#pickup, #dropoff'
        ).forEach(field => {
          if (field.tagName !== 'SELECT') return;
          const input = document.createElement('input');
          input.id = field.id;
          input.placeholder = 'Enter town manually';
          input.style.cssText = field.style.cssText;
          field.replaceWith(input);
        });
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded', start, {once:true}
    );
  } else {
    start();
  }
})();
