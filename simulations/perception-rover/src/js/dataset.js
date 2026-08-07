// Manual data collection, labels, expert-data generation, and dataset reset.
'use strict';

function snapshot(label, withThumb = true) {
  return {
    x: captureInput(),
    y: label,
    thumb: withThumb ? tiny.toDataURL('image/jpeg', .66) : null
  };
}

function labelForSteer(value) {
  if (value < -.22) return 0;
  if (value > .22) return 2;
  return 1;
}

function invalidateModel() {
  sim.model = null;
  sim.trainAcc = null;
  sim.valAcc = null;
  sim.probs = [0, 0, 0];
  sim.autopilot = false;
  sim.apSteer = 0;
  $('autoBtn').classList.remove('autopilot');
  $('autoBtn').textContent = 'Enable autopilot';
  $('autoBtn').disabled = true;
  $('sTrain').classList.remove('done');
  $('sDeploy').classList.remove('done');
  $('stageTrain').textContent = 'not trained';
  $('stageDeploy').textContent = 'manual';
  $('trainProgress').style.width = '0%';
}

function maybeRecord(now) {
  if (!sim.recording || sim.autopilot || now - sim.lastCapture < 105) return;
  sim.lastCapture = now;
  if (sim.model) invalidateModel();
  sim.dataset.push(snapshot(labelForSteer(sim.manualSteer), true));
  if (sim.dataset.length > 1600) sim.dataset.shift();
  updateDatasetUI();
  if (sim.dataset.length % 5 === 0) updateGallery();
}

function clearDataset() {
  sim.recording = false;
  sim.dataset = [];
  invalidateModel();
  $('recordBtn').classList.remove('recording');
  $('recordBtn').textContent = '● Record my driving';
  $('trainAcc').textContent = '—';
  $('valAcc').textContent = '—';
  $('status').innerHTML = 'Dataset cleared. Try a different data-collection strategy, or generate the expert dataset for a known-good baseline.';
  updateDatasetUI();
  updateGallery();
  updateUI();
}

async function generateExpertDataset() {
  if (sim.training || sim.generating) return;
  sim.generating = true;
  sim.recording = false;
  invalidateModel();
  $('recordBtn').classList.remove('recording');
  $('recordBtn').textContent = '● Record my driving';
  $('recordBtn').disabled = true;
  $('expertBtn').disabled = true;
  $('trainBtn').disabled = true;
  $('clearBtn').disabled = true;
  $('resetBtn').disabled = true;
  $('status').textContent = 'Generating balanced labeled camera views from many positions and recovery situations…';

  const saved = { x: sim.x, y: sim.y, heading: sim.heading };
  sim.dataset = [];
  const targetPerClass = 120;
  const counts = [0, 0, 0];
  let tries = 0;

  while (Math.min(...counts) < targetPerClass && tries < 9000) {
    tries++;
    const x = rand(0, W);
    sim.x = x;
    sim.y = roadCenter(x) + rand(-78, 78);
    sim.heading = roadHeading(x) + rand(-.27, .27);
    const steer = expertSteer(sim.x, sim.y, sim.heading);
    const label = labelForSteer(steer);
    if (counts[label] >= targetPerClass) continue;

    drawCamera();
    const keepThumb = counts[label] >= targetPerClass - 4;
    sim.dataset.push(snapshot(label, keepThumb));
    counts[label]++;

    if (sim.dataset.length % 45 === 0) {
      $('trainProgress').style.width = `${sim.dataset.length / (targetPerClass * 3) * 100}%`;
      $('status').textContent = `Generating expert examples… ${sim.dataset.length}/${targetPerClass * 3}`;
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  sim.x = saved.x;
  sim.y = saved.y;
  sim.heading = saved.heading;
  sim.generating = false;
  drawWorld();
  drawCamera();
  $('trainProgress').style.width = '0%';
  $('recordBtn').disabled = false;
  $('expertBtn').disabled = false;
  $('clearBtn').disabled = false;
  $('resetBtn').disabled = false;
  $('status').innerHTML = `Generated <b>${sim.dataset.length}</b> balanced examples, including recovery states. Train the model next.`;
  updateDatasetUI();
  updateGallery();
}
