// Traffic perception, passing choices, speed planning, and driver control.
'use strict';

function localTraffic(car) {
  const entries = [];
  let nearestAhead = null;
  let nearestAheadDelta = Infinity;
  for (const other of sim.cars) {
    if (other.id === car.id || other.removed || other.parked || other.finished || other.disabled) continue;
    let longitudinal = other.totalProgress - car.totalProgress;
    if (longitudinal < -sim.track.length * .5) longitudinal += sim.track.length;
    if (longitudinal > sim.track.length * .5) longitudinal -= sim.track.length;
    if (Math.abs(longitudinal) > 150) continue;
    const dx = other.x - car.x, dy = other.y - car.y;
    const distance = hypot(dx, dy);
    if (distance > 110) continue;
    const lateral = other.lateral - car.lateral;
    const rvx = other.vx - car.vx, rvy = other.vy - car.vy;
    const rv2 = rvx * rvx + rvy * rvy;
    const tca = rv2 > 1e-4 ? clamp(-dot(dx, dy, rvx, rvy) / rv2, 0, 1.35) : 0;
    const cdx = dx + rvx * tca, cdy = dy + rvy * tca;
    const dca = hypot(cdx, cdy);
    const item = { other, longitudinal, lateral, distance, tca, dca };
    entries.push(item);
    if (longitudinal > 0 && longitudinal < nearestAheadDelta && Math.abs(lateral) < 27) {
      nearestAhead = item;
      nearestAheadDelta = longitudinal;
    }
  }
  return { entries, nearestAhead, nearestAheadDelta };
}

function candidatePassScore(car, candidate, traffic, baseOffset) {
  const edgeLimit = TRACK_WIDTH * .5 - 10;
  let score = Math.abs(candidate - baseOffset) * .035;
  score += Math.max(0, Math.abs(candidate) - edgeLimit + 5) * 4;
  for (const item of traffic.entries) {
    if (item.longitudinal < -13 || item.longitudinal > 75) continue;
    const lateralGap = Math.abs(item.other.lateral - candidate);
    if (lateralGap < 16) score += (16 - lateralGap) * 3.6 + Math.max(0, 50 - item.longitudinal) * .45;
    if (item.dca < 15 && item.tca < .9) score += 55;
  }
  return score;
}

function planSpeed(car, grip, traffic) {
  const style = car.style;
  const damageEngine = clamp(1 - car.damage * .0048, .52, 1);
  let target = style.maxSpeed * car.skill * damageEngine;
  const brakeCapability = style.brake * clamp(1 - car.damage * .0022, .72, 1);
  const horizon = 190 + car.speed * .18;
  for (let d = 18; d <= horizon; d += 13) {
    const p = sampleAtS(car.progress + d);
    const k = Math.abs(p.lineCurvature ?? p.curvature);
    if (k < .00035) continue;
    const cornerGrip = grip * (car.style.key === 'momentum' ? 1.03 : 1);
    const cornerSpeed = Math.sqrt(Math.max(30, cornerGrip / k)) * style.risk * .94;
    const reachable = Math.sqrt(Math.max(0, cornerSpeed * cornerSpeed + 2 * brakeCapability * d));
    target = Math.min(target, reachable);
  }

  const ahead = traffic.nearestAhead;
  if (ahead) {
    const closing = car.forwardSpeed - ahead.other.forwardSpeed;
    const sameCorridor = Math.abs(ahead.lateral) < 16;
    const imminent = ahead.dca < 13.5 && ahead.tca < 1.0;
    if ((sameCorridor && ahead.longitudinal < 42) || imminent) {
      const buffer = 19 + Math.max(0, closing) * .45;
      const pressure = clamp((buffer + 4 - ahead.longitudinal) / Math.max(1, buffer + 4), 0, 1);
      const passing = car.passTimer > 0 && Math.abs(car.passTarget - ahead.other.lateral) > 17;
      if (!passing || imminent) {
        target = Math.min(target, Math.max(34, ahead.other.speed - pressure * (58 + closing * .85)));
      }
    }
  }

  if (car.offTrackNow) target = Math.min(target, 92);
  if (car.recovering) target = Math.min(target, 70);
  if (car.slickTimer > 0) target = Math.min(target, 130);
  return Math.max(38, target);
}

function updateCarProgress(car, dt = FIXED_DT, accumulate = true) {
  const info = nearestTrackInfo(car);
  car.trackIdx = info.idx;
  car.lateral = info.lateral;
  const previousWrapped = car.progress;
  let progressDelta = info.sample.s - previousWrapped;
  if (progressDelta < -sim.track.length * .5) progressDelta += sim.track.length;
  if (progressDelta > sim.track.length * .5) progressDelta -= sim.track.length;

  if (accumulate && !car.disabled && !car.finished) {
    const tangentSpeed = dot(car.vx, car.vy, info.sample.tx, info.sample.ty);
    const physicallyPossible = Math.max(2.6, Math.abs(tangentSpeed) * dt * 1.75 + .8);
    progressDelta = clamp(progressDelta, -physicallyPossible, physicallyPossible);
    // Do not award forward race distance while a spinning car is actually travelling backward.
    if (tangentSpeed < -4 && progressDelta > 0) progressDelta *= .15;
    car.totalProgress += progressDelta;
  }
  car.progress = info.sample.s;
  car.lap = Math.max(0, Math.floor(Math.max(0, car.totalProgress) / sim.track.length));
  car.currentCurvature = info.sample.curvature;
  car.recovering = info.distance > TRACK_WIDTH * .72;

  if (!accumulate) return;
  if (!car.hasStarted && car.totalProgress >= 0) {
    car.hasStarted = true;
    car.lapStart = sim.raceTime;
  }
  while (car.hasStarted && car.totalProgress >= car.nextLapMark && !car.finished && !car.retired) {
    const lapTime = sim.raceTime - car.lapStart;
    car.lastLap = lapTime;
    car.bestLap = Math.min(car.bestLap, lapTime);
    car.lapStart = sim.raceTime;
    car.nextLapMark += sim.track.length;
  }
  if (car.totalProgress >= sim.laps * sim.track.length && !car.finished && !car.retired) {
    car.finished = true;
    car.finishTime = sim.raceTime;
    car.finishPosition = sim.finishOrder.length + 1;
    car.finishAge = 0;
    sim.finishOrder.push(car);
    car.status = 'Finished — peeling into pits';
  }
}

function updateFinishedCar(car, dt) {
  car.finishAge += dt;
  if (car.parked) return;
  const pitBase = sampleAtS(PIT_S);
  const slot = (car.finishPosition || 1) - 1;
  const pitX = pitBase.x - pitBase.nx * (69 + Math.floor(slot / 5) * 12) + pitBase.tx * ((slot % 5) * 17 - 34);
  const pitY = pitBase.y - pitBase.ny * (69 + Math.floor(slot / 5) * 12) + pitBase.ty * ((slot % 5) * 17 - 34);
  const dx = pitX - car.x, dy = pitY - car.y;
  const distance = hypot(dx, dy);
  const desiredHeading = Math.atan2(dy, dx);
  const headingError = normalizeAngle(desiredHeading - car.heading);
  const targetSpeed = Math.min(85, Math.max(26, distance * 1.4));
  const speedError = targetSpeed - car.speed;
  car.throttle = clamp(speedError / 35, 0, 1);
  car.brake = clamp(-speedError / 35, 0, 1);
  const maxSteer = car.speed < 55 ? .95 : .62;
  car.steer = lerp(car.steer, clamp(headingError * 1.5, -maxSteer, maxSteer), clamp(dt * 8, 0, 1));
  integratePhysics(car, dt, 1, false);
  if (distance < 11 || car.finishAge > 5.5) {
    car.x = pitX; car.y = pitY; car.vx = 0; car.vy = 0; car.speed = 0;
    car.heading = Math.atan2(pitBase.ty, pitBase.tx);
    car.parked = true;
    car.status = 'Parked in pits';
  }
}

function updateDisabledCar(car, dt) {
  car.disableAge += dt;
  car.throttle = 0;
  car.brake = car.speed > 10 ? .35 : .7;
  car.steer *= Math.exp(-dt * 2.5);
  integratePhysics(car, dt, .72, true);
  if (!car.burning && car.disableAge > car.fireDelay) {
    car.burning = true;
    spawnRing(car.x, car.y, 20, 'FIRE!');
  }
  if (car.burning && car.rng() < dt * 18) {
    spawnParticle(car.x - Math.cos(car.heading) * 4, car.y - Math.sin(car.heading) * 4, 'fire');
    spawnParticle(car.x, car.y, 'smoke');
  } else if (car.rng() < dt * 5) {
    spawnParticle(car.x, car.y, 'smoke');
  }
}

function updateCar(car, dt) {
  if (car.removed || car.parked) return;
  car.collisionCooldown = Math.max(0, car.collisionCooldown - dt);
  car.passTimer = Math.max(0, car.passTimer - dt);
  car.slickTimer = Math.max(0, car.slickTimer - dt);
  car.incidentTimer = Math.max(0, car.incidentTimer - dt);

  if (car.finished) {
    updateFinishedCar(car, dt);
    return;
  }
  updateCarProgress(car, dt, false);
  if (car.disabled) {
    updateDisabledCar(car, dt);
    return;
  }

  const offTrack = Math.abs(car.lateral) > TRACK_WIDTH * .50;
  if (offTrack && !car.offTrackNow) car.offTracks++;
  car.offTrackNow = offTrack;

  const traffic = localTraffic(car);
  const style = car.style;
  const edgeLimit = TRACK_WIDTH * .5 - 10;
  const lookAhead = clamp(24 + car.speed * .26 + style.lookAhead, 24, 96);
  const targetTrack = sampleAtS(car.progress + lookAhead);
  let desiredOffset = targetTrack.raceOffset + style.lineBias;

  // Hold the staggered grid just long enough to prevent the start from collapsing into one point.
  const startHold = 1 - smoothstep(.4, 5.2, sim.raceTime);
  desiredOffset = lerp(desiredOffset, car.gridOffset, startHold * .88);

  const ahead = traffic.nearestAhead;
  if (ahead) {
    const closing = car.forwardSpeed - ahead.other.forwardSpeed;
    if (ahead.longitudinal < 78 && closing > -3) car.stuckTimer += dt;
    else car.stuckTimer = Math.max(0, car.stuckTimer - dt * 2);

    const passGeometry = Math.abs(targetTrack.lineCurvature ?? targetTrack.curvature) < .0034
      && Math.abs(sampleAtS(car.progress + 72).lineCurvature ?? 0) < .0042;
    if ((closing > 4 || car.stuckTimer > .75) && ahead.longitudinal < 72 && car.passTimer <= 0 && passGeometry) {
      const separation = 21 + style.aggression * 6;
      const left = clamp(ahead.other.lateral + separation, -edgeLimit, edgeLimit);
      const right = clamp(ahead.other.lateral - separation, -edgeLimit, edgeLimit);
      const leftScore = candidatePassScore(car, left, traffic, desiredOffset);
      const rightScore = candidatePassScore(car, right, traffic, desiredOffset);
      car.passTarget = leftScore <= rightScore ? left : right;
      car.passTimer = 1.15 + style.aggression * 1.05 + car.rng() * .35;
    }
  } else {
    car.stuckTimer = Math.max(0, car.stuckTimer - dt * 2.5);
  }

  const inSharpSection = Math.abs(targetTrack.lineCurvature ?? targetTrack.curvature) > .0044;
  if (inSharpSection && car.passTimer > 0) car.passTimer = Math.max(0, car.passTimer - dt * 3.2);
  if (car.passTimer > 0 && Number.isFinite(car.passTarget)) {
    const passBlend = inSharpSection ? .28 : .82;
    desiredOffset = lerp(desiredOffset, car.passTarget, passBlend);
    car.status = ahead ? `Passing ${ahead.other.name.split(' ')[0]}` : 'Completing pass';
  }

  let avoidance = 0;
  let urgentBrake = 0;
  for (const item of traffic.entries) {
    const other = item.other;
    const startFactor = sim.raceTime < 7 ? 1.45 : 1;
    const predictedDanger = item.tca < 1.05 && item.dca < 15.5;
    const closeNow = item.distance < 22;
    if (!predictedDanger && !closeNow) continue;
    let side = Math.sign(car.lateral - other.lateral);
    if (side === 0) side = ((car.id + other.id) & 1) ? 1 : -1;
    const strength = startFactor * clamp((18.5 - item.dca) / 12.5, 0, 1) * clamp((1.25 - item.tca) / 1.25, .18, 1);
    avoidance += side * strength * 31;
    if (item.longitudinal > -4 && item.longitudinal < 38) urgentBrake = Math.max(urgentBrake, strength);
  }
  desiredOffset += clamp(avoidance, -29, 29);

  if (offTrack || car.recovering) {
    desiredOffset = clamp(targetTrack.raceOffset * .45, -12, 12);
    car.passTimer = 0;
    car.status = 'Recovering';
  } else if (car.passTimer <= 0) {
    car.status = Math.abs(targetTrack.curvature) > .0023 ? 'Attacking corner' : 'Pushing';
  }
  desiredOffset = clamp(desiredOffset, -edgeLimit, edgeLimit);
  car.targetLateral = desiredOffset;

  const targetX = targetTrack.x + targetTrack.nx * desiredOffset;
  const targetY = targetTrack.y + targetTrack.ny * desiredOffset;
  const dx = targetX - car.x, dy = targetY - car.y;
  const c = Math.cos(car.heading), s = Math.sin(car.heading);
  const localX = c * dx + s * dy;
  const localY = -s * dx + c * dy;
  const targetDistance2 = Math.max(80, localX * localX + localY * localY);
  const pursuitCurvature = 2 * localY / targetDistance2;
  const desiredHeading = Math.atan2(dy, dx);
  const headingError = normalizeAngle(desiredHeading - car.heading);
  const headingCorrection = headingError * lerp(.34, .10, smoothstep(30, 175, car.speed));
  let desiredSteer = Math.atan(WHEELBASE * pursuitCurvature) * style.steerGain + headingCorrection;
  if (car.incidentTimer > 0) desiredSteer += car.incidentKick * (car.incidentTimer / 1.5);
  const lowSpeedSteer = lerp(1.02, .38, smoothstep(24, 170, car.speed));
  desiredSteer = clamp(desiredSteer, -lowSpeedSteer, lowSpeedSteer);
  car.steer = lerp(car.steer, desiredSteer, clamp(style.steerResponse * dt, 0, 1));

  let surfaceGrip = offTrack ? .46 : 1;
  for (const slick of sim.slicks) {
    const d2 = dist2(car.x, car.y, slick.x, slick.y);
    if (d2 < slick.radius * slick.radius) {
      if (car.slickTimer <= 0) {
        spawnRing(car.x, car.y, 11, 'SLICK!');
        car.angularVel += (car.rng() < .5 ? -1 : 1) * (.8 + car.speed * .003);
      }
      car.slickTimer = .68;
    }
  }
  if (car.slickTimer > 0) surfaceGrip *= .38;
  if (car.incidentTimer > 0) surfaceGrip *= .48;
  surfaceGrip *= clamp(1 - car.damage * .004, .55, 1);

  const baseGrip = style.grip * car.skill * surfaceGrip;
  car.targetSpeed = planSpeed(car, baseGrip, traffic);
  if (urgentBrake > 0) car.targetSpeed = Math.min(car.targetSpeed, Math.max(38, car.speed * (1 - urgentBrake * .48)));

  const speedError = car.targetSpeed - car.speed;
  car.throttle = clamp(speedError / 31, 0, 1);
  car.brake = clamp(-speedError / 34, 0, 1);
  if (sim.countdown > 0) { car.throttle = 0; car.brake = .68; }
  integratePhysics(car, dt, surfaceGrip, false);
  updateCarProgress(car, dt, true);
}
