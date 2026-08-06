'use strict';

const APP_VERSION = '1.1.0';
const THEME_STORAGE_KEY = 'green-hackenbush-theme';
const root = document.body;
const $ = (selector) => root.querySelector(selector);
const $$ = (selector) => [...root.querySelectorAll(selector)];

function loadStoredTheme() {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return ['system', 'light', 'dark'].includes(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
const resolvedSystemTheme = () => systemTheme.matches ? 'dark' : 'light';

function applyTheme(theme, persist = false) {
  const normalized = ['system', 'light', 'dark'].includes(theme) ? theme : 'system';
  const resolved = normalized === 'system' ? resolvedSystemTheme() : normalized;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themeMode = normalized;
  $('#theme-select').value = normalized;
  $('#system-option').textContent = `System (${resolvedSystemTheme()})`;

  if (persist) {
    try { window.localStorage.setItem(THEME_STORAGE_KEY, normalized); } catch { /* File previews can block storage. */ }
  }
}

systemTheme.addEventListener?.('change', () => {
  $('#system-option').textContent = `System (${resolvedSystemTheme()})`;
  if (document.documentElement.dataset.themeMode === 'system') applyTheme('system');
});

$$('[data-app-version]').forEach((element) => { element.textContent = `v${APP_VERSION}`; });

const originalDefinition = `# The Last Gardener
shrub Oak: G-A, A-B, B-C, A-D
shrub Arch: G-A, A-B, B-G
shrub Window: G-A, A-B, B-C, C-G
shrub Tower: G-A, A-B, B-G, B-C, C-D
heap Bowl: 6`;

const originalLayouts = {
  Oak:   { A: [0, -58], B: [-30, -99], C: [-38, -145], D: [42, -100] },
  Arch:  { A: [-39, -61], B: [39, -61] },
  Window:{ A: [-43, -61], B: [0, -108], C: [43, -61] },
  Tower: { A: [-43, -61], B: [12, -61], C: [12, -104], D: [12, -149] }
};

let initialDefinition = originalDefinition;
let components = [];
let currentPlayer = 1;
let gameOver = false;
let log = [];
let lastExplanation = 'The starting position is ready. Cut a branch or remove pebbles when it is your turn.';
let isAnimating = false;
let pendingMove = null;
let recentGone = new Map();
let autoplayActive = false;
let autoplayToken = 0;
let activeView = 'play';

const delay = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

function autoplayDuration() {
  return Math.max(700, Math.min(4000, Number($('#autoplay-speed').value) || 1800));
}

function updateSpeedLabel() {
  const duration = autoplayDuration();
  const label = duration <= 1000 ? 'Fast' : duration >= 3000 ? 'Slow' : 'Normal';
  $('#autoplay-speed-label').textContent = `${label} · ${(duration / 1000).toFixed(1)} s / move`;
}

function moveTiming(source) {
  if (source === 'human') return { highlight: 260, fall: 780, gap: 0 };
  if (source !== 'autoplay') return { highlight: 1050, fall: 780, gap: 0 };

  const total = autoplayDuration();
  const highlight = Math.max(240, Math.round(total * .46));
  const fall = Math.max(220, Math.round(total * .34));
  const gap = Math.max(60, total - highlight - fall);
  return { highlight, fall, gap };
}

function applyAnimationTiming(timing) {
  root.style.setProperty('--move-flash-step', `${Math.max(55, timing.highlight / 4)}ms`);
  root.style.setProperty('--fall-duration', `${timing.fall}ms`);
}
const bit = (index) => 1n << BigInt(index);

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function mex(values) {
  let value = 0;
  while (values.has(value)) value += 1;
  return value;
}

function parseDefinition(text) {
  const parsed = [];
  const lines = text.split(/\r?\n/);

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const raw = lines[lineNumber].replace(/#.*$/, '').trim();
    if (!raw) continue;

    const match = raw.match(/^(shrub|heap)\s+([^:]+):\s*(.+)$/i);
    if (!match) throw new Error(`Line ${lineNumber + 1}: expected "shrub Name: ..." or "heap Name: ...".`);

    const type = match[1].toLowerCase();
    const name = match[2].trim();
    const body = match[3].trim();

    if (type === 'heap') {
      const size = Number(body);
      if (!Number.isInteger(size) || size < 0) throw new Error(`Line ${lineNumber + 1}: heap size must be a nonnegative integer.`);
      parsed.push({ type: 'heap', name, size, initialSize: size });
      continue;
    }

    const edges = [];
    const seen = new Set();
    const edgeRegex = /([A-Za-z0-9_]+)\s*-\s*([A-Za-z0-9_]+)/g;
    let edgeMatch;

    while ((edgeMatch = edgeRegex.exec(body)) !== null) {
      const a = edgeMatch[1];
      const b = edgeMatch[2];
      if (a === b) throw new Error(`Line ${lineNumber + 1}: self-edge ${a}-${b} is not allowed.`);
      const key = [a, b].sort().join('|');
      if (seen.has(key)) throw new Error(`Line ${lineNumber + 1}: duplicate edge ${a}-${b}.`);
      seen.add(key);
      edges.push({ a, b });
    }

    if (!edges.length) throw new Error(`Line ${lineNumber + 1}: no edges found.`);
    if (edges.length > 18) throw new Error(`Line ${lineNumber + 1}: shrubs are capped at 18 edges; 12 or fewer is strongly recommended.`);
    if (!edges.some((edge) => edge.a === 'G' || edge.b === 'G')) throw new Error(`Line ${lineNumber + 1}: shrub must have at least one edge touching G.`);

    const vertices = [...new Set(edges.flatMap((edge) => [edge.a, edge.b]))];
    const fullMask = (1n << BigInt(edges.length)) - 1n;
    const component = { type: 'graph', name, edges, vertices, fullMask, mask: fullMask, memo: new Map() };
    component.mask = canonicalMask(component, component.mask);
    parsed.push(component);
  }

  if (!parsed.length) throw new Error('No components found.');
  return parsed;
}

function canonicalMask(component, mask) {
  if (mask === 0n) return 0n;

  const adjacency = new Map(component.vertices.map((vertex) => [vertex, []]));
  component.edges.forEach((edge, index) => {
    if ((mask & bit(index)) === 0n) return;
    adjacency.get(edge.a).push({ other: edge.b, index });
    adjacency.get(edge.b).push({ other: edge.a, index });
  });

  const reachable = new Set(['G']);
  const queue = ['G'];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const vertex = queue[cursor];
    for (const item of adjacency.get(vertex) || []) {
      if (!reachable.has(item.other)) {
        reachable.add(item.other);
        queue.push(item.other);
      }
    }
  }

  let result = 0n;
  component.edges.forEach((edge, index) => {
    if ((mask & bit(index)) !== 0n && reachable.has(edge.a) && reachable.has(edge.b)) result |= bit(index);
  });
  return result;
}

function grundyGraph(component, mask) {
  const canonical = canonicalMask(component, mask);
  if (canonical === 0n) return 0;
  if (component.memo.has(canonical)) return component.memo.get(canonical);

  const reachable = new Set();
  component.edges.forEach((edge, index) => {
    if ((canonical & bit(index)) === 0n) return;
    const next = canonicalMask(component, canonical & ~bit(index));
    reachable.add(grundyGraph(component, next));
  });

  const value = mex(reachable);
  component.memo.set(canonical, value);
  return value;
}

function componentValue(component) {
  return component.type === 'heap' ? component.size : grundyGraph(component, component.mask);
}

function totalValue() {
  return components.reduce((total, component) => total ^ componentValue(component), 0);
}

function hasMoves() {
  return components.some((component) => component.type === 'heap' ? component.size > 0 : component.mask !== 0n);
}

function graphMoveOptions(component, componentIndex) {
  const options = [];
  component.edges.forEach((edge, edgeIndex) => {
    if ((component.mask & bit(edgeIndex)) === 0n) return;
    const nextMask = canonicalMask(component, component.mask & ~bit(edgeIndex));
    options.push({
      type: 'graph',
      componentIndex,
      edgeIndex,
      nextMask,
      nextG: grundyGraph(component, nextMask)
    });
  });
  return options;
}

function legalMoves() {
  const moves = [];
  const total = totalValue();

  components.forEach((component, componentIndex) => {
    const currentG = componentValue(component);

    if (component.type === 'heap') {
      for (let target = 0; target < component.size; target += 1) {
        const resultingTotal = total ^ currentG ^ target;
        moves.push({ type: 'heap', componentIndex, target, nextG: target, resultingTotal, winning: resultingTotal === 0 });
      }
      return;
    }

    graphMoveOptions(component, componentIndex).forEach((move) => {
      const resultingTotal = total ^ currentG ^ move.nextG;
      moves.push({ ...move, resultingTotal, winning: resultingTotal === 0 });
    });
  });

  return moves;
}

function choosePerfectMove() {
  const moves = legalMoves();
  return moves.find((move) => move.winning) || moves[0] || null;
}

function moveLabel(move) {
  if (!move) return '';
  const component = components[move.componentIndex];
  if (move.type === 'heap') {
    const removed = component.size - move.target;
    return `remove ${removed} pebble${removed === 1 ? '' : 's'} from ${component.name}`;
  }
  const edge = component.edges[move.edgeIndex];
  return `cut ${component.name} segment ${edge.a}-${edge.b}`;
}

function actorLabel(player = currentPlayer) {
  const mode = $('#player-mode').value;
  if (mode === 'human-ai') return player === 1 ? 'You' : 'Computer';
  if (mode === 'perfect') return `Computer Player ${player}`;
  return `Player ${player}`;
}

function isHumanTurn() {
  if (gameOver || isAnimating) return false;
  const mode = $('#player-mode').value;
  return mode === 'manual' || (mode === 'human-ai' && currentPlayer === 1);
}

function isComputerTurn() {
  if (gameOver || isAnimating) return false;
  const mode = $('#player-mode').value;
  return mode === 'perfect' || (mode === 'human-ai' && currentPlayer === 2);
}

function collectGoneEdges(component, beforeMask, afterMask) {
  const gone = new Set();
  component.edges.forEach((edge, index) => {
    if ((beforeMask & bit(index)) !== 0n && (afterMask & bit(index)) === 0n) gone.add(index);
  });
  return gone;
}
