// Dataset, prediction, telemetry, and manual-control UI updates.
'use strict';

function updateDatasetUI() {
  const counts = [0, 0, 0];
  sim.dataset.forEach(sample => counts[sample.y]++);
  $('totalFrames').textContent = sim.dataset.length;
  $('samplesText').textContent = sim.dataset.length;
  $('nLeft').textContent = counts[0];
  $('nStraight').textContent = counts[1];
  $('nRight').textContent = counts[2];
  $('stageCollect').textContent = `${sim.dataset.length} frames`;
  $('trainBtn').disabled = sim.dataset.length < 60 || sim.training;
  const ready = sim.dataset.length >= 60 && Math.min(...counts) >= 8;
  $('sCollect').classList.toggle('done', ready);
  $('sLabel').classList.toggle('done', ready);
}

function updateGallery() {
  const gallery = $('gallery');
  gallery.innerHTML = '';
  const items = sim.dataset.filter(sample => sample.thumb).slice(-10).reverse();
  items.forEach(sample => {
    const cell = document.createElement('div');
    cell.className = 'thumb';
    const image = document.createElement('img');
    image.src = sample.thumb;
    image.alt = `${LABELS[sample.y]} labeled camera frame`;
    const badge = document.createElement('b');
    badge.textContent = LABELS[sample.y][0];
    badge.style.color = sample.y === 0 ? '#9af7ff' : sample.y === 2 ? '#ff9aa4' : '#fff';
    cell.append(image, badge);
    gallery.appendChild(cell);
  });
}

function updatePredictionUI() {
  const ids = ['pLeft', 'pStraight', 'pRight'];
  const best = argmax(sim.probs);
  ids.forEach((id, index) => {
    const element = $(id);
    element.querySelector('strong').textContent = sim.model ? `${Math.round(sim.probs[index] * 100)}%` : '—';
    element.classList.toggle('best', Boolean(sim.model) && index === best);
  });
}

function updateUI() {
  const error = sim.y - roadCenter(sim.x);
  $('errorText').textContent = `${Math.round(error)} px`;
  $('errorText').style.color = Math.abs(error) > ROAD_HALF ? '#ff9ca5' : '';
  $('modeText').textContent = sim.autopilot ? 'Autopilot' : sim.recording ? 'Manual + recording' : 'Manual';
  $('accText').textContent = sim.valAcc == null ? '—' : `${Math.round(sim.valAcc * 100)}%`;
  $('trainAcc').textContent = sim.trainAcc == null ? '—' : `${Math.round(sim.trainAcc * 100)}%`;
  $('valAcc').textContent = sim.valAcc == null ? '—' : `${Math.round(sim.valAcc * 100)}%`;
  $('stageDeploy').textContent = sim.autopilot ? 'autopilot active' : 'manual';
  $('sDeploy').classList.toggle('done', sim.autopilot);
  $('steerVal').textContent = sim.steerResponse.toFixed(2);
  updatePredictionUI();
}

function setManualSteer(value) {
  if (sim.autopilot) return;
  sim.manualSteer = value;
  $('leftBtn').classList.toggle('active', value < 0);
  $('straightBtn').classList.toggle('active', value === 0);
  $('rightBtn').classList.toggle('active', value > 0);
}
