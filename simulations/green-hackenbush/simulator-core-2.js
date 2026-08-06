'use strict';

async function animateAndApply(move, source) {
  if (!move || gameOver || isAnimating) return;
  isAnimating = true;
  const timing = moveTiming(source);
  applyAnimationTiming(timing);
  pendingMove = move;
  renderAll();

  await delay(timing.highlight);
  if (!pendingMove) return;

  const beforeTotal = totalValue();
  const player = currentPlayer;
  const component = components[move.componentIndex];
  const beforeG = componentValue(component);
  let text;

  recentGone = new Map();

  if (move.type === 'heap') {
    const removed = component.size - move.target;
    component.size = move.target;
    text = `${component.name}: removed ${removed} pebble${removed === 1 ? '' : 's'}, leaving ${move.target}`;
  } else {
    const edge = component.edges[move.edgeIndex];
    const beforeMask = component.mask;
    const afterMask = move.nextMask ?? canonicalMask(component, beforeMask & ~bit(move.edgeIndex));
    component.mask = afterMask;
    recentGone.set(move.componentIndex, collectGoneEdges(component, beforeMask, afterMask));
    const fallenCount = recentGone.get(move.componentIndex).size - 1;
    text = `${component.name}: cut ${edge.a}-${edge.b}${fallenCount > 0 ? `; ${fallenCount} disconnected segment${fallenCount === 1 ? '' : 's'} fell` : ''}`;
  }

  const afterG = componentValue(component);
  const afterTotal = totalValue();
  const restored = afterTotal === 0;

  lastExplanation = beforeTotal === 0
    ? `${actorLabel(player)} began at total G = 0, where no move can preserve the balance. ${text}. The component changed from G=${beforeG} to G=${afterG}, and the total became ${afterTotal}.`
    : restored
      ? `${actorLabel(player)} played the balancing move: ${text}. The component changed from G=${beforeG} to G=${afterG}, making the total XOR 0.`
      : `${actorLabel(player)} played: ${text}. The component changed from G=${beforeG} to G=${afterG}; total XOR changed from ${beforeTotal} to ${afterTotal}.`;

  log.unshift({ player, actor: actorLabel(player), text, beforeTotal, afterTotal, source });
  pendingMove = null;

  if (!hasMoves()) {
    gameOver = true;
    autoplayActive = false;
    autoplayToken += 1;
    lastExplanation += ` No moves remain, so ${actorLabel(player)} made the last move and wins.`;
  } else {
    currentPlayer = currentPlayer === 1 ? 2 : 1;
  }

  renderAll();
  await delay(timing.fall);
  recentGone = new Map();
  renderAll();
  if (timing.gap > 0) await delay(timing.gap);
  isAnimating = false;
  renderAll();

  if (!gameOver && $('#player-mode').value === 'human-ai' && currentPlayer === 2) {
    await delay(450);
    if (!gameOver && !isAnimating && $('#player-mode').value === 'human-ai') animateAndApply(choosePerfectMove(), 'perfect');
  }
}

function resetGame() {
  stopAutoplay();
  components = parseDefinition(initialDefinition);
  currentPlayer = 1;
  gameOver = false;
  isAnimating = false;
  pendingMove = null;
  recentGone = new Map();
  log = [];
  lastExplanation = 'The starting position is ready. A total G of 0 is losing; any nonzero total has a move back to 0.';
  renderAll();
}

function autoLayout(component) {
  const nonGround = component.vertices.filter((vertex) => vertex !== 'G');
  const adjacency = new Map(nonGround.map((vertex) => [vertex, []]));
  const groundNeighbors = [];

  component.edges.forEach((edge) => {
    if (edge.a === 'G' && edge.b !== 'G') groundNeighbors.push(edge.b);
    else if (edge.b === 'G' && edge.a !== 'G') groundNeighbors.push(edge.a);
    else if (edge.a !== 'G' && edge.b !== 'G') {
      adjacency.get(edge.a)?.push(edge.b);
      adjacency.get(edge.b)?.push(edge.a);
    }
  });

  const depth = new Map();
  const queue = [];
  [...new Set(groundNeighbors)].sort().forEach((vertex) => {
    depth.set(vertex, 1);
    queue.push(vertex);
  });

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const vertex = queue[cursor];
    for (const other of adjacency.get(vertex) || []) {
      if (!depth.has(other)) {
        depth.set(other, depth.get(vertex) + 1);
        queue.push(other);
      }
    }
  }

  nonGround.forEach((vertex) => { if (!depth.has(vertex)) depth.set(vertex, 1); });
  const maxDepth = Math.max(1, ...depth.values());
  const levels = new Map();
  nonGround.forEach((vertex) => {
    const d = depth.get(vertex);
    if (!levels.has(d)) levels.set(d, []);
    levels.get(d).push(vertex);
  });

  const positions = {};
  for (const [d, vertices] of levels.entries()) {
    vertices.sort();
    const span = Math.min(120, 42 * Math.max(1, vertices.length - 1));
    vertices.forEach((vertex, index) => {
      const x = vertices.length === 1 ? 0 : -span / 2 + index * (span / (vertices.length - 1));
      positions[vertex] = [x, -52 - ((d - 1) * (105 / Math.max(1, maxDepth - 1)))];
    });
  }
  return positions;
}

function positionsFor(component) {
  if (originalLayouts[component.name]) return originalLayouts[component.name];
  return autoLayout(component);
}

function sceneGeometry() {
  const count = Math.max(1, components.length);
  const columns = Math.min(6, count);
  const rows = Math.ceil(count / columns);
  const slotWidth = 190;
  return {
    columns,
    rows,
    slotWidth,
    width: Math.max(720, columns * slotWidth + 48),
    rowHeight: 275,
    height: rows * 275
  };
}

function hatchLines(y, width) {
  const parts = [];
  for (let x = 25; x < width - 15; x += 28) {
    parts.push(`<line x1="${x}" y1="${y + 4}" x2="${x - 10}" y2="${y + 17}" class="ground-hatch"/>`);
  }
  return parts.join('');
}

function edgeScreenPoints(edge, positions, centerX, baseline) {
  if (edge.a === 'G') {
    const [x, y] = positions[edge.b];
    return { x1: centerX + x, y1: baseline, x2: centerX + x, y2: baseline + y };
  }
  if (edge.b === 'G') {
    const [x, y] = positions[edge.a];
    return { x1: centerX + x, y1: baseline + y, x2: centerX + x, y2: baseline };
  }
  const [ax, ay] = positions[edge.a];
  const [bx, by] = positions[edge.b];
  return { x1: centerX + ax, y1: baseline + ay, x2: centerX + bx, y2: baseline + by };
}

function renderGraphSvg(component, componentIndex, centerX, baseline, interactive, showValues) {
  const positions = positionsFor(component);
  const parts = [];
  const pending = pendingMove && pendingMove.type === 'graph' && pendingMove.componentIndex === componentIndex
    ? pendingMove.edgeIndex : -1;
  const gone = recentGone.get(componentIndex) || new Set();

  component.edges.forEach((edge, edgeIndex) => {
    const alive = (component.mask & bit(edgeIndex)) !== 0n;
    const recentlyGone = gone.has(edgeIndex);
    if (!alive && !recentlyGone) return;
    const p = edgeScreenPoints(edge, positions, centerX, baseline);
    const classes = ['branch'];
    if (alive && interactive) classes.push('playable');
    if (edgeIndex === pending) classes.push('move-pending');
    if (recentlyGone) classes.push('recent-gone');
    parts.push(`<line class="${classes.join(' ')}" data-component="${componentIndex}" data-edge="${edgeIndex}" x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}"><title>${escapeHtml(component.name)} ${escapeHtml(edge.a)}-${escapeHtml(edge.b)}${alive ? ': cut this segment' : ': falling away'}</title></line>`);
  });

  Object.entries(positions).forEach(([vertex, [x, y]]) => {
    const connected = component.edges.some((edge, index) =>
      (component.mask & bit(index)) !== 0n && (edge.a === vertex || edge.b === vertex));
    if (connected) parts.push(`<circle class="joint" cx="${centerX + x}" cy="${baseline + y}" r="4.2"/>`);
  });

  parts.push(`<text class="component-label" x="${centerX}" y="${baseline + 36}">${escapeHtml(component.name)}</text>`);
  if (showValues) parts.push(`<text class="component-value" x="${centerX}" y="${baseline + 54}">G = ${componentValue(component)}</text>`);
  return parts.join('');
}

function renderHeapSvg(component, componentIndex, centerX, baseline, interactive, showValues) {
  const pending = pendingMove && pendingMove.type === 'heap' && pendingMove.componentIndex === componentIndex;
  const classes = ['pot-group'];
  if (interactive && component.size > 0) classes.push('playable');
  if (pending) classes.push('move-pending');
  const parts = [`<g class="${classes.join(' ')}" data-heap="${componentIndex}">`];
  parts.push(`<path class="pot-body" d="M ${centerX - 42} ${baseline - 66} L ${centerX + 42} ${baseline - 66} L ${centerX + 31} ${baseline - 8} Q ${centerX} ${baseline + 4} ${centerX - 31} ${baseline - 8} Z"/>`);
  parts.push(`<ellipse class="pot-rim" cx="${centerX}" cy="${baseline - 66}" rx="44" ry="10"/>`);

  const shown = Math.min(component.size, 24);
  for (let index = 0; index < shown; index += 1) {
    const col = index % 6;
    const row = Math.floor(index / 6);
    const x = centerX - 27 + col * 11;
    const y = baseline - 61 + row * 12;
    parts.push(`<circle class="pebble" cx="${x}" cy="${y}" r="5"/>`);
  }
  parts.push(`<text class="pot-count" x="${centerX}" y="${baseline - 22}">${component.size}</text>`);
  parts.push(`</g>`);
  parts.push(`<text class="component-label" x="${centerX}" y="${baseline + 36}">${escapeHtml(component.name)}</text>`);
  if (showValues) parts.push(`<text class="component-value" x="${centerX}" y="${baseline + 54}">G = ${component.size}</text>`);
  return parts.join('');
}

function renderGarden(svg, interactive, showValues) {
  const geometry = sceneGeometry();
  svg.setAttribute('viewBox', `0 0 ${geometry.width} ${geometry.height}`);
  svg.innerHTML = '';
  const parts = [];

  for (let row = 0; row < geometry.rows; row += 1) {
    const baseline = row * geometry.rowHeight + 205;
    parts.push(`<line x1="18" y1="${baseline}" x2="${geometry.width - 18}" y2="${baseline}" class="ground-line"/>`);
    parts.push(hatchLines(baseline, geometry.width));
  }

  components.forEach((component, index) => {
    const row = Math.floor(index / geometry.columns);
    const col = index % geometry.columns;
    const centerX = 24 + (col + .5) * geometry.slotWidth;
    const baseline = row * geometry.rowHeight + 205;
    const canInteract = interactive && isHumanTurn();
    parts.push(component.type === 'graph'
      ? renderGraphSvg(component, index, centerX, baseline, canInteract, showValues)
      : renderHeapSvg(component, index, centerX, baseline, canInteract, showValues));
  });

  svg.innerHTML = parts.join('');

  if (interactive) {
    svg.querySelectorAll('.branch.playable').forEach((line) => {
      line.addEventListener('click', () => {
        if (!isHumanTurn()) return;
        const componentIndex = Number(line.dataset.component);
        const edgeIndex = Number(line.dataset.edge);
        const component = components[componentIndex];
        const nextMask = canonicalMask(component, component.mask & ~bit(edgeIndex));
        animateAndApply({ type: 'graph', componentIndex, edgeIndex, nextMask }, 'human');
      });
    });
    svg.querySelectorAll('.pot-group.playable').forEach((group) => {
      group.addEventListener('click', () => {
        const input = $(`[data-heap-input="${group.dataset.heap}"]`);
        input?.focus();
      });
    });
  }
}
