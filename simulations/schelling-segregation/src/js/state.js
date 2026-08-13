// DOM handles and mutable application state.
'use strict';

const $ = id => document.getElementById(id);
const canvas = $('worldCanvas');
const ctx = canvas.getContext('2d');
const compareCanvas = $('compareCanvas');
const compareCtx = compareCanvas.getContext('2d');
const historyCanvas = $('historyCanvas');
const historyCtx = historyCanvas.getContext('2d');

const sim = {
  config: deepClone(DEFAULT_CONFIG),
  running: false,
  speed: 1,
  worldA: null,
  worldB: null,
  initialSnapshot: null,
  initialSnapshotB: null,
  initialSignatureB: null,
  selectedIndex: null,
  selectedWorld: 'A',
  pendingSettings: false,
  initialSignature: null,
  hoveredIndex: null,
  history: [],
  lastFrame: performance.now(),
  accumulator: 0,
  uiTimer: 0,
  status: 'Ready',
  preset: 'classic'
};
