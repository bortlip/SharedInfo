import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const jsDir = path.join(root, 'src', 'js');
const jsFiles = (await readdir(jsDir))
  .filter(name => name.endsWith('.js'))
  .sort()
  .map(name => path.join(jsDir, name));

let failed = false;
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed = true;
    console.error(`\nSyntax check failed: ${path.relative(root, file)}`);
    console.error(result.stderr || result.stdout);
  }
}

// Classic scripts share a browser-global lexical environment, while HTML ids may also
// appear as named window properties. The dangerous case is an earlier script reading a
// name before the later script that declares the intended global has executed.
const classicOrder = [
  'version.js','state.js','scene.js','tracks.js','cars.js','model.js','perception.js',
  'simulation.js','physics.js','session.js','training.js','race.js','brain-viz.js',
  'audio.js','ui.js','runtime.js'
];
const classicSources = new Map();
for (const name of classicOrder) {
  classicSources.set(name, await readFile(path.join(jsDir, name), 'utf8'));
}


// Shared display helpers used by several later scripts must live in the first shared layer.
const stateSource = classicSources.get('state.js');
for (const helper of ['formatDuration','compactNumber','formatBytes','formatMs']) {
  const pattern = new RegExp(`function\\s+${helper}\\s*\\(`);
  if (pattern.test(stateSource)) continue;
  failed = true;
  console.error(`\nShared-helper load-order violation: ${helper} must be declared in state.js.`);
}
const declarations = new Map();
const declaration = /^(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*))/gm;
for (const [index, name] of classicOrder.entries()) {
  for (const match of classicSources.get(name).matchAll(declaration)) {
    const identifier = match[1] || match[2];
    if (!declarations.has(identifier)) declarations.set(identifier, []);
    declarations.get(identifier).push({ index, file: name });
  }
}

const htmlFiles = [path.join(root, 'simulator.html'), path.join(root, 'src', 'index.html')];
for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, 'utf8');
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
  for (const id of ids) {
    const defs = declarations.get(id) || [];
    for (const def of defs) {
      const referencePattern = new RegExp(`\\b${id.replace(/[$]/g, '\\$&')}\\b`);
      const earlier = classicOrder.slice(0, def.index).find(name => referencePattern.test(classicSources.get(name)));
      if (!earlier) continue;
      failed = true;
      console.error(`\nPre-declaration DOM/global hazard: id="${id}" in ${path.relative(root, htmlFile)}`);
      console.error(`  ${earlier} references ${id} before ${def.file} declares the intended global.`);
    }
  }
}

if (failed) process.exit(1);
console.log(`Source checks passed: ${jsFiles.length} JavaScript files parsed; shared helpers are early; no pre-declaration HTML-id/global hazards found.`);
