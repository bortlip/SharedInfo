// DOM handles, offscreen camera buffer, and mutable simulation state.
'use strict';

const $ = id => document.getElementById(id);
const world = $('world');
const wg = world.getContext('2d');
const camera = $('camera');
const cg = camera.getContext('2d', { willReadFrequently: true });
const tiny = document.createElement('canvas');
tiny.width = CAMERA_W;
tiny.height = CAMERA_H;
const tg = tiny.getContext('2d', { willReadFrequently: true });

const sim = {
  x: 90,
  y: H / 2,
  heading: 0,
  speed: 105,
  manualSteer: 0,
  apSteer: 0,
  steerResponse: 1.05,
  recording: false,
  autopilot: false,
  lastCapture: 0,
  dataset: [],
  model: null,
  training: false,
  generating: false,
  trainAcc: null,
  valAcc: null,
  probs: [0, 0, 0],
  lastTime: performance.now(),
  laps: 0
};
