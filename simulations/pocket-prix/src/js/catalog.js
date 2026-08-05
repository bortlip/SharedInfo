// Track definitions, driver personalities, names, and car colors.
'use strict';

const TRACKS = {
  garden: {
    name: 'Apex Garden',
    points: [
      [238, 190], [485, 114], [790, 126], [1050, 238], [1112, 420], [955, 580],
      [694, 610], [510, 535], [352, 610], [160, 520], [140, 345]
    ]
  },
  switchback: {
    name: 'Switchback Hollow',
    points: [
      [170, 198], [430, 112], [720, 128], [1038, 174], [1110, 324], [892, 375],
      [1050, 550], [770, 612], [565, 508], [358, 610], [146, 490], [330, 382], [132, 310]
    ]
  },
  ribbon: {
    name: 'Ribbon Run',
    points: [
      [224, 156], [540, 104], [872, 130], [1108, 278], [1030, 505], [774, 592],
      [620, 442], [472, 592], [184, 544], [122, 352], [326, 298]
    ]
  }
};

const STYLES = [
  {
    key: 'smooth', name: 'Silk Line', color: '#72ddf7',
    description: 'Early, tidy braking and patient passes. Consistency beats heroics.',
    maxSpeed: 222, accel: 78, brake: 166, grip: 218, risk: .95,
    steerGain: 1.00, steerResponse: 8.0, lookAhead: 9, aggression: .32, passGap: 39, lineBias: 0
  },
  {
    key: 'late', name: 'Last Ditch', color: '#ff6b6b',
    description: 'Brakes late, attacks gaps, occasionally discovers geography.',
    maxSpeed: 234, accel: 84, brake: 181, grip: 207, risk: 1.07,
    steerGain: 1.08, steerResponse: 9.8, lookAhead: -5, aggression: .92, passGap: 27, lineBias: -1
  },
  {
    key: 'momentum', name: 'Flow State', color: '#ffd166',
    description: 'Protects speed with wide, flowing arcs and gentle inputs.',
    maxSpeed: 228, accel: 75, brake: 153, grip: 220, risk: 1.01,
    steerGain: .94, steerResponse: 7.1, lookAhead: 18, aggression: .50, passGap: 34, lineBias: 1
  },
  {
    key: 'opportunist', name: 'Gap Goblin', color: '#c77dff',
    description: 'Constantly searches for clean air and changes line without shame.',
    maxSpeed: 232, accel: 81, brake: 174, grip: 210, risk: 1.04,
    steerGain: 1.12, steerResponse: 10.4, lookAhead: 1, aggression: .79, passGap: 29, lineBias: 0
  }
];

const NAMES = [
  'Mina Vale', 'Theo Rush', 'Juno Park', 'Cass Bell', 'Rafi Knox', 'Nora Flint', 'Milo Vega', 'Iris Hart',
  'Beck Rowan', 'Aya Moss', 'Finn Pike', 'Lena Cross', 'Omar Lane', 'Zoe March', 'Kai Ember', 'Esme Ward',
  'Nico Reed', 'Tess Quinn', 'Leo Banks', 'Maya Frost', 'Remy Shaw', 'Arlo Wynn', 'Gia Stone', 'Sam Voss'
];
const CAR_COLORS = [
  '#ff5d73', '#55c2ff', '#ffd166', '#9cff57', '#c77dff', '#ff9f43', '#5eead4', '#f472b6',
  '#a3e635', '#60a5fa', '#f87171', '#fbbf24', '#34d399', '#818cf8', '#fb7185', '#2dd4bf',
  '#e879f9', '#38bdf8', '#facc15', '#4ade80', '#f97316', '#a78bfa', '#22d3ee', '#ef4444'
];
