// Defaults, palettes, and preset model configurations.
'use strict';

const EMPTY = -1;
const MAX_GROUPS = 20;
const MAX_GRID_CELLS = 14000;
const HISTORY_LIMIT = 320;
const MOVE_EVENT_LIFE = 26;

const COLOR_SCHEMES = {
  vivid: ['#d8ef16','#4652a3','#21ad91','#f05b73','#f5a623','#8d63d2','#00a6d6','#d94aa9','#6fbd45','#e07a3f','#2c7be5','#a6d854','#e85d04','#5e60ce','#00b4d8','#ff758f','#9c6644','#70e000','#bc6c25','#4cc9f0'],
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
  visual: { colorScheme: 'vivid', showVacancies: true, showUnhappy: true, showNeighborhood: true, animateMoves: true, showTrails: false, gridLines: false, clusterOutlines: false },
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
