// DOM handles and mutable application state.
'use strict';

const $ = (id) => document.getElementById(id);
const fieldCanvas = $('fieldCanvas');
const fieldCtx = fieldCanvas.getContext('2d');
const networkCanvas = $('networkCanvas');
const networkCtx = networkCanvas.getContext('2d');
const historyCanvas = $('historyCanvas');
const historyCtx = historyCanvas.getContext('2d');

const sim = {
  running: false,
  speedIndex: 1,
  trainAccumulator: 0,
  lastRealTime: performance.now(),
  flowPhase: 0,
  epoch: 0,
  sampleIndex: 0,
  modelType: 'perceptron',
  hiddenUnits: 4,
  learningRate: 0.12,
  preset: 'linear',
  seed: 7319,
  points: [],
  nextPointId: 1,
  model: null,
  history: [],
  metrics: { accuracy: 0, loss: 0 },
  activePointId: null,
  selectedPointId: null,
  hoveredPointId: null,
  tool: 'inspect',
  currentSignal: null,
  status: 'Ready to learn'
};
