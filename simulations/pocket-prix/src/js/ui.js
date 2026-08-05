// Standings, telemetry, charts, controller summaries, and finish presentation.
'use strict';

function initializeStyleCards() {
  $('styleGrid').innerHTML = STYLES.map(style => `
    <div class="style-card" data-style="${style.key}">
      <div class="style-top">
        <div class="style-name"><span class="dot" style="background:${style.color}"></span>${style.name}</div>
        <div class="style-pos" id="stylePos-${style.key}">avg —</div>
      </div>
      <div class="style-desc">${style.description}</div>
      <div class="bar"><span id="styleBar-${style.key}" style="background:${style.color}"></span></div>
    </div>`).join('');
}

function updateStyleStats() {
  for (const style of STYLES) {
    const group = sim.cars.filter(c => c.style.key === style.key);
    if (!group.length) continue;
    const avg = group.reduce((sum, c) => sum + c.rank, 0) / group.length;
    const best = Math.min(...group.map(c => c.rank));
    const score = 100 * (1 - (avg - 1) / Math.max(1, sim.cars.length - 1));
    $(`stylePos-${style.key}`).textContent = `avg ${avg.toFixed(1)} · best ${ordinal(best)}`;
    $(`styleBar-${style.key}`).style.width = `${score}%`;
  }
}

function updateStandings(force = false) {
  const sorted = updateRanks();
  const leader = sorted.find(c => !c.retired) || sorted[0];
  $('leaderBadge').textContent = leader ? leader.name.split(' ')[0] : '—';
  const leaderLap = leader ? Math.min(sim.laps, Math.floor(Math.max(0, leader.totalProgress) / sim.track.length) + 1) : 1;
  $('lapBadge').textContent = `${leaderLap} / ${sim.laps}`;
  $('finishCount').textContent = `${classifiedCount()} classified`;
  $('timeBadge').textContent = formatTime(sim.raceTime);
  $('simStatusChip').textContent = sim.finished ? 'Race complete' : sim.running ? (sim.countdown > 0 ? 'Lights sequence' : 'Race live') : sim.raceTime <= 0 ? 'Race ready' : 'Race paused';

  const leaderProgress = leader?.totalProgress || 0;
  $('standings').innerHTML = sorted.map(car => {
    const gap = sim.raceTime <= 0
      ? (car.rank === 1 ? 'POLE' : 'GRID')
      : car.retired
        ? 'DNF'
        : car.rank === 1
          ? 'LEADER'
          : car.finished && sim.finishOrder[0]
            ? formatTime(car.finishTime - sim.finishOrder[0].finishTime)
            : `+${Math.max(0, (leaderProgress - car.totalProgress) / Math.max(55, leader?.speed || 55)).toFixed(1)}s`;
    const lap = car.retired ? 'DNF' : `L${Math.min(sim.laps, Math.floor(Math.max(0, car.totalProgress) / sim.track.length) + 1)}`;
    return `<div class="standing-row ${car.id === sim.selectedId ? 'selected' : ''} ${car.finished ? 'finished' : ''}" data-car-id="${car.id}">
      <div class="rank">${car.rank}</div>
      <div class="car-swatch" style="background:${car.color}"></div>
      <div class="driver-name"><strong>${car.name}</strong><span>${car.style.name} · ${lap}${car.damage > 0 ? ` · ${Math.round(car.damage)}% dmg` : ''}</span></div>
      <div class="gap">${gap}</div>
    </div>`;
  }).join('');
  document.querySelectorAll('.standing-row').forEach(row => row.addEventListener('click', () => {
    sim.selectedId = Number(row.dataset.carId);
    updateStandings(true); updateTelemetry();
  }));
  updateStyleStats();
  if (force) render();
}

function selectedCar() {
  return sim.cars.find(c => c.id === sim.selectedId) || sim.cars[0];
}

function updateTelemetry() {
  const car = selectedCar();
  if (!car) return;
  if (sim.selectedId === null) sim.selectedId = car.id;
  $('metricSpeed').textContent = `${Math.round(car.speed * .88)} km/h`;
  $('metricPosition').textContent = car.retired ? 'DNF' : ordinal(car.rank);
  $('metricLap').textContent = formatTime(car.bestLap);
  $('metricIncidents').textContent = car.collisions + car.offTracks;
  if ($('metricDamage')) $('metricDamage').textContent = `${Math.round(car.damage)}%`;
  if ($('metricGrip')) $('metricGrip').textContent = car.slickTimer > 0 ? 'SLICK' : `${Math.round(car.gripRatio * 100)}%`;
  $('profileCar').style.background = car.color;
  $('profileName').textContent = car.name;
  $('profileStyle').textContent = `${car.style.name} controller`;
  const slip = Math.abs(car.slipAngle) * 180 / Math.PI;
  $('profileCopy').textContent = `${car.status}. ${Math.round(car.damage)}% damage, ${slip.toFixed(1)}° slip, ${car.overtakes} position change${car.overtakes === 1 ? '' : 's'}, ${car.collisions} contact${car.collisions === 1 ? '' : 's'}, and ${car.offTracks} off-track moment${car.offTracks === 1 ? '' : 's'}.`;
}

function drawTrace() {
  const w = traceCanvas.width, h = traceCanvas.height;
  tctx.clearRect(0, 0, w, h);
  const grad = tctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(255,255,255,.035)'); grad.addColorStop(1, 'rgba(0,0,0,.05)');
  tctx.fillStyle = grad; tctx.fillRect(0, 0, w, h);
  tctx.strokeStyle = 'rgba(255,255,255,.07)'; tctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) { const y = (h - 24) * i / 5 + 8; tctx.beginPath(); tctx.moveTo(34, y); tctx.lineTo(w - 10, y); tctx.stroke(); }
  if (sim.trace.length < 2) {
    tctx.fillStyle = 'rgba(255,255,255,.42)'; tctx.font = '12px Inter, sans-serif'; tctx.textAlign = 'center';
    tctx.fillText('The trace wakes up when the race starts.', w / 2, h / 2);
    return;
  }
  const minT = sim.trace[0].t;
  const maxT = Math.max(minT + 1, sim.trace[sim.trace.length - 1].t);
  const allPoints = sim.trace.flatMap(s => s.cars.map(c => c.p));
  const minP = Math.min(...allPoints);
  const maxP = Math.max(minP + 1, ...allPoints);
  const ids = [...new Set(sim.trace.flatMap(s => s.cars.map(c => c.id)))].slice(0, 8);
  for (const id of ids) {
    const car = sim.cars.find(c => c.id === id); if (!car) continue;
    tctx.beginPath(); let started = false;
    for (const snap of sim.trace) {
      const point = snap.cars.find(c => c.id === id); if (!point) continue;
      const x = 34 + (snap.t - minT) / (maxT - minT) * (w - 48);
      const y = h - 16 - (point.p - minP) / (maxP - minP) * (h - 30);
      if (!started) { tctx.moveTo(x, y); started = true; } else tctx.lineTo(x, y);
    }
    tctx.strokeStyle = car.color; tctx.globalAlpha = id === sim.selectedId ? 1 : .55; tctx.lineWidth = id === sim.selectedId ? 2.6 : 1.4; tctx.stroke();
  }
  tctx.globalAlpha = 1;
  tctx.fillStyle = 'rgba(255,255,255,.45)'; tctx.font = '10px Inter, sans-serif'; tctx.textAlign = 'left';
  tctx.fillText(formatTime(minT), 34, h - 4); tctx.fillText(formatTime(maxT), w - 10, h - 4);
}

function showFinishPanel() {
  const podium = sim.finishOrder.slice(0, 3);
  if (!podium.length) return;
  $('finishTitle').textContent = `${podium[0].name} wins`;
  const dnfs = sim.cars.filter(c => c.retired).length;
  $('finishSubtitle').textContent = `${podium[0].style.name} takes it in ${formatTime(podium[0].finishTime)}${dnfs ? ` · ${dnfs} DNF${dnfs === 1 ? '' : 's'}` : ''}.`;
  $('podium').innerHTML = podium.map((car, i) => `<div>
    <div class="podium-rank">${['Winner', 'Second', 'Third'][i]}</div>
    <div class="podium-name" style="color:${car.color}">${car.name}</div>
    <div class="podium-style">${car.style.name}<br>${formatTime(car.finishTime)}</div>
  </div>`).join('');
  $('finishPanel').classList.add('show');
}
