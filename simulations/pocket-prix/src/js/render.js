// Canvas scene construction and dynamic rendering.
'use strict';

function drawPath(context, samples, offset = 0, useRaceOffset = false) {
  context.beginPath();
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i];
    const off = useRaceOffset ? p.raceOffset : offset;
    const x = p.x + p.nx * off;
    const y = p.y + p.ny * off;
    if (i === 0) context.moveTo(x, y); else context.lineTo(x, y);
  }
  context.closePath();
}

function buildStaticScene() {
  const g = sctx;
  g.clearRect(0, 0, WORLD_W, WORLD_H);
  const bg = g.createLinearGradient(0, 0, WORLD_W, WORLD_H);
  bg.addColorStop(0, '#173d28');
  bg.addColorStop(.55, '#1e4a2d');
  bg.addColorStop(1, '#123622');
  g.fillStyle = bg;
  g.fillRect(0, 0, WORLD_W, WORLD_H);

  const rng = mulberry32(sim.seed + 404);
  g.globalAlpha = .18;
  for (let i = 0; i < 1500; i++) {
    const x = rng() * WORLD_W, y = rng() * WORLD_H;
    const r = .5 + rng() * 1.4;
    g.fillStyle = rng() > .5 ? '#95d36b' : '#0b2518';
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;

  for (const item of sim.scenery) drawSceneryItem(g, item);

  const samples = sim.track.samples;
  g.save();
  g.lineJoin = 'round'; g.lineCap = 'round';
  drawPath(g, samples);
  g.strokeStyle = 'rgba(4,10,8,.58)'; g.lineWidth = TRACK_WIDTH + 22; g.stroke();
  drawPath(g, samples);
  g.strokeStyle = '#c4c8c6'; g.lineWidth = TRACK_WIDTH + 10; g.stroke();
  drawPath(g, samples);
  const asphalt = g.createLinearGradient(0, 0, WORLD_W, WORLD_H);
  asphalt.addColorStop(0, '#333a3a'); asphalt.addColorStop(.5, '#262d2d'); asphalt.addColorStop(1, '#383f3f');
  g.strokeStyle = asphalt; g.lineWidth = TRACK_WIDTH; g.stroke();

  g.globalAlpha = .16;
  drawPath(g, samples);
  g.strokeStyle = '#ffffff'; g.lineWidth = 1.2; g.setLineDash([2, 9]); g.stroke();
  g.setLineDash([]); g.globalAlpha = 1;

  drawCurbs(g, samples, TRACK_WIDTH * .5 + 2);
  drawCurbs(g, samples, -TRACK_WIDTH * .5 - 2);
  drawStartLine(g);
  drawPitDecor(g);
  g.restore();
}

function drawSceneryItem(g, item) {
  const { x, y, size, type } = item;
  if (type === 'tree') {
    g.fillStyle = 'rgba(0,0,0,.20)'; g.beginPath(); g.ellipse(x + 3, y + 5, size * .9, size * .55, .3, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#183923'; g.beginPath(); g.arc(x, y, size, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2f6a38'; g.beginPath(); g.arc(x - size * .25, y - size * .25, size * .62, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4d8b4d'; g.beginPath(); g.arc(x + size * .25, y - size * .15, size * .42, 0, Math.PI * 2); g.fill();
  } else if (type === 'bush') {
    g.fillStyle = '#255b33'; g.beginPath(); g.arc(x, y, size * .65, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4d8b4d'; g.beginPath(); g.arc(x - 2, y - 2, size * .35, 0, Math.PI * 2); g.fill();
  } else {
    g.save(); g.translate(x, y); g.rotate(-.18);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(-size * .8 + 3, -size * .45 + 4, size * 1.6, size * .9);
    g.fillStyle = '#efe5c9'; g.fillRect(-size * .8, -size * .45, size * 1.6, size * .9);
    g.fillStyle = '#ff6b6b'; g.fillRect(-size * .8, -size * .45, size * .8, size * .9);
    g.restore();
  }
}

function drawCurbs(g, samples, offset) {
  const segment = 8;
  for (let i = 0; i < samples.length; i += segment) {
    const a = samples[i];
    const b = samples[(i + segment) % samples.length];
    g.beginPath();
    g.moveTo(a.x + a.nx * offset, a.y + a.ny * offset);
    g.lineTo(b.x + b.nx * offset, b.y + b.ny * offset);
    g.strokeStyle = (Math.floor(i / segment) % 2 === 0) ? '#f4efe8' : '#e84a4a';
    g.lineWidth = 7; g.stroke();
  }
}

function drawStartLine(g) {
  const p = sampleAtS(0);
  const angle = Math.atan2(p.ty, p.tx);
  g.save(); g.translate(p.x, p.y); g.rotate(angle);
  const tile = 7;
  for (let r = -6; r <= 5; r++) {
    for (let c = -1; c <= 1; c++) {
      g.fillStyle = (r + c) % 2 === 0 ? '#f8f8f8' : '#171717';
      g.fillRect(c * tile, r * tile, tile, tile);
    }
  }
  g.restore();
}

function drawPitDecor(g) {
  const p = sampleAtS(PIT_S);
  g.save(); g.translate(p.x - p.nx * 72, p.y - p.ny * 72); g.rotate(Math.atan2(p.ty, p.tx));
  g.fillStyle = 'rgba(7,12,10,.35)'; g.fillRect(-50, -18, 106, 42);
  g.fillStyle = '#d8ddd8'; g.fillRect(-52, -24, 104, 35);
  for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#ff6b6b' : '#ffd166'; g.fillRect(-46 + i * 20, -19, 14, 10); }
  g.fillStyle = '#202827'; g.fillRect(-48, 7, 96, 5);
  g.restore();
}

function drawDynamicTrackDetails() {
  drawSlicks();
  drawSkidMarks();
  if (sim.showLine) {
    ctx.save();
    ctx.globalAlpha = .72;
    ctx.setLineDash([7, 8]);
    drawPath(ctx, sim.track.samples, 0, true);
    ctx.strokeStyle = '#8cffbf'; ctx.lineWidth = 2.2; ctx.stroke();
    ctx.setLineDash([]); ctx.restore();
  }
}

function drawSlicks() {
  for (const slick of sim.slicks) {
    ctx.save();
    ctx.translate(slick.x, slick.y);
    ctx.rotate(slick.phase);
    const grad = ctx.createRadialGradient(-3, -3, 1, 0, 0, slick.radius);
    grad.addColorStop(0, 'rgba(10,12,13,.82)');
    grad.addColorStop(.65, 'rgba(4,7,8,.66)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.ellipse(0, 0, slick.radius * 1.2, slick.radius * .68, .2, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = .38;
    ctx.strokeStyle = '#72ddf7'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(-2, -1, slick.radius * .42, .2, 2.3); ctx.stroke();
    ctx.strokeStyle = '#c77dff';
    ctx.beginPath(); ctx.arc(3, 1, slick.radius * .58, 3.0, 5.4); ctx.stroke();
    ctx.restore();
  }
}

function drawSkidMarks() {
  if (!sim.skidMarks.length) return;
  ctx.save();
  ctx.lineCap = 'round';
  for (const mark of sim.skidMarks) {
    ctx.globalAlpha = mark.a;
    ctx.strokeStyle = '#050606';
    ctx.lineWidth = mark.w;
    ctx.beginPath(); ctx.moveTo(mark.x1, mark.y1); ctx.lineTo(mark.x2, mark.y2); ctx.stroke();
  }
  ctx.restore();
}

function drawTrails() {
  if (!sim.showTrails) return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const car of sim.cars) {
    if (car.trail.length < 2 || car.removed) continue;
    ctx.beginPath();
    car.trail.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
    ctx.globalAlpha = car.id === sim.selectedId ? .30 : .11;
    ctx.strokeStyle = car.color; ctx.lineWidth = car.id === sim.selectedId ? 3 : 1.4; ctx.stroke();
  }
  ctx.restore();
}

function drawParticlesBehindCars() {
  for (const p of sim.particles) {
    if (p.type === 'spark' || p.type === 'fire') continue;
    const a = clamp(p.life / p.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = p.type === 'debris' ? Math.min(1, a * 2) : a * .55;
    ctx.translate(p.x, p.y);
    if (p.type === 'debris') {
      ctx.rotate(p.rotation || 0);
      ctx.fillStyle = '#1c2321';
      ctx.fillRect(-p.size * .65, -p.size * .28, p.size * 1.3, p.size * .56);
    } else {
      ctx.fillStyle = p.type === 'dust' ? '#b9a47d' : '#b7c0bd';
      ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

function drawParticlesFront() {
  for (const p of sim.particles) {
    if (p.type !== 'spark' && p.type !== 'fire') continue;
    const a = clamp(p.life / p.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(p.x, p.y);
    if (p.type === 'spark') {
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-p.vx * .025, -p.vy * .025); ctx.stroke();
    } else {
      ctx.fillStyle = a > .45 ? '#ffd166' : '#ff6b3d';
      ctx.beginPath(); ctx.arc(0, 0, p.size * a + 1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

function drawRings() {
  for (const r of sim.rings) {
    const t = 1 - r.life / r.maxLife;
    ctx.save();
    ctx.globalAlpha = (1 - t) * .85;
    ctx.strokeStyle = r.strength > 35 ? '#ffb45e' : '#ffffff';
    ctx.lineWidth = 2.5 * (1 - t) + .5;
    ctx.beginPath(); ctx.arc(r.x, r.y, 6 + t * (18 + r.strength * .18), 0, Math.PI * 2); ctx.stroke();
    if (r.label) {
      ctx.fillStyle = '#fff';
      ctx.font = '950 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(r.label, r.x, r.y - 13 - t * 18);
    }
    ctx.restore();
  }
}

function drawBirds() {
  ctx.save();
  ctx.strokeStyle = 'rgba(10,18,14,.78)';
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  for (const bird of sim.birds) {
    ctx.save(); ctx.translate(bird.x, bird.y);
    if (bird.flying) {
      const flap = Math.sin(bird.phase) * 3.2;
      const angle = Math.atan2(bird.vy, bird.vx);
      ctx.rotate(angle);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-5, -2 - flap); ctx.moveTo(0, 0); ctx.lineTo(-5, 2 + flap); ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(15,24,19,.70)';
      ctx.beginPath(); ctx.arc(0, 0, 1.7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawCar(car) {
  if (car.removed) return;
  const selected = car.id === sim.selectedId;
  const hovered = car.id === sim.hoveredId;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.heading);
  if (selected || hovered) {
    ctx.strokeStyle = selected ? '#ffffff' : 'rgba(255,255,255,.65)';
    ctx.lineWidth = selected ? 2.2 : 1.2;
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = car.parked ? .72 : 1;
  ctx.fillStyle = 'rgba(0,0,0,.30)';
  roundRect(ctx, -CAR_LENGTH * .5 + 2, -CAR_WIDTH * .5 + 2, CAR_LENGTH, CAR_WIDTH, 3); ctx.fill();

  const damageDark = clamp(car.damage / 100, 0, .56);
  ctx.fillStyle = car.color;
  roundRect(ctx, -CAR_LENGTH * .5, -CAR_WIDTH * .5, CAR_LENGTH, CAR_WIDTH, 3.2); ctx.fill();
  if (damageDark > 0) {
    ctx.fillStyle = `rgba(5,7,7,${damageDark})`;
    roundRect(ctx, -CAR_LENGTH * .5, -CAR_WIDTH * .5, CAR_LENGTH, CAR_WIDTH, 3.2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,.28)';
  roundRect(ctx, 1, -CAR_WIDTH * .38, 5.8, CAR_WIDTH * .76, 2); ctx.fill();
  ctx.fillStyle = '#121a19';
  roundRect(ctx, -2.5, -CAR_WIDTH * .32, 5.2, CAR_WIDTH * .64, 2); ctx.fill();
  ctx.fillStyle = car.style.color;
  ctx.beginPath(); ctx.arc(-.3, 0, 2.15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillRect(-6.7, -CAR_WIDTH * .62, 5, 1.7); ctx.fillRect(-6.7, CAR_WIDTH * .45, 5, 1.7);
  ctx.fillRect(3.7, -CAR_WIDTH * .62, 4, 1.7); ctx.fillRect(3.7, CAR_WIDTH * .45, 4, 1.7);
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(6.8, -3.1, 1.5, 2); ctx.fillRect(6.8, 1.1, 1.5, 2);
  if (car.brake > .15) { ctx.fillStyle = '#ff3b3b'; ctx.fillRect(-9.4, -3, 1.4, 2); ctx.fillRect(-9.4, 1, 1.4, 2); }
  if (car.disabled) {
    ctx.fillStyle = '#ffb45e';
    ctx.beginPath(); ctx.arc(-5.5, 0, 1.8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  if (sim.showNames || selected || car.disabled) {
    ctx.save();
    ctx.font = selected ? '800 11px Inter, sans-serif' : '700 9px Inter, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    const label = car.disabled ? `${car.name.split(' ')[0]} DNF` : car.name.split(' ')[0];
    const w = ctx.measureText(label).width + 9;
    ctx.fillStyle = car.disabled ? 'rgba(84,20,15,.84)' : 'rgba(5,12,9,.72)';
    roundRect(ctx, car.x - w / 2, car.y - 20, w, 15, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(label, car.x, car.y - 8);
    ctx.restore();
  }
}

function drawTowTruck() {
  const tow = sim.tow;
  if (!tow) return;
  ctx.save();
  ctx.translate(tow.x, tow.y);
  ctx.rotate(tow.heading);
  ctx.fillStyle = 'rgba(0,0,0,.32)';
  roundRect(ctx, -12 + 2, -6 + 2, 24, 12, 3); ctx.fill();
  ctx.fillStyle = '#ffd43b';
  roundRect(ctx, -12, -6, 24, 12, 3); ctx.fill();
  ctx.fillStyle = '#263230'; ctx.fillRect(1, -5, 7, 10);
  ctx.fillStyle = '#ff5d73'; ctx.beginPath(); ctx.arc(-3, 0, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111'; ctx.fillRect(-9, -7, 5, 2); ctx.fillRect(4, -7, 5, 2); ctx.fillRect(-9, 5, 5, 2); ctx.fillRect(4, 5, 5, 2);
  ctx.restore();
  const target = sim.cars.find(c => c.id === tow.targetId);
  if (target && tow.carried) {
    ctx.save(); ctx.strokeStyle = '#d9d9d9'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(tow.x, tow.y); ctx.lineTo(target.x, target.y); ctx.stroke(); ctx.restore();
  }
}

function roundRect(c, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  c.beginPath(); c.roundRect(x, y, w, h, rr);
}

function drawCountdown() {
  if (!sim.running || sim.countdown <= 0) return;
  const n = Math.ceil(sim.countdown);
  ctx.save();
  ctx.fillStyle = 'rgba(5,12,9,.28)'; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '950 104px Inter, sans-serif';
  ctx.fillStyle = n === 1 ? '#8cffbf' : '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 30;
  ctx.fillText(n > 0 ? n : 'GO', WORLD_W / 2, WORLD_H / 2);
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, WORLD_W, WORLD_H);
  ctx.save();
  if (sim.cameraShake > .05) ctx.translate((sim.rng() - .5) * sim.cameraShake, (sim.rng() - .5) * sim.cameraShake);
  ctx.drawImage(staticCanvas, 0, 0);
  drawDynamicTrackDetails();
  drawTrails();
  drawParticlesBehindCars();
  drawBirds();
  const ordered = [...sim.cars].sort((a, b) => a.y - b.y);
  for (const car of ordered) drawCar(car);
  drawTowTruck();
  drawParticlesFront();
  drawRings();
  ctx.restore();
  drawCountdown();
}
