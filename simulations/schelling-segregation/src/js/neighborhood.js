// Neighborhood geometry and local composition analysis.
'use strict';

function neighborIndices(index, config) {
  const { cols, rows } = config.population;
  const { radius, type, wrap } = config.neighborhood;
  const p = indexXY(index, cols); const found = new Set();
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (type === 'vonNeumann' && Math.abs(dx) + Math.abs(dy) > radius) continue;
      let x = p.x + dx, y = p.y + dy;
      if (wrap) { x = (x % cols + cols) % cols; y = (y % rows + rows) % rows; }
      else if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      const ni = xyIndex(x, y, cols); if (ni !== index) found.add(ni);
    }
  }
  return [...found];
}

function analyzePosition(world, agentId, index, config, sourceIndex = null, swapOccupantId = EMPTY) {
  const agent = world.agents[agentId];
  let same = 0, different = 0, vacant = 0;
  const neighbors = neighborIndices(index, config);
  for (const ni of neighbors) {
    let occupant = ni === sourceIndex ? swapOccupantId : world.grid[ni];
    if (occupant === EMPTY || !world.agents[occupant]?.active) { vacant++; continue; }
    if (world.agents[occupant].group === agent.group) same++; else different++;
  }
  const occupied = same + different;
  const denominator = config.neighborhood.ignoreVacancies ? occupied : neighbors.length;
  const similarFraction = denominator ? same / denominator : 0;
  const differentFraction = denominator ? different / denominator : 0;
  return { same, different, vacant, occupied, total: neighbors.length, similarFraction, differentFraction, neighbors };
}
