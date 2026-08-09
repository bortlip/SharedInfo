const bootError = document.getElementById('bootError');
const lab = document.getElementById('lab');
const releaseVersion = globalThis.RL_RACING_LAB_VERSION || 'dev';

function buildErrorDiagnostics(error, context = 'runtime', meta = {}) {
  const message = String(error?.message || error || 'Unknown error');
  const name = String(error?.name || 'Error');
  const lines = [
    `POV RL Racing Lab ${context} error`,
    `Version: ${releaseVersion}`,
    `Time: ${new Date().toISOString()}`,
    `URL: ${location.href}`,
    `Name: ${name}`,
    `Message: ${message}`
  ];
  if (meta.filename) lines.push(`Source: ${meta.filename}${meta.lineno ? `:${meta.lineno}${meta.colno ? `:${meta.colno}` : ''}` : ''}`);
  if (error?.stack) lines.push('', 'Stack:', String(error.stack));
  return lines.join('\n');
}

let reportedErrorCount = 0;
function showRuntimeError(error, context = 'runtime', meta = {}) {
  const message = String(error?.message || error || 'Unknown error');
  const diagnostics = buildErrorDiagnostics(error, context, meta);
  console.error(`POV RL Racing Lab ${context} error.`, error);
  bootError.style.display = 'block';
  if (reportedErrorCount === 0) {
    bootError.replaceChildren();
    const title = document.createElement('strong');
    title.textContent = 'POV RL Racing Lab reported one or more errors.';
    const help = document.createElement('p');
    help.textContent = 'Each failure is preserved below in the order it was reported. Copy the diagnostics when reporting a problem; DevTools Console still contains the original error objects.';
    bootError.append(title, help);
  }
  reportedErrorCount++;
  const details = document.createElement('details');
  details.open = true;
  const detailsSummary = document.createElement('summary');
  detailsSummary.textContent = `${reportedErrorCount}. ${context}: ${message}`;
  const pre = document.createElement('pre');
  pre.textContent = diagnostics;
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = 'Copy diagnostics';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(diagnostics);
      copy.textContent = 'Copied ✓';
    } catch {
      copy.textContent = 'Copy failed — select the text below';
    }
  });
  details.append(detailsSummary, copy, pre);
  bootError.append(details);
}

globalThis.showRlRacingError = showRuntimeError;

globalThis.addEventListener('error', event => {
  const error = event?.error || new Error(event?.message || 'Unknown runtime error');
  showRuntimeError(error, 'runtime', {filename:event?.filename, lineno:event?.lineno, colno:event?.colno});
});
globalThis.addEventListener('unhandledrejection', event => {
  showRuntimeError(event.reason, 'promise');
});

function loadClassicScript(relativePath) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const url = new URL(relativePath, import.meta.url);
    const errorsBeforeLoad = reportedErrorCount;
    url.searchParams.set('v', releaseVersion);
    script.src = url.href;
    script.onload = () => {
      if (reportedErrorCount > errorsBeforeLoad) {
        reject(new Error(`${relativePath} reported an error while loading; startup stopped before dependent scripts ran.`));
        return;
      }
      resolve();
    };
    script.onerror = () => reject(new Error(`Could not load ${relativePath}.`));
    document.head.appendChild(script);
  });
}

try {
  globalThis.THREE = await import('https://cdn.jsdelivr.net/npm/three@0.170.0/+esm');
  for (const file of [
    'state.js','scene.js','tracks.js','cars.js','effects.js','model.js','perception.js','simulation.js','physics.js','session.js','training.js','experiments.js','race.js','brain-viz.js','audio.js','ui.js','runtime.js'
  ]) await loadClassicScript(file);
} catch (error) {
  showRuntimeError(error, 'startup');
  lab.style.display = 'none';
}
