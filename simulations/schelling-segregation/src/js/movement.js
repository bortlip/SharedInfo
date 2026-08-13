// Candidate search, destination policies, swaps, and relocation execution.
'use strict';

function activeAgentIds(world) { return world.agents.filter(a => a?.active && world.positions[a.id] >= 0).map(a => a.id); }

function candidatePool(world, agentId, config) {
  const mode = config.movement.mode; const source = world.positions[agentId]; const group = world.agents[agentId].group;
  let cells = [];
  if (mode === 'vacancy' || mode === 'either') cells.push(...world.vacancies);
  if (mode === 'swap' || mode === 'either') {
    for (const other of world.agents) {
      if (!other?.active || other.id === agentId || other.group === group) continue;
      const pos = world.positions[other.id]; if (pos >= 0) cells.push(pos);
    }
  }
  if (config.movement.search === 'local') cells = cells.filter(i => cellDistance(source, i, config.population.cols) <= config.movement.searchRadius);
  return cells;
}

function bestCandidate(world, agentId, config, cells) {
  let best = null;
  for (const cell of cells) {
    const ev = evaluatePlacement(world, agentId, cell, config);
    if (!best || ev.utility > best.ev.utility || (ev.utility === best.ev.utility && world.rng() < .5)) best = { cell, ev };
  }
  return best;
}

function chooseDestination(world, agentId, config, current) {
  const cells = candidatePool(world, agentId, config);
  if (!cells.length) return { choice: null, hasLegal: false };
  const destination = config.movement.destination;
  let choice = null;
  if (destination === 'randomVacancy') {
    const cell = cells[Math.floor(world.rng() * cells.length)]; choice = { cell, ev: evaluatePlacement(world, agentId, cell, config) };
  } else if (destination === 'randomSatisfying') {
    for (const cell of shuffled(cells, world.rng)) { const ev = evaluatePlacement(world, agentId, cell, config); if (ev.satisfied) { choice = { cell, ev }; break; } }
  } else if (destination === 'nearestSatisfying') {
    const source = world.positions[agentId]; let distance = Infinity;
    for (const cell of cells) { const ev = evaluatePlacement(world, agentId, cell, config); if (!ev.satisfied) continue; const d = cellDistance(source, cell, config.population.cols); if (d < distance) { distance = d; choice = { cell, ev }; } }
  } else choice = bestCandidate(world, agentId, config, cells);

  if (!choice && (destination === 'randomSatisfying' || destination === 'nearestSatisfying')) {
    if (config.movement.fallback === 'best') choice = bestCandidate(world, agentId, config, cells);
    else if (config.movement.fallback === 'random') { const cell = cells[Math.floor(world.rng() * cells.length)]; choice = { cell, ev: evaluatePlacement(world, agentId, cell, config) }; }
  }
  if (choice && current?.satisfied && config.movement.allowSatisfied && choice.ev.utility + 1e-9 < current.utility) choice = null;
  return { choice, hasLegal: true };
}

function executeMove(world, agentId, target, config) {
  const source = world.positions[agentId]; const occupant = world.grid[target];
  if (occupant === EMPTY) {
    world.grid[source] = EMPTY; world.grid[target] = agentId; world.positions[agentId] = target;
    world.vacancies.delete(target); world.vacancies.add(source);
  } else {
    world.grid[source] = occupant; world.positions[occupant] = source;
    world.grid[target] = agentId; world.positions[agentId] = target;
  }
  world.moves++; world.moveEvents.push({ agentId, from: source, to: target, age: 0, swap: occupant !== EMPTY });
  if (world.moveEvents.length > 120) world.moveEvents.splice(0, world.moveEvents.length - 120);
}

function attemptMove(world, agentId, config) {
  const agent = world.agents[agentId]; if (!agent?.active || world.positions[agentId] < 0) return { moved: false, attempted: false, legal: false };
  const current = evaluateAgent(world, agentId, config); if (!current) return { moved: false, attempted: false, legal: false };
  if (current.satisfied && !config.movement.allowSatisfied) return { moved: false, attempted: false, legal: true };
  const { choice, hasLegal } = chooseDestination(world, agentId, config, current);
  if (!choice) return { moved: false, attempted: true, legal: hasLegal };
  executeMove(world, agentId, choice.cell, config);
  return { moved: true, attempted: true, legal: true };
}

function eligibleAgentIds(world, config) {
  const ids = [];
  for (const agent of world.agents) {
    if (!agent?.active) continue;
    const ev = evaluateAgent(world, agent.id, config); if (ev && (!ev.satisfied || config.movement.allowSatisfied)) ids.push(agent.id);
  }
  return ids;
}
