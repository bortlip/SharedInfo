'use strict';

(() => {
  const SAFE_VERSION = '1.2.0';
  const SAFE_ORIGINAL_DEFINITION = `# The Last Gardener
shrub Oak: G-A, A-B, B-C, A-D
shrub Arch: G-A, A-B, B-G
shrub Window: G-A, A-B, B-C, C-G
shrub Tower: G-A, A-B, B-G, B-C, C-D
heap Bowl: ?`;

  let spoilersVisible = false;
  let pendingDefinition = SAFE_ORIGINAL_DEFINITION;
  let pendingSummary = 'Original puzzle loaded';
  let pendingHeaps = [];

  const dialog = document.getElementById('bowl-setup-dialog');
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

  function showDialog() {
    document.body.classList.add('setup-locked');
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function closeDialog() {
    if (dialog.open && typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    document.body.classList.remove('setup-locked');
  }

  function openBowlSetup(text, summary) {
    pendingDefinition = text;
    pendingSummary = summary;
    pendingHeaps = heapDefinitions(text);
    error.textContent = '';

    if (!pendingHeaps.length) {
      loadText(text, summary);
      closeDialog();
      return;
    }

    fields.innerHTML = pendingHeaps.map((heap, index) => {
      const known = heap.value !== '?';
      const value = known ? heap.value : '';
      return `<label class="bowl-field">
        <span>${escapeHtml(heap.name)}</span>
        <input type="number" min="0" step="1" inputmode="numeric" data-bowl-index="${index}" value="${value}" placeholder="Choose a nonnegative integer" required>
        <small>${known ? 'Current definition value; change it or keep it.' : 'Unknown in the puzzle. Choose a value before play begins.'}</small>
      </label>`;
    }).join('');

    const heading = document.getElementById('bowl-setup-title');
    heading.textContent = pendingHeaps.length === 1 ? 'Choose the starting bowl size' : 'Choose the starting bowl sizes';
    document.getElementById('bowl-setup-copy').textContent = pendingHeaps.length === 1
      ? 'The original puzzle leaves this value unknown. Enter your choice, then start the game.'
      : 'Every bowl is listed separately, so games with several bowls work the same way.';

    showDialog();
    window.setTimeout(() => fields.querySelector('input')?.focus(), 0);
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
  const baseRenderMetrics = renderMetrics;
  const baseRenderLog = renderLog;
  const baseRenderLastExplanation = renderLastExplanation;
  const baseRenderExplain = renderExplain;
  const baseRenderTurnBanner = renderTurnBanner;

  renderGarden = function spoilerAwareGarden(svg, interactive, showValues) {
    return baseRenderGarden(svg, interactive, showValues && spoilersVisible);
  };

  renderMetrics = function spoilerAwareMetrics() {
    if (spoilersVisible) return baseRenderMetrics();
    const moveCount = gameOver ? 0 : legalMoves().length;
    document.getElementById('metrics').innerHTML = `
      <div class="metric"><div class="metric-label">Player to move</div><div class="metric-value">${gameOver ? '—' : escapeHtml(actorLabel())}</div></div>
      <div class="metric"><div class="metric-label">Legal moves available</div><div class="metric-value">${moveCount}</div></div>`;
    document.getElementById('xor-expression').textContent = '';
  };

  renderLog = function spoilerAwareLog() {
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
    if (spoilersVisible) return baseRenderLastExplanation();
    const latest = log[0];
    document.getElementById('last-explanation').innerHTML = latest
      ? `<p>${escapeHtml(latest.actor)}: ${escapeHtml(latest.text)}</p><p class="status-note">Strategy values and winning-position information are hidden.</p>`
      : '<p>The starting position is ready.</p><p class="status-note">Strategy values and winning-position information are hidden.</p>';
  };

  renderTurnBanner = function spoilerAwareTurnBanner() {
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

  renderExplain = function spoilerAwareAnalysis() {
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

  spoilerToggle.addEventListener('click', () => setSpoilers(!spoilersVisible));

  dialog.addEventListener('cancel', (event) => event.preventDefault());
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
    loadText(resolved, pendingSummary);
    closeDialog();
  });

  replaceButton('load-preset', () => {
    document.getElementById('definition').value = SAFE_ORIGINAL_DEFINITION;
    document.getElementById('parse-message').textContent = 'Original puzzle restored. Choose the bowl size when you load it.';
  });

  replaceButton('load-definition', () => {
    openBowlSetup(document.getElementById('definition').value, 'Custom game loaded');
  });

  replaceButton('generate-load', () => {
    const text = generateRandomDefinition();
    document.getElementById('definition').value = text;
    openBowlSetup(text, 'Random game loaded');
  });

  initialDefinition = SAFE_ORIGINAL_DEFINITION;
  components = [];
  currentPlayer = 1;
  gameOver = false;
  log = [];
  lastExplanation = 'Choose the starting bowl size to begin.';
  document.getElementById('definition').value = SAFE_ORIGINAL_DEFINITION;
  document.getElementById('setup-summary').textContent = 'Waiting for bowl size';
  setSpoilers(false);
  openBowlSetup(SAFE_ORIGINAL_DEFINITION, 'Original puzzle loaded');
})();
