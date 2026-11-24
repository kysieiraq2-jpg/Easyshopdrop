(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const category = byId('category');
  const subtype = byId('subtype');
  const arrangement = byId('arrangement');
  const province = byId('province');
  const town = byId('town');
  const status = byId('searchStatus');
  const {CATEGORIES, ARRANGEMENTS} = window.ShopDropTransportTaxonomy;
  function fill(select, values, placeholder) {
    select.replaceChildren(new Option(placeholder, ''));
    for (const value of values) {
      const pair = Array.isArray(value) ? value : [value, value];
      select.add(new Option(pair[1], pair[0]));
    }
  }
  fill(category, Object.keys(CATEGORIES).sort(), 'All categories');
  fill(subtype, [], 'Choose a category first');
  fill(arrangement, ARRANGEMENTS, 'Any arrangement');
  fill(province, [], 'All provinces');
  fill(town, [], 'Choose a province first');
  category.addEventListener('change', () => {
    fill(subtype, (CATEGORIES[category.value] || []).slice().sort(), 'All equipment types');
    subtype.disabled = !category.value;
  });
  async function initializeLocations() {
    try {
      const response = await fetch('./shopdrop-sa-towns-181.json');
      if (!response.ok) throw Error('Location data unavailable');
      const data = await response.json();
      const provinces = data.provinces;
      if (!provinces || !Object.keys(provinces).length) throw Error('Location data unavailable');
      fill(province, Object.keys(provinces).sort(), 'All provinces');
      province.addEventListener('change', () => {
        fill(town, (provinces[province.value] || []).slice().sort(), 'All towns');
        town.disabled = !province.value;
      });
      byId('searchButton').disabled = false;
    } catch (_) {
      status.textContent = 'Location selections could not load. Please reload this page.';
    }
  }
  byId('transportSearch').addEventListener('submit', event => {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const id of ['category','subtype','arrangement','province','town']) {
      const value = byId(id).value;
      if (value) params.set(id, value);
    }
    location.href = './transport-results.html?' + params.toString();
  });
  initializeLocations();
})();
