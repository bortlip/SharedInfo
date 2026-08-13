// Math, deterministic random, cloning, configuration, and URL helpers.
'use strict';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const pct = value => `${Math.round(value * 100)}%`;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function shuffled(values, rng) {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function deepClone(value) { return JSON.parse(JSON.stringify(value)); }

function mergeDeep(target, patch) {
  for (const [key, value] of Object.entries(patch || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) target[key] = {};
      mergeDeep(target[key], value);
    } else target[key] = deepClone(value);
  }
  return target;
}

function normalizedWeights(weights, count) {
  const cleaned = Array.from({ length: count }, (_, i) => Math.max(0, Number(weights?.[i] ?? 1)));
  let total = cleaned.reduce((a, b) => a + b, 0);
  if (total <= 0) { cleaned.fill(1); total = count; }
  return cleaned.map(v => v / total);
}

function weightedGroup(rng, weights) {
  const r = rng(); let sum = 0;
  for (let i = 0; i < weights.length; i++) { sum += weights[i]; if (r <= sum) return i; }
  return weights.length - 1;
}

function groupColor(group, scheme = 'vivid') {
  const palette = COLOR_SCHEMES[scheme] || COLOR_SCHEMES.vivid;
  return palette[((group % palette.length) + palette.length) % palette.length];
}

function indexXY(index, cols) { return { x: index % cols, y: Math.floor(index / cols) }; }
function xyIndex(x, y, cols) { return y * cols + x; }
function cellDistance(a, b, cols) { const p = indexXY(a, cols), q = indexXY(b, cols); return Math.hypot(p.x - q.x, p.y - q.y); }

function encodeConfig(config) {
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(config)))); } catch { return ''; }
}
function decodeConfig(text) {
  try { return JSON.parse(decodeURIComponent(escape(atob(text)))); } catch { return null; }
}

function randomSeed() { return 1 + Math.floor(Math.random() * 999999998); }
