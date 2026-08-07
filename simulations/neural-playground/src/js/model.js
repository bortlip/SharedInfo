// Tiny from-scratch learning models: a classic perceptron and a one-hidden-layer neural network.
'use strict';

function createModel(type = sim.modelType, hiddenUnits = sim.hiddenUnits, seed = sim.seed + 101) {
  const rng = mulberry32(seed);
  if (type === 'perceptron') {
    return {
      type,
      w: [randn(rng) * 0.55, randn(rng) * 0.55],
      b: randn(rng) * 0.18
    };
  }

  const scale = 0.85;
  return {
    type: 'network',
    hiddenUnits,
    w1: Array.from({ length: hiddenUnits }, () => [randn(rng) * scale, randn(rng) * scale]),
    b1: Array.from({ length: hiddenUnits }, () => randn(rng) * 0.12),
    w2: Array.from({ length: hiddenUnits }, () => randn(rng) * scale),
    b2: randn(rng) * 0.12
  };
}

function predictDetailed(model, x, y) {
  if (model.type === 'perceptron') {
    const score = model.w[0] * x + model.w[1] * y + model.b;
    const output = sigmoid(score * 2.2);
    return { inputs: [x, y], score, hidden: [], output };
  }

  const hidden = [];
  const hiddenRaw = [];
  for (let i = 0; i < model.hiddenUnits; i++) {
    const z = model.w1[i][0] * x + model.w1[i][1] * y + model.b1[i];
    hiddenRaw.push(z);
    hidden.push(tanh(z));
  }
  let outRaw = model.b2;
  for (let i = 0; i < model.hiddenUnits; i++) outRaw += model.w2[i] * hidden[i];
  const output = sigmoid(outRaw);
  return { inputs: [x, y], hiddenRaw, hidden, outRaw, output };
}

function trainSample(model, point, learningRate) {
  const before = predictDetailed(model, point.x, point.y);
  const target = point.label;

  if (model.type === 'perceptron') {
    const predicted = before.score >= 0 ? 1 : 0;
    const error = target - predicted;
    if (error !== 0) {
      model.w[0] += learningRate * error * point.x;
      model.w[1] += learningRate * error * point.y;
      model.b += learningRate * error;
    }
  } else {
    const outputError = before.output - target;
    const oldW2 = [...model.w2];
    for (let i = 0; i < model.hiddenUnits; i++) {
      model.w2[i] -= learningRate * outputError * before.hidden[i];
    }
    model.b2 -= learningRate * outputError;

    for (let i = 0; i < model.hiddenUnits; i++) {
      const dz = outputError * oldW2[i] * (1 - before.hidden[i] * before.hidden[i]);
      model.w1[i][0] -= learningRate * dz * point.x;
      model.w1[i][1] -= learningRate * dz * point.y;
      model.b1[i] -= learningRate * dz;
    }
  }

  return { before, after: predictDetailed(model, point.x, point.y), target };
}

function evaluateModel(model, points) {
  if (!points.length) return { accuracy: 0, loss: 0 };
  let correct = 0;
  let loss = 0;
  for (const point of points) {
    const p = clamp(predictDetailed(model, point.x, point.y).output, 1e-6, 1 - 1e-6);
    const predicted = p >= 0.5 ? CLASS_B : CLASS_A;
    if (predicted === point.label) correct++;
    loss += -(point.label * Math.log(p) + (1 - point.label) * Math.log(1 - p));
  }
  return { accuracy: correct / points.length, loss: loss / points.length };
}
