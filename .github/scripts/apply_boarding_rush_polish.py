from pathlib import Path
import re

root = Path('simulations/group-aware-boarding')

index = root / 'src/index.html'
text = index.read_text(encoding='utf-8')
text = text.replace(
    '<div class="badge">unreleased candidate · scenarios · shareable seeds</div>',
    '<div class="badge">scenarios · shareable seeds · deterministic races</div>',
    1,
)
text = text.replace(
    'Boarding Rush candidate · deterministic seeds · no external libraries',
    'Boarding Rush · deterministic seeds · no external libraries',
    1,
)
if 'unreleased candidate' in text or 'Boarding Rush candidate' in text:
    raise SystemExit('Process-facing candidate language remains in the page')
index.write_text(text, encoding='utf-8')

styles = root / 'src/styles.css'
text = styles.read_text(encoding='utf-8')
old = '.seed-entry{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px}\n.seed-entry button{padding-inline:10px;white-space:nowrap}'
new = '.seed-control{grid-column:span 2;min-width:300px}\n.seed-entry{display:grid;grid-template-columns:minmax(14ch,1fr) auto;gap:7px}\n.seed-entry input{min-width:14ch;font-variant-numeric:tabular-nums}\n.seed-entry button{padding-inline:10px;white-space:nowrap}'
if old not in text:
    raise SystemExit('Could not locate seed layout styles')
styles.write_text(text.replace(old, new, 1), encoding='utf-8')

scenarios = root / 'src/js/scenarios.js'
text = scenarios.read_text(encoding='utf-8')
marker = 'export const SCENARIO_PRESETS = ['
replacement = '// Set `included` to false to remove a scenario from the selector without deleting its definition.\n' + marker
if replacement not in text:
    text = text.replace(marker, replacement, 1)
text, count = re.subn(
    r'(\n\s{4}id:"[^"]+",\n)(\s{4}name:)',
    r'\1    included:true,\n\2',
    text,
)
if count != 9:
    raise SystemExit(f'Expected 9 scenario inclusion flags; added {count}')
text = text.replace(
    'return SCENARIO_PRESETS.find(preset=>!preset.disabled && settingsEqual(settings,preset.settings))||null;',
    'return SCENARIO_PRESETS.find(preset=>preset.included!==false && !preset.disabled && settingsEqual(settings,preset.settings))||null;',
    1,
)
scenarios.write_text(text, encoding='utf-8')

fmt = root / 'src/js/format.js'
text = fmt.read_text(encoding='utf-8').rstrip() + '''

export function benchmarkSignature(cfg,trials){
  return JSON.stringify({
    loadFactor:cfg.loadFactor,
    familyShare:cfg.familyShare,
    partyWeights:cfg.partyWeights,
    assistedParties:cfg.assistedParties,
    bagRate:cfg.bagRate,
    sequenceCompliance:cfg.sequenceCompliance,
    priorityPolicy:cfg.priorityPolicy,
    seed:cfg.seed,
    trials
  });
}

export function sameBenchmarkResults(left,right,methods){
  if(!left || !right) return false;
  return methods.every(method=>{
    const a=left[method];
    const b=right[method];
    return !!a && !!b
      && a.wins===b.wins
      && a.stats.mean===b.stats.mean
      && a.stats.median===b.stats.median
      && a.stats.p10===b.stats.p10
      && a.stats.p90===b.stats.p90;
  });
}
'''
fmt.write_text(text, encoding='utf-8')

app = root / 'src/js/app.js'
text = app.read_text(encoding='utf-8')
text = text.replace(
    'import { formatTime, stats } from "./format.js";',
    'import { benchmarkSignature, formatTime, sameBenchmarkResults, stats } from "./format.js";',
    1,
)
text = text.replace(
    'const selected=SCENARIO_PRESETS.find(preset=>preset.id===activePresetId && !preset.disabled);',
    'const selected=SCENARIO_PRESETS.find(preset=>preset.id===activePresetId && preset.included!==false && !preset.disabled);',
    1,
)
text = text.replace(
    'for(const preset of SCENARIO_PRESETS){',
    'for(const preset of SCENARIO_PRESETS.filter(preset=>preset.included!==false)){',
    1,
)
text = text.replace(
    '$("benchSubtitle").textContent=`${result.trials} trials · base seed ${result.seed.toLocaleString()} · same manifest per trial · lower is better`;',
    'const repeatNote=result.repeated?" · exact rerun; deterministic results unchanged":"";\n  $("benchSubtitle").textContent=`${result.trials} trials · base seed ${result.seed.toLocaleString()} · same manifest per trial · lower is better${repeatNote}`;',
    1,
)
text = text.replace(
    'const trials=clamp(Math.floor(+controls.trials.value||40),5,200);\n  const times=',
    'const trials=clamp(Math.floor(+controls.trials.value||40),5,200);\n  const signature=benchmarkSignature(cfg,trials);\n  const previousResult=benchmarkResult;\n  const times=',
    1,
)
old = '''    benchmarkResult={trials,seed:cfg.seed};
    for(const method of METHODS) benchmarkResult[method]={stats:stats(times[method]),wins:wins[method]};
    renderBenchmark(benchmarkResult);
    benchStatus.textContent=`Benchmark complete: ${trials} trials from base seed ${cfg.seed.toLocaleString()}.`;'''
new = '''    const nextResult={trials,seed:cfg.seed,signature};
    for(const method of METHODS) nextResult[method]={stats:stats(times[method]),wins:wins[method]};
    const exactRepeat=previousResult?.signature===signature;
    nextResult.repeated=exactRepeat && sameBenchmarkResults(previousResult,nextResult,METHODS);
    benchmarkResult=nextResult;
    renderBenchmark(benchmarkResult);
    if(nextResult.repeated){
      benchStatus.textContent=`Exact benchmark rerun: the settings, ${trials} trials, and base seed ${cfg.seed.toLocaleString()} are unchanged, so the deterministic results are unchanged.`;
    }else if(exactRepeat){
      benchStatus.textContent=`This exact benchmark unexpectedly changed. The deterministic model should be investigated.`;
    }else{
      benchStatus.textContent=`Benchmark complete: ${trials} trials from base seed ${cfg.seed.toLocaleString()}.`;
    }'''
if old not in text:
    raise SystemExit('Could not locate benchmark completion block')
text = text.replace(old, new, 1)
app.write_text(text, encoding='utf-8')

task = root / 'tasks/TASK-001-scenario-presets-and-shareable-urls.md'
text = task.read_text(encoding='utf-8').rstrip() + '''

## Follow-up polish

- Page-facing text is written as product copy and never exposes candidate/release-process terminology.
- Each scenario definition has an `included` flag; set it to `false` to hide that scenario without deleting its settings or implementation.
- The editable seed field spans two control columns so its full value remains visible beside the randomize button.
- Repeating an identical benchmark shows that its deterministic results are unchanged; the comparison requires the same seed, settings, and trial count, not merely the same seed alone.
'''
task.write_text(text, encoding='utf-8')
