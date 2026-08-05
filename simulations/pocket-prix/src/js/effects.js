// Particles, impact effects, birds, chaos events, and tow-truck recovery.
'use strict';

function spawnParticle(x, y, type, strength = 1) {
  const rng = sim.rng;
  let p;
  if (type === 'spark') {
    const angle = rng() * Math.PI * 2;
    const speed = (35 + rng() * 95) * strength;
    p = { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .28 + rng() * .34, maxLife: .62, size: 1 + rng() * 1.7, type };
  } else if (type === 'debris') {
    const angle = rng() * Math.PI * 2;
    const speed = (18 + rng() * 62) * strength;
    p = { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 4 + rng() * 5, maxLife: 9, size: 1.5 + rng() * 2.8, spin: (rng() - .5) * 9, rotation: rng() * 6, type };
  } else if (type === 'fire') {
    p = { x: x + (rng() - .5) * 6, y: y + (rng() - .5) * 5, vx: (rng() - .5) * 10, vy: -18 - rng() * 24, life: .38 + rng() * .38, maxLife: .76, size: 3 + rng() * 4, type };
  } else {
    const dust = type === 'dust';
    p = { x: x + (rng() - .5) * 5, y: y + (rng() - .5) * 5, vx: (rng() - .5) * (dust ? 18 : 10), vy: (rng() - .5) * (dust ? 18 : 10) - (dust ? 2 : 8), life: .7 + rng() * 1.0, maxLife: 1.7, size: 3 + rng() * 5, type };
  }
  sim.particles.push(p);
  if (sim.particles.length > 850) sim.particles.splice(0, sim.particles.length - 850);
}

function spawnRing(x, y, strength, label = '') {
  sim.rings.push({ x, y, life: .75, maxLife: .75, strength, label });
  if (sim.rings.length > 40) sim.rings.shift();
}

function spawnImpact(x, y, strength) {
  sim.impactCount++;
  spawnRing(x, y, strength, strength > 48 ? 'CRUNCH!' : 'THUMP');
  const sparkCount = clamp(Math.round(strength * .25), 5, 22);
  const debrisCount = clamp(Math.round(strength * .11), 2, 12);
  for (let i = 0; i < sparkCount; i++) spawnParticle(x, y, 'spark', clamp(strength / 60, .5, 1.8));
  for (let i = 0; i < debrisCount; i++) spawnParticle(x, y, 'debris', clamp(strength / 75, .5, 1.5));
  for (let i = 0; i < Math.min(8, Math.round(strength / 10)); i++) spawnParticle(x, y, 'smoke');
  sim.cameraShake = Math.max(sim.cameraShake, clamp(strength * .16, 2, 13));
  playImpactSound(strength);
}

function updateEffects(dt) {
  sim.cameraShake *= Math.exp(-dt * 8);
  for (const p of sim.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.type === 'spark' || p.type === 'debris') p.vy += 55 * dt;
    p.vx *= Math.exp(-dt * (p.type === 'debris' ? 1.5 : 2.8));
    p.vy *= Math.exp(-dt * (p.type === 'smoke' || p.type === 'dust' ? 1.2 : .8));
    if (p.rotation !== undefined) p.rotation += p.spin * dt;
    if (p.type === 'smoke' || p.type === 'dust') p.size += dt * 4.5;
  }
  sim.particles = sim.particles.filter(p => p.life > 0);
  for (const r of sim.rings) r.life -= dt;
  sim.rings = sim.rings.filter(r => r.life > 0);
}

function updateBirds(dt) {
  for (const bird of sim.birds) {
    bird.phase += dt * (bird.flying ? 13 : 4);
    if (!bird.flying) {
      bird.rest -= dt;
      let threat = null, best = 75 * 75;
      for (const car of sim.cars) {
        if (car.removed || car.parked) continue;
        const d = dist2(bird.x, bird.y, car.x, car.y);
        if (d < best && car.speed > 45) { best = d; threat = car; }
      }
      if (threat || bird.rest <= 0) {
        const angle = threat ? Math.atan2(bird.y - threat.y, bird.x - threat.x) : -Math.PI * .35 + (sim.rng() - .5) * .7;
        const speed = 75 + sim.rng() * 45;
        bird.vx = Math.cos(angle) * speed;
        bird.vy = Math.sin(angle) * speed - 15;
        bird.flying = true;
      }
    } else {
      bird.x += bird.vx * dt;
      bird.y += bird.vy * dt;
      bird.vx *= Math.exp(-dt * .08);
      bird.vy -= 1.5 * dt;
      if (bird.x < -40 || bird.x > WORLD_W + 40 || bird.y < -40 || bird.y > WORLD_H + 40) {
        bird.x = bird.homeX;
        bird.y = bird.homeY;
        bird.vx = bird.vy = 0;
        bird.flying = false;
        bird.rest = 6 + sim.rng() * 10;
      }
    }
  }
}

function updateChaos(dt) {
  if (sim.drama !== 'chaos' || sim.countdown > 0 || sim.raceTime < sim.nextIncidentAt) return;
  const candidates = sim.cars.filter(c => !c.finished && !c.retired && !c.disabled && !c.removed && c.speed > 80);
  if (candidates.length) {
    const car = candidates[Math.floor(sim.rng() * candidates.length)];
    car.incidentTimer = 1.25 + sim.rng() * .45;
    car.incidentKick = (sim.rng() < .5 ? -1 : 1) * (.72 + sim.rng() * .45);
    car.status = 'Sudden loss of grip';
    spawnRing(car.x, car.y, 16, 'SNAP!');
    for (let i = 0; i < 5; i++) spawnParticle(car.x, car.y, 'smoke');
  }
  sim.nextIncidentAt = sim.raceTime + 12 + sim.rng() * 12;
}

function updateTow(dt) {
  if (!sim.tow) {
    const target = sim.cars.find(c => c.disabled && !c.towed && !c.removed && c.disableAge > 2.8);
    if (!target) return;
    const start = sampleAtS(PIT_S);
    sim.tow = {
      x: start.x - start.nx * 61,
      y: start.y - start.ny * 61,
      heading: Math.atan2(start.ty, start.tx),
      progress: PIT_S,
      targetId: target.id,
      phase: 'dispatch',
      timer: 0,
      carried: false,
      completedLap: false
    };
    target.towed = true;
  }
  const tow = sim.tow;
  const target = sim.cars.find(c => c.id === tow.targetId);
  if (!target || target.removed) { sim.tow = null; return; }
  tow.timer += dt;

  if (tow.phase === 'dispatch') {
    let delta = mod(target.progress - tow.progress, sim.track.length);
    const advance = Math.min(delta, 170 * dt);
    tow.progress = mod(tow.progress + advance, sim.track.length);
    const p = sampleAtS(tow.progress);
    tow.x = p.x - p.nx * 58;
    tow.y = p.y - p.ny * 58;
    tow.heading = Math.atan2(p.ty, p.tx);
    if (delta < 17 || tow.timer > 19) { tow.phase = 'hook'; tow.timer = 0; }
  } else if (tow.phase === 'hook') {
    const t = smoothstep(0, 1.25, tow.timer);
    const shoulder = sampleAtS(target.progress);
    const sx = shoulder.x - shoulder.nx * 55;
    const sy = shoulder.y - shoulder.ny * 55;
    tow.x = lerp(sx, target.x, t);
    tow.y = lerp(sy, target.y, t);
    tow.heading = Math.atan2(target.y - sy, target.x - sx);
    if (tow.timer > 1.25) {
      tow.phase = 'return';
      tow.timer = 0;
      tow.progress = target.progress;
      tow.carried = true;
      target.burning = false;
    }
  } else if (tow.phase === 'return') {
    const delta = mod(PIT_S - tow.progress, sim.track.length);
    const advance = Math.min(delta, 145 * dt);
    tow.progress = mod(tow.progress + advance, sim.track.length);
    const p = sampleAtS(tow.progress);
    tow.x = p.x - p.nx * 58;
    tow.y = p.y - p.ny * 58;
    tow.heading = Math.atan2(p.ty, p.tx);
    const back = 18;
    target.x = tow.x - Math.cos(tow.heading) * back;
    target.y = tow.y - Math.sin(tow.heading) * back;
    target.heading = tow.heading;
    target.vx = target.vy = target.speed = 0;
    if (delta < 13 || tow.timer > 24) {
      target.removed = true;
      target.status = 'Recovered';
      sim.tow = null;
    }
  }
}
