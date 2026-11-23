(() => {
  'use strict';

  const provinceNames = [
    'Eastern Cape',
    'Free State',
    'Gauteng',
    'KwaZulu-Natal',
    'Limpopo',
    'Mpumalanga',
    'North West',
    'Northern Cape',
    'Western Cape'
  ];

  const fields = [
    ['pickupRegion', 'pickup', 'pickupCountry'],
    ['dropoffRegion', 'dropoff', 'dropoffCountry']
  ];

  const fill = (element, values, prompt) => {
    element.replaceChildren(new Option(prompt, ''));
    for (const value of values) {
      element.add(new Option(value, value));
    }
  };

  const createSelect = input => {
    const select = document.createElement('select');

    for (const attr of input.attributes) {
      if (!['type', 'value', 'placeholder'].includes(attr.name)) {
        select.setAttribute(attr.name, attr.value);
      }
    }

    select.id = input.id;
    select.style.width = '100%';
    select.style.minHeight = '46px';

    input.replaceWith(select);
    return select;
  };

  function install(data) {
    for (const [regionId, townId, countryId] of fields) {
      const country = document.getElementById(countryId);
      let region = document.getElementById(regionId);
      let town = document.getElementById(townId);

      if (!country || !region || !town) continue;

      const originalRegion = region.cloneNode(true);
      const originalTown = town.cloneNode(true);

      let originalRegionValue = region.value;
      let originalTownValue = town.value;

      const southAfrica = () => {
        const value = String(country.value).trim().toLowerCase();
        return value === 'za' || value === 'south africa';
      };

      const updateTowns = selected => {
        const available = data.provinces[region.value] || [];

        fill(
          town,
          available,
          region.value
            ? 'Choose town or area'
            : 'Choose province first'
        );

        town.disabled = !region.value;

        if (available.includes(selected)) {
          town.value = selected;
        }
      };

      function setup() {
        region = document.getElementById(regionId);
        town = document.getElementById(townId);

        if (!region || !town) return;

        if (!southAfrica()) {
          const regionValue = region.value;
          const townValue = town.value;

          if (region.tagName === 'SELECT') {
            const input = originalRegion.cloneNode(true);
            input.value = regionValue;
            region.replaceWith(input);
            region = input;
          }

          if (town.tagName === 'SELECT') {
            const input = originalTown.cloneNode(true);
            input.value = townValue;
            town.replaceWith(input);
            town = input;
          }

          return;
        }

        const previousRegion = region.value || originalRegionValue;
        const previousTown = town.value || originalTownValue;

        if (region.tagName !== 'SELECT') {
          region = createSelect(region);
        }

        if (town.tagName !== 'SELECT') {
          town = createSelect(town);
        }

        fill(region, provinceNames, 'Choose province');

        if (provinceNames.includes(previousRegion)) {
          region.value = previousRegion;
        }

        region.onchange = () => {
          originalRegionValue = region.value;
          originalTownValue = '';
          updateTowns('');
        };

        town.onchange = () => {
          originalTownValue = town.value;
        };

        updateTowns(previousTown);
      }

      country.addEventListener('change', setup);
      setup();
    }
  }

  function start() {
    fetch('./shopdrop-sa-towns-181.json', {
      cache: 'no-store'
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Town dataset unavailable');
        }
        return response.json();
      })
      .then(data => {
        if (data.country !== 'ZA' || !data.provinces) {
          throw new Error('Invalid South African town data');
        }
        install(data);
      })
      .catch(error => {
        console.error('Fix 182C:', error);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded', start, {once: true}
    );
  } else {
    start();
  }
})();
