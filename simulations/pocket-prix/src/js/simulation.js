// Fixed-step race orchestration, ranking, classification, and finish logic.
'use strict';

function updateRanks() {
  const sorted = [...sim.cars].sort((a, b) => {
    if (a.finished && b.finished) return a.finishPosition - b.finishPosition;
    if (a.finished) return -1;
    if (b.finished) return 1;
    if (a.retired && b.retired) return b.totalProgress - a.totalProgress;
    if (a.retired) return 1;
    if (b.retired) return -1;
    return b.totalProgress - a.totalProgress;
  });
  sorted.forEach((car, i) => {
    car.priorRank = car.rank;
    car.rank = i + 1;
    if (car.rank < car.priorRank && sim.raceTime > 4 && !car.finished && !car.retired) car.overtakes += car.priorRank - car.rank;
  });
  return sorted;
}

function classifiedCount() {
  return sim.cars.filter(c => c.finished || c.retired).length;
}

function step(dt) {
  if (sim.countdown > 0) {
    sim.countdown -= dt;
    if (sim.countdown <= 0) sim.countdown = 0;
  } else if (!sim.finished) {
    sim.raceTime += dt;
  }

  // Effects, recovery, and parked activity continue after the race result appears.
  for (const car of sim.cars) updateCar(car, dt);
  resolveCollisions();
  updateTow(dt);
  updateEffects(dt);
  updateBirds(dt);
  updateChaos(dt);
  updateRanks();

  if (!sim.finished) {
    sim.traceTimer += dt;
    if (sim.traceTimer >= .4) {
      sim.traceTimer = 0;
      const top = [...sim.cars].filter(c => !c.retired).sort((a, b) => b.totalProgress - a.totalProgress).slice(0, 6);
      sim.trace.push({ t: sim.raceTime, cars: top.map(c => ({ id: c.id, p: c.totalProgress })) });
      if (sim.trace.length > 220) sim.trace.shift();
    }
    if (classifiedCount() === sim.cars.length && sim.cars.length > 0) finishRace();
  }
}

function finishRace() {
  if (sim.finished) return;
  sim.finished = true;
  sim.running = false;
  $('playBtn').textContent = '▶ Race complete';
  $('simStatusChip').textContent = 'Race complete';
  showFinishPanel();
}
