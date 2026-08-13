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

const B_OVERRIDE_DEFS = [
  { key:'satisfaction.threshold', group:'Satisfaction', label:'Satisfaction threshold', type:'number', min:-1, max:200, step:.01, defaultEnabled:true, defaultValue:.40, help:'Override only World B’s satisfaction threshold. The valid interpretation follows B’s satisfaction rule.' },
  { key:'satisfaction.rule', group:'Satisfaction', label:'Satisfaction rule', type:'select', defaultValue:'minSimilarFraction', options:[['minSimilarFraction','Minimum same-group fraction'],['maxDifferentFraction','Maximum different-group fraction'],['minSameCount','Minimum same-group count'],['majority','Same-group majority'],['weightedUtility','Weighted utility']], help:'Use a different rule to decide whether World B agents are satisfied.' },
  { key:'satisfaction.isolated', group:'Satisfaction', label:'No occupied neighbors', type:'select', defaultValue:'satisfied', options:[['satisfied','Satisfied'],['unsatisfied','Unsatisfied']], help:'Override how isolated World B agents are treated.' },
  { key:'satisfaction.heterogeneous', group:'Satisfaction', label:'Heterogeneous thresholds', type:'boolean', defaultValue:false, help:'Give World B agents stable individual threshold differences.' },
  { key:'satisfaction.variation', group:'Satisfaction', label:'Threshold variation', type:'number', min:0, max:.5, step:.01, defaultValue:.10, help:'Maximum per-agent threshold variation in World B when heterogeneous thresholds are enabled.' },
  { key:'neighborhood.type', group:'Neighborhood', label:'Neighborhood shape', type:'select', defaultValue:'moore', options:[['moore','Moore / surrounding'],['vonNeumann','Von Neumann / orthogonal']], help:'Use a different neighborhood geometry in World B.' },
  { key:'neighborhood.radius', group:'Neighborhood', label:'Neighborhood radius', type:'number', min:1, max:6, step:1, defaultValue:1, help:'How far World B agents look when evaluating nearby cells.' },
  { key:'neighborhood.wrap', group:'Neighborhood', label:'Wrap edges', type:'boolean', defaultValue:false, help:'Make World B wrap across opposite grid edges.' },
  { key:'neighborhood.ignoreVacancies', group:'Neighborhood', label:'Ignore vacancies in ratios', type:'boolean', defaultValue:true, help:'Choose whether World B excludes vacancies from neighborhood ratio denominators.' },
  { key:'movement.mode', group:'Movement', label:'Relocation mode', type:'select', defaultValue:'vacancy', options:[['vacancy','Vacancies only'],['swap','Swap only'],['either','Vacancy or swap']], help:'Override whether World B moves into vacancies, swaps, or can do either.' },
  { key:'movement.selection', group:'Movement', label:'Agent selection', type:'select', defaultValue:'randomSequential', options:[['randomSequential','Random sequential'],['fixedOrder','Fixed order'],['allPerRound','All unhappy per round'],['snapshotRound','Snapshot-simultaneous round']], help:'Override how World B chooses agents for movement.' },
  { key:'movement.destination', group:'Movement', label:'Destination choice', type:'select', defaultValue:'randomSatisfying', options:[['randomVacancy','Random candidate'],['randomSatisfying','Random satisfying'],['best','Best available'],['nearestSatisfying','Nearest satisfying'],['leastBad','Least bad']], help:'Override how World B chooses a destination.' },
  { key:'movement.fallback', group:'Movement', label:'If none satisfy', type:'select', defaultValue:'stay', options:[['stay','Stay put'],['best','Move to best'],['random','Move randomly']], help:'What World B does when no candidate satisfies the rule.' },
  { key:'movement.search', group:'Movement', label:'Search scope', type:'select', defaultValue:'global', options:[['global','Whole world'],['local','Within radius']], help:'Search all of World B or only nearby destinations.' },
  { key:'movement.searchRadius', group:'Movement', label:'Move radius', type:'number', min:1, max:30, step:1, defaultValue:8, help:'Maximum relocation distance for World B local search.' },
  { key:'movement.allowSatisfied', group:'Movement', label:'Satisfied agents may move', type:'boolean', defaultValue:false, help:'Allow satisfied World B agents to relocate when the destination is non-worsening.' },
  { key:'simulation.mode', group:'Simulation & stopping', label:'Time model', type:'select', defaultValue:'continuous', options:[['continuous','Continuous attempts'],['round','Round sweeps']], help:'Override the World B simulation time model.' },
  { key:'simulation.movesPerTick', group:'Simulation & stopping', label:'Attempts / tick', type:'number', min:1, max:500, step:1, defaultValue:20, help:'Maximum move attempts per World B continuous tick.' },
  { key:'simulation.maxIterations', group:'Simulation & stopping', label:'Max iterations', type:'number', min:1, max:100000, step:1, defaultValue:5000, help:'World B iteration cap.' },
  { key:'simulation.quietRounds', group:'Simulation & stopping', label:'Quiet rounds', type:'number', min:1, max:100, step:1, defaultValue:5, help:'World B no-move iterations required by the quiet-stop rule.' },
  { key:'simulation.stopSatisfied', group:'Simulation & stopping', label:'Stop when all satisfied', type:'boolean', defaultValue:true, help:'Let World B stop when every occupied agent is satisfied.' },
  { key:'simulation.stopNoLegal', group:'Simulation & stopping', label:'Stop when no legal move', type:'boolean', defaultValue:true, help:'Let World B stop when no eligible agent has a legal move.' },
  { key:'simulation.stopQuiet', group:'Simulation & stopping', label:'Stop after quiet rounds', type:'boolean', defaultValue:true, help:'Let World B stop after its configured quiet-round count.' },
  { key:'simulation.stopMax', group:'Simulation & stopping', label:'Stop at iteration cap', type:'boolean', defaultValue:true, help:'Let World B stop at its maximum iteration count.' },
  { key:'population.groups', group:'Initial world', label:'Groups', type:'number', min:2, max:20, step:1, defaultValue:2, structural:true, help:'Give World B a different number of groups. This requires a different initial world.' },
  { key:'population.groupWeights', group:'Initial world', label:'Relative group shares', type:'weights', defaultValue:'1, 1', structural:true, help:'Comma-separated relative group weights for World B. They are normalized automatically and adapted to B’s group count.' },
  { key:'population.vacancyRate', group:'Initial world', label:'Vacancy rate', type:'number', min:0, max:.9, step:.01, defaultValue:.12, structural:true, help:'Give World B a different vacancy rate. This breaks the matched starting grid.' },
  { key:'population.cols', group:'Initial world', label:'Columns', type:'number', min:12, max:140, step:1, defaultValue:60, structural:true, help:'Give World B a different grid width. This creates a different initial world.' },
  { key:'population.rows', group:'Initial world', label:'Rows', type:'number', min:12, max:100, step:1, defaultValue:44, structural:true, help:'Give World B a different grid height. This creates a different initial world.' },
  { key:'population.distribution', group:'Initial world', label:'Initial pattern', type:'select', defaultValue:'random', structural:true, options:[['random','Random'],['clustered','Loose clusters'],['striped','Stripes']], help:'Give World B a different generated starting pattern. This creates a different initial world.' },
  { key:'population.seed', group:'Initial world', label:'Seed', type:'number', min:1, max:999999999, step:1, defaultValue:7319, structural:true, help:'Give World B an independent random seed. This creates a different initial world.' }
];

const DEFAULT_COMPARE_OVERRIDES = Object.fromEntries(B_OVERRIDE_DEFS.map(def => [def.key, { enabled:Boolean(def.defaultEnabled), value:def.defaultValue }]));

const DEFAULT_CONFIG = {
  population: { groups: 2, groupWeights: [1,1], vacancyRate: .12, cols: 60, rows: 44, distribution: 'random', seed: 7319 },
  neighborhood: { type: 'moore', radius: 1, wrap: false, ignoreVacancies: true },
  satisfaction: { rule: 'minSimilarFraction', threshold: .30, heterogeneous: false, variation: .10, isolated: 'satisfied' },
  movement: { mode: 'vacancy', selection: 'randomSequential', destination: 'randomSatisfying', fallback: 'stay', search: 'global', searchRadius: 8, allowSatisfied: false },
  simulation: { mode: 'continuous', movesPerTick: 20, maxIterations: 5000, quietRounds: 5, stopSatisfied: true, stopNoLegal: true, stopQuiet: true, stopMax: true },
  visual: { colorScheme: 'vivid', markerStyle: 'strongOutline', showVacancies: true, showUnhappy: true, showNeighborhood: true, animateMoves: true, showTrails: false, gridLines: false, clusterOutlines: false },
  compare: { enabled: false, overrides: DEFAULT_COMPARE_OVERRIDES }
};

const PRESETS = {
  classic: { label: 'Classic Schelling', patch: {} },
  threeGroups: { label: 'Three groups', patch: { population: { groups: 3, groupWeights: [1,1,1], vacancyRate: .12 }, satisfaction: { threshold: .30 } } },
  swap: { label: 'Full occupancy + swaps', patch: { population: { vacancyRate: 0 }, movement: { mode: 'swap', destination: 'randomSatisfying' } } },
  local: { label: 'Local search', patch: { movement: { search: 'local', searchRadius: 7, destination: 'nearestSatisfying' } } },
  bestChoice: { label: 'Best available destination', patch: { movement: { destination: 'best', fallback: 'best' } } },
  simultaneous: { label: 'Snapshot-simultaneous round', patch: { movement: { selection: 'snapshotRound' }, simulation: { mode: 'round', movesPerTick: 20 } } }
};
