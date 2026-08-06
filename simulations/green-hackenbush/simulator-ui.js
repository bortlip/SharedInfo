'use strict';

function renderExplain() {
  const total = totalValue();
  const otherPlayer = currentPlayer === 1 ? 2 : 1;
  const winner = gameOver
    ? (log[0]?.actor || 'The last player')
    : total === 0 ? actorLabel(otherPlayer) : actorLabel(currentPlayer);
  const perfectMove = total === 0 || gameOver ? null : choosePerfectMove();
  const outcomeText = gameOver
    ? 'No moves remain, so the player who made the last move has won.'
    : total === 0
      ? `${actorLabel(currentPlayer)} must break the balance, and ${actorLabel(otherPlayer)} can restore it after every move.`
      : `${actorLabel(currentPlayer)} can immediately move to total XOR 0${perfectMove ? `: ${escapeHtml(describeMove(perfectMove))}` : '.'}`;

  const namedValues = components.map((component) => `${escapeHtml(component.name)} = ${componentValue(component)}`).join(', ');

  const adjustableBowlIndex = components.findIndex((component) => component.type === 'heap');
  let bowlBalanceText;

  if (adjustableBowlIndex >= 0) {
    const bowl = components[adjustableBowlIndex];
    const requiredBowlSize = components.reduce(
      (xor, component, index) => index === adjustableBowlIndex ? xor : xor ^ componentValue(component),
      0
    );
    const secondMover = log.length === 0 && !gameOver
      ? escapeHtml(actorLabel(otherPlayer))
      : 'the player who moves second from that position';

    bowlBalanceText = bowl.size === requiredBowlSize
      ? `To tune the game for a second-player win, set one bowl equal to the XOR of everything else. Using <strong>${escapeHtml(bowl.name)}</strong> as that bowl, the required amount is <strong>${requiredBowlSize}</strong>. It is already set to ${bowl.size}, so the total is 0 and <strong>${secondMover}</strong> has the winning position.`
      : `To tune the game for a second-player win, set one bowl equal to the XOR of everything else. Using <strong>${escapeHtml(bowl.name)}</strong> as that bowl, this selection requires <strong>${requiredBowlSize}</strong> pebble${requiredBowlSize === 1 ? '' : 's'} rather than ${bowl.size}; that would make the total 0 and give <strong>${secondMover}</strong> the winning position.`;
  } else if (total === 0) {
    bowlBalanceText = 'The selected shrubs are already balanced at total XOR 0, so no additional bowl is needed to create a second-player winning position.';
  } else {
    const secondMover = log.length === 0 && !gameOver
      ? escapeHtml(actorLabel(otherPlayer))
      : 'the player who moves second from that position';
    bowlBalanceText = `To tune the game for a second-player win, add a bowl containing <strong>${total}</strong> pebble${total === 1 ? '' : 's'}. It would cancel the rest of the garden to total XOR 0 and give <strong>${secondMover}</strong> the winning position.`;
  }

  $('#theory-intro').innerHTML = `
    <h2>Sprague-Grundy theory: why this garden can be solved like Nim</h2>
    <p>This puzzle is a <strong>finite impartial normal-play game</strong>: both players always have the same legal moves from a position, the game must eventually end, and whoever makes the last move wins. Sprague-Grundy theory says every independent component of such a game behaves exactly like a Nim heap of some size.</p>
    <div class="theory-steps">
      <div class="theory-step"><strong><span class="step-number">1</span>Split the garden</strong>Each shrub and bowl is an independent mini-game. A move changes exactly one component.</div>
      <div class="theory-step"><strong><span class="step-number">2</span>Assign a Grundy value</strong>Terminal positions are 0. Otherwise use <em>mex</em>: the smallest nonnegative value not reachable in one move.</div>
      <div class="theory-step"><strong><span class="step-number">3</span>Replace it with Nim</strong>A component with value <code>g</code> is strategically equivalent to a Nim heap containing <code>g</code> counters. The value is a strategy label, not a branch count.</div>
      <div class="theory-step"><strong><span class="step-number">4</span>Combine with XOR</strong>The value of the whole garden is the bitwise XOR of the component values, not their ordinary sum.</div>
      <div class="theory-step"><strong><span class="step-number">5</span>Read the winner</strong>Total XOR 0 is losing for the player to move. Any nonzero total has at least one move to 0.</div>
    </div>
    <div class="application-strip"><strong>Applied to this position:</strong> ${namedValues}. Their XOR is <strong>${total}</strong>. ${total === 0 ? 'The position is already balanced, so the player to move cannot preserve that balance.' : `The position is unbalanced, so ${escapeHtml(actorLabel(currentPlayer))} has a move that changes the total to 0.`}</div>
    <div class="balance-strip"><strong>Balancing with the bowl:</strong> ${bowlBalanceText}</div>
    <div class="guide-link-strip">
      <div><strong>Want the complete derivation?</strong><br><span>The puzzle guide works through every shrub, mex, nimbers, XOR, the winning strategy, and the recursive solver.</span></div>
      <a class="button primary" href="the-last-gardener.html">Read the full puzzle guide</a>
    </div>`;

  $('#explain-summary').innerHTML = `
    <section class="panel callout winner">
      <h2>${escapeHtml(winner)} wins with perfect play</h2>
      <p>The component values XOR to <strong>${total}</strong>. ${outcomeText}</p>
    </section>
    <section class="panel callout">
      <h2>The one-line calculation</h2>
      <p><code>${components.map(componentValue).join(' XOR ')} = ${total}</code></p>
      <p class="status-note">A total of 0 is losing for the player whose turn it is.</p>
    </section>`;

  renderGarden($('#explain-garden-svg'), false, true);
  $('#explain-xor').textContent = `${components.map(componentValue).join(' XOR ')} = ${total}`;

  $('#component-analysis').innerHTML = components.map((component, index) => {
    const options = componentOptions(component, index);
    const values = [...new Set(options.map((option) => option.value))].sort((a, b) => a - b);
    const rows = options.length <= 12
      ? options.map((option) => `<li>${escapeHtml(option.label)} → G=${option.value}</li>`).join('')
      : `<li>Can leave every heap size from 0 through ${component.size - 1}.</li>`;
    const reasoning = component.type === 'heap'
      ? `A bowl of ${component.size} pebbles can move to every smaller number, so its value is ${component.size}.`
      : `Reachable values: {${values.join(', ') || 'none'}}. The first missing nonnegative number is ${componentValue(component)}.`;
    return `<article class="panel analysis-card">
      <h3>${escapeHtml(component.name)}: G=${componentValue(component)}</h3>
      <p>${escapeHtml(reasoning)}</p>
      <ul class="option-list">${rows}</ul>
    </article>`;
  }).join('');

  const values = components.map(componentValue);
  const bitWidth = Math.max(1, ...values.concat(total).map((value) => value.toString(2).length));
  const rows = components.map((component) => {
    const value = componentValue(component);
    return `<tr><td>${escapeHtml(component.name)}</td><td>${value}</td><td>${value.toString(2).padStart(bitWidth, '0')}</td></tr>`;
  }).join('');
  $('#xor-analysis').innerHTML = `
    <h3>How the values combine</h3>
    <p>XOR is binary addition without carrying: a column with an even number of 1s becomes 0; an odd number becomes 1.</p>
    <table class="xor-table">
      <thead><tr><th>Component</th><th>Decimal</th><th>Binary</th></tr></thead>
      <tbody>${rows}<tr><td><strong>Total XOR</strong></td><td><strong>${total}</strong></td><td><strong>${total.toString(2).padStart(bitWidth, '0')}</strong></td></tr></tbody>
    </table>`;

  $('#theory-section').innerHTML = `
    <h3>The perfect-play recipe for this exact position</h3>
    <p><strong>First calculate:</strong> ${namedValues}, giving total XOR <code>${total}</code>.</p>
    <p>${total === 0
      ? `<strong>The player to move is losing under perfect play.</strong> Every legal move makes the XOR nonzero, so the opponent can answer by restoring 0.`
      : `<strong>The player to move is winning under perfect play.</strong> ${perfectMove ? `The solver's recommended move is: ${escapeHtml(describeMove(perfectMove))}` : 'A move to XOR 0 exists.'}`}</p>
    <p>After reaching XOR 0, the strategy is not necessarily to copy the opponent's physical move. It is to make whatever legal reply restores the total XOR to 0.</p>`;
}

function renderControls() {
  const mode = $('#player-mode').value;
  $('#step-ai').disabled = gameOver || isAnimating || !isComputerTurn();
  $('#autoplay').disabled = gameOver || isAnimating || mode !== 'perfect';
  $('#autoplay-speed').disabled = mode !== 'perfect';
  $('#autoplay').textContent = autoplayActive ? 'Stop autoplay' : 'Autoplay';
}

function renderAll() {
  renderTurnBanner();
  renderGarden($('#garden-svg'), true, true);
  renderMovePanel();
  renderMetrics();
  renderLastExplanation();
  renderLog();
  renderControls();
  renderExplain();
}

function stopAutoplay() {
  autoplayActive = false;
  autoplayToken += 1;
  renderControls();
}

async function toggleAutoplay() {
  if (autoplayActive) {
    stopAutoplay();
    return;
  }
  if ($('#player-mode').value !== 'perfect' || gameOver || isAnimating) return;
  autoplayActive = true;
  const token = ++autoplayToken;
  renderControls();
  while (autoplayActive && token === autoplayToken && !gameOver) {
    await animateAndApply(choosePerfectMove(), 'autoplay');
  }
  if (token === autoplayToken) {
    autoplayActive = false;
    renderControls();
  }
}

function switchView(view) {
  activeView = view;
  $$('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.view === view));
  $('#play-view').classList.toggle('active', view === 'play');
  $('#explain-view').classList.toggle('active', view === 'explain');
  if (view === 'explain') renderExplain();
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomShrubLine(index, edgeCount, cycleChance) {
  const vertices = ['G'];
  const edges = [];
  const seen = new Set();
  let nextCode = 65;

  function addEdge(a, b) {
    const key = [a, b].sort().join('|');
    if (a === b || seen.has(key)) return false;
    seen.add(key);
    edges.push([a, b]);
    return true;
  }

  while (edges.length < edgeCount) {
    const canCycle = vertices.length >= 3;
    const makeCycle = canCycle && Math.random() * 100 < cycleChance;

    if (makeCycle) {
      let added = false;
      for (let attempt = 0; attempt < 40 && !added; attempt += 1) {
        const a = vertices[randomInt(0, vertices.length - 1)];
        const b = vertices[randomInt(0, vertices.length - 1)];
        added = addEdge(a, b);
      }
      if (added) continue;
    }

    const newVertex = String.fromCharCode(nextCode++);
    const parent = vertices[randomInt(0, vertices.length - 1)];
    vertices.push(newVertex);
    addEdge(parent, newVertex);
  }

  return `shrub Random${index}: ${edges.map(([a, b]) => `${a}-${b}`).join(', ')}`;
}

function generateRandomDefinition() {
  const shrubCount = Math.max(1, Math.min(10, Number($('#random-shrubs').value) || 1));
  const heapCount = Math.max(0, Math.min(6, Number($('#random-heaps').value) || 0));
  let minEdges = Math.max(1, Math.min(12, Number($('#random-min-edges').value) || 1));
  let maxEdges = Math.max(1, Math.min(12, Number($('#random-max-edges').value) || 1));
  if (minEdges > maxEdges) [minEdges, maxEdges] = [maxEdges, minEdges];
  const cycleChance = Number($('#random-cycle').value) || 0;

  const lines = ['# Random Green Hackenbush game'];
  for (let index = 1; index <= shrubCount; index += 1) {
    lines.push(randomShrubLine(index, randomInt(minEdges, maxEdges), cycleChance));
  }
  for (let index = 1; index <= heapCount; index += 1) lines.push(`heap Bowl${index}: ${randomInt(1, 15)}`);
  return lines.join('\n');
}

function loadText(text, summary) {
  try {
    stopAutoplay();
    components = parseDefinition(text);
    initialDefinition = text;
    currentPlayer = 1;
    gameOver = false;
    isAnimating = false;
    pendingMove = null;
    recentGone = new Map();
    log = [];
    lastExplanation = 'Game loaded. The garden is ready.';
    $('#parse-message').textContent = 'Loaded successfully.';
    $('#setup-summary').textContent = summary;
    $('#setup-panel').open = false;
    renderAll();
  } catch (error) {
    $('#parse-message').textContent = error.message;
  }
}

$$('.tab').forEach((tab) => tab.addEventListener('click', () => switchView(tab.dataset.view)));
$('#theme-select').addEventListener('change', () => applyTheme($('#theme-select').value, true));
$('#load-preset').addEventListener('click', () => {
  $('#definition').value = originalDefinition;
  $('#parse-message').textContent = 'Original puzzle restored in the editor.';
});
$('#load-definition').addEventListener('click', () => loadText($('#definition').value, 'Custom game loaded'));
$('#generate-random').addEventListener('click', () => {
  $('#definition').value = generateRandomDefinition();
  $('#parse-message').textContent = 'Random game generated. Review it, then load it.';
});
$('#generate-load').addEventListener('click', () => {
  const text = generateRandomDefinition();
  $('#definition').value = text;
  loadText(text, 'Random game loaded');
});
$('#random-cycle').addEventListener('input', () => { $('#cycle-value').textContent = `${$('#random-cycle').value}%`; });
$('#autoplay-speed').addEventListener('input', updateSpeedLabel);
$('#step-ai').addEventListener('click', () => animateAndApply(choosePerfectMove(), 'perfect'));
$('#autoplay').addEventListener('click', toggleAutoplay);
$('#reset').addEventListener('click', resetGame);
$('#clear-log').addEventListener('click', () => { log = []; renderLog(); });
$('#player-mode').addEventListener('change', () => {
  stopAutoplay();
  renderAll();
  if ($('#player-mode').value === 'human-ai' && currentPlayer === 2 && !gameOver) {
    window.setTimeout(() => animateAndApply(choosePerfectMove(), 'perfect'), 400);
  }
});

applyTheme(loadStoredTheme());
$('#definition').value = originalDefinition;
components = parseDefinition(originalDefinition);
updateSpeedLabel();
renderAll();
