// Small deterministic datasets designed to expose model capabilities and limitations.
'use strict';

const DATASET_INFO = {
  linear: {
    name: 'Easy split',
    blurb: 'Two clouds separated by a line. A single perceptron should solve this cleanly.'
  },
  noisy: {
    name: 'Noisy split',
    blurb: 'Mostly linearly separable, with a few awkward examples that keep the boundary honest.'
  },
  xor: {
    name: 'XOR',
    blurb: 'Opposite corners share a class. One straight decision boundary cannot solve this.'
  },
  circles: {
    name: 'Inner / outer',
    blurb: 'A nonlinear ring-shaped problem. Hidden units can bend several simple boundaries into one useful region.'
  }
};

function makePoint(x, y, label) {
  return { id: sim.nextPointId++, x: clamp(x, -1, 1), y: clamp(y, -1, 1), label };
}

function gaussianPoint(cx, cy, spread, label, rng) {
  return makePoint(cx + randn(rng) * spread, cy + randn(rng) * spread, label);
}

function generateDataset(key, seed = sim.seed) {
  const rng = mulberry32(seed);
  const points = [];
  sim.nextPointId = 1;

  if (key === 'linear' || key === 'noisy') {
    for (let i = 0; i < 30; i++) points.push(gaussianPoint(-0.47, -0.18, 0.19, CLASS_A, rng));
    for (let i = 0; i < 30; i++) points.push(gaussianPoint(0.45, 0.22, 0.19, CLASS_B, rng));
    if (key === 'noisy') {
      points.push(makePoint(-0.28, 0.34, CLASS_B));
      points.push(makePoint(0.24, -0.34, CLASS_A));
      points.push(makePoint(-0.08, 0.18, CLASS_B));
      points.push(makePoint(0.12, -0.12, CLASS_A));
    }
  } else if (key === 'xor') {
    const centers = [
      [-0.52, -0.52, CLASS_A], [0.52, 0.52, CLASS_A],
      [-0.52, 0.52, CLASS_B], [0.52, -0.52, CLASS_B]
    ];
    for (const [cx, cy, label] of centers) {
      for (let i = 0; i < 18; i++) points.push(gaussianPoint(cx, cy, 0.12, label, rng));
    }
  } else if (key === 'circles') {
    for (let i = 0; i < 36; i++) {
      const a = rng() * Math.PI * 2;
      const r = 0.18 + rng() * 0.22;
      points.push(makePoint(Math.cos(a) * r + randn(rng) * 0.035, Math.sin(a) * r + randn(rng) * 0.035, CLASS_A));
    }
    for (let i = 0; i < 48; i++) {
      const a = rng() * Math.PI * 2;
      const r = 0.62 + randn(rng) * 0.08;
      points.push(makePoint(Math.cos(a) * r, Math.sin(a) * r, CLASS_B));
    }
  }

  return points;
}
