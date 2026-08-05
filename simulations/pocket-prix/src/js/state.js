// DOM handles and mutable application state.
'use strict';

const $ = (id) => document.getElementById(id);
const canvas = $('raceCanvas');
const ctx = canvas.getContext('2d');
const traceCanvas = $('traceCanvas');
const tctx = traceCanvas.getContext('2d');
const staticCanvas = document.createElement('canvas');
staticCanvas.width = WORLD_W;
staticCanvas.height = WORLD_H;
const sctx = staticCanvas.getContext('2d');

const sim = {
  running: false,
  finished: false,
  speedMultiplier: 1,
  accumulator: 0,
  lastRealTime: performance.now(),
  raceTime: 0,
  countdown: 3.2,
  trackKey: 'garden',
  track: null,
  cars: [],
  laps: 5,
  fieldSize: 16,
  seed: 7319,
  rng: mulberry32(7319),
  selectedId: null,
  hoveredId: null,
  showTrails: true,
  showLine: false,
  showNames: false,
  trace: [],
  traceTimer: 0,
  uiTimer: 0,
  finishOrder: [],
  scenery: [],
  birds: [],
  slicks: [],
  skidMarks: [],
  particles: [],
  rings: [],
  debris: [],
  tow: null,
  drama: 'hazards',
  nextIncidentAt: Infinity,
  cameraShake: 0,
  impactCount: 0,
  mouse: { x: 0, y: 0, inside: false },
  audio: {
    ctx: null,
    master: null,
    compressor: null,
    voices: new Map(),
    tireGain: null,
    tireSource: null,
    enabled: false,
    volume: .45,
    status: 'Sound off'
  }
};
