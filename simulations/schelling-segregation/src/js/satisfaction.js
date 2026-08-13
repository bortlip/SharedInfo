// Satisfaction rules, heterogeneous thresholds, and placement utility.
'use strict';

function agentThreshold(agent, config) {
  const s = config.satisfaction;
  if (!s.heterogeneous) return s.threshold;
  if (s.rule === 'minSameCount') return Math.max(0, s.threshold * (1 + agent.toleranceOffset * s.variation));
  const min = s.rule === 'weightedUtility' ? -1 : 0;
  return clamp(s.threshold + agent.toleranceOffset * s.variation, min, 1);
}

function evaluateStats(agent, stats, config) {
  const s = config.satisfaction;
  const threshold = agentThreshold(agent, config);
  if (stats.occupied === 0) {
    const satisfied = s.isolated === 'satisfied';
    return { satisfied, threshold, score: 0, utility: 0, reason: satisfied ? 'No occupied neighbors; configured satisfied.' : 'No occupied neighbors; configured unsatisfied.' };
  }
  let satisfied = false, reason = '', score = 0;
  if (s.rule === 'minSimilarFraction') { score = stats.similarFraction; satisfied = score >= threshold; reason = `${pct(stats.similarFraction)} same-group vs ${pct(threshold)} required`; }
  else if (s.rule === 'maxDifferentFraction') { score = -stats.differentFraction; satisfied = stats.differentFraction <= threshold; reason = `${pct(stats.differentFraction)} different-group vs ${pct(threshold)} maximum`; }
  else if (s.rule === 'minSameCount') { score = stats.same; satisfied = score >= threshold; reason = `${stats.same} same-group vs ${Math.ceil(threshold)} required`; }
  else if (s.rule === 'majority') { score = stats.same - stats.different; satisfied = score > 0; reason = `${stats.same} same vs ${stats.different} different`; }
  else { score = stats.similarFraction - stats.differentFraction; satisfied = score >= threshold; reason = `utility ${score.toFixed(2)} vs ${threshold.toFixed(2)} required`; }
  return { satisfied, threshold, score, utility: score, reason };
}

function evaluateAgent(world, agentId, config) {
  const pos = world.positions[agentId];
  if (pos < 0 || !world.agents[agentId]?.active) return null;
  const stats = analyzePosition(world, agentId, pos, config);
  return { ...evaluateStats(world.agents[agentId], stats, config), stats, position: pos };
}

function evaluatePlacement(world, agentId, targetIndex, config) {
  const source = world.positions[agentId];
  const occupant = world.grid[targetIndex];
  const swapId = occupant === EMPTY ? EMPTY : occupant;
  const stats = analyzePosition(world, agentId, targetIndex, config, source, swapId);
  return { ...evaluateStats(world.agents[agentId], stats, config), stats, position: targetIndex, occupant };
}
