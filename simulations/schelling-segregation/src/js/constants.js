// Defaults, palettes, and preset model configurations.
'use strict';

const EMPTY = -1;
const MAX_GROUPS = 20;
const MAX_GRID_CELLS = 14000;
const HISTORY_LIMIT = 320;
const MOVE_EVENT_LIFE = 26;

const COLOR_SCHEMES = {
  vivid: ['#d8ef16','#4652a3','#21ad91','#f05b73','#f5a623','#8d63d2','#00a6d6','#d94aa9','#6fbd45','#e07a3f','#2c7be5','#a6d854','#e85d04','#5e60ce','#00b4d8','#ff758f','#9c6644','#70e000','#bc6c25','#4cc9f0'],
  classic: ['#d9ef1b','#5c4aa8','#16a58d','#f06b68','#f2b441','#7b62c9','#24a9cf','#c94f9b','#75b84b','#db7d45','#3b77c7','#b5cc39','#d95c32','#6c63b5','#3bb8c7','#e87892','#9a6c50','#8ecb3d','#c68a36','#48a9d1'],
  jewel: ['#2a9d8f','#6d597a','#b56576','#e76f51','#457b9d','#8f5d9f','#d4a017','#3a7d44','#c44569','#4d6cfa','#7a5195','#ef8354','#2f6690','#5f8f29','#a23e48','#3d9970','#b07bac','#d17b0f','#4464ad','#b44c75'],
  ocean: ['#00a6a6','#0077b6','#48cae4','#023e8a','#2ec4b6','#5e60ce','#0096c7','#90e0ef','#4361ee','#00b4d8','#3a86ff','#5390d9','#56cfe1','#4ea8de','#5f0fbe','#168aad','#34a0a4','#76c893','#277da1','#64dfdf'],
  sunset: ['#ff6b6b','#f9844a','#f9c74f','#f15bb5','#9b5de5','#ff8fab','#fb8500','#ef476f','#f3722c','#ffb703','#c77dff','#e85d75','#ff9f1c','#f72585','#b5179e','#f8961e','#f94144','#ffd166','#ff70a6','#8338ec'],
  garden: ['#4f772d','#90a955','#2a9d8f','#6a994e','#386641','#bc6c25','#7f5539','#2d6a4f','#95d5b2','#588157','#a3b18a','#6b705c','#40916c','#9c6644','#84a98c','#52796f','#b7b7a4','#606c38','#dda15e','#74c69d'],
  nordic: ['#5e81ac','#88c0d0','#81a1c1','#b48ead','#a3be8c','#d08770','#8fbcbb','#bf616a','#ebcb8b','#4c566a','#6b8eaa','#7aa2b8','#9b8abf','#88a97c','#cf765f','#6fa9a4','#b85f68','#d2b96d','#627d98','#9aa6b2'],
  candy: ['#ff70a6','#70d6ff','#ffd670','#e9ff70','#ff9770','#b388eb','#80ffdb','#ff85a1','#a0c4ff','#fdffb6','#caffbf','#ffc6ff','#9bf6ff','#ffadad','#bdb2ff','#ffd6a5','#72efdd','#f4a261','#cdb4db','#90dbf4'],
  earth: ['#8d6e63','#6b8e23','#b07d62','#5f7a61','#c08a53','#7f5539','#a98467','#656d4a','#936639','#7b8f5a','#c2a878','#6f4e37','#a68a64','#556b2f','#b08968','#7d8471','#9c6644','#8a9a5b','#c6a15b','#705d56'],
  pastel: ['#dfe98e','#9fa9dc','#8ed6c6','#efafb7','#f2cd86','#b9a5df','#8dccdf','#dfa1cd','#b8d996','#e7b28e','#9ebfe8','#d7e6a2','#e8aa83','#a8a9df','#8ed4e0','#edb1bf','#c8aa98','#b7dea0','#d7b38d','#a5dce7'],
  colorblind: ['#f0e442','#0072b2','#009e73','#d55e00','#cc79a7','#56b4e9','#e69f00','#6a3d9a','#4daf4a','#984ea3','#ff7f00','#a65628','#377eb8','#e41a1c','#999999','#66c2a5','#fc8d62','#8da0cb','#e78ac3','#a6d854'],
  neon: ['#dfff00','#6c7bff','#00f5c4','#ff4d7d','#ffb000','#b56cff','#00d9ff','#ff4fd8','#79ff4d','#ff7b35','#2d8cff','#bfff27','#ff5d00','#775dff','#00e5ff','#ff6e8a','#d58b52','#77ff00','#ff9d2e','#4de9ff']
};

const DEFAULT_CONFIG = {
  population: { groups: 2, groupWeights: [1,1], vacancyRate: .12, cols: 60, rows: 44, distribution: 'random', seed: 7319 },
  neighborhood: { type: 'moore', radius: 1, wrap: false, ignoreVacancies: true },
  satisfaction: { rule: 'minSimilarFraction', threshold: .30, heterogeneous: false, variation: .10, isolated: 'satisfied' },
  movement: { mode: 'vacancy', selection: 'randomSequential', destination: 'randomSatisfying', fallback: 'stay', search: 'global', searchRadius: 8, allowSatisfied: false },
  simulation: { mode: 'continuous', movesPerTick: 20, maxIterations: 5000, quietRounds: 5, stopSatisfied: true, stopNoLegal: true, stopQuiet: true, stopMax: true },
  visual: { colorScheme: 'vivid', markerStyle: 'strongOutline', showVacancies: true, showUnhappy: true, showNeighborhood: true, animateMoves: true, showTrails: false, gridLines: false, clusterOutlines: false },
  compare: { enabled: false, threshold: .40 }
};

const PRESETS = {
  classic: { label: 'Classic Schelling', patch: {} },
  threeGroups: { label: 'Three groups', patch: { population: { groups: 3, groupWeights: [1,1,1], vacancyRate: .12 }, satisfaction: { threshold: .30 } } },
  swap: { label: 'Full occupancy + swaps', patch: { population: { vacancyRate: 0 }, movement: { mode: 'swap', destination: 'randomSatisfying' } } },
  local: { label: 'Local search', patch: { movement: { search: 'local', searchRadius: 7, destination: 'nearestSatisfying' } } },
  bestChoice: { label: 'Best available destination', patch: { movement: { destination: 'best', fallback: 'best' } } },
  simultaneous: { label: 'Snapshot-simultaneous round', patch: { movement: { selection: 'snapshotRound' }, simulation: { mode: 'round', movesPerTick: 20 } } }
};
