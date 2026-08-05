// Track construction, interpolation, curvature, and nearest-point queries.
'use strict';

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    y: 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
  };
}

function circularAverage(values, index, radius) {
  let sum = 0;
  let weight = 0;
  for (let o = -radius; o <= radius; o++) {
    const w = radius + 1 - Math.abs(o);
    sum += values[mod(index + o, values.length)] * w;
    weight += w;
  }
  return sum / Math.max(1, weight);
}

function buildTrack(def) {
  const control = def.points;
  const rough = [];
  const perSegment = 70;
  for (let i = 0; i < control.length; i++) {
    const p0 = control[mod(i - 1, control.length)];
    const p1 = control[i];
    const p2 = control[(i + 1) % control.length];
    const p3 = control[(i + 2) % control.length];
    for (let j = 0; j < perSegment; j++) rough.push(catmullRom(p0, p1, p2, p3, j / perSegment));
  }

  let roughLength = 0;
  for (let i = 0; i < rough.length; i++) {
    const next = rough[(i + 1) % rough.length];
    roughLength += hypot(next.x - rough[i].x, next.y - rough[i].y);
  }

  const sampleCount = 960;
  const targetStep = roughLength / sampleCount;
  const samples = [];
  let seg = 0;
  let cur = { ...rough[0] };
  let remain = 0;
  let cumulative = 0;
  samples.push({ x: cur.x, y: cur.y, s: 0 });
  let guard = 0;
  while (samples.length < sampleCount && guard++ < rough.length * 20) {
    const next = rough[(seg + 1) % rough.length];
    const dx = next.x - cur.x;
    const dy = next.y - cur.y;
    const len = hypot(dx, dy);
    if (len + remain >= targetStep && len > 1e-8) {
      const need = targetStep - remain;
      const f = need / len;
      cur = { x: cur.x + dx * f, y: cur.y + dy * f };
      cumulative += targetStep;
      samples.push({ x: cur.x, y: cur.y, s: cumulative });
      remain = 0;
    } else {
      remain += len;
      cur = { ...next };
      seg = (seg + 1) % rough.length;
    }
  }

  const exactTotal = cumulative + hypot(samples[0].x - samples[samples.length - 1].x, samples[0].y - samples[samples.length - 1].y);
  const rawCurvature = new Array(samples.length).fill(0);
  for (let i = 0; i < samples.length; i++) {
    const prev = samples[mod(i - 2, samples.length)];
    const next = samples[(i + 2) % samples.length];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const tangentLen = hypot(dx, dy) || 1;
    samples[i].tx = dx / tangentLen;
    samples[i].ty = dy / tangentLen;
    samples[i].nx = -samples[i].ty;
    samples[i].ny = samples[i].tx;

    const a = samples[mod(i - 4, samples.length)];
    const b = samples[i];
    const c = samples[(i + 4) % samples.length];
    const abx = b.x - a.x, aby = b.y - a.y;
    const bcx = c.x - b.x, bcy = c.y - b.y;
    const cross = abx * bcy - aby * bcx;
    const denom = Math.max(1, hypot(abx, aby) * hypot(bcx, bcy) * hypot(c.x - a.x, c.y - a.y));
    rawCurvature[i] = (2 * cross) / denom;
  }

  const smoothCurvature = rawCurvature.map((_, i) => circularAverage(rawCurvature, i, 7));
  const rawOffsets = smoothCurvature.map((kNow, i) => {
    const kAhead = circularAverage(smoothCurvature, i + 28, 8);
    const kFar = circularAverage(smoothCurvature, i + 48, 8);
    const kBehind = circularAverage(smoothCurvature, i - 24, 8);
    const now = Math.tanh(kNow * 720);
    const ahead = Math.tanh(kAhead * 720);
    const far = Math.tanh(kFar * 680);
    const behind = Math.tanh(kBehind * 680);
    // Positive curvature turns left and positive normal is the inside of that turn.
    // The future/past terms put the car outside before and after the apex.
    return clamp(23.5 * (1.08 * now - .44 * ahead - .22 * far - .34 * behind), -26, 26);
  });
  let offsets = rawOffsets;
  for (let pass = 0; pass < 7; pass++) offsets = offsets.map((_, i) => circularAverage(offsets, i, 9));

  for (let i = 0; i < samples.length; i++) {
    samples[i].curvature = smoothCurvature[i];
    samples[i].raceOffset = clamp(offsets[i], -26, 26);
    samples[i].idx = i;
  }
  // Curvature of the actual target path, not merely the centerline. This is what the speed planner must respect.
  const lineCurvature = new Array(samples.length).fill(0);
  for (let i = 0; i < samples.length; i++) {
    const a = samples[mod(i - 4, samples.length)];
    const b = samples[i];
    const c = samples[(i + 4) % samples.length];
    const ax = a.x + a.nx * a.raceOffset, ay = a.y + a.ny * a.raceOffset;
    const bx = b.x + b.nx * b.raceOffset, by = b.y + b.ny * b.raceOffset;
    const cx = c.x + c.nx * c.raceOffset, cy = c.y + c.ny * c.raceOffset;
    const abx = bx - ax, aby = by - ay;
    const bcx = cx - bx, bcy = cy - by;
    const cross = abx * bcy - aby * bcx;
    const denom = Math.max(1, hypot(abx, aby) * hypot(bcx, bcy) * hypot(cx - ax, cy - ay));
    lineCurvature[i] = (2 * cross) / denom;
  }
  const smoothLineCurvature = lineCurvature.map((_, i) => circularAverage(lineCurvature, i, 6));
  for (let i = 0; i < samples.length; i++) samples[i].lineCurvature = smoothLineCurvature[i];
  return { name: def.name, samples, length: exactTotal, step: exactTotal / samples.length };
}

function sampleAtS(s) {
  const track = sim.track;
  const wrapped = mod(s, track.length);
  const idxFloat = wrapped / track.step;
  const i = Math.floor(idxFloat) % track.samples.length;
  const t = idxFloat - Math.floor(idxFloat);
  const a = track.samples[i];
  const b = track.samples[(i + 1) % track.samples.length];
  const tx = lerp(a.tx, b.tx, t), ty = lerp(a.ty, b.ty, t);
  const tl = hypot(tx, ty) || 1;
  const nx = lerp(a.nx, b.nx, t), ny = lerp(a.ny, b.ny, t);
  const nl = hypot(nx, ny) || 1;
  return {
    x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t),
    tx: tx / tl, ty: ty / tl,
    nx: nx / nl, ny: ny / nl,
    curvature: lerp(a.curvature, b.curvature, t),
    lineCurvature: lerp(a.lineCurvature, b.lineCurvature, t),
    raceOffset: lerp(a.raceOffset, b.raceOffset, t),
    idx: i, s: wrapped
  };
}

function nearestTrackInfo(car) {
  const samples = sim.track.samples;
  let bestIdx = car.trackIdx ?? 0;
  let bestD = Infinity;
  const radius = car.recovering || car.disabled ? 105 : 45;
  for (let o = -radius; o <= radius; o++) {
    const idx = mod(bestIdx + o, samples.length);
    const p = samples[idx];
    const d = dist2(car.x, car.y, p.x, p.y);
    if (d < bestD) { bestD = d; bestIdx = idx; }
  }
  const p = samples[bestIdx];
  const dx = car.x - p.x, dy = car.y - p.y;
  return { idx: bestIdx, sample: p, lateral: dx * p.nx + dy * p.ny, distance: Math.sqrt(bestD) };
}
