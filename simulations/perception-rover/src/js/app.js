// Input wiring, guarded bootstrap, and animation loop.
'use strict';

document.addEventListener('keydown', event => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp'].includes(event.key)) event.preventDefault();
  if (event.repeat) return;
  if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') setManualSteer(-1);
  if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') setManualSteer(1);
  if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'w') setManualSteer(0);
});

document.addEventListener('keyup', event => {
  if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(event.key)) setManualSteer(0);
});

$('leftBtn').onpointerdown = () => setManualSteer(-1);
$('rightBtn').onpointerdown = () => setManualSteer(1);
$('straightBtn').onclick = () => setManualSteer(0);
$('leftBtn').onpointerup = $('rightBtn').onpointerup = () => setManualSteer(0);
$('leftBtn').onpointerleave = $('rightBtn').onpointerleave = () => setManualSteer(0);

$('recordBtn').onclick = () => {
  if (sim.autopilot) return;
  sim.recording = !sim.recording;
  $('recordBtn').classList.toggle('recording', sim.recording);
  $('recordBtn').textContent = sim.recording ? '■ Stop recording' : '● Record my driving';
  $('status').textContent = sim.recording
    ? 'Recording. Drive around the whole road, and make sure you actually create left, straight, and right examples.'
    : 'Recording paused.';
};

$('expertBtn').onclick = generateExpertDataset;
$('trainBtn').onclick = trainModel;
$('clearBtn').onclick = clearDataset;
$('resetBtn').onclick = resetRover;
$('steerRange').oninput = event => sim.steerResponse = Number(event.target.value);

$('autoBtn').onclick = () => {
  if (!sim.model) return;
  sim.autopilot = !sim.autopilot;
  sim.recording = false;
  sim.apSteer = 0;
  $('recordBtn').classList.remove('recording');
  $('recordBtn').textContent = '● Record my driving';
  $('autoBtn').classList.toggle('autopilot', sim.autopilot);
  $('autoBtn').textContent = sim.autopilot ? 'Disable autopilot' : 'Enable autopilot';
  $('status').innerHTML = sim.autopilot
    ? 'Autopilot is now using <b>camera pixels only</b>. If it leaves the road, inspect where and ask what camera situations were missing from the dataset.'
    : 'Back to manual control.';
};

function showBootFailure(error) {
  console.error('Perception Rover Lab failed to start.', error);
  const notice = document.createElement('div');
  notice.className = 'boot-error';
  notice.innerHTML = `<div><strong>Perception Rover Lab could not start</strong><span>${String(error?.message || error)}</span><small>Refresh the page. If the problem persists, check the browser console.</small></div>`;
  document.body.appendChild(notice);
}

function loop(now) {
  const dt = Math.min(.035, (now - sim.lastTime) / 1000);
  sim.lastTime = now;
  if (!sim.generating) {
    drawCamera();
    updatePhysics(dt);
    drawWorld();
    drawCamera();
    maybeRecord(now);
  }
  updateUI();
  requestAnimationFrame(loop);
}

try {
  resetRover();
  drawWorld();
  drawCamera();
  updateDatasetUI();
  updateUI();
  requestAnimationFrame(loop);
} catch (error) {
  showBootFailure(error);
}
