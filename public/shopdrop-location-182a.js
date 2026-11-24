(() => {
  'use strict';

  const provinces = [
    'Eastern Cape', 'Free State', 'Gauteng',
    'KwaZulu-Natal', 'Limpopo', 'Mpumalanga',
    'North West', 'Northern Cape', 'Western Cape'
  ];

  const seller = location.pathname
    .endsWith('/sell-item.html');

  const townId = seller ? 'town' : 'city';
  const provinceId = seller ? null : 'region';

  const originalTown = document.getElementById(townId);
  const originalProvince = provinceId
    ? document.getElementById(provinceId)
    : null;

  if (!originalTown) return;
  if (!seller && !originalProvince) return;

  const makeSelect = (id) => {
    const select = document.createElement('select');
    select.id = id;
    select.style.cssText =
      'display:block;width:100%;min-height:46px;' +
      'padding:11px;margin:8px 0 15px;' +
      'border:1px solid #cbd5e1;border-radius:9px;' +
      'background:#fff;box-sizing:border-box';
    return select;
  };

  const province = makeSelect('locationProvince182A');
  const town = makeSelect('locationTown182A');

  const fill = (element, values, prompt) => {
    element.replaceChildren(new Option(prompt, ''));
    values.forEach(value => {
      element.add(new Option(value, value));
    });
  };

  const provinceLabel = document.createElement('label');
  provinceLabel.htmlFor = province.id;
  provinceLabel.textContent = 'Province';

  const townLabel = document.createElement('label');
  townLabel.htmlFor = town.id;
  townLabel.textContent = 'Town or city';

  const originalTownValue = originalTown.value;
  const originalProvinceValue =
    originalProvince ? originalProvince.value : '';

  fetch('./shopdrop-sa-towns-181.json')
    .then(response => {
      if (!response.ok) throw Error('Town list unavailable');
      return response.json();
    })
    .then(data => {
      if (data.country !== 'ZA' || !data.provinces)
        throw Error('Invalid town list');

      const towns = data.provinces;

      fill(province, provinces, 'Choose province');
      fill(town, [], 'Choose province first');
      town.disabled = true;

      const sync = () => {
        if (seller) {
          originalTown.value = town.value
            ? town.value + ', ' + province.value
            : '';
        } else {
          originalTown.value = town.value;
          originalProvince.value = province.value;
        }
      };

      const updateTowns = (selected = '') => {
        const available = towns[province.value] || [];
        fill(town, available, 'Choose town or city');
        town.disabled = !available.length;

        if (available.includes(selected))
          town.value = selected;

        sync();
      };

      province.addEventListener('change', () => {
        updateTowns();
      });

      town.addEventListener('change', sync);

      let savedProvince = originalProvinceValue;
      let savedTown = originalTownValue;

      if (seller) {
        const found = provinces.find(p =>
          originalTownValue.endsWith(', ' + p)
        );

        if (found) {
          savedProvince = found;
          savedTown = originalTownValue.slice(
            0, -(found.length + 2)
          );
        }
      }

      if (provinces.includes(savedProvince)) {
        province.value = savedProvince;
        updateTowns(savedTown);
      }

      const parent = originalTown.parentNode;
      if (!parent) return;

      if (seller) {
        originalTown.before(
          provinceLabel, province,
          townLabel, town
        );
      } else {
        // Checkout only: reuse the original visible labels and keep
        // the existing address fields for the save-address bridge.
        const existingProvinceLabel = parent.querySelector('label[for="region"]');
        const existingTownLabel = parent.querySelector('label[for="city"]');
        if (existingProvinceLabel) {
          existingProvinceLabel.htmlFor = province.id;
          originalProvince.before(province);
        } else {
          originalProvince.before(provinceLabel, province);
        }
        if (existingTownLabel) {
          existingTownLabel.htmlFor = town.id;
          originalTown.before(town);
        } else {
          originalTown.before(townLabel, town);
        }
        province.required = true;
        town.required = true;
      }

      originalTown.type = 'hidden';
      if (originalProvince)
        originalProvince.type = 'hidden';

      const form = originalTown.closest('form');
      if (form) {
        form.addEventListener('submit', sync, true);
      }
    })
    .catch(error => {
      console.warn(
        'ShopDrop location dropdowns unavailable:',
        error.message
      );
    });
})();
