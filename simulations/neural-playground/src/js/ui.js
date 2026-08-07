// Live metrics, point inspector, lesson callouts, and control-state updates.
'use strict';

function modelDisplayName() {
  return sim.modelType === 'perceptron' ? 'Single perceptron' : `${sim.hiddenUnits}-unit network`;
}

function className(label) {
  return label === CLASS_A ? 'Class A · circle' : 'Class B · diamond';
}

function updateUI() {
  $('epochValue').textContent = sim.epoch.toLocaleString();
  $('accuracyValue').textContent = `${Math.round(sim.metrics.accuracy * 100)}%`;
  $('lossValue').textContent = fmt(sim.metrics.loss, 3);
  $('pointCountValue').textContent = sim.points.length;
  $('topModel').textContent = modelDisplayName();
  $('topDataset').textContent = DATASET_INFO[sim.preset]?.name || sim.preset;
  $('statusChip').textContent = sim.running ? 'Training live' : sim.status;
  $('playBtn').textContent = sim.running ? '❚❚ Pause training' : (sim.epoch ? '▶ Resume training' : '▶ Start training');
  $('datasetBlurb').textContent = DATASET_INFO[sim.preset]?.blurb || '';
  $('learningRateValue').textContent = fmt(sim.learningRate, 2);
  $('hiddenUnitsValue').textContent = sim.hiddenUnits;
  $('hiddenUnitsField').classList.toggle('disabled', sim.modelType === 'perceptron');
  $('hiddenUnitsInput').disabled = sim.modelType === 'perceptron';
  updateInspector();
  updateLesson();
}

function updateInspector() {
  const point = chooseSignalPoint();
  if (!point || !sim.model) {
    $('inspectTitle').textContent = 'No point selected';
    $('inspectSubtitle').textContent = 'Hover or inspect a training point.';
    $('inspectTarget').textContent = '—';
    $('inspectPrediction').textContent = '—';
    $('inspectConfidence').textContent = '—';
    $('inspectCoords').textContent = '—';
    $('signalReadout').textContent = 'Choose a point to trace its values through the network.';
    return;
  }
  const detail = predictDetailed(sim.model, point.x, point.y);
  const predictedLabel = detail.output >= .5 ? CLASS_B : CLASS_A;
  const confidence = predictedLabel === CLASS_B ? detail.output : 1 - detail.output;
  $('inspectTitle').textContent = `Point ${className(point.label)}`;
  $('inspectSubtitle').textContent = point.id === sim.activePointId ? 'This is the sample currently teaching the model.' : 'This sample is being traced through the model.';
  $('inspectTarget').textContent = point.label === CLASS_A ? 'A' : 'B';
  $('inspectPrediction').textContent = predictedLabel === CLASS_A ? 'A' : 'B';
  $('inspectConfidence').textContent = `${Math.round(confidence * 100)}%`;
  $('inspectCoords').textContent = `(${fmt(point.x, 2)}, ${fmt(point.y, 2)})`;
  if (sim.model.type === 'perceptron') {
    $('signalReadout').textContent = `x₁ and x₂ are multiplied by two learned weights, the bias shifts the threshold, and the score ${fmt(detail.score, 3)} becomes output ${fmt(detail.output, 3)}.`;
  } else {
    const hidden = detail.hidden.map(v => fmt(v, 2)).join(', ');
    $('signalReadout').textContent = `Inputs create hidden activations [${hidden}]. Those values are recombined into output ${fmt(detail.output, 3)}. Watch the pulses move left → right.`;
  }
}

function updateLesson() {
  const el = $('lessonText');
  const kicker = $('lessonKicker');
  if (sim.preset === 'xor' && sim.modelType === 'perceptron') {
    kicker.textContent = 'The important failure';
    el.innerHTML = '<strong>XOR cannot be separated by one straight line.</strong> Let the perceptron train: it will keep moving the boundary around, but there is no perfect position to find. Then switch to the hidden-layer network.';
  } else if (sim.preset === 'xor') {
    kicker.textContent = 'Watch representation emerge';
    el.innerHTML = '<strong>The hidden units create several intermediate cuts of the plane.</strong> Their outputs are recombined, letting the network form a nonlinear decision region that a lone perceptron cannot express.';
  } else if (sim.preset === 'circles' && sim.modelType === 'perceptron') {
    kicker.textContent = 'Wrong tool, useful lesson';
    el.innerHTML = '<strong>A single linear boundary cannot wrap around the inner class.</strong> The failure is structural, not a lack of training time. Try the hidden-layer network.';
  } else if (sim.metrics.accuracy > .96 && sim.epoch > 2) {
    kicker.textContent = 'It found a useful boundary';
    el.innerHTML = '<strong>The model now classifies almost every training point correctly.</strong> Add a few points in awkward places or change the dataset and watch the learned boundary adapt.';
  } else {
    kicker.textContent = 'What to watch';
    el.innerHTML = '<strong>Training changes the weights, and the weights move the decision boundary.</strong> The field shows what the model currently believes everywhere, not just at the training points.';
  }
}

function setTool(tool) {
  sim.tool = tool;
  document.querySelectorAll('[data-tool]').forEach(button => button.classList.toggle('active', button.dataset.tool === tool));
  fieldCanvas.classList.toggle('editing', tool !== 'inspect');
}
