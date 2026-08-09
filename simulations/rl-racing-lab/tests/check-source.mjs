import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import vm from 'node:vm';

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
  'version.js','state.js','track-layouts.js','scene.js','tracks.js','cars.js','effects.js','model.js','perception.js',
  'simulation.js','physics.js','session.js','training.js','experiments.js','race.js','brain-viz.js',
  'audio.js','ui.js','runtime.js'
];
const classicSources = new Map();
for (const name of classicOrder) {
  classicSources.set(name, await readFile(path.join(jsDir, name), 'utf8'));
}

// Training-affecting randomness must use the saved experiment streams. Presentation-only effects are intentionally excluded.
for (const name of ['track-layouts.js','tracks.js','cars.js','model.js','simulation.js','physics.js','training.js']) {
  if (!/\bMath\.random\b/.test(classicSources.get(name))) continue;
  failed = true;
  console.error(`\nDeterminism violation: ${name} uses Math.random instead of experimentRandom().`);
}

// Build every pure circuit definition and enforce the road-ribbon safety envelope.
const trackLayoutSource = classicSources.get('track-layouts.js');
const trackLayoutContext = vm.createContext({});
try {
  vm.runInContext(`${trackLayoutSource}\nglobalThis.__trackLayoutProbe={version:TRACK_LAYOUT_VERSION,stats:Object.fromEntries(Object.entries(TRACK_LAYOUT_STATS).map(([id,s])=>[id,{length:s.length,minRadius:s.minRadius,minClearance:s.minClearance,minSegment:s.minSegment,maxSegment:s.maxSegment,averageSegment:s.averageSegment}]))};`, trackLayoutContext);
  const probe = trackLayoutContext.__trackLayoutProbe;
  const expected = ['mixed','reverse','technical','sweepers','figure8','grandprix'];
  const stats = probe?.stats || {};
  const invalid = expected.filter(id => !stats[id] || stats[id].minRadius < 18 || stats[id].minClearance < 15 || stats[id].maxSegment > stats[id].averageSegment * 1.08 || stats[id].minSegment < stats[id].averageSegment * .92);
  if (probe?.version !== 2 || invalid.length || Number(stats.mixed?.length) < 450 || Number(stats.grandprix?.length) < 900 || Number(stats.grandprix?.length) < Number(stats.mixed?.length) * 1.8) {
    failed = true;
    console.error(`\nTrack-layout validation failed${invalid.length ? ` for: ${invalid.join(', ')}` : ''}.`);
  }
} catch (error) {
  failed = true;
  console.error('\nTrack-layout execution check failed:', error);
}

// Shared display helpers used by several later scripts must live in the first shared layer.
const stateSource = classicSources.get('state.js');
const rngContext = vm.createContext({ performance });
try {
  vm.runInContext(`${stateSource}\nresetExperimentRng(123456789);const a=[experimentRandom('init'),experimentRandom('policy'),experimentRandom('shuffle')];resetExperimentRng(123456789);const b=[experimentRandom('init'),experimentRandom('policy'),experimentRandom('shuffle')];resetExperimentRng(123456789);const policyBefore=experimentRandom('policy');resetExperimentRng(123456789);for(let i=0;i<250;i++)experimentRandom('init');const policyAfter=experimentRandom('policy');globalThis.__rngProbe={a,b,policyBefore,policyAfter};`, rngContext);
  const probe = rngContext.__rngProbe;
  if (!probe || probe.a.some((value,index) => value !== probe.b[index]) || probe.policyBefore !== probe.policyAfter) {
    failed = true;
    console.error('\nDeterminism violation: seeded RNG streams did not replay independently.');
  }
} catch (error) {
  failed = true;
  console.error('\nSeeded RNG execution check failed:', error);
}
const modelContext = vm.createContext({ performance });
try {
  vm.runInContext(`${stateSource}\n${classicSources.get('model.js')}\nresetExperimentRng(424242);const n1=createNetwork();resetExperimentRng(424242);const n2=createNetwork();resetExperimentRng(424243);const n3=createNetwork();const w1=Array.from(n1.layers[0].w.slice(0,32)),w2=Array.from(n2.layers[0].w.slice(0,32)),w3=Array.from(n3.layers[0].w.slice(0,32));globalThis.__networkProbe={same:w1.every((v,i)=>v===w2[i]),different:w1.some((v,i)=>v!==w3[i])};`, modelContext);
  if (!modelContext.__networkProbe?.same || !modelContext.__networkProbe?.different) {
    failed = true;
    console.error('\nDeterminism violation: network initialization did not replay from the experiment seed.');
  }
} catch (error) {
  failed = true;
  console.error('\nSeeded network initialization check failed:', error);
}
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
console.log(`Source checks passed: ${jsFiles.length} JavaScript files parsed; all track layouts validated; deterministic learning path guarded; shared helpers are early; no pre-declaration HTML-id/global hazards found.`);
