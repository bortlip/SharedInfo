// Animation loop, input wiring, interaction, and application bootstrap.
'use strict';

function animationLoop(now) {
  const realDelta = Math.min(.08, (now - sim.lastRealTime) / 1000);
  sim.lastRealTime = now;
  if (sim.running || (sim.finished && (sim.tow || sim.particles.length || sim.cars.some(c => c.finished && !c.parked)))) {
    sim.accumulator += realDelta * (sim.running ? sim.speedMultiplier : 1);
    let steps = 0;
    while (sim.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      step(FIXED_DT);
      sim.accumulator -= FIXED_DT;
      steps++;
    }
  }
  sim.uiTimer += realDelta;
  if (sim.uiTimer > .14) {
    sim.uiTimer = 0;
    updateStandings(); updateTelemetry(); drawTrace(); updateAudio();
    $('traceStatus').textContent = sim.running ? `${sim.speedMultiplier}× live` : sim.finished ? 'final classification' : 'paused';
  }
  render();
  requestAnimationFrame(animationLoop);
}

async function togglePlay() {
  if (sim.finished) return;
  if (!sim.audio.enabled && $('autoSoundToggle')?.checked) await ensureAudio();
  sim.running = !sim.running;
  $('playBtn').textContent = sim.running ? '❚❚ Pause race' : (sim.raceTime > 0 ? '▶ Resume race' : '▶ Start race');
  $('simStatusChip').textContent = sim.running ? 'Race live' : 'Race paused';
  sim.lastRealTime = performance.now();
}

function mouseToWorld(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) / rect.width * WORLD_W, y: (event.clientY - rect.top) / rect.height * WORLD_H };
}

canvas.addEventListener('mousemove', (e) => {
  const p = mouseToWorld(e); sim.mouse = { ...p, inside: true };
  let hovered = null, best = 19 * 19;
  for (const car of sim.cars) {
    if (car.removed) continue;
    const d = dist2(p.x, p.y, car.x, car.y);
    if (d < best) { best = d; hovered = car; }
  }
  sim.hoveredId = hovered?.id ?? null;
  if (hovered) {
    $('tooltip').classList.add('show');
    $('tooltip').style.left = `${e.clientX}px`; $('tooltip').style.top = `${e.clientY}px`;
    $('tooltip').innerHTML = `<strong>${hovered.name}</strong><div>${hovered.style.name} · ${hovered.retired ? 'DNF' : ordinal(hovered.rank)}</div><div>${Math.round(hovered.speed * .88)} km/h · ${Math.round(hovered.damage)}% damage</div><div>${hovered.status}</div>`;
  } else $('tooltip').classList.remove('show');
});
canvas.addEventListener('mouseleave', () => { sim.hoveredId = null; sim.mouse.inside = false; $('tooltip').classList.remove('show'); });
canvas.addEventListener('click', (e) => {
  const p = mouseToWorld(e); let chosen = null, best = 23 * 23;
  for (const car of sim.cars) {
    if (car.removed) continue;
    const d = dist2(p.x, p.y, car.x, car.y);
    if (d < best) { best = d; chosen = car; }
  }
  if (chosen) { sim.selectedId = chosen.id; updateStandings(true); updateTelemetry(); }
});

$('playBtn').addEventListener('click', togglePlay);
$('resetBtn').addEventListener('click', () => resetSimulation());
$('raceAgainBtn').addEventListener('click', () => { $('seedInput').value = (sim.seed + 1) % 999999 || 1; resetSimulation(); togglePlay(); });
$('dismissFinishBtn').addEventListener('click', () => $('finishPanel').classList.remove('show'));
['trackSelect', 'carsInput', 'lapsInput', 'seedInput', 'dramaSelect'].forEach(id => $(id)?.addEventListener('change', () => resetSimulation()));
document.querySelectorAll('.speed-btn').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active'); sim.speedMultiplier = Number(btn.dataset.speed);
}));
$('trailsToggle').addEventListener('change', e => sim.showTrails = e.target.checked);
$('lineToggle').addEventListener('change', e => sim.showLine = e.target.checked);
$('namesToggle').addEventListener('change', e => sim.showNames = e.target.checked);
$('soundBtn')?.addEventListener('click', toggleSound);
$('testSoundBtn')?.addEventListener('click', testRev);
$('volumeInput')?.addEventListener('input', e => {
  sim.audio.volume = Number(e.target.value);
  if (sim.audio.ctx && sim.audio.master && sim.audio.enabled) sim.audio.master.gain.setTargetAtTime(sim.audio.volume, sim.audio.ctx.currentTime, .04);
  $('volumeValue').textContent = `${Math.round(sim.audio.volume * 100)}%`;
});

window.__pocketPrix = sim;
resetSimulation(true);
requestAnimationFrame(animationLoop);
