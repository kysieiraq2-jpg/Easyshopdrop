(() => {
  'use strict';

  const provinces = [
    'Eastern Cape', 'Free State', 'Gauteng',
    'KwaZulu-Natal', 'Limpopo', 'Mpumalanga',
    'North West', 'Northern Cape', 'Western Cape'
  ];

  const fields = [
    ['province', null],
    ['pickupRegion', 'pickupCountry'],
    ['dropoffRegion', 'dropoffCountry'],
    ['serviceRegion', 'serviceCountry']
  ];

  function init(id, countryId) {
    let field = document.getElementById(id);
    if (!field) return;

    const country = countryId
      ? document.getElementById(countryId)
      : null;

    function update() {
      const code = String(
        country?.value || 'ZA'
      ).trim().toLowerCase();

      const sa = code === 'za' ||
        code === 'south africa';

      if (sa === (field.tagName === 'SELECT')) {
        return;
      }

      const previous = field.value;

      const next = document.createElement(
        sa ? 'select' : 'input'
      );

      for (const attribute of field.attributes) {
        if (![
          'id', 'type', 'value', 'placeholder'
        ].includes(attribute.name)) {
          next.setAttribute(
            attribute.name,
            attribute.value
          );
        }
      }

      next.id = id;

      if (sa) {
        next.add(
          new Option('Choose province', '')
        );

        provinces.forEach(p =>
          next.add(new Option(p, p))
        );

        if (provinces.includes(previous)) {
          next.value = previous;
        }
      } else {
        next.type = 'text';
        next.maxLength = 120;
        next.placeholder =
          'Province / state / region';
        next.value = previous;
      }

      field.replaceWith(next);
      field = next;
    }

    update();

    country?.addEventListener(
      'change', update
    );
  }

  function start() {
    fields.forEach(
      ([id, country]) => init(id, country)
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      start,
      {once: true}
    );
  } else {
    start();
  }
})();
