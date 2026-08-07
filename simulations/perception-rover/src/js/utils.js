// Small math and array helpers shared across the lab.
'use strict';

const wrap = x => ((x % W) + W) % W;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

function angleDiff(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

function argmax(values) {
  let best = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[best]) best = i;
  }
  return best;
}

function shuffle(values) {
  for (let i = values.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [values[i], values[j]] = [values[j], values[i]];
  }
}
