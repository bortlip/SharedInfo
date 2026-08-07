// Animation loop, input wiring, interaction, and application bootstrap.
'use strict';

function pointerToField(event) {
  const rect = fieldCanvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / rect.width * FIELD_W,
    y: (event.clientY - rect.top) / rect.height * FIELD_H
  };
}

function nearestPointAt(canvasPoint, maxDistance = 18) {
  let best = null;
  let bestD = maxDistance * maxDistance;
  for (const point of sim.points) {
    const p = worldToCanvas(point.x, point.y);
    const d = dist2(canvasPoint.x, canvasPoint.y, p.x, p.y);
    if (d < bestD) { bestD = d; best = point; }
  }
  return best;
}

fieldCanvas.addEventListener('mousemove', (event) => {
  const p = pointerToField(event);
  const hit = nearestPointAt(p, 20);
  sim.hoveredPointId = hit?.id ?? null;
  if (!sim.running) refreshCurrentSignal();
});

fieldCanvas.addEventListener('mouseleave', () => {
  sim.hoveredPointId = null;
  if (!sim.running) refreshCurrentSignal();
});

fieldCanvas.addEventListener('click', (event) => {
  const p = pointerToField(event);
  const hit = nearestPointAt(p, 20);
  if (sim.tool === 'inspect') {
    if (hit) {
      sim.selectedPointId = hit.id;
      sim.activePointId = hit.id;
      refreshCurrentSignal();
      sim.status = 'Inspecting sample';
    }
    return;
  }
  if (sim.tool === 'erase') {
    if (hit) removePoint(hit.id);
    return;
  }
  const world = canvasToWorld(p.x, p.y);
  addUserPoint(world.x, world.y, sim.tool === 'class-a' ? CLASS_A : CLASS_B);
});

$('playBtn').addEventListener('click', () => {
  sim.running = !sim.running;
  sim.lastRealTime = performance.now();
  sim.status = sim.running ? 'Training live' : 'Training paused';
});

$('stepEpochBtn').addEventListener('click', () => {
  sim.running = false;
  trainEpoch();
  sim.status = `Stepped to epoch ${sim.epoch}`;
});

$('resetWeightsBtn').addEventListener('click', () => {
  sim.running = false;
  sim.seed = (sim.seed + 1) % 999999 || 1;
  resetModel();
});

$('clearPointsBtn').addEventListener('click', () => {
  sim.running = false;
  sim.points = [];
  sim.selectedPointId = null;
  sim.activePointId = null;
  sim.currentSignal = null;
  sim.history = [];
  sim.epoch = 0;
  updateMetrics(false);
  sim.status = 'Canvas cleared';
});

$('regenerateBtn').addEventListener('click', () => {
  sim.running = false;
  sim.seed = (sim.seed + 1) % 999999 || 1;
  loadDataset(sim.preset);
});

$('datasetSelect').addEventListener('change', event => {
  sim.running = false;
  loadDataset(event.target.value);
});

$('modelSelect').addEventListener('change', event => {
  sim.running = false;
  sim.modelType = event.target.value;
  resetModel();
  sim.status = sim.modelType === 'perceptron' ? 'Single perceptron ready' : 'Hidden-layer network ready';
});

$('learningRateInput').addEventListener('input', event => {
  sim.learningRate = Number(event.target.value);
  $('learningRateValue').textContent = fmt(sim.learningRate, 2);
});

$('hiddenUnitsInput').addEventListener('input', event => {
  sim.running = false;
  sim.hiddenUnits = Number(event.target.value);
  $('hiddenUnitsValue').textContent = sim.hiddenUnits;
  if (sim.modelType === 'network') resetModel();
});

document.querySelectorAll('[data-speed-index]').forEach(button => button.addEventListener('click', () => {
  sim.speedIndex = Number(button.dataset.speedIndex);
  document.querySelectorAll('[data-speed-index]').forEach(b => b.classList.toggle('active', b === button));
}));

document.querySelectorAll('[data-tool]').forEach(button => button.addEventListener('click', () => setTool(button.dataset.tool)));

function showBootFailure(error) {
  console.error('Neural Playground failed to start.', error);
  const notice = document.createElement('div');
  notice.className = 'boot-error';
  notice.innerHTML = `<div><strong>Neural Playground could not start</strong><span>${String(error?.message || error)}</span><small>Refresh the page. If this persists, the source link in the footer points to the current files.</small></div>`;
  document.body.appendChild(notice);
}

function animationLoop(now) {
  const dt = Math.min(.08, (now - sim.lastRealTime) / 1000);
  sim.lastRealTime = now;
  sim.flowPhase = (now / 1050) % 1;
  updateTraining(dt);
  if (!sim.running && !sim.currentSignal) refreshCurrentSignal();
  updateMetrics(false);
  renderAll();
  updateUI();
  requestAnimationFrame(animationLoop);
}

window.__neuralPlayground = sim;
try {
  loadDataset('linear');
  setTool('inspect');
  refreshCurrentSignal();
  renderAll();
  updateUI();
  requestAnimationFrame(animationLoop);
} catch (error) {
  showBootFailure(error);
}
