// Satisfaction, segregation, population, cluster, and history metrics.
'use strict';

function largestCluster(world, config) {
  const { cols, rows } = config.population;
  const seen = new Uint8Array(world.grid.length);
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  let largest = 0, clusters = 0;
  for (let start = 0; start < world.grid.length; start++) {
    const aid = world.grid[start];
    if (aid === EMPTY || seen[start] || !world.agents[aid]?.active) continue;
    clusters++;
    const group = world.agents[aid].group;
    let size = 0;
    const queue = [start];
    seen[start] = 1;
    while (queue.length) {
      const cell = queue.pop(); size++;
      const p = indexXY(cell, cols);
      for (const [dx,dy] of dirs) {
        let x = p.x + dx, y = p.y + dy;
        if (config.neighborhood.wrap) { x = (x % cols + cols) % cols; y = (y % rows + rows) % rows; }
        else if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const ni = xyIndex(x,y,cols);
        if (seen[ni]) continue;
        const nid = world.grid[ni];
        if (nid !== EMPTY && world.agents[nid]?.active && world.agents[nid].group === group) { seen[ni] = 1; queue.push(ni); }
      }
    }
    largest = Math.max(largest, size);
  }
  return { largest, clusters };
}

function computeWorldStats(world, config) {
  const groupCounts = Array(config.population.groups).fill(0);
  let occupied = 0, satisfied = 0, similaritySum = 0, similarityN = 0;
  const satisfaction = new Int8Array(world.agents.length); satisfaction.fill(-1);
  for (const agent of world.agents) {
    if (!agent?.active || world.positions[agent.id] < 0) continue;
    occupied++; groupCounts[agent.group]++;
    const ev = evaluateAgent(world, agent.id, config); if (!ev) continue;
    satisfaction[agent.id] = ev.satisfied ? 1 : 0;
    if (ev.satisfied) satisfied++;
    if (ev.stats.occupied > 0) { similaritySum += ev.stats.similarFraction; similarityN++; }
  }
  const sameShare = similarityN ? similaritySum / similarityN : 0;
  const proportions = occupied ? groupCounts.map(c => c / occupied) : groupCounts.map(() => 0);
  const expectedSame = proportions.reduce((sum,p) => sum + p*p, 0);
  const segregation = expectedSame < 1 ? clamp((sameShare - expectedSame) / (1 - expectedSame), -1, 1) : 0;
  const cluster = largestCluster(world, config);
  world.satisfaction = satisfaction;
  world.stats = { occupied, vacancies: world.vacancies.size, satisfied, satisfiedFraction: occupied ? satisfied / occupied : 1, sameShare, segregation, groupCounts, largestCluster: cluster.largest, clusterCount: cluster.clusters, moves: world.moves, iteration: world.iteration };
  return world.stats;
}

function recordHistory() {
  const a = sim.worldA.stats || computeWorldStats(sim.worldA, sim.config);
  const bConfig = comparisonConfig();
  const b = sim.config.compare.enabled && sim.worldB ? (sim.worldB.stats || computeWorldStats(sim.worldB, bConfig)) : null;
  sim.history.push({ iteration: a.iteration, a: { satisfied: a.satisfiedFraction, segregation: a.segregation }, b: b ? { satisfied: b.satisfiedFraction, segregation: b.segregation } : null });
  if (sim.history.length > HISTORY_LIMIT) sim.history.shift();
}
