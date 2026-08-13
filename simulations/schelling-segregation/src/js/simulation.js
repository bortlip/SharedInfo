// Reset, stepping, comparison, convergence, and stop-condition orchestration.
'use strict';

function normalizeComparisonSettings(config) {
  if (!config.compare || typeof config.compare !== 'object') config.compare = {};
  const compare = config.compare;
  const hadOverrides = compare.overrides && typeof compare.overrides === 'object';
  const source = hadOverrides ? compare.overrides : {};
  const legacyThreshold = Number(compare.threshold);
  const normalized = {};
  for (const def of B_OVERRIDE_DEFS) {
    const current = source[def.key];
    let enabled = current && Object.prototype.hasOwnProperty.call(current, 'enabled') ? Boolean(current.enabled) : Boolean(def.defaultEnabled);
    let value = current && Object.prototype.hasOwnProperty.call(current, 'value') ? current.value : def.defaultValue;
    if (Object.prototype.hasOwnProperty.call(compare, 'threshold') && def.key === 'satisfaction.threshold' && Number.isFinite(legacyThreshold)) {
      enabled = true; value = legacyThreshold;
    }
    normalized[def.key] = { enabled, value };
  }
  compare.enabled = Boolean(compare.enabled);
  compare.overrides = normalized;
  delete compare.threshold;
  return compare;
}

function coerceComparisonValue(def, value) {
  if (def.type === 'boolean') return value === true || value === 'true';
  if (def.type === 'weights') {
    const source = Array.isArray(value) ? value : String(value).split(',');
    const weights = source.map(item => Math.max(0, Number(item))).filter(Number.isFinite);
    return weights.length ? weights : [1];
  }
  if (def.type === 'number') {
    let number = Number(value);
    if (!Number.isFinite(number)) number = Number(def.defaultValue) || 0;
    if (Number.isFinite(def.min)) number = Math.max(def.min, number);
    if (Number.isFinite(def.max)) number = Math.min(def.max, number);
    return def.step === 1 ? Math.round(number) : number;
  }
  return String(value);
}

function comparisonConfig(baseConfig = sim.config) {
  const config = deepClone(baseConfig);
  const compare = normalizeComparisonSettings(config);
  for (const def of B_OVERRIDE_DEFS) {
    const override = compare.overrides[def.key];
    if (!override?.enabled) continue;
    const [section, property] = def.key.split('.');
    config[section][property] = coerceComparisonValue(def, override.value);
  }
  const p = config.population;
  p.groups = clamp(Math.round(p.groups), 2, MAX_GROUPS);
  p.vacancyRate = clamp(Number(p.vacancyRate), 0, .9);
  p.cols = clamp(Math.round(p.cols), 12, 140);
  p.rows = clamp(Math.round(p.rows), 12, 100);
  p.seed = clamp(Math.round(p.seed), 1, 999999999);
  p.groupWeights = normalizedWeights(p.groupWeights, p.groups);
  config.neighborhood.radius = clamp(Math.round(config.neighborhood.radius), 1, 6);
  config.satisfaction.variation = clamp(Number(config.satisfaction.variation), 0, .5);
  const maxNeighbors = config.neighborhood.type === 'vonNeumann' ? 2 * config.neighborhood.radius * (config.neighborhood.radius + 1) : (2 * config.neighborhood.radius + 1) ** 2 - 1;
  if (config.satisfaction.rule === 'minSameCount') config.satisfaction.threshold = clamp(Number(config.satisfaction.threshold), 0, maxNeighbors);
  else if (config.satisfaction.rule === 'weightedUtility') config.satisfaction.threshold = clamp(Number(config.satisfaction.threshold), -1, 1);
  else config.satisfaction.threshold = clamp(Number(config.satisfaction.threshold), 0, 1);
  config.movement.searchRadius = clamp(Math.round(config.movement.searchRadius), 1, 30);
  config.simulation.movesPerTick = clamp(Math.round(config.simulation.movesPerTick), 1, 500);
  config.simulation.maxIterations = clamp(Math.round(config.simulation.maxIterations), 1, 100000);
  config.simulation.quietRounds = clamp(Math.round(config.simulation.quietRounds), 1, 100);
  return config;
}

function activeComparisonOverrides(config = sim.config) {
  const compare = normalizeComparisonSettings(config);
  return B_OVERRIDE_DEFS.filter(def => compare.overrides[def.key]?.enabled);
}

function structuralSignature(config) {
  const p = config.population;
  return JSON.stringify({ groups:p.groups, weights:normalizedWeights(p.groupWeights,p.groups), vacancy:p.vacancyRate, cols:p.cols, rows:p.rows, distribution:p.distribution, seed:p.seed });
}

function comparisonUsesSameInitialWorld(config = sim.config) {
  return structuralSignature(config) === structuralSignature(comparisonConfig(config));
}

function initializeSimulation(makeNewInitial = true) {
  sim.running = false;
  normalizeComparisonSettings(sim.config);
  const signature = structuralSignature(sim.config);
  if (makeNewInitial || !sim.initialSnapshot || sim.initialSignature !== signature) {
    const initial = createInitialWorld(sim.config);
    sim.initialSnapshot = snapshotWorld(initial);
    sim.initialSignature = signature;
  }

  const bConfig = comparisonConfig();
  const bSignature = structuralSignature(bConfig);
  const sameInitial = signature === bSignature;
  if (sameInitial) {
    sim.initialSnapshotB = sim.initialSnapshot;
    sim.initialSignatureB = signature;
  } else if (makeNewInitial || !sim.initialSnapshotB || sim.initialSignatureB !== bSignature) {
    const initialB = createInitialWorld(bConfig);
    sim.initialSnapshotB = snapshotWorld(initialB);
    sim.initialSignatureB = bSignature;
  }

  sim.worldA = worldFromSnapshot(sim.initialSnapshot, sim.config, 0);
  sim.worldB = worldFromSnapshot(sameInitial ? sim.initialSnapshot : sim.initialSnapshotB, bConfig, 0);
  sim.selectedIndex = null;
  sim.selectedWorld = 'A';
  sim.hoveredIndex = null;
  sim.history = [];
  computeWorldStats(sim.worldA, sim.config);
  if (sim.config.compare.enabled) computeWorldStats(sim.worldB, bConfig);
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
