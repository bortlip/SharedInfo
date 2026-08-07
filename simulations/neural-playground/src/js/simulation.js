// Dataset/model reset, training orchestration, history, and current-signal selection.
'use strict';

function resetModel({ preserveHistory = false } = {}) {
  sim.model = createModel(sim.modelType, sim.hiddenUnits, sim.seed + sim.epoch + 101);
  sim.epoch = 0;
  sim.sampleIndex = 0;
  sim.trainAccumulator = 0;
  sim.activePointId = null;
  sim.currentSignal = null;
  if (!preserveHistory) sim.history = [];
  updateMetrics(true);
  sim.status = 'Fresh weights';
}

function loadDataset(key = sim.preset) {
  sim.preset = key;
  sim.points = generateDataset(key, sim.seed);
  sim.selectedPointId = null;
  sim.hoveredPointId = null;
  sim.epoch = 0;
  resetModel();
  sim.status = `${DATASET_INFO[key].name} loaded`;
}

function updateMetrics(pushHistory = false) {
  sim.metrics = evaluateModel(sim.model, sim.points);
  if (pushHistory) {
    sim.history.push({ epoch: sim.epoch, accuracy: sim.metrics.accuracy, loss: sim.metrics.loss });
    if (sim.history.length > MAX_HISTORY) sim.history.shift();
  }
}

function chooseSignalPoint() {
  const id = sim.hoveredPointId ?? sim.selectedPointId ?? sim.activePointId;
  return sim.points.find(p => p.id === id) || sim.points[0] || null;
}

function refreshCurrentSignal() {
  const point = chooseSignalPoint();
  if (!point || !sim.model) {
    sim.currentSignal = null;
    return;
  }
  sim.currentSignal = {
    point,
    detail: predictDetailed(sim.model, point.x, point.y)
  };
}

function trainOne() {
  if (!sim.points.length || !sim.model) return;
  const point = sim.points[sim.sampleIndex % sim.points.length];
  sim.activePointId = point.id;
  const trace = trainSample(sim.model, point, sim.learningRate);
  sim.currentSignal = { point, detail: trace.after, trace };
  sim.sampleIndex++;

  if (sim.sampleIndex >= sim.points.length) {
    sim.sampleIndex = 0;
    sim.epoch++;
    updateMetrics(true);
    sim.status = `Learning · epoch ${sim.epoch}`;
  }
}

function trainEpoch() {
  const count = Math.max(1, sim.points.length);
  for (let i = 0; i < count; i++) trainOne();
  updateMetrics(false);
}

function updateTraining(dt) {
  if (!sim.running) return;
  const rate = TRAIN_RATES[sim.speedIndex] || TRAIN_RATES[1];
  sim.trainAccumulator += dt * rate;
  let steps = 0;
  while (sim.trainAccumulator >= 1 && steps < 260) {
    trainOne();
    sim.trainAccumulator--;
    steps++;
  }
}

function addUserPoint(x, y, label) {
  const point = makePoint(x, y, label);
  sim.points.push(point);
  sim.selectedPointId = point.id;
  sim.activePointId = point.id;
  updateMetrics(false);
  refreshCurrentSignal();
  sim.status = 'Point added';
}

function removePoint(id) {
  sim.points = sim.points.filter(p => p.id !== id);
  if (sim.selectedPointId === id) sim.selectedPointId = null;
  if (sim.hoveredPointId === id) sim.hoveredPointId = null;
  if (sim.activePointId === id) sim.activePointId = null;
  updateMetrics(false);
  refreshCurrentSignal();
  sim.status = 'Point removed';
}
