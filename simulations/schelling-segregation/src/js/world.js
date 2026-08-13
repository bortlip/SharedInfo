// Agent/grid creation, initialization patterns, snapshots, and custom editing.
'use strict';

function makeAgent(id, group, rng) {
  return { id, group, toleranceOffset: rng() * 2 - 1, active: true };
}

function groupForStripe(x, cols, weights) {
  const p = (x + .5) / cols; let sum = 0;
  for (let g = 0; g < weights.length; g++) { sum += weights[g]; if (p <= sum) return g; }
  return weights.length - 1;
}

function createInitialWorld(config) {
  const cols = clamp(Math.round(config.population.cols), 12, 140);
  const rows = clamp(Math.round(config.population.rows), 12, 100);
  if (cols * rows > MAX_GRID_CELLS) throw new Error(`Grid is limited to ${MAX_GRID_CELLS.toLocaleString()} cells.`);
  config.population.cols = cols; config.population.rows = rows;
  const count = cols * rows;
  const rng = mulberry32(config.population.seed);
  const groups = clamp(Math.round(config.population.groups), 2, MAX_GROUPS);
  const weights = normalizedWeights(config.population.groupWeights, groups);
  const occupiedCount = clamp(Math.round(count * (1 - config.population.vacancyRate)), 0, count);
  const occupiedCells = shuffled(Array.from({ length: count }, (_, i) => i), rng).slice(0, occupiedCount);
  const grid = new Int32Array(count); grid.fill(EMPTY);
  const agents = [];
  const positions = [];
  const centers = Array.from({ length: groups }, () => ({ x: rng() * cols, y: rng() * rows }));

  for (const cell of occupiedCells) {
    const { x, y } = indexXY(cell, cols);
    let group;
    if (config.population.distribution === 'striped') group = groupForStripe(x, cols, weights);
    else if (config.population.distribution === 'clustered') {
      let best = Infinity, bestGroup = 0;
      for (let g = 0; g < groups; g++) {
        const d = Math.hypot(x - centers[g].x, y - centers[g].y) / Math.sqrt(Math.max(.03, weights[g]));
        const noisy = d * (.82 + rng() * .36);
        if (noisy < best) { best = noisy; bestGroup = g; }
      }
      group = bestGroup;
    } else group = weightedGroup(rng, weights);
    const agent = makeAgent(agents.length, group, rng);
    agents.push(agent); positions[agent.id] = cell; grid[cell] = agent.id;
  }

  return makeWorld(grid, agents, positions, config.population.seed);
}

function makeWorld(grid, agents, positions, seed) {
  const vacancies = new Set();
  for (let i = 0; i < grid.length; i++) if (grid[i] === EMPTY) vacancies.add(i);
  return {
    grid, agents, positions: Int32Array.from(positions), vacancies,
    rng: mulberry32((seed + 0x9e3779b9) >>> 0), iteration: 0, moves: 0,
    quietRounds: 0, stopped: false, stopReason: '', fixedCursor: 0,
    moveEvents: [], lastStepMoves: 0, lastLegalMove: true, stats: null
  };
}

function snapshotWorld(world) {
  return {
    grid: Array.from(world.grid),
    agents: world.agents.map(a => a ? { ...a } : null)
  };
}

function worldFromSnapshot(snapshot, config, seedOffset = 0) {
  const grid = Int32Array.from(snapshot.grid);
  const agents = snapshot.agents.map(a => a ? { ...a } : null);
  const positions = new Int32Array(agents.length); positions.fill(-1);
  for (let i = 0; i < grid.length; i++) if (grid[i] !== EMPTY) positions[grid[i]] = i;
  return makeWorld(grid, agents, positions, config.population.seed + seedOffset);
}

function paintWorldCell(world, index, group, config) {
  if (index < 0 || index >= world.grid.length) return;
  const occupant = world.grid[index];
  if (group === EMPTY) {
    if (occupant !== EMPTY) { world.agents[occupant].active = false; world.positions[occupant] = -1; world.grid[index] = EMPTY; world.vacancies.add(index); }
  } else if (occupant !== EMPTY) {
    world.agents[occupant].group = clamp(group, 0, config.population.groups - 1);
  } else {
    const agent = makeAgent(world.agents.length, clamp(group, 0, config.population.groups - 1), world.rng);
    world.agents.push(agent);
    const next = new Int32Array(world.agents.length); next.fill(-1); next.set(world.positions); world.positions = next;
    world.positions[agent.id] = index; world.grid[index] = agent.id; world.vacancies.delete(index);
  }
  world.stopped = false; world.stopReason = ''; world.stats = null;
}
