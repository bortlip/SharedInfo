// Vehicle integration, grip, skid marks, collision detection, and damage.
'use strict';

function integratePhysics(car, dt, surfaceGrip, disabledMode) {
  car.prevX = car.x;
  car.prevY = car.y;
  const style = car.style;
  const c = Math.cos(car.heading), s = Math.sin(car.heading);
  const fx = c, fy = s;
  const lx = -s, ly = c;
  let forwardSpeed = dot(car.vx, car.vy, fx, fy);
  let lateralSpeed = dot(car.vx, car.vy, lx, ly);
  const speed = hypot(car.vx, car.vy);
  car.speed = speed;
  car.forwardSpeed = forwardSpeed;
  car.lateralSpeed = lateralSpeed;
  car.slipAngle = speed > 3 ? normalizeAngle(Math.atan2(car.vy, car.vx) - car.heading) : 0;

  const engineHealth = clamp(1 - car.damage * .006, .38, 1);
  const brakeHealth = clamp(1 - car.damage * .002, .76, 1);
  const maxGripAccel = style.grip * car.skill * surfaceGrip * clamp(1 - car.brake * .22, .55, 1);
  const requestedEngine = disabledMode ? 0 : car.throttle * style.accel * engineHealth;
  const tractionLimit = maxGripAccel * (.60 + .15 * smoothstep(20, 90, speed));
  const actualEngine = Math.min(requestedEngine, tractionLimit);
  const wheelspin = Math.max(0, requestedEngine - actualEngine);

  let ax = fx * actualEngine;
  let ay = fy * actualEngine;
  if (speed > .2) {
    const brakeAccel = car.brake * style.brake * brakeHealth;
    ax -= car.vx / speed * brakeAccel;
    ay -= car.vy / speed * brakeAccel;
    const drag = .00135 * speed * speed + (car.offTrackNow ? 9 : 1.5);
    ax -= car.vx / speed * drag;
    ay -= car.vy / speed * drag;
  }

  const desiredLateralAccel = -lateralSpeed * (8.5 + speed * .018);
  const lateralAccel = clamp(desiredLateralAccel, -maxGripAccel, maxGripAccel);
  ax += lx * lateralAccel;
  ay += ly * lateralAccel;
  car.gripRatio = Math.abs(desiredLateralAccel) < 1 ? 1 : clamp(maxGripAccel / Math.abs(desiredLateralAccel), 0, 1);

  const theoreticalYaw = Math.abs(forwardSpeed) > 1 ? forwardSpeed / WHEELBASE * Math.tan(car.steer) : 0;
  const maxYawFromGrip = maxGripAccel / Math.max(22, Math.abs(forwardSpeed));
  let yawTarget = clamp(theoreticalYaw, -maxYawFromGrip, maxYawFromGrip);
  if (car.damage > 55) yawTarget += Math.sin(sim.raceTime * 5 + car.id) * (car.damage - 55) * .0009;
  car.angularVel += (yawTarget - car.angularVel) * clamp(dt * (5.4 + surfaceGrip * 2.5), 0, 1);
  if (car.incidentTimer > 0) car.angularVel += car.incidentKick * dt * 1.8;
  car.angularVel *= Math.exp(-dt * (disabledMode ? 1.7 : .28));

  car.vx += ax * dt;
  car.vy += ay * dt;
  const maxSpeed = style.maxSpeed * 1.12;
  const newSpeed = hypot(car.vx, car.vy);
  if (newSpeed > maxSpeed) {
    car.vx *= maxSpeed / newSpeed;
    car.vy *= maxSpeed / newSpeed;
  }
  car.heading = normalizeAngle(car.heading + car.angularVel * dt);
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.speed = hypot(car.vx, car.vy);

  const skidding = car.gripRatio < .50 && Math.abs(lateralSpeed) > 13.5 && speed > 64;
  const brakeLock = car.brake > .94 && speed > 108;
  const burnout = wheelspin > 6 && speed < 55 && car.throttle > .75;
  updateSkidMarks(car, dt, skidding || brakeLock || burnout, clamp(Math.max(Math.abs(lateralSpeed) / 11, car.brake, wheelspin / 35), .22, 1));

  if (burnout && car.rng() < dt * 23) spawnParticle(car.x - fx * 8, car.y - fy * 8, 'smoke');
  if (car.offTrackNow && speed > 40 && car.rng() < dt * 15) spawnParticle(car.x - fx * 6, car.y - fy * 6, 'dust');

  car.trailTimer += dt;
  if (car.trailTimer > .07) {
    car.trailTimer = 0;
    car.trail.push({ x: car.x, y: car.y });
    if (car.trail.length > 76) car.trail.shift();
  }
}

function rearWheelPositions(car) {
  const c = Math.cos(car.heading), s = Math.sin(car.heading);
  const fx = c, fy = s, lx = -s, ly = c;
  const rear = -CAR_LENGTH * .34;
  const half = CAR_WIDTH * .37;
  return {
    left: { x: car.x + fx * rear + lx * half, y: car.y + fy * rear + ly * half },
    right: { x: car.x + fx * rear - lx * half, y: car.y + fy * rear - ly * half }
  };
}

function updateSkidMarks(car, dt, active, intensity) {
  const wheels = rearWheelPositions(car);
  car.skidTimer += dt;
  if (active && car.skidTimer >= .060 && car.lastRearLeft && car.lastRearRight) {
    car.skidTimer = 0;
    sim.skidMarks.push({ x1: car.lastRearLeft.x, y1: car.lastRearLeft.y, x2: wheels.left.x, y2: wheels.left.y, a: .16 + intensity * .34, w: .9 + intensity * .8 });
    sim.skidMarks.push({ x1: car.lastRearRight.x, y1: car.lastRearRight.y, x2: wheels.right.x, y2: wheels.right.y, a: .16 + intensity * .34, w: .9 + intensity * .8 });
    if (sim.skidMarks.length > 3000) sim.skidMarks.splice(0, sim.skidMarks.length - 3000);
  }
  car.lastRearLeft = wheels.left;
  car.lastRearRight = wheels.right;
}

function getCarAxes(car) {
  const c = Math.cos(car.heading), s = Math.sin(car.heading);
  return { fx: c, fy: s, lx: -s, ly: c };
}

function obbCollision(a, b) {
  const aa = getCarAxes(a), ba = getCarAxes(b);
  const axes = [
    { x: aa.fx, y: aa.fy }, { x: aa.lx, y: aa.ly },
    { x: ba.fx, y: ba.fy }, { x: ba.lx, y: ba.ly }
  ];
  const dx = b.x - a.x, dy = b.y - a.y;
  let minOverlap = Infinity;
  let bestAxis = null;
  for (const axis of axes) {
    const ra = CAR_LENGTH * .5 * Math.abs(dot(axis.x, axis.y, aa.fx, aa.fy)) + CAR_WIDTH * .5 * Math.abs(dot(axis.x, axis.y, aa.lx, aa.ly));
    const rb = CAR_LENGTH * .5 * Math.abs(dot(axis.x, axis.y, ba.fx, ba.fy)) + CAR_WIDTH * .5 * Math.abs(dot(axis.x, axis.y, ba.lx, ba.ly));
    const centerDistance = dot(dx, dy, axis.x, axis.y);
    const overlap = ra + rb - Math.abs(centerDistance);
    if (overlap <= 0) return null;
    if (overlap < minOverlap) {
      minOverlap = overlap;
      const sign = centerDistance >= 0 ? 1 : -1;
      bestAxis = { x: axis.x * sign, y: axis.y * sign };
    }
  }
  return { normal: bestAxis, penetration: minOverlap };
}

function applyDamage(car, amount, impactSpeed) {
  if (car.finished || car.retired) return;
  car.damage = clamp(car.damage + amount, 0, 100);
  if (!car.disabled && (car.damage >= 98 || (impactSpeed > 118 && car.rng() < .12) || (amount > 46 && car.rng() < .035))) {
    car.disabled = true;
    car.retired = true;
    car.disableAge = 0;
    car.fireDelay = car.damage > 84 && car.rng() < .36 ? 1.2 + car.rng() * 4 : Infinity;
    car.status = 'Disabled — recovery requested';
    spawnRing(car.x, car.y, 18, 'DNF');
  }
}

function resolveCollisions() {
  const cars = sim.cars;
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    if (a.removed || a.parked || a.finished) continue;
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      if (b.removed || b.parked || b.finished) continue;
      const centerD2 = dist2(a.x, a.y, b.x, b.y);
      if (centerD2 > 34 * 34) continue;
      const centerD = Math.sqrt(Math.max(centerD2, 1e-6));
      const snx = (b.x - a.x) / centerD, sny = (b.y - a.y) / centerD;
      const srvx = b.vx - a.vx, srvy = b.vy - a.vy;
      const closing = Math.max(0, -dot(srvx, srvy, snx, sny));
      if (centerD < 29 && closing > 0) {
        const safety = sim.drama === 'clean' ? 1 : sim.drama === 'hazards' ? .78 : .48;
        const cushion = safety * clamp((29 - centerD) / 10, 0, 1) * (5 + closing) * .035;
        a.vx -= snx * cushion; a.vy -= sny * cushion;
        b.vx += snx * cushion; b.vy += sny * cushion;
      }
      const hit = obbCollision(a, b);
      if (!hit) continue;
      const nx = hit.normal.x, ny = hit.normal.y;
      const invA = 1 / a.mass, invB = 1 / b.mass;
      const totalInv = invA + invB;
      const correction = Math.max(0, hit.penetration - .15) / totalInv * .82;
      a.x -= nx * correction * invA;
      a.y -= ny * correction * invA;
      b.x += nx * correction * invB;
      b.y += ny * correction * invB;

      const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
      const velNormal = dot(rvx, rvy, nx, ny);
      let impactSpeed = Math.max(0, -velNormal);
      if (velNormal < 0) {
        const restitution = .18;
        const impulse = -(1 + restitution) * velNormal / totalInv;
        a.vx -= nx * impulse * invA;
        a.vy -= ny * impulse * invA;
        b.vx += nx * impulse * invB;
        b.vy += ny * impulse * invB;

        const tx = -ny, ty = nx;
        const tangentVelocity = dot(rvx, rvy, tx, ty);
        const frictionImpulse = clamp(-tangentVelocity / totalInv, -impulse * .42, impulse * .42);
        a.vx -= tx * frictionImpulse * invA;
        a.vy -= ty * frictionImpulse * invA;
        b.vx += tx * frictionImpulse * invB;
        b.vy += ty * frictionImpulse * invB;
        a.angularVel -= tangentVelocity * .008 + (a.rng() - .5) * impactSpeed * .006;
        b.angularVel += tangentVelocity * .008 + (b.rng() - .5) * impactSpeed * .006;
      } else {
        impactSpeed = hit.penetration * 7;
      }

      if (a.collisionCooldown <= 0 || b.collisionCooldown <= 0) {
        const rawDamage = Math.max(0, impactSpeed - 20) * .18 + hit.penetration * .52;
        const dramaDamage = sim.drama === 'clean' ? .48 : sim.drama === 'hazards' ? .76 : 1;
        const damage = rawDamage * dramaDamage;
        if (damage > 1.35) {
          applyDamage(a, damage * (.75 + a.rng() * .28), impactSpeed);
          applyDamage(b, damage * (.75 + b.rng() * .28), impactSpeed);
          const ix = (a.x + b.x) * .5, iy = (a.y + b.y) * .5;
          spawnImpact(ix, iy, impactSpeed + damage * .8);
          if (a.collisionCooldown <= 0) { a.collisions++; a.collisionCooldown = .9; }
          if (b.collisionCooldown <= 0) { b.collisions++; b.collisionCooldown = .9; }
        }
      }
      if (!a.disabled) a.status = 'Contact!';
      if (!b.disabled) b.status = 'Contact!';
    }
  }
}
