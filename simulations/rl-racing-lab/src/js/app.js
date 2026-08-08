const bootError = document.getElementById('bootError');
const lab = document.getElementById('lab');
const releaseVersion = globalThis.RL_RACING_LAB_VERSION || 'dev';

function showRuntimeError(error, context = 'runtime') {
  const message = String(error?.message || error || 'Unknown error');
  console.error(`POV RL Racing Lab ${context} error.`, error);
  bootError.style.display = 'block';
  bootError.innerHTML = `<strong>POV RL Racing Lab hit a ${context} error.</strong><p>${message}</p><p>Try a hard refresh. If it persists, this message identifies the failing runtime instead of leaving blank canvases.</p>`;
}

globalThis.addEventListener('error', event => {
  if (event?.error) showRuntimeError(event.error, 'runtime');
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
    'state.js',
    'scene.js',
    'tracks.js',
    'cars.js',
    'model.js',
    'perception.js',
    'simulation.js',
    'physics.js',
    'session.js',
    'training.js',
    'race.js',
    'brain-viz.js',
    'audio.js',
    'ui.js',
    'runtime.js'
  ]) {
    await loadClassicScript(file);
  }
} catch (error) {
  showRuntimeError(error, 'startup');
  lab.style.display = 'none';
}
