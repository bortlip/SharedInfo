// Periodic road geometry, expert controller, reset, and rover physics.
'use strict';

function roadCenter(x) {
  const a = TAU * wrap(x) / W;
  return H / 2 + 83 * Math.sin(a) + 38 * Math.sin(2 * a + .65) + 13 * Math.sin(3 * a - 1.1);
}

function roadSlope(x) {
  const e = .75;
  return (roadCenter(x + e) - roadCenter(x - e)) / (2 * e);
}

function roadHeading(x) {
  return Math.atan(roadSlope(x));
}

function expertSteer(x, y, heading) {
  const targetX = wrap(x + 80);
  const lateral = y - roadCenter(x);
  const desired = roadHeading(targetX) - lateral * .0062;
  return clamp(angleDiff(desired, heading) * 2.8, -1, 1);
}

function resetRover() {
  sim.x = 90;
  sim.y = roadCenter(sim.x);
  sim.heading = roadHeading(sim.x);
  sim.manualSteer = 0;
  sim.apSteer = 0;
  sim.laps = 0;
  sim.autopilot = false;
  $('autoBtn').classList.remove('autopilot');
  $('autoBtn').textContent = 'Enable autopilot';
}

function updatePhysics(dt) {
  let steer = sim.manualSteer;

  if (sim.autopilot && sim.model) {
    sim.probs = Array.from(forward(sim.model, captureInput()));
    const desired = clamp((sim.probs[2] - sim.probs[0]) * 1.65, -1, 1);
    sim.apSteer += (desired - sim.apSteer) * Math.min(1, dt * 7);
    steer = sim.apSteer;
  } else if (sim.model) {
    sim.probs = Array.from(forward(sim.model, captureInput()));
  } else {
    sim.probs = [0, 0, 0];
  }

  sim.heading += steer * sim.steerResponse * dt;
  const desiredRoad = roadHeading(sim.x);
  if (Math.abs(steer) < .05) {
    sim.heading += angleDiff(desiredRoad, sim.heading) * dt * .12;
  }

  const oldX = sim.x;
  sim.x = wrap(sim.x + Math.cos(sim.heading) * sim.speed * dt);
  sim.y += Math.sin(sim.heading) * sim.speed * dt;
  if (oldX > 850 && sim.x < 150) sim.laps++;
  sim.y = clamp(sim.y, 25, H - 25);
}
