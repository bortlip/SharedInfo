'use strict';

(() => {
  const SAFE_VERSION = '1.2.1';
  const SAFE_ORIGINAL_DEFINITION = `# The Last Gardener
shrub Oak: G-A, A-B, B-C, A-D
shrub Arch: G-A, A-B, B-G
shrub Window: G-A, A-B, B-C, C-G
shrub Tower: G-A, A-B, B-G, B-C, C-D
heap Bowl: ?`;

  let spoilersVisible = false;
  let gameStarted = false;
  let pendingDefinition = SAFE_ORIGINAL_DEFINITION;
  let pendingSummary = 'Original puzzle loaded';
  let pendingHeaps = [];

  document.querySelectorAll('.site-header a[href="THE_LAST_GARDENER.md"], .site-header a[href*="github.com"]')
    .forEach((link) => link.remove());

  const legacyDialog = document.getElementById('bowl-setup-dialog');
  if (legacyDialog) {
    const legacyForm = document.getElementById('bowl-setup-form');
    const legacyHeading = document.getElementById('bowl-setup-title');
    const details = document.createElement('details');
    details.className = 'panel bowl-setup-panel';
    details.id = 'bowl-setup-panel';
    details.open = true;

    const summary = document.createElement('summary');
    const title = document.createElement('span');
    title.id = 'bowl-setup-title';
    title.textContent = legacyHeading?.textContent || 'Choose the starting bowl size';
    const state = document.createElement('span');
    state.id = 'bowl-setup-state';
    state.className = 'bowl-setup-state';
    state.textContent = 'Not started';
    summary.append(title, state);

    const body = document.createElement('div');
    body.className = 'bowl-setup-body';
    legacyHeading?.remove();
    legacyForm.removeAttribute('method');
    legacyForm.querySelector('.bowl-setup-actions a')?.remove();
    body.append(legacyForm);
    details.append(summary, body);
    legacyDialog.replaceWith(details);
  }

  document.body.classList.remove('setup-locked');
  document.body.classList.add('game-not-started');

  const panel = document.getElementById('bowl-setup-panel');
  const form = document.getElementById('bowl-setup-form');
  const fields = document.getElementById('bowl-setup-fields');
  const error = document.getElementById('bowl-setup-error');
  const spoilerToggle = document.getElementById('spoiler-toggle');

  document.querySelectorAll('.site-version').forEach((node) => { node.textContent = `App v${SAFE_VERSION}`; });
  const footerVersion = document.querySelector('.site-footer > span');
  if (footerVersion) footerVersion.textContent = `Green Hackenbush Garden · App v${SAFE_VERSION}`;

  function heapDefinitions(text) {
    return text.split(/\r?\n/).map((line, lineIndex) => {
      const match = line.match(/^(\s*heap\s+([^:]+):\s*)(\?|\d+)(\s*(?:#.*)?)$/i);
      if (!match) return null;
      return {
        lineIndex,
        prefix: match[1],
        name: match[2].trim(),
        value: match[3],
        suffix: match[4] || ''
      };
    }).filter(Boolean);
  }

  function resolvedDefinition(text, heaps, values) {
    const lines = text.split(/\r?\n/);
    heaps.forEach((heap, index) => {
      lines[heap.lineIndex] = `${heap.prefix}${values[index]}${heap.suffix}`;
    });
    return lines.join('\n');
  }

  function previewDefinition(text, heaps) {
    return resolvedDefinition(text, heaps, heaps.map((heap) => heap.value === '?' ? 0 : Number(heap.value)));
  }

  function setPanelText(title, copy, state) {
    document.getElementById('bowl-setup-title').textContent = title;
    document.getElementById('bowl-setup-copy').textContent = copy;
    document.getElementById('bowl-setup-state').textContent = state;
  }

  function prepareBowlSetup(text, summary, focusPanel = false) {
    pendingDefinition = text;
    pendingSummary = summary;
    pendingHeaps = heapDefinitions(text);
    error.textContent = '';

    if (!pendingHeaps.length) {
      gameStarted = true;
      document.body.classList.remove('game-not-started');
      spoilerToggle.disabled = false;
      loadText(text, summary);
      panel.open = false;
      return;
    }

    fields.innerHTML = pendingHeaps.map((heap, index) => {
      const known = heap.value !== '?';
      const value = known ? heap.value : '';
      return `<label class="bowl-field">
        <span>${escapeHtml(heap.name)}</span>
        <input type="number" min="0" step="1" inputmode="numeric" data-bowl-index="${index}" value="${value}" placeholder="Choose a nonnegative integer" required>
        <small>${known ? 'Current definition value; change it or keep it.' : 'Unknown in the puzzle. Choose a value whenever you are ready.'}</small>
      </label>`;
    }).join('');

    form.querySelector('button[type="submit"]').textContent = gameStarted ? 'Restart with these values' : 'Start game';
    setPanelText(
      pendingHeaps.length === 1 ? 'Choose the starting bowl size' : 'Choose the starting bowl sizes',
      pendingHeaps.length === 1
        ? 'The puzzle leaves this value unknown. You can inspect the simulator first; enter a value here when you are ready to play.'
        : 'Each bowl has its own field. You can inspect the position first, then choose all starting values when you are ready.',
      'Not started'
    );

    stopAutoplay();
    gameStarted = false;
    document.body.classList.add('game-not-started');
    spoilerToggle.disabled = true;
    components = parseDefinition(previewDefinition(text, pendingHeaps));
    initialDefinition = previewDefinition(text, pendingHeaps);
    currentPlayer = 1;
    gameOver = false;
    isAnimating = false;
    pendingMove = null;
    recentGone = new Map();
    log = [];
    lastExplanation = 'Choose the starting bowl values when you are ready to begin.';
    document.getElementById('definition').value = text;
    document.getElementById('setup-summary').textContent = 'Previewing — bowl values not chosen';
    panel.open = true;
    renderAll();

    if (focusPanel) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => fields.querySelector('input')?.focus(), 250);
    }
  }

  function replaceButton(id, handler) {
    const oldButton = document.getElementById(id);
    if (!oldButton) return null;
    const button = oldButton.cloneNode(true);
    oldButton.replaceWith(button);
    button.addEventListener('click', handler);
    return button;
  }

  const baseRenderGarden = renderGarden;
  const baseRenderMovePanel = renderMovePanel;
  const baseRenderMetrics = renderMetrics;
  const baseRenderLog = renderLog;
  const baseRenderLastExplanation = renderLastExplanation;
  const baseRenderExplain = renderExplain;
  const baseRenderTurnBanner = renderTurnBanner;
  const baseRenderControls = renderControls;

  renderGarden = function spoilerAwareGarden(svg, interactive, showValues) {
    const result = baseRenderGarden(svg, gameStarted && interactive, gameStarted && showValues && spoilersVisible);
    if (!gameStarted) {
      const counts = svg.querySelectorAll('.pot-count');
      pendingHeaps.forEach((heap, index) => {
        if (counts[index]) counts[index].textContent = heap.value === '?' ? '?' : heap.value;
      });
    }
    return result;
  };

  renderMovePanel = function spoilerAwareMovePanel() {
    if (gameStarted) return baseRenderMovePanel();
    document.getElementById('move-panel').innerHTML = '<div class="status-note">This is a preview. Choose the starting bowl values above to enable moves.</div>';
  };

  renderMetrics = function spoilerAwareMetrics() {
    if (!gameStarted) {
      const shrubs = components.filter((component) => component.type === 'graph').length;
      const bowls = pendingHeaps.length;
      document.getElementById('metrics').innerHTML = `
        <div class="metric"><div class="metric-label">Position preview</div><div class="metric-value">${shrubs} shrub${shrubs === 1 ? '' : 's'}</div></div>
        <div class="metric"><div class="metric-label">Starting bowls</div><div class="metric-value">${bowls} awaiting value${bowls === 1 ? '' : 's'}</div></div>`;
      document.getElementById('xor-expression').textContent = '';
      return;
    }
    if (spoilersVisible) return baseRenderMetrics();
    const moveCount = gameOver ? 0 : legalMoves().length;
    document.getElementById('metrics').innerHTML = `
      <div class="metric"><div class="metric-label">Player to move</div><div class="metric-value">${gameOver ? '—' : escapeHtml(actorLabel())}</div></div>
      <div class="metric"><div class="metric-label">Legal moves available</div><div class="metric-value">${moveCount}</div></div>`;
    document.getElementById('xor-expression').textContent = '';
  };

  renderLog = function spoilerAwareLog() {
    if (!gameStarted) {
      document.getElementById('move-log').innerHTML = '<li class="status-note">The game has not started yet.</li>';
      return;
    }
    if (spoilersVisible) return baseRenderLog();
    const list = document.getElementById('move-log');
    if (!log.length) {
      list.innerHTML = '<li class="status-note">No moves yet.</li>';
      return;
    }
    list.innerHTML = log.map((entry) => `
      <li><strong>${escapeHtml(entry.actor)}</strong>: ${escapeHtml(entry.text)}</li>`).join('');
  };

  renderLastExplanation = function spoilerAwareExplanation() {
    if (!gameStarted) {
      document.getElementById('last-explanation').innerHTML = '<p>Browse the position and controls, then choose the bowl values above when you are ready.</p><p class="status-note">No strategy information is calculated from the unknown starting values.</p>';
      return;
    }
    if (spoilersVisible) return baseRenderLastExplanation();
    const latest = log[0];
    document.getElementById('last-explanation').innerHTML = latest
      ? `<p>${escapeHtml(latest.actor)}: ${escapeHtml(latest.text)}</p><p class="status-note">Strategy values and winning-position information are hidden.</p>`
      : '<p>The starting position is ready.</p><p class="status-note">Strategy values and winning-position information are hidden.</p>';
  };

  renderTurnBanner = function spoilerAwareTurnBanner() {
    if (!gameStarted) {
      const banner = document.getElementById('turn-banner');
      banner.className = 'turn-banner';
      banner.innerHTML = '<h2>Position preview</h2><p>Choose the starting bowl values above whenever you are ready to begin.</p>';
      return;
    }
    if (spoilersVisible) return baseRenderTurnBanner();
    const banner = document.getElementById('turn-banner');
    banner.className = 'turn-banner';

    if (gameOver) {
      banner.classList.add('finished');
      const winner = log[0]?.actor || 'The last player';
      banner.innerHTML = `<h2>Game over — ${escapeHtml(winner)} wins</h2><p>The last legal move was made; no moves remain.</p>`;
      return;
    }

    if (isAnimating || isComputerTurn()) {
      banner.classList.add('computer');
      const action = pendingMove ? `About to ${moveLabel(pendingMove)}.` : 'Choosing a move...';
      banner.innerHTML = `<h2>${escapeHtml(actorLabel())}'s turn</h2><p>${escapeHtml(action)} Watch the flashing piece.</p>`;
      return;
    }

    const mode = document.getElementById('player-mode').value;
    const heading = mode === 'human-ai' ? 'Your turn' : `${actorLabel()}'s turn`;
    banner.innerHTML = `<h2>${escapeHtml(heading)}</h2><p>Cut a green segment or remove at least one pebble.</p>`;
  };

  renderControls = function spoilerAwareControls() {
    baseRenderControls();
    if (!gameStarted) {
      document.getElementById('step-ai').disabled = true;
      document.getElementById('autoplay').disabled = true;
      document.getElementById('reset').disabled = true;
    }
  };

  renderExplain = function spoilerAwareAnalysis() {
    if (!gameStarted) {
      document.getElementById('theory-intro').innerHTML = `
        <div class="spoiler-lock">
          <p class="spoiler-kicker">Starting values not chosen</p>
          <h2>Analysis begins after the game is configured</h2>
          <p>You can inspect the shapes now. Choose the bowl values above before asking the solver who is winning or what move is best.</p>
        </div>`;
      document.getElementById('explain-summary').innerHTML = '';
      document.getElementById('explain-xor').textContent = '';
      baseRenderGarden(document.getElementById('explain-garden-svg'), false, false);
      const counts = document.getElementById('explain-garden-svg').querySelectorAll('.pot-count');
      pendingHeaps.forEach((heap, index) => { if (counts[index]) counts[index].textContent = heap.value === '?' ? '?' : heap.value; });
      document.getElementById('component-analysis').innerHTML = '';
      document.getElementById('xor-analysis').innerHTML = '';
      document.getElementById('theory-section').innerHTML = '<p class="status-note">Strategy details remain unavailable until all bowl values are selected.</p>';
      return;
    }

    if (spoilersVisible) return baseRenderExplain();

    document.getElementById('theory-intro').innerHTML = `
      <div class="spoiler-lock">
        <p class="spoiler-kicker">Strategy information is hidden</p>
        <h2>Analysis is available when you choose to reveal it</h2>
        <p>This view can identify who is winning, display Grundy values, show the XOR total, and recommend a perfect move.</p>
        <button type="button" class="button primary" data-reveal-strategy>Reveal strategy information</button>
      </div>`;
    document.getElementById('explain-summary').innerHTML = '';
    document.getElementById('explain-xor').textContent = '';
    baseRenderGarden(document.getElementById('explain-garden-svg'), false, false);
    document.getElementById('component-analysis').innerHTML = '';
    document.getElementById('xor-analysis').innerHTML = '';
    document.getElementById('theory-section').innerHTML = `
      <h3>Prefer the full walkthrough?</h3>
      <p>The dedicated guide keeps its answer below a spoiler warning.</p>
      <p><a class="button" href="the-last-gardener.html">Open the puzzle guide</a></p>`;
    document.querySelector('[data-reveal-strategy]')?.addEventListener('click', () => setSpoilers(true));
  };

  function setSpoilers(visible) {
    spoilersVisible = Boolean(visible);
    document.body.classList.toggle('spoilers-hidden', !spoilersVisible);
    spoilerToggle.setAttribute('aria-pressed', String(spoilersVisible));
    spoilerToggle.textContent = spoilersVisible ? 'Strategy info: shown' : 'Strategy info: hidden';
    spoilerToggle.classList.toggle('revealed', spoilersVisible);
    renderAll();
  }

  spoilerToggle.addEventListener('click', () => {
    if (gameStarted) setSpoilers(!spoilersVisible);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const inputs = [...fields.querySelectorAll('[data-bowl-index]')];
    const values = inputs.map((input) => Number(input.value));
    const invalidIndex = values.findIndex((value) => !Number.isInteger(value) || value < 0);
    if (invalidIndex >= 0) {
      error.textContent = 'Enter a nonnegative whole number for every bowl.';
      inputs[invalidIndex].focus();
      return;
    }

    const resolved = resolvedDefinition(pendingDefinition, pendingHeaps, values);
    document.getElementById('definition').value = resolved;
    gameStarted = true;
    document.body.classList.remove('game-not-started');
    spoilerToggle.disabled = false;
    loadText(resolved, pendingSummary);
    const summary = pendingHeaps.map((heap, index) => `${heap.name} ${values[index]}`).join(' · ');
    setPanelText('Starting bowl values', 'Change any value and restart the game from this position.', summary);
    form.querySelector('button[type="submit"]').textContent = 'Restart with these values';
    panel.open = false;
  });

  replaceButton('load-preset', () => {
    document.getElementById('definition').value = SAFE_ORIGINAL_DEFINITION;
    document.getElementById('parse-message').textContent = 'Original puzzle restored. Choose the bowl size in the panel above.';
    prepareBowlSetup(SAFE_ORIGINAL_DEFINITION, 'Original puzzle loaded', true);
  });

  replaceButton('load-definition', () => {
    prepareBowlSetup(document.getElementById('definition').value, 'Custom game loaded', true);
  });

  replaceButton('generate-load', () => {
    const text = generateRandomDefinition();
    document.getElementById('definition').value = text;
    prepareBowlSetup(text, 'Random game loaded', true);
  });

  initialDefinition = SAFE_ORIGINAL_DEFINITION;
  components = [];
  currentPlayer = 1;
  gameOver = false;
  log = [];
  lastExplanation = 'Choose the starting bowl values when you are ready.';
  document.getElementById('definition').value = SAFE_ORIGINAL_DEFINITION;
  document.getElementById('setup-summary').textContent = 'Previewing — bowl values not chosen';
  setSpoilers(false);
  prepareBowlSetup(SAFE_ORIGINAL_DEFINITION, 'Original puzzle loaded');
})();
