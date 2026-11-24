/*
 Shop&Drop Fix174D
 Dispatching vehicle and equipment selection.

 New additive file.
 Does not modify Other Services.
 Does not activate payments or bookings.
*/
(() => {
  'use strict';

  const CATEGORIES = {
    'Cars and light vehicles': [
      'Hatchback',
      'Sedan',
      'SUV',
      '4x4 vehicle',
      'Single-cab bakkie',
      'Double-cab bakkie',
      'Panel van',
      'Minibus',
      'Motorcycle',
      'Other light vehicle'
    ],
    'Delivery and commercial vehicles': [
      'Courier vehicle',
      'Delivery van',
      'Refrigerated van',
      'Dropside truck',
      'Box-body truck',
      'Curtain-side truck',
      'Flatbed truck',
      'Tail-lift truck',
      'Furniture removal truck',
      'Livestock truck',
      'Other commercial vehicle'
    ],
    'Heavy trucks and long-distance transport': [
      'Rigid truck',
      'Horse and trailer',
      'Superlink',
      'Interlink',
      'Container truck',
      'Side-tipper',
      'End-tipper',
      'Tanker',
      'Refrigerated truck',
      'Logging truck',
      'Bulk carrier',
      'Other heavy transport'
    ],
    'Trailers and abnormal loads': [
      'Utility trailer',
      'Flatbed trailer',
      'Enclosed trailer',
      'Car transporter',
      'Lowbed trailer',
      'Step-deck trailer',
      'Extendable trailer',
      'Multi-axle heavy-haul trailer',
      'Abnormal-load transport',
      'Recovery trailer',
      'Other trailer'
    ],
    'Cranes and lifting equipment': [
      'Mobile crane',
      'Truck-mounted crane',
      'HIAB crane',
      'All-terrain crane',
      'Rough-terrain crane',
      'Crawler crane',
      'Tower crane',
      'Spider crane',
      'Forklift',
      'Telehandler',
      'Boom lift',
      'Scissor lift',
      'Other lifting equipment'
    ],
    'Earthmoving and construction equipment': [
      'Bulldozer',
      'Excavator',
      'Mini excavator',
      'TLB / backhoe loader',
      'Front-end loader',
      'Skid-steer loader',
      'Grader',
      'Road roller',
      'Compactor',
      'Articulated dump truck',
      'Rigid dump truck',
      'Trencher',
      'Rock breaker',
      'Crusher',
      'Concrete mixer',
      'Concrete pump',
      'Other construction equipment'
    ],
    'Agricultural equipment': [
      'Tractor',
      'Combine harvester',
      'Baler',
      'Planter',
      'Seeder',
      'Plough',
      'Cultivator',
      'Sprayer',
      'Fertiliser spreader',
      'Irrigation equipment',
      'Agricultural trailer',
      'Other agricultural equipment'
    ],
    'Mining and industrial equipment': [
      'Mining haul truck',
      'Underground loader',
      'Drilling rig',
      'Compressor',
      'Industrial generator',
      'Mobile lighting tower',
      'Conveyor equipment',
      'Industrial forklift',
      'Other mining or industrial equipment'
    ],
    'Municipal and specialist vehicles': [
      'Water tanker',
      'Fuel bowser',
      'Vacuum tanker',
      'Sewer cleaning truck',
      'Road sweeper',
      'Refuse truck',
      'Fire vehicle',
      'Recovery truck',
      'Tow truck',
      'Mobile workshop',
      'Other specialist vehicle'
    ],
    'Other transport or equipment': [
      'Other — describe below'
    ]
  };

  const ARRANGEMENTS = [
    ['transport', 'Transport service'],
    ['hire_with_operator', 'Hire with driver or operator'],
    ['hire_without_operator', 'Hire without driver or operator'],
    ['hire_optional_operator', 'Hire — operator optional'],
    ['specialist_service', 'Specialist service or quotation']
  ];

  function element(tag, text) {
    const node = document.createElement(tag);
    if (text !== undefined) {
      node.textContent = text;
    }
    return node;
  }

  function field(title, input) {
    const label = element('label', title);
    label.append(input);
    return label;
  }

  function selectOptions(select, values, placeholder) {
    select.replaceChildren();

    const empty = element('option', placeholder);
    empty.value = '';
    select.append(empty);

    for (const item of values) {
      const option = element(
        'option',
        Array.isArray(item) ? item[1] : item
      );

      option.value = Array.isArray(item)
        ? item[0]
        : item;

      select.append(option);
    }
  }

  function makeInput(type, placeholder) {
    const input = element('input');
    input.type = type;
    input.placeholder = placeholder;
    return input;
  }

  function initialize() {
    const original = document.getElementById('type');

    if (!original) return;

    if (document.getElementById(
      'shopdropEquipmentFields174'
    )) return;

    const wrapper = element('div');
    wrapper.id = 'shopdropEquipmentFields174';

    const heading = element(
      'h3',
      'Choose your vehicle or equipment'
    );

    const explanation = element(
      'p',
      'Choose the category and type. ' +
      'Only enter specifications that apply.'
    );

    const category = element('select');
    category.id = 'dispatchCategory174';
    category.required = true;

    selectOptions(
      category,
      Object.keys(CATEGORIES),
      'Choose a category'
    );

    const subtype = element('select');
    subtype.id = 'dispatchSubtype174';
    subtype.required = true;

    selectOptions(
      subtype,
      [],
      'Choose a category first'
    );

    const arrangement = element('select');
    arrangement.id = 'dispatchArrangement174';
    arrangement.required = true;

    selectOptions(
      arrangement,
      ARRANGEMENTS,
      'Choose how the service is offered'
    );

    const specificationBox = element('details');
    const summary = element(
      'summary',
      'Equipment details and capacity'
    );

    specificationBox.append(summary);

    const payload = makeInput(
      'number',
      'Example: 8'
    );

    payload.id = 'dispatchPayload174';
    payload.min = '0';
    payload.step = 'any';

    const lifting = makeInput(
      'number',
      'Example: 25'
    );

    lifting.id = 'dispatchLifting174';
    lifting.min = '0';
    lifting.step = 'any';

    const operatingWeight = makeInput(
      'number',
      'Example: 20'
    );

    operatingWeight.id = 'dispatchWeight174';
    operatingWeight.min = '0';
    operatingWeight.step = 'any';

    const quantity = makeInput(
      'number',
      'Number of identical vehicles or machines'
    );

    quantity.id = 'dispatchQuantity174';
    quantity.min = '1';
    quantity.max = '10000';
    quantity.step = '1';
    quantity.value = '1';

    const notes = element('textarea');
    notes.id = 'dispatchSpecsNotes174';
    notes.rows = 3;
    notes.maxLength = 1000;
    notes.placeholder =
      'Model, size, attachments, special features';

    specificationBox.append(
      field('Payload capacity (tonnes)', payload),
      field('Lifting capacity (tonnes)', lifting),
      field('Operating weight (tonnes)', operatingWeight),
      field('Number available', quantity),
      field('Additional equipment details', notes)
    );

    const other = makeInput(
      'text',
      'Describe the other vehicle or equipment'
    );

    other.id = 'dispatchOther174';
    other.maxLength = 160;
    other.hidden = true;

    const otherLabel = field(
      'Other vehicle or equipment',
      other
    );

    otherLabel.hidden = true;

    category.addEventListener('change', () => {
      selectOptions(
        subtype,
        CATEGORIES[category.value] || [],
        'Choose the specific type'
      );

      other.value = '';
      otherLabel.hidden = true;
      original.value = '';
    });

    subtype.addEventListener('change', () => {
      const isOther =
        subtype.value.toLowerCase().startsWith('other');

      otherLabel.hidden = !isOther;
      other.hidden = !isOther;
      other.required = isOther;

      if (!isOther) other.value = '';

      /*
       Preserve the original vehicle_type field
       for existing browsing and legacy consumers.
      */
      const legacyValue = subtype.value;

      let option = Array.from(original.options)
        .find(item => item.value === legacyValue);

      if (!option && legacyValue) {
        option = element('option', legacyValue);
        option.value = legacyValue;
        original.append(option);
      }

      original.value = legacyValue;
    });

    wrapper.append(
      heading,
      explanation,
      field('Main category', category),
      field('Vehicle or equipment type', subtype),
      otherLabel,
      field('Service arrangement', arrangement),
      specificationBox
    );

    /*
     The original field remains available to
     existing form validation and saving.
    */
    const originalLabel = original.closest('label');

    if (!originalLabel) return;

    originalLabel.parentNode.insertBefore(
      wrapper,
      originalLabel
    );

    originalLabel.style.display = 'none';

    window.ShopDropDispatchEquipment174 =
      Object.freeze({
        collect() {
          if (
            !category.value ||
            !subtype.value ||
            !arrangement.value
          ) {
            throw Error(
              'Choose category, type and service arrangement.'
            );
          }

          if (other.required && !other.value.trim()) {
            throw Error(
              'Describe your specialist equipment.'
            );
          }

          const numberOrNull = input => {
            if (!input.value.trim()) return null;

            const number = Number(input.value);

            if (
              !Number.isFinite(number) ||
              number < 0
            ) {
              throw Error(
                'Enter a valid equipment capacity.'
              );
            }

            return number;
          };

          const count = Number(quantity.value);

          if (
            !Number.isSafeInteger(count) ||
            count < 1 ||
            count > 10000
          ) {
            throw Error(
              'Enter a valid number of available units.'
            );
          }

          return {
            dispatch_category: category.value,
            dispatch_subtype: subtype.value,
            hire_arrangement: arrangement.value,
            equipment_specifications: {
              payload_tonnes: numberOrNull(payload),
              lifting_capacity_tonnes:
                numberOrNull(lifting),
              operating_weight_tonnes:
                numberOrNull(operatingWeight),
              available_units: count,
              other_type: other.value.trim() || null,
              notes: notes.value.trim() || null
            }
          };
        }
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initialize,
      {once: true}
    );
  } else {
    initialize();
  }
})();
