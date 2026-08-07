const bootError = document.getElementById('bootError');
const lab = document.getElementById('lab');

function loadClassicScript(relativePath) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL(relativePath, import.meta.url).href;
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
    'training.js',
    'race.js',
    'ui.js',
    'runtime.js'
  ]) {
    await loadClassicScript(file);
  }
} catch (error) {
  console.error('POV RL Racing Lab failed to start.', error);
  bootError.style.display = 'block';
  bootError.innerHTML = `<strong>POV RL Racing Lab could not start.</strong><p>${String(error?.message || error)}</p><p>Reload while online so Three.js and the local simulator modules can load.</p>`;
  lab.style.display = 'none';
}
