// Car creation, scenery, hazards, and race reset/setup.
'use strict';

function createCars() {
  const rng = sim.rng;
  const cars = [];
  const gridStartS = -18;
  for (let i = 0; i < sim.fieldSize; i++) {
    const style = STYLES[i % STYLES.length];
    const row = Math.floor(i / 2);
    const side = i % 2 === 0 ? -1 : 1;
    const s = gridStartS - row * 27;
    const p = sampleAtS(s);
    const lat = side * 15.5;
    const skillJitter = (rng() - .5) * .075;
    const heading = Math.atan2(p.ty, p.tx);
    const car = {
      id: i,
      name: NAMES[i % NAMES.length],
      color: CAR_COLORS[i % CAR_COLORS.length],
      style,
      skill: 1 + skillJitter,
      x: p.x + p.nx * lat,
      y: p.y + p.ny * lat,
      prevX: p.x + p.nx * lat,
      prevY: p.y + p.ny * lat,
      heading,
      angularVel: 0,
      vx: 0,
      vy: 0,
      speed: 0,
      forwardSpeed: 0,
      lateralSpeed: 0,
      slipAngle: 0,
      gripRatio: 1,
      steer: 0,
      throttle: 0,
      brake: 0,
      trackIdx: p.idx,
      lap: 0,
      progress: p.s,
      totalProgress: s,
      hasStarted: false,
      nextLapMark: sim.track.length,
      lateral: lat,
      gridOffset: lat,
      targetLateral: lat,
      passTarget: null,
      passTimer: 0,
      stuckTimer: 0,
      status: 'On grid',
      finished: false,
      finishAge: 0,
      parked: false,
      finishTime: Infinity,
      finishPosition: null,
      lapStart: 0,
      lastLap: Infinity,
      bestLap: Infinity,
      collisions: 0,
      offTracks: 0,
      overtakes: 0,
      collisionCooldown: 0,
      offTrackNow: false,
      recovering: false,
      disabled: false,
      retired: false,
      removed: false,
      towed: false,
      damage: 0,
      disableAge: 0,
      fireDelay: Infinity,
      burning: false,
      slickTimer: 0,
      incidentTimer: 0,
      incidentKick: 0,
      trail: [],
      trailTimer: 0,
      skidTimer: 0,
      lastRearLeft: null,
      lastRearRight: null,
      rank: i + 1,
      priorRank: i + 1,
      currentCurvature: 0,
      targetSpeed: 0,
      rng: mulberry32(sim.seed * 101 + i * 977 + 17),
      reaction: rng() * .15,
      wobblePhase: rng() * Math.PI * 2,
      mass: 1 + (rng() - .5) * .08
    };
    cars.push(car);
  }
  return cars;
}

function distanceToTrackApprox(x, y) {
  let best = Infinity;
  const samples = sim.track.samples;
  for (let i = 0; i < samples.length; i += 10) best = Math.min(best, dist2(x, y, samples[i].x, samples[i].y));
  return Math.sqrt(best);
}

function makeScenery() {
  const rng = mulberry32(sim.seed ^ 0x9E3779B9);
  const scenery = [];
  for (let attempts = 0; attempts < 620 && scenery.length < 120; attempts++) {
    const x = 38 + rng() * (WORLD_W - 76);
    const y = 38 + rng() * (WORLD_H - 76);
    if (distanceToTrackApprox(x, y) < TRACK_WIDTH * .68 + 34) continue;
    const r = rng();
    scenery.push({ x, y, type: r < .66 ? 'tree' : r < .83 ? 'bush' : 'tent', size: 7 + rng() * 10, phase: rng() * Math.PI * 2 });
  }
  sim.scenery = scenery;

  sim.birds = [];
  for (let i = 0; i < 7; i++) {
    let x = 0, y = 0;
    for (let tries = 0; tries < 50; tries++) {
      x = 80 + rng() * (WORLD_W - 160);
      y = 75 + rng() * (WORLD_H - 150);
      if (distanceToTrackApprox(x, y) > TRACK_WIDTH * .58 + 20) break;
    }
    sim.birds.push({ x, y, vx: 0, vy: 0, flying: false, phase: rng() * 10, rest: 2 + rng() * 6, homeX: x, homeY: y });
  }
}

function makeHazards() {
  sim.slicks = [];
  const rng = mulberry32(sim.seed ^ 0xA5A5BEEF);
  const count = sim.drama === 'clean' ? 0 : sim.drama === 'hazards' ? 2 : 4;
  for (let i = 0; i < count; i++) {
    const s = sim.track.length * (.17 + rng() * .72);
    const p = sampleAtS(s);
    const offset = (rng() - .5) * 38;
    sim.slicks.push({
      s, x: p.x + p.nx * offset, y: p.y + p.ny * offset,
      offset, radius: 15 + rng() * 8, phase: rng() * Math.PI * 2
    });
  }
  sim.nextIncidentAt = sim.drama === 'chaos' ? 13 + rng() * 8 : Infinity;
}

function resetSimulation(keepPaused = false) {
  sim.running = false;
  sim.finished = false;
  sim.accumulator = 0;
  sim.raceTime = 0;
  sim.countdown = 3.2;
  sim.trace = [];
  sim.traceTimer = 0;
  sim.finishOrder = [];
  sim.selectedId = null;
  sim.hoveredId = null;
  sim.skidMarks = [];
  sim.particles = [];
  sim.rings = [];
  sim.debris = [];
  sim.tow = null;
  sim.cameraShake = 0;
  sim.impactCount = 0;
  sim.trackKey = $('trackSelect').value;
  sim.fieldSize = clamp(parseInt($('carsInput').value, 10) || 16, 8, 24);
  sim.laps = clamp(parseInt($('lapsInput').value, 10) || 5, 2, 12);
  sim.seed = clamp(parseInt($('seedInput').value, 10) || 7319, 1, 999999);
  sim.drama = $('dramaSelect')?.value || 'hazards';
  $('carsInput').value = sim.fieldSize;
  $('lapsInput').value = sim.laps;
  $('seedInput').value = sim.seed;
  sim.rng = mulberry32(sim.seed);
  sim.track = buildTrack(TRACKS[sim.trackKey]);
  sim.cars = createCars();
  makeScenery();
  makeHazards();
  buildStaticScene();
  initializeStyleCards();
  rebuildEngineVoices();
  updateStandings(true);
  updateTelemetry();
  drawTrace();
  $('finishPanel').classList.remove('show');
  $('playBtn').textContent = '▶ Start race';
  $('simStatusChip').textContent = 'Race ready';
  $('topTrackName').textContent = sim.track.name;
  $('topSeed').textContent = sim.seed;
  $('fieldSummary').textContent = `${sim.fieldSize} cars · ${sim.laps} laps`;
  $('finishCount').textContent = '0 classified';
  $('lapBadge').textContent = `1 / ${sim.laps}`;
  $('leaderBadge').textContent = '—';
  $('timeBadge').textContent = '0:00.000';
  $('traceStatus').textContent = 'waiting for lights';
  sim.lastRealTime = performance.now();
  if (!keepPaused) render();
}
