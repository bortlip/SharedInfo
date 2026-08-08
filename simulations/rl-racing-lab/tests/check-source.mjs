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

const htmlFiles = [path.join(root, 'simulator.html'), path.join(root, 'src', 'index.html')];
const classicFiles = jsFiles.filter(file => !file.endsWith(`${path.sep}app.js`));
const topLevelNames = new Map();
for (const file of classicFiles) {
  const source = await readFile(file, 'utf8');
  const declaration = /^(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*))/gm;
  for (const match of source.matchAll(declaration)) {
    const name = match[1] || match[2];
    if (!topLevelNames.has(name)) topLevelNames.set(name, []);
    topLevelNames.get(name).push(path.relative(root, file));
  }
}

for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, 'utf8');
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
  for (const id of ids) {
    if (!topLevelNames.has(id)) continue;
    failed = true;
    console.error(`\nDOM/global collision: id="${id}" in ${path.relative(root, htmlFile)}`);
    console.error(`  conflicts with classic-script global declared in: ${topLevelNames.get(id).join(', ')}`);
  }
}

if (failed) process.exit(1);
console.log(`Source checks passed: ${jsFiles.length} JavaScript files parsed; no HTML-id/classic-global collisions found.`);
