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

  
window.ShopDropTransportTaxonomy = Object.freeze({CATEGORIES, ARRANGEMENTS});
})();
