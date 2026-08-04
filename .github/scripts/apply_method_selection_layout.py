from pathlib import Path

ROOT = Path('simulations/group-aware-boarding')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'Could not locate {label}')
    return text.replace(old, new, 1)

# Page markup
index_path = ROOT / 'src/index.html'
index = index_path.read_text(encoding='utf-8')
index = index.replace(
    'Pick a flight, press run, and watch six boarding strategies race through the same A320 manifest.',
    'Pick a flight, choose the racers, and watch boarding strategies compete through the same A320 manifest.',
    1,
)
method_controls = '''  </details>

  <section class="card method-controls" aria-labelledby="methodHeading">
    <div class="section-head method-heading">
      <div>
        <h2 id="methodHeading">Choose the racers</h2>
        <p>Run one method, compare two side by side, or keep the whole field in view.</p>
      </div>
      <div class="layout-control">
        <span>Plane size</span>
        <div class="segmented-control" role="group" aria-label="Plane display size">
          <button id="standardLayoutBtn" type="button" data-layout="standard" aria-pressed="true">Roomy</button>
          <button id="compactLayoutBtn" type="button" data-layout="compact" aria-pressed="false">Compact fleet</button>
        </div>
      </div>
    </div>
    <div class="method-picker" id="methodPicker" aria-label="Boarding methods"></div>
    <div class="method-toolbar">
      <button id="selectAllMethodsBtn" type="button" class="ghost">Select all six</button>
      <span id="methodSelectionStatus" role="status" aria-live="polite">6 methods selected · Roomy view</span>
    </div>
  </section>

  <main class="sim-grid" id="simGrid">'''
index = replace_once(index, '  </details>\n\n  <main class="sim-grid">', method_controls, 'simulation grid insertion point')
for method in ['random', 'back', 'front', 'zones', 'wilma', 'steffen']:
    index = replace_once(
        index,
        '    <article class="card sim-card">',
        f'    <article class="card sim-card" data-method="{method}">',
        f'{method} simulation card',
    )
index_path.write_text(index, encoding='utf-8')

# Presentation
styles_path = ROOT / 'src/styles.css'
styles = styles_path.read_text(encoding='utf-8')
method_css = '''.race-controls{border-top:0;margin-top:12px}

.method-controls{padding:16px;margin-bottom:16px}
.method-heading{align-items:center}
.layout-control{display:grid;gap:5px;justify-items:end}
.layout-control>span{color:var(--muted);font-size:.68rem;text-transform:uppercase;letter-spacing:.08em}
.segmented-control{display:inline-flex;padding:3px;border:1px solid #36516f;border-radius:12px;background:#081625}
.segmented-control button{border:0;border-radius:8px;background:transparent;padding:7px 10px;font-size:.75rem}
.segmented-control button:hover{transform:none;background:#10253d}
.segmented-control button.active{background:#1a4962;color:#e9faff;box-shadow:inset 0 0 0 1px #4d9bb9}
.method-picker{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
.method-option{position:relative;display:block;min-width:0}
.method-option input{position:absolute;inline-size:1px;block-size:1px;opacity:0;pointer-events:none}
.method-option span{display:flex;min-height:48px;align-items:center;justify-content:center;padding:8px 9px;border:1px solid #36516f;border-radius:11px;background:#091827;color:#9eb0c9;text-align:center;font-size:.72rem;font-weight:650;line-height:1.25;cursor:pointer;transition:.15s ease}
.method-option span:hover{border-color:#5f86b6;background:#10253d;color:#dbeeff}
.method-option input:checked+span{border-color:var(--accent);background:linear-gradient(180deg,#17435c,#102d42);color:#e8f8ff;box-shadow:0 0 0 2px rgba(99,215,255,.11)}
.method-option input:focus-visible+span{outline:2px solid var(--accent);outline-offset:2px}
.method-option input:disabled+span{opacity:.55;cursor:wait}
.method-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:10px}
.method-toolbar span{color:var(--muted);font-size:.75rem}

.controls'''
styles = replace_once(styles, '.race-controls{border-top:0;margin-top:12px}\n\n.controls', method_css, 'method controls styles')
styles = replace_once(
    styles,
    '''.sim-grid{
  display:grid;
  grid-template-columns:repeat(3,minmax(270px,1fr));
  gap:16px;
}''',
    '''.sim-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));
  gap:16px;
}
.sim-grid.compact-view{
  grid-template-columns:repeat(auto-fit,minmax(185px,230px));
  justify-content:center;
  gap:10px;
}''',
    'standard simulation grid styles',
)
compact_css = '''canvas{
  width:100%;
  height:650px;
  display:block;
  border-radius:13px;
  border:1px solid #29405f;
  background:linear-gradient(180deg,#07131f,#0b1d30);
}
.sim-grid.compact-view .sim-card{padding:9px}
.sim-grid.compact-view .sim-head{gap:7px;margin-bottom:6px}
.sim-grid.compact-view .sim-head h2{font-size:.86rem}
.sim-grid.compact-view .sim-head p{display:none}
.sim-grid.compact-view .time{font-size:.78rem}
.sim-grid.compact-view canvas{height:470px}
.sim-grid.compact-view .metrics{grid-template-columns:repeat(2,1fr);gap:5px;margin-top:6px}
.sim-grid.compact-view .metric{padding:6px}
.sim-grid.compact-view .metric>span{font-size:.58rem;white-space:normal;line-height:1.2}
.sim-grid.compact-view .metric strong{font-size:.76rem}'''
styles = replace_once(
    styles,
    '''canvas{
  width:100%;
  height:650px;
  display:block;
  border-radius:13px;
  border:1px solid #29405f;
  background:linear-gradient(180deg,#07131f,#0b1d30);
}''',
    compact_css,
    'canvas styles',
)
styles = replace_once(
    styles,
    '''@media(max-width:1100px){
  .sim-grid{grid-template-columns:repeat(2,minmax(270px,1fr))}
  canvas{height:620px}
  .lower{grid-template-columns:1fr}
}''',
    '''@media(max-width:1100px){
  .method-picker{grid-template-columns:repeat(3,minmax(0,1fr))}
  .sim-grid:not(.compact-view){grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))}
  .sim-grid.compact-view{grid-template-columns:repeat(auto-fit,minmax(180px,220px))}
  canvas{height:620px}
  .sim-grid.compact-view canvas{height:450px}
  .lower{grid-template-columns:1fr}
}''',
    '1100px media query',
)
styles = replace_once(
    styles,
    '  .sim-grid{grid-template-columns:1fr}\n',
    '  .method-heading{align-items:flex-start;flex-direction:column}\n  .layout-control{justify-items:start}\n  .method-picker{grid-template-columns:repeat(2,minmax(0,1fr))}\n  .sim-grid:not(.compact-view){grid-template-columns:1fr}\n  .sim-grid.compact-view{grid-template-columns:repeat(2,minmax(0,1fr))}\n',
    '720px simulation grid styles',
)
styles = replace_once(
    styles,
    '  .seed-entry{grid-template-columns:1fr}\n}',
    '  .seed-entry{grid-template-columns:1fr}\n  .method-picker,.sim-grid.compact-view{grid-template-columns:1fr}\n}',
    '430px compact styles',
)
styles_path.write_text(styles, encoding='utf-8')

# Benchmark signatures include the compared field.
format_path = ROOT / 'src/js/format.js'
fmt = format_path.read_text(encoding='utf-8')
fmt = replace_once(fmt, 'export function benchmarkSignature(cfg,trials){', 'export function benchmarkSignature(cfg,trials,methods=[]){', 'benchmark signature declaration')
fmt = replace_once(fmt, '    seed:cfg.seed,\n    trials', '    seed:cfg.seed,\n    trials,\n    methods:[...methods]', 'benchmark signature methods')
format_path.write_text(fmt, encoding='utf-8')

# Application behavior
app_path = ROOT / 'src/js/app.js'
app = app_path.read_text(encoding='utf-8')
app = replace_once(
    app,
    'let activePresetId = "custom";\nlet toastTimer = null;\n\nfunction normalizedPartyWeights()',
    '''let activePresetId = "custom";
let toastTimer = null;
let selectedMethods = new Set(METHODS);
let raceLayout = "standard";

function activeMethods(){
  return METHODS.filter(method=>selectedMethods.has(method));
}

function parseRaceView(search){
  const params=new URLSearchParams(search||"");
  const requested=(params.get("m")||"").split(",").filter(method=>METHODS.includes(method));
  const methods=[...new Set(requested)];
  return {
    methods:methods.length?methods:[...METHODS],
    layout:params.get("view")==="compact"?"compact":"standard"
  };
}

function updateRaceView(){
  const methods=activeMethods();
  document.querySelectorAll(".sim-card[data-method]").forEach(card=>{
    card.hidden=!selectedMethods.has(card.dataset.method);
  });
  document.querySelectorAll(".method-option input").forEach(input=>{
    input.checked=selectedMethods.has(input.value);
  });
  const grid=$("simGrid");
  grid.classList.toggle("compact-view",raceLayout==="compact");
  grid.dataset.layout=raceLayout;
  for(const button of document.querySelectorAll("[data-layout]")){
    const active=button.dataset.layout===raceLayout;
    button.classList.toggle("active",active);
    button.setAttribute("aria-pressed",String(active));
  }
  $("methodSelectionStatus").textContent=`${methods.length} method${methods.length===1?"":"s"} selected · ${raceLayout==="compact"?"Compact fleet":"Roomy"} view`;
}

function clearBenchmark(){
  benchmarkResult=null;
  $("benchBody").innerHTML='<tr><td colspan="5" class="empty">No benchmark results yet.</td></tr>';
  $("barBox").innerHTML="";
  $("benchSubtitle").textContent="Run a benchmark to average over different manifests and delays.";
  $("benchStatus").textContent="Ready. Benchmarking uses a snapshot of the current settings and runs independently of the animation.";
}

function applyMethodSelection(methods,{resetRace=false}={}){
  const valid=[...new Set(methods)].filter(method=>METHODS.includes(method));
  if(!valid.length) return false;
  selectedMethods=new Set(valid);
  updateRaceView();
  if(resetRace){
    clearBenchmark();
    reset();
  }
  return true;
}

function setRaceLayout(layout){
  raceLayout=layout==="compact"?"compact":"standard";
  updateRaceView();
  renderAll();
}

function setMethodControlsDisabled(disabled){
  document.querySelectorAll(".method-option input").forEach(input=>input.disabled=disabled);
  $("selectAllMethodsBtn").disabled=disabled;
}

function renderMethodPicker(){
  const picker=$("methodPicker");
  picker.innerHTML="";
  for(const method of METHODS){
    const label=document.createElement("label");
    label.className="method-option";
    const input=document.createElement("input");
    input.type="checkbox";
    input.value=method;
    input.checked=true;
    const text=document.createElement("span");
    text.textContent=META[method].label;
    label.append(input,text);
    input.addEventListener("change",()=>{
      const next=new Set(selectedMethods);
      if(input.checked) next.add(method);
      else next.delete(method);
      if(!next.size){
        input.checked=true;
        $("methodSelectionStatus").textContent="At least one boarding method must remain selected.";
        return;
      }
      applyMethodSelection([...next],{resetRace:true});
    });
    picker.appendChild(label);
  }
  $("selectAllMethodsBtn").addEventListener("click",()=>applyMethodSelection(METHODS,{resetRace:true}));
  $("standardLayoutBtn").addEventListener("click",()=>setRaceLayout("standard"));
  $("compactLayoutBtn").addEventListener("click",()=>setRaceLayout("compact"));
  updateRaceView();
}

function normalizedPartyWeights()''',
    'race view state and controls',
)
app = replace_once(
    app,
    '  sims={};\n  for(const method of METHODS) sims[method]=new BoardingSim(manifest,method,cfg);',
    '  sims={};\n  for(const method of activeMethods()) sims[method]=new BoardingSim(manifest,method,cfg);',
    'reset method creation',
)
old_render = '''function renderAll(){
  let allDone=true;
  for(const method of METHODS){
    const sim=sims[method];
    if(!sim) continue;
    allDone=allDone&&sim.done;
    drawSim(sim,$(META[method].canvas));
    const el=panelElements(method);
    el.time.textContent=formatTime(sim.time);
    el.done.textContent=`${sim.completed} / ${sim.queue.length}`;
    el.conflicts.textContent=String(sim.seatConflicts);
    el.blocked.textContent=`${Math.round(sim.blockedSeconds)} s`;
    el.queue.textContent=String(sim.queue.length-sim.pending);
  }
  if(allDone && running){
    running=false;
    const winner=METHODS.slice().sort((a,b)=>sims[a].time-sims[b].time)[0];
    $("status").textContent=`Complete. ${META[winner].label} won ${currentScenarioName()} at ${formatTime(sims[winner].time)}.`;
  }
}'''
new_render = '''function renderAll(){
  const methods=activeMethods();
  let allDone=methods.length>0;
  for(const method of methods){
    const sim=sims[method];
    if(!sim) continue;
    allDone=allDone&&sim.done;
    drawSim(sim,$(META[method].canvas));
    const el=panelElements(method);
    el.time.textContent=formatTime(sim.time);
    el.done.textContent=`${sim.completed} / ${sim.queue.length}`;
    el.conflicts.textContent=String(sim.seatConflicts);
    el.blocked.textContent=`${Math.round(sim.blockedSeconds)} s`;
    el.queue.textContent=String(sim.queue.length-sim.pending);
  }
  if(allDone && running){
    running=false;
    const winner=methods.slice().sort((a,b)=>sims[a].time-sims[b].time)[0];
    $("status").textContent=methods.length===1
      ? `Complete. ${META[winner].label} finished ${currentScenarioName()} at ${formatTime(sims[winner].time)}.`
      : `Complete. ${META[winner].label} won ${currentScenarioName()} at ${formatTime(sims[winner].time)}.`;
  }
}'''
app = replace_once(app, old_render, new_render, 'renderAll function')
app = replace_once(app, '      for(const method of METHODS) sims[method].step(FIXED_DT);', '      for(const method of activeMethods()) sims[method].step(FIXED_DT);', 'animation method loop')
old_run = '''function run(){
  if(!manifest || METHODS.some(m=>sims[m].done)) reset();
  running=true;
  $("pauseBtn").textContent="Pause";
  $("status").textContent=`Running ${currentScenarioName()} through all six boarding methods…`;
}'''
new_run = '''function run(){
  const methods=activeMethods();
  if(!manifest || methods.some(method=>sims[method]?.done)) reset();
  running=true;
  $("pauseBtn").textContent="Pause";
  $("status").textContent=`Running ${currentScenarioName()} through ${methods.length} selected method${methods.length===1?"":"s"}…`;
}'''
app = replace_once(app, old_run, new_run, 'run function')
app = replace_once(app, '  if(!running && METHODS.every(m=>sims[m].time===0)){', '  if(!running && activeMethods().every(method=>sims[method]?.time===0)){', 'pause empty-state check')
old_finish = '''function finish(){
  running=false;
  $("pauseBtn").textContent="Pause";
  for(const method of METHODS) sims[method].runToEnd(.15);
  renderAll();
  const winner=METHODS.slice().sort((a,b)=>sims[a].time-sims[b].time)[0];
  $("status").textContent=`Complete. ${META[winner].label} won ${currentScenarioName()} at ${formatTime(sims[winner].time)}.`;
}'''
new_finish = '''function finish(){
  running=false;
  $("pauseBtn").textContent="Pause";
  const methods=activeMethods();
  for(const method of methods) sims[method].runToEnd(.15);
  renderAll();
  const winner=methods.slice().sort((a,b)=>sims[a].time-sims[b].time)[0];
  $("status").textContent=methods.length===1
    ? `Complete. ${META[winner].label} finished ${currentScenarioName()} at ${formatTime(sims[winner].time)}.`
    : `Complete. ${META[winner].label} won ${currentScenarioName()} at ${formatTime(sims[winner].time)}.`;
}'''
app = replace_once(app, old_finish, new_finish, 'finish function')
app = app.replace('const bestMean=Math.min(...METHODS.map(m=>result[m].stats.mean));', 'const methods=result.methods;\n  const bestMean=Math.min(...methods.map(m=>result[m].stats.mean));', 1)
app = app.replace('const maxMean=Math.max(...METHODS.map(m=>result[m].stats.mean));', 'const maxMean=Math.max(...methods.map(m=>result[m].stats.mean));', 1)
app = app.replace('for(const m of METHODS){', 'for(const m of methods){', 2)
app = replace_once(app, '  const cfg=config();\n  const trials=clamp(Math.floor(+controls.trials.value||40),5,200);\n  const signature=benchmarkSignature(cfg,trials);', '  const cfg=config();\n  const methods=activeMethods();\n  const trials=clamp(Math.floor(+controls.trials.value||40),5,200);\n  const signature=benchmarkSignature(cfg,trials,methods);', 'benchmark method snapshot')
app = replace_once(app, '  const times=Object.fromEntries(METHODS.map(m=>[m,[]]));\n  const wins=Object.fromEntries(METHODS.map(m=>[m,0]));', '  const times=Object.fromEntries(methods.map(m=>[m,[]]));\n  const wins=Object.fromEntries(methods.map(m=>[m,0]));', 'benchmark containers')
app = replace_once(app, '        for(const method of METHODS){', '        for(const method of methods){', 'benchmark simulation loop')
app = replace_once(app, '      const win=METHODS.slice().sort((a,b)=>trialTimes[a]-trialTimes[b])[0];', '      const win=methods.slice().sort((a,b)=>trialTimes[a]-trialTimes[b])[0];', 'benchmark winner')
app = replace_once(app, '    const nextResult={trials,seed:cfg.seed,signature};\n    for(const method of METHODS) nextResult[method]={stats:stats(times[method]),wins:wins[method]};', '    const nextResult={trials,seed:cfg.seed,signature,methods:[...methods]};\n    for(const method of methods) nextResult[method]={stats:stats(times[method]),wins:wins[method]};', 'benchmark result methods')
app = replace_once(app, '    nextResult.repeated=exactRepeat && sameBenchmarkResults(previousResult,nextResult,METHODS);', '    nextResult.repeated=exactRepeat && sameBenchmarkResults(previousResult,nextResult,methods);', 'benchmark result comparison')
app = replace_once(app, '  button.disabled=true;\n  button.textContent="Benchmarking…";', '  button.disabled=true;\n  button.textContent="Benchmarking…";\n  setMethodControlsDisabled(true);', 'benchmark selector lock')
app = replace_once(app, '    button.disabled=false;\n    button.textContent="Run benchmark";', '    button.disabled=false;\n    button.textContent="Run benchmark";\n    setMethodControlsDisabled(false);', 'benchmark selector unlock')
app = replace_once(
    app,
    '  url.search=serializeScenarioSettings(settings,preset?.id||"custom");\n  url.hash="";',
    '  url.search=serializeScenarioSettings(settings,preset?.id||"custom");\n  url.searchParams.set("m",activeMethods().join(","));\n  url.searchParams.set("view",raceLayout);\n  url.hash="";',
    'shareable race view',
)
app = app.replace('Scenario link copied — seed ${settings.seed.toLocaleString()} included.', 'Scenario link copied — seed and race view included.', 1)
app = replace_once(
    app,
    'function initialize(){\n  renderScenarioCards();\n  const fromUrl=parseScenarioSearch(location.search);\n  writeScenarioSettings(fromUrl||DEFAULT_SCENARIO_SETTINGS);\n  detectActivePreset();',
    'function initialize(){\n  renderScenarioCards();\n  renderMethodPicker();\n  const fromUrl=parseScenarioSearch(location.search);\n  const raceView=parseRaceView(location.search);\n  writeScenarioSettings(fromUrl||DEFAULT_SCENARIO_SETTINGS);\n  applyMethodSelection(raceView.methods);\n  setRaceLayout(raceView.layout);\n  detectActivePreset();',
    'initial race view loading',
)
app_path.write_text(app, encoding='utf-8')

# Task documentation
readme_path = ROOT / 'tasks/README.md'
readme = readme_path.read_text(encoding='utf-8')
entry = '19. [TASK-019: Method Selection and Race Layouts](TASK-019-method-selection-and-race-layouts.md)\n'
if entry not in readme:
    readme = replace_once(readme, '18. [TASK-018: Automated Tests and Release Guards](TASK-018-automated-tests-and-release-guards.md)\n', '18. [TASK-018: Automated Tests and Release Guards](TASK-018-automated-tests-and-release-guards.md)\n' + entry, 'TASK-019 backlog entry')
readme_path.write_text(readme, encoding='utf-8')

task_path = ROOT / 'tasks/TASK-019-method-selection-and-race-layouts.md'
task_path.write_text('''# TASK-019: Method Selection and Race Layouts

**Status: In progress**

## Goal

Let a user focus the race on the boarding methods they actually care about and choose between a spacious comparison and a denser fleet view.

## Functional behavior

- All six methods begin selected.
- Each method can be independently included or excluded through accessible toggle controls.
- At least one method must remain selected.
- Selecting two methods gives them the available row side by side in Roomy view.
- Compact Fleet uses narrow cards, shorter aircraft, condensed headings, and two-column metrics so more methods fit on screen simultaneously.
- Method changes reset the visible race and clear benchmark results because the comparison field changed.
- Layout changes are presentational and do not reset the race.
- Benchmarks run and award wins only among the selected methods.
- Exact benchmark-repeat detection includes the selected method set.
- Shareable links preserve selected methods and the layout; older links safely default to all methods in Roomy view.

## Release safety

This task changes modular source and regenerates `dist/simulator.html`. It must not modify the released root `simulator.html` or root `index.html`.
''', encoding='utf-8')
