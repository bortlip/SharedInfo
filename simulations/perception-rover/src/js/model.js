// Tiny fully-connected neural network implemented directly in JavaScript.
'use strict';

function initModel() {
  const randomWeight = () => Math.random() * 2 - 1;
  return {
    w1: Array.from({ length: HIDDEN }, () => Float32Array.from({ length: INPUTS }, () => randomWeight() * Math.sqrt(2 / INPUTS))),
    b1: new Float32Array(HIDDEN),
    w2: Array.from({ length: OUTPUTS }, () => Float32Array.from({ length: HIDDEN }, () => randomWeight() * Math.sqrt(2 / HIDDEN))),
    b2: new Float32Array(OUTPUTS)
  };
}

function forwardDetailed(model, input) {
  const hidden = new Float32Array(HIDDEN);
  for (let j = 0; j < HIDDEN; j++) {
    let z = model.b1[j];
    const weights = model.w1[j];
    for (let i = 0; i < INPUTS; i++) z += weights[i] * input[i];
    hidden[j] = Math.max(0, z);
  }

  const logits = new Float32Array(OUTPUTS);
  let maxLogit = -Infinity;
  for (let k = 0; k < OUTPUTS; k++) {
    let z = model.b2[k];
    const weights = model.w2[k];
    for (let j = 0; j < HIDDEN; j++) z += weights[j] * hidden[j];
    logits[k] = z;
    if (z > maxLogit) maxLogit = z;
  }

  let sum = 0;
  const probabilities = new Float32Array(OUTPUTS);
  for (let k = 0; k < OUTPUTS; k++) {
    probabilities[k] = Math.exp(logits[k] - maxLogit);
    sum += probabilities[k];
  }
  for (let k = 0; k < OUTPUTS; k++) probabilities[k] /= sum;
  return { hidden, probabilities };
}

function forward(model, input) {
  return forwardDetailed(model, input).probabilities;
}

function trainStep(model, sample, learningRate) {
  const { hidden, probabilities } = forwardDetailed(model, sample.x);
  const outputGradient = new Float32Array(probabilities);
  outputGradient[sample.y] -= 1;

  const hiddenGradient = new Float32Array(HIDDEN);
  for (let j = 0; j < HIDDEN; j++) {
    let value = 0;
    for (let k = 0; k < OUTPUTS; k++) value += model.w2[k][j] * outputGradient[k];
    hiddenGradient[j] = hidden[j] > 0 ? value : 0;
  }

  for (let k = 0; k < OUTPUTS; k++) {
    for (let j = 0; j < HIDDEN; j++) model.w2[k][j] -= learningRate * outputGradient[k] * hidden[j];
    model.b2[k] -= learningRate * outputGradient[k];
  }

  for (let j = 0; j < HIDDEN; j++) {
    const weights = model.w1[j];
    const gradient = hiddenGradient[j];
    for (let i = 0; i < INPUTS; i++) weights[i] -= learningRate * gradient * sample.x[i];
    model.b1[j] -= learningRate * gradient;
  }
}

function accuracy(model, data) {
  if (!data.length) return 0;
  let correct = 0;
  for (const sample of data) {
    if (argmax(forward(model, sample.x)) === sample.y) correct++;
  }
  return correct / data.length;
}

function stratifiedSplit(data) {
  const groups = Array.from({ length: OUTPUTS }, () => []);
  data.forEach(sample => groups[sample.y].push(sample));
  const train = [];
  const validation = [];

  groups.forEach(group => {
    shuffle(group);
    const cut = Math.max(1, Math.floor(group.length * .8));
    train.push(...group.slice(0, cut));
    validation.push(...group.slice(cut));
  });

  shuffle(train);
  shuffle(validation);
  return { train, validation };
}
