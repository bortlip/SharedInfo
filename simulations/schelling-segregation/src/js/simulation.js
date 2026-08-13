// Reset, stepping, comparison, convergence, and stop-condition orchestration.
'use strict';

function comparisonConfig() {
  const config = deepClone(sim.config);
  config.satisfaction.threshold = sim.config.compare.threshold;
  return config;
}

function structuralSignature(config) {
  const p = config.population;
  return JSON.stringify({ groups:p.groups, weights:normalizedWeights(p.groupWeights,p.groups), vacancy:p.vacancyRate, cols:p.cols, rows:p.rows, distribution:p.distribution, seed:p.seed });
}

function initializeSimulation(makeNewInitial = true) {
  sim.running = false;
  const signature = structuralSignature(sim.config);
  if (makeNewInitial || !sim.initialSnapshot || sim.initialSignature !== signature) {
    const initial = createInitialWorld(sim.config);
    sim.initialSnapshot = snapshotWorld(initial);
    sim.initialSignature = signature;
  }
  sim.worldA = worldFromSnapshot(sim.initialSnapshot, sim.config, 0);
  sim.worldB = worldFromSnapshot(sim.initialSnapshot, sim.config, 0);
  sim.selectedIndex = null;
  sim.hoveredIndex = null;
  sim.history = [];
  computeWorldStats(sim.worldA, sim.config);
  if (sim.config.compare.enabled) computeWorldStats(sim.worldB, comparisonConfig());
  recordHistory();
  updateAllUI();
  renderAll();
}

function resetSameWorld() { initializeSimulation(false); }

function worldHasLegalMove(world, config) {
  for (const agentId of eligibleAgentIds(world, config)) {
    const current = evaluateAgent(world, agentId, config);
    const cells = candidatePool(world, agentId, config);
    if (!cells.length) continue;
    const destination = config.movement.destination;
    if (destination === 'randomVacancy' || destination === 'best' || destination === 'leastBad' || config.movement.fallback !== 'stay') {
      if (!current?.satisfied || !config.movement.allowSatisfied) return true;
      for (const cell of cells) if (evaluatePlacement(world, agentId, cell, config).utility + 1e-9 >= current.utility) return true;
    } else {
      for (const cell of cells) {
        const ev = evaluatePlacement(world, agentId, cell, config);
        if (ev.satisfied && (!current?.satisfied || !config.movement.allowSatisfied || ev.utility + 1e-9 >= current.utility)) return true;
      }
    }
  }
  return false;
}

function chooseSequentialAgent(world, config) {
  const ids = activeAgentIds(world);
  if (!ids.length) return null;
  if (config.movement.selection === 'fixedOrder') {
    for (let n = 0; n < ids.length; n++) {
      const id = ids[world.fixedCursor % ids.length];
      world.fixedCursor = (world.fixedCursor + 1) % ids.length;
      const ev = evaluateAgent(world, id, config);
      if (ev && (!ev.satisfied || config.movement.allowSatisfied)) return id;
    }
    return null;
  }
  for (let n = 0; n < Math.min(30, ids.length * 2); n++) {
    const id = ids[Math.floor(world.rng() * ids.length)];
    const ev = evaluateAgent(world, id, config);
    if (ev && (!ev.satisfied || config.movement.allowSatisfied)) return id;
  }
  const eligible = eligibleAgentIds(world, config);
  return eligible.length ? eligible[Math.floor(world.rng() * eligible.length)] : null;
}

function runSnapshotRound(world, config) {
  const frozen = worldFromSnapshot(snapshotWorld(world), config, 0);
  frozen.rng = world.rng;
  const plans = [];
  const ids = shuffled(eligibleAgentIds(frozen, config), world.rng);
  for (const id of ids) {
    const current = evaluateAgent(frozen, id, config);
    const { choice } = chooseDestination(frozen, id, config, current);
    if (!choice) continue;
    plans.push({ agentId:id, source:frozen.positions[id], target:choice.cell, expectedTarget:frozen.grid[choice.cell] });
  }
  let moved = 0;
  for (const plan of shuffled(plans, world.rng)) {
    if (world.positions[plan.agentId] !== plan.source) continue;
    if (world.grid[plan.target] !== plan.expectedTarget) continue;
    executeMove(world, plan.agentId, plan.target, config); moved++;
  }
  return moved;
}

function runWorldTick(world, config) {
  if (!world || world.stopped) return;
  let moved = 0;
  if (config.movement.selection === 'snapshotRound') {
    moved = runSnapshotRound(world, config);
  } else if (config.simulation.mode === 'round' || config.movement.selection === 'allPerRound') {
    let ids = eligibleAgentIds(world, config);
    if (config.movement.selection === 'randomSequential') ids = shuffled(ids, world.rng);
    for (const id of ids) if (attemptMove(world, id, config).moved) moved++;
  } else {
    for (let i = 0; i < config.simulation.movesPerTick; i++) {
      const id = chooseSequentialAgent(world, config);
      if (id === null) break;
      if (attemptMove(world, id, config).moved) moved++;
    }
  }
  world.iteration++;
  world.lastStepMoves = moved;
  world.quietRounds = moved ? 0 : world.quietRounds + 1;
  for (const ev of world.moveEvents) ev.age++;
  world.moveEvents = world.moveEvents.filter(ev => ev.age <= MOVE_EVENT_LIFE);
  const stats = computeWorldStats(world, config);

  let reason = '';
  if (config.simulation.stopSatisfied && stats.satisfied === stats.occupied) reason = 'Everyone is satisfied';
  else if (config.simulation.stopNoLegal && moved === 0 && !worldHasLegalMove(world, config)) reason = 'No legal moves remain';
  else if (config.simulation.stopQuiet && world.quietRounds >= config.simulation.quietRounds) reason = `No moves for ${world.quietRounds} iterations`;
  else if (config.simulation.stopMax && world.iteration >= config.simulation.maxIterations) reason = 'Iteration limit reached';
  if (reason) { world.stopped = true; world.stopReason = reason; }
}

function stepSimulation() {
  runWorldTick(sim.worldA, sim.config);
  if (sim.config.compare.enabled) runWorldTick(sim.worldB, comparisonConfig());
  recordHistory();
  const doneA = sim.worldA?.stopped;
  const doneB = !sim.config.compare.enabled || sim.worldB?.stopped;
  if (doneA && doneB) {
    sim.running = false;
    sim.status = sim.config.compare.enabled ? 'Both worlds stopped' : `Stopped · ${sim.worldA.stopReason}`;
  }
}
