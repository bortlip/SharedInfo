'use strict';

function renderMovePanel() {
  const panel = $('#move-panel');
  const heaps = components.map((component, index) => ({ component, index })).filter(({ component }) => component.type === 'heap');
  const human = isHumanTurn();
  const graphAvailable = components.some((component) => component.type === 'graph' && component.mask !== 0n);

  const intro = human
    ? `${graphAvailable ? 'Click any green segment in the garden to cut it.' : ''}${graphAvailable && heaps.some(({ component }) => component.size > 0) ? ' Or ' : ''}${heaps.some(({ component }) => component.size > 0) ? 'remove pebbles below.' : ''}`
    : gameOver ? 'The game is finished.' : 'Move controls are locked while the computer is moving.';

  const controls = heaps.map(({ component, index }) => {
    const disabled = !human || component.size === 0;
    return `<div class="heap-control">
      <div><strong>${escapeHtml(component.name)}</strong><div class="status-note">${component.size} pebble${component.size === 1 ? '' : 's'} remain</div></div>
      <label><span>Leave this many</span><input data-heap-input="${index}" type="number" min="0" max="${Math.max(0, component.size - 1)}" value="${Math.max(0, component.size - 1)}" ${disabled ? 'disabled' : ''}></label>
      <button type="button" class="button" data-heap-button="${index}" ${disabled ? 'disabled' : ''}>Remove</button>
    </div>`;
  }).join('');

  panel.innerHTML = `<div class="status-note">${intro}</div>${controls}`;
  panel.querySelectorAll('[data-heap-button]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!isHumanTurn()) return;
      const componentIndex = Number(button.dataset.heapButton);
      const component = components[componentIndex];
      const input = panel.querySelector(`[data-heap-input="${componentIndex}"]`);
      const target = Number(input.value);
      if (!Number.isInteger(target) || target < 0 || target >= component.size) return;
      animateAndApply({ type: 'heap', componentIndex, target }, 'human');
    });
  });
}

function renderTurnBanner() {
  const banner = $('#turn-banner');
  banner.className = 'turn-banner';

  if (gameOver) {
    banner.classList.add('finished');
    const winner = log[0]?.actor || 'The last player';
    banner.innerHTML = `<h2>Game over — ${escapeHtml(winner)} wins</h2><p>The last legal move was made; no moves remain.</p>`;
    return;
  }

  if (isAnimating || isComputerTurn()) {
    banner.classList.add('computer');
    const action = pendingMove ? `About to ${moveLabel(pendingMove)}.` : 'Choosing the balancing move...';
    banner.innerHTML = `<h2>${escapeHtml(actorLabel())}'s turn</h2><p>${escapeHtml(action)} Watch the flashing piece.</p>`;
    return;
  }

  const mode = $('#player-mode').value;
  const heading = mode === 'human-ai' ? 'Your turn' : `${actorLabel()}'s turn`;
  banner.innerHTML = `<h2>${escapeHtml(heading)}</h2><p>Cut a green segment or remove at least one pebble.</p>`;
}

function renderMetrics() {
  const total = totalValue();
  const values = components.map(componentValue);
  const status = gameOver ? 'Finished' : total === 0 ? 'Losing' : 'Winning';
  $('#metrics').innerHTML = `
    <div class="metric"><div class="metric-label">Player to move</div><div class="metric-value">${gameOver ? '—' : escapeHtml(actorLabel())}</div></div>
    <div class="metric"><div class="metric-label">Total Grundy value</div><div class="metric-value">${total}</div></div>
    <div class="metric"><div class="metric-label">Position under perfect play</div><div class="metric-value">${status}</div></div>
    <div class="metric"><div class="metric-label">Component values</div><div class="metric-value" style="font-size:1rem">${values.join(' ⊕ ')}</div></div>`;
  $('#xor-expression').textContent = `${values.join(' XOR ')} = ${total}`;
}

function renderLog() {
  const list = $('#move-log');
  if (!log.length) {
    list.innerHTML = '<li class="status-note">No moves yet.</li>';
    return;
  }
  list.innerHTML = log.map((entry) => `
    <li><strong>${escapeHtml(entry.actor)}</strong>: ${escapeHtml(entry.text)}<br>
    <small>Total XOR ${entry.beforeTotal} → ${entry.afterTotal}${entry.source !== 'human' ? ' · perfect move' : ''}</small></li>`).join('');
}

function renderLastExplanation() {
  $('#last-explanation').innerHTML = `<p>${escapeHtml(lastExplanation)}</p><p class="status-note">A perfect move aims to leave total XOR 0. From 0, every legal move makes the total nonzero.</p>`;
}

function describeMove(move) {
  if (!move) return 'No move is available.';
  const component = components[move.componentIndex];
  if (move.type === 'heap') {
    return `Remove ${component.size - move.target} pebble${component.size - move.target === 1 ? '' : 's'} from ${component.name}, leaving ${move.target}.`;
  }
  const edge = component.edges[move.edgeIndex];
  return `Cut ${component.name}'s ${edge.a}-${edge.b} segment. The component becomes G=${move.nextG}.`;
}

function componentOptions(component, componentIndex) {
  if (component.type === 'heap') {
    return Array.from({ length: component.size }, (_, target) => ({ label: `Leave ${target} pebble${target === 1 ? '' : 's'}`, value: target }));
  }
  return graphMoveOptions(component, componentIndex).map((move) => {
    const edge = component.edges[move.edgeIndex];
    return { label: `Cut ${edge.a}-${edge.b}`, value: move.nextG };
  });
}
