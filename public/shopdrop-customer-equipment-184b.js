(() => {
  'use strict';

  const CATEGORIES = {"Cars and light vehicles": ["Hatchback", "Sedan", "SUV", "4x4 vehicle", "Single-cab bakkie", "Double-cab bakkie", "Panel van", "Minibus", "Motorcycle", "Other light vehicle"], "Delivery and commercial vehicles": ["Courier vehicle", "Delivery van", "Refrigerated van", "Dropside truck", "Box-body truck", "Curtain-side truck", "Flatbed truck", "Tail-lift truck", "Furniture removal truck", "Livestock truck", "Other commercial vehicle"], "Heavy trucks and long-distance transport": ["Rigid truck", "Horse and trailer", "Superlink", "Interlink", "Container truck", "Side-tipper", "End-tipper", "Tanker", "Refrigerated truck", "Logging truck", "Bulk carrier", "Other heavy transport"], "Trailers and abnormal loads": ["Utility trailer", "Flatbed trailer", "Enclosed trailer", "Car transporter", "Lowbed trailer", "Step-deck trailer", "Extendable trailer", "Multi-axle heavy-haul trailer", "Abnormal-load transport", "Recovery trailer", "Other trailer"], "Cranes and lifting equipment": ["Mobile crane", "Truck-mounted crane", "HIAB crane", "All-terrain crane", "Rough-terrain crane", "Crawler crane", "Tower crane", "Spider crane", "Forklift", "Telehandler", "Boom lift", "Scissor lift", "Other lifting equipment"], "Earthmoving and construction equipment": ["Bulldozer", "Excavator", "Mini excavator", "TLB / backhoe loader", "Front-end loader", "Skid-steer loader", "Grader", "Road roller", "Compactor", "Articulated dump truck", "Rigid dump truck", "Trencher", "Rock breaker", "Crusher", "Concrete mixer", "Concrete pump", "Other construction equipment"], "Agricultural equipment": ["Tractor", "Combine harvester", "Baler", "Planter", "Seeder", "Plough", "Cultivator", "Sprayer", "Fertiliser spreader", "Irrigation equipment", "Agricultural trailer", "Other agricultural equipment"], "Mining and industrial equipment": ["Mining haul truck", "Underground loader", "Drilling rig", "Compressor", "Industrial generator", "Mobile lighting tower", "Conveyor equipment", "Industrial forklift", "Other mining or industrial equipment"], "Municipal and specialist vehicles": ["Water tanker", "Fuel bowser", "Vacuum tanker", "Sewer cleaning truck", "Road sweeper", "Refuse truck", "Fire vehicle", "Recovery truck", "Tow truck", "Mobile workshop", "Other specialist vehicle"], "Other transport or equipment": ["Other — describe below"]};

  function start() {
    const original =
      document.getElementById('vehicle');

    if (!original) return;

    if (document.getElementById(
      'shopdropCustomerCategory184B'
    )) return;

    const category =
      document.createElement('select');

    category.id =
      'shopdropCustomerCategory184B';

    category.setAttribute(
      'aria-label',
      'Choose vehicle or equipment category'
    );

    const subtype =
      document.createElement('select');

    subtype.id =
      'shopdropCustomerSubtype184B';

    subtype.setAttribute(
      'aria-label',
      'Choose specific vehicle or equipment'
    );

    const categoryLabel =
      document.createElement('label');

    categoryLabel.textContent =
      'Vehicle or equipment category';

    const subtypeLabel =
      document.createElement('label');

    subtypeLabel.textContent =
      'Specific vehicle or equipment';

    const fill = (select, values, prompt) => {
      select.replaceChildren(
        new Option(prompt, '')
      );

      values.forEach(value => {
        select.add(new Option(value, value));
      });
    };

    fill(
      category,
      Object.keys(CATEGORIES),
      'Choose category'
    );

    fill(
      subtype,
      [],
      'Choose category first'
    );

    subtype.disabled = true;

    function syncOriginal() {
      const value = subtype.value;

      if (
        value &&
        !Array.from(original.options)
          .some(option => option.value === value)
      ) {
        original.add(new Option(value, value));
      }

      original.value = value;

      original.dispatchEvent(
        new Event('change', {bubbles:true})
      );
    }

    category.addEventListener(
      'change',
      () => {
        const values =
          CATEGORIES[category.value] || [];

        fill(
          subtype,
          values,
          'Choose specific type'
        );

        subtype.disabled = !values.length;
        syncOriginal();
      }
    );

    subtype.addEventListener(
      'change',
      syncOriginal
    );

    const oldValue = original.value;

    categoryLabel.append(category);
    subtypeLabel.append(subtype);

    original.before(
      categoryLabel,
      subtypeLabel
    );

    original.style.display = 'none';

    if (oldValue) {
      for (const [name, values]
        of Object.entries(CATEGORIES)) {
        if (values.includes(oldValue)) {
          category.value = name;
          category.dispatchEvent(
            new Event('change')
          );
          subtype.value = oldValue;
          syncOriginal();
          break;
        }
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      start,
      {once:true}
    );
  } else {
    start();
  }
})();
