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

function showRuntimeError(error, context = 'runtime', meta = {}) {
  const message = String(error?.message || error || 'Unknown error');
  const diagnostics = buildErrorDiagnostics(error, context, meta);
  console.error(`POV RL Racing Lab ${context} error.`, error);
  bootError.style.display = 'block';
  bootError.replaceChildren();
  const title = document.createElement('strong');
  title.textContent = `POV RL Racing Lab hit a ${context} error.`;
  const summary = document.createElement('p');
  summary.textContent = message;
  const help = document.createElement('p');
  help.textContent = 'Detailed diagnostics are below. Copy them when reporting the problem; DevTools Console still contains the original error object.';
  const details = document.createElement('details');
  details.open = true;
  const detailsSummary = document.createElement('summary');
  detailsSummary.textContent = 'Full error diagnostics';
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
  bootError.append(title, summary, help, details);
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
    url.searchParams.set('v', releaseVersion);
    script.src = url.href;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Could not load ${relativePath}.`));
    document.head.appendChild(script);
  });
}

try {
  globalThis.THREE = await import('https://cdn.jsdelivr.net/npm/three@0.170.0/+esm');
  for (const file of [
    'state.js','scene.js','tracks.js','cars.js','model.js','perception.js','simulation.js','physics.js','session.js','training.js','race.js','brain-viz.js','audio.js','ui.js','runtime.js'
  ]) await loadClassicScript(file);
} catch (error) {
  showRuntimeError(error, 'startup');
  lab.style.display = 'none';
}
