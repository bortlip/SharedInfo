// Settings, presets, World B overrides, metrics, inspector, and experiment sharing.
'use strict';

function maxNeighborsForForm() {
  const r=clamp(Number($('radiusInput').value)||1,1,6);
  return $('neighborhoodSelect').value==='vonNeumann' ? 2*r*(r+1) : (2*r+1)**2-1;
}

function formatThresholdValue(rule, value) {
  if(rule==='minSameCount') return `${Math.round(value)}`;
  if(rule==='weightedUtility') return Number(value).toFixed(2);
  if(rule==='majority') return 'fixed';
  return pct(Number(value));
}

function syncThresholdControl(reset=false) {
  const rule=$('satisfactionRuleSelect').value;
  const input=$('thresholdInput');
  let min=0,max=1,step=.01,label='Minimum same-group share',fallback=.30;
  if(rule==='maxDifferentFraction'){label='Maximum different-group share';fallback=.70;}
  else if(rule==='minSameCount'){label='Minimum same-group count';min=0;max=maxNeighborsForForm();step=1;fallback=Math.min(3,max);}
  else if(rule==='majority'){label='Same-group majority';}
  else if(rule==='weightedUtility'){label='Minimum utility score';min=-1;max=1;step=.01;fallback=0;}
  $('thresholdLabel').textContent=label;
  input.min=min;input.max=max;input.step=step;input.disabled=rule==='majority';
  if(reset)input.value=fallback;else input.value=clamp(Number(input.value)||0,min,max);
  $('thresholdValue').textContent=formatThresholdValue(rule,input.value);
}

function renderGroupShareControls(weights=null) {
  const count=clamp(Math.round(Number($('groupsInput').value)||2),2,MAX_GROUPS);
  const existing=[...document.querySelectorAll('[data-group-weight]')].map(el=>Number(el.value));
  const source=weights||existing.length? (weights||existing) : sim.config.population.groupWeights;
  const normalized=normalizedWeights(source,count);
  $('groupShares').innerHTML=Array.from({length:count},(_,g)=>`<label class="group-share" title="Relative population weight for Group ${g+1}; all group weights are normalized together."><span class="swatch" style="background:${groupColor(g,$('colorSchemeSelect').value)}"></span><span>Group ${g+1}</span><input data-group-weight="${g}" title="Relative population weight for Group ${g+1}" type="number" min="0" step="0.1" value="${Number((normalized[g]*count).toFixed(3))}" /></label>`).join('');
  $('paintGroupSelect').innerHTML='<option value="-1">Vacancy</option>'+Array.from({length:count},(_,g)=>`<option value="${g}">Group ${g+1}</option>`).join('');
}

function comparisonControlId(index, kind) { return `bOverride${index}${kind}`; }
function comparisonBaseValue(config, key) { const [section, property]=key.split('.'); return config?.[section]?.[property]; }
function escapeAttribute(value) { return String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

function formatComparisonValue(def, value, config) {
  if(def.type==='boolean')return value===true||value==='true'?'On':'Off';
  if(def.type==='weights')return Array.isArray(value)?value.map(number=>Number(number).toFixed(2)).join(', '):String(value);
  if(def.key==='satisfaction.threshold')return formatThresholdValue(config.satisfaction.rule,Number(value));
  if(def.key==='population.vacancyRate'||def.key==='satisfaction.variation')return pct(Number(value));
  if(def.type==='select')return def.options?.find(option=>option[0]===String(value))?.[1]||String(value);
  return String(value);
}

function comparisonValueControl(def, index, override) {
  const id=comparisonControlId(index,'Value'),disabled=override.enabled?'':' disabled';
  if(def.type==='boolean')return `<select id="${id}" data-b-override-value="${index}"${disabled}><option value="true"${override.value===true||override.value==='true'?' selected':''}>On</option><option value="false"${override.value===false||override.value==='false'?' selected':''}>Off</option></select>`;
  if(def.type==='select')return `<select id="${id}" data-b-override-value="${index}"${disabled}>${def.options.map(([value,label])=>`<option value="${escapeAttribute(value)}"${String(override.value)===String(value)?' selected':''}>${label}</option>`).join('')}</select>`;
  if(def.type==='weights')return `<input id="${id}" data-b-override-value="${index}" type="text" value="${escapeAttribute(Array.isArray(override.value)?override.value.join(', '):override.value)}" placeholder="1, 1"${disabled} />`;
  return `<input id="${id}" data-b-override-value="${index}" type="number" min="${def.min}" max="${def.max}" step="${def.step}" value="${escapeAttribute(override.value)}"${disabled} />`;
}

function renderComparisonControls(config=sim.config) {
  const container=$('compareOverrideControls');if(!container)return;
  const compare=normalizeComparisonSettings(config);
  const groups=[...new Set(B_OVERRIDE_DEFS.map(def=>def.group))];
  container.innerHTML=groups.map(group=>{
    const structural=group==='Initial world';
    const rows=B_OVERRIDE_DEFS.map((def,index)=>({def,index})).filter(item=>item.def.group===group).map(({def,index})=>{
      const override=compare.overrides[def.key],inherited=comparisonBaseValue(config,def.key);
      return `<div class="b-override-row${def.structural?' structural':''}" title="${escapeAttribute(def.help)}"><label class="b-override-switch"><input id="${comparisonControlId(index,'Enable')}" data-b-override-enable="${index}" type="checkbox"${override.enabled?' checked':''} /><span>Override</span></label><div class="b-override-label"><strong>${def.label}</strong><small>World A: ${formatComparisonValue(def,inherited,config)}</small></div>${comparisonValueControl(def,index,override)}</div>`;
    }).join('');
    const open=group==='Satisfaction'?' open':'';
    return `<details class="b-override-group${structural?' structural':''}"${open}><summary class="b-override-group-head"><strong>${group}</strong><span>${structural?'May create a different initial world':'Keeps the same initial world'}</span></summary><div class="b-override-grid">${rows}</div></details>`;
  }).join('');
  syncComparisonOverrideControlStates();
}

function syncComparisonOverrideControlStates() {
  B_OVERRIDE_DEFS.forEach((def,index)=>{
    const enabled=$(comparisonControlId(index,'Enable'))?.checked;
    const control=$(comparisonControlId(index,'Value'));if(control)control.disabled=!enabled;
  });
}

function readComparisonOverridesFromForm(config) {
  const compare=normalizeComparisonSettings(config);
  B_OVERRIDE_DEFS.forEach((def,index)=>{
    const enable=$(comparisonControlId(index,'Enable')), control=$(comparisonControlId(index,'Value'));
    if(!enable||!control)return;
    compare.overrides[def.key]={enabled:enable.checked,value:coerceComparisonValue(def,control.value)};
  });
  return compare;
}

function clearComparisonOverrideForm() {
  B_OVERRIDE_DEFS.forEach((def,index)=>{const enable=$(comparisonControlId(index,'Enable'));if(enable)enable.checked=false;});
  syncComparisonOverrideControlStates();markSettingsPending();
}

function readFormConfig() {
  const config=deepClone(sim.config||DEFAULT_CONFIG);
  config.population.groups=clamp(Math.round(Number($('groupsInput').value)||2),2,MAX_GROUPS);
  config.population.groupWeights=[...document.querySelectorAll('[data-group-weight]')].slice(0,config.population.groups).map(el=>Math.max(0,Number(el.value)||0));
  config.population.vacancyRate=clamp(Number($('vacancyInput').value),0,.9);
  config.population.cols=clamp(Math.round(Number($('colsInput').value)||60),12,140);
  config.population.rows=clamp(Math.round(Number($('rowsInput').value)||44),12,100);
  config.population.distribution=$('distributionSelect').value;
  config.population.seed=clamp(Math.round(Number($('seedInput').value)||7319),1,999999999);
  config.neighborhood={type:$('neighborhoodSelect').value,radius:clamp(Math.round(Number($('radiusInput').value)||1),1,6),wrap:$('wrapToggle').checked,ignoreVacancies:$('ignoreVacanciesToggle').checked};
  config.satisfaction={rule:$('satisfactionRuleSelect').value,threshold:Number($('thresholdInput').value),heterogeneous:$('heterogeneousToggle').checked,variation:clamp(Number($('variationInput').value),0,.5),isolated:$('isolatedSelect').value};
  config.movement={mode:$('movementModeSelect').value,selection:$('selectionSelect').value,destination:$('destinationSelect').value,fallback:$('fallbackSelect').value,search:$('searchSelect').value,searchRadius:clamp(Math.round(Number($('searchRadiusInput').value)||8),1,30),allowSatisfied:$('allowSatisfiedToggle').checked};
  config.simulation={mode:$('simulationModeSelect').value,movesPerTick:clamp(Math.round(Number($('movesPerTickInput').value)||20),1,500),maxIterations:clamp(Math.round(Number($('maxIterationsInput').value)||5000),1,100000),quietRounds:clamp(Math.round(Number($('quietRoundsInput').value)||5),1,100),stopSatisfied:$('stopSatisfiedToggle').checked,stopNoLegal:$('stopNoLegalToggle').checked,stopQuiet:$('stopQuietToggle').checked,stopMax:$('stopMaxToggle').checked};
  config.visual={colorScheme:$('colorSchemeSelect').value,showVacancies:$('showVacanciesToggle').checked,showUnhappy:$('showUnhappyToggle').checked,showNeighborhood:$('showNeighborhoodToggle').checked,animateMoves:$('animateMovesToggle').checked,showTrails:$('showTrailsToggle').checked,gridLines:$('gridLinesToggle').checked,clusterOutlines:$('clusterOutlinesToggle').checked};
  config.visual.markerStyle=$('markerStyleSelect').value;
  normalizeComparisonSettings(config);
  config.compare.enabled=$('compareToggle').checked;
  readComparisonOverridesFromForm(config);
  return config;
}

function writeFormConfig(config) {
  normalizeComparisonSettings(config);
  $('groupsInput').value=config.population.groups;$('vacancyInput').value=config.population.vacancyRate;$('colsInput').value=config.population.cols;$('rowsInput').value=config.population.rows;$('distributionSelect').value=config.population.distribution;$('seedInput').value=config.population.seed;
  $('neighborhoodSelect').value=config.neighborhood.type;$('radiusInput').value=config.neighborhood.radius;$('wrapToggle').checked=config.neighborhood.wrap;$('ignoreVacanciesToggle').checked=config.neighborhood.ignoreVacancies;
  $('satisfactionRuleSelect').value=config.satisfaction.rule;$('thresholdInput').value=config.satisfaction.threshold;$('heterogeneousToggle').checked=config.satisfaction.heterogeneous;$('variationInput').value=config.satisfaction.variation;$('isolatedSelect').value=config.satisfaction.isolated;
  $('movementModeSelect').value=config.movement.mode;$('selectionSelect').value=config.movement.selection;$('destinationSelect').value=config.movement.destination;$('fallbackSelect').value=config.movement.fallback;$('searchSelect').value=config.movement.search;$('searchRadiusInput').value=config.movement.searchRadius;$('allowSatisfiedToggle').checked=config.movement.allowSatisfied;
  $('simulationModeSelect').value=config.simulation.mode;$('movesPerTickInput').value=config.simulation.movesPerTick;$('maxIterationsInput').value=config.simulation.maxIterations;$('quietRoundsInput').value=config.simulation.quietRounds;$('stopSatisfiedToggle').checked=config.simulation.stopSatisfied;$('stopNoLegalToggle').checked=config.simulation.stopNoLegal;$('stopQuietToggle').checked=config.simulation.stopQuiet;$('stopMaxToggle').checked=config.simulation.stopMax;
  $('colorSchemeSelect').value=config.visual.colorScheme;$('showVacanciesToggle').checked=config.visual.showVacancies;$('showUnhappyToggle').checked=config.visual.showUnhappy;$('showNeighborhoodToggle').checked=config.visual.showNeighborhood;$('animateMovesToggle').checked=config.visual.animateMoves;$('showTrailsToggle').checked=config.visual.showTrails;$('gridLinesToggle').checked=config.visual.gridLines;$('clusterOutlinesToggle').checked=config.visual.clusterOutlines;
  $('markerStyleSelect').value=config.visual.markerStyle;
  $('compareToggle').checked=config.compare.enabled;
  renderGroupShareControls(config.population.groupWeights);renderComparisonControls(config);syncThresholdControl(false);updateRangeLabels();
}

function updateRangeLabels(){
  $('vacancyValue').textContent=pct(Number($('vacancyInput').value));
  $('variationValue').textContent=`±${Math.round(Number($('variationInput').value)*100)}%`;
  $('thresholdValue').textContent=formatThresholdValue($('satisfactionRuleSelect').value,$('thresholdInput').value);
}

const PENDING_SETTING_IDS = ['groupsInput','vacancyInput','colsInput','rowsInput','distributionSelect','seedInput','neighborhoodSelect','radiusInput','wrapToggle','ignoreVacanciesToggle','satisfactionRuleSelect','thresholdInput','isolatedSelect','variationInput','heterogeneousToggle','movementModeSelect','selectionSelect','destinationSelect','fallbackSelect','searchSelect','searchRadiusInput','allowSatisfiedToggle','simulationModeSelect','movesPerTickInput','maxIterationsInput','quietRoundsInput','stopSatisfiedToggle','stopNoLegalToggle','stopQuietToggle','stopMaxToggle'];

function setSettingsPending(pending=true) {
  sim.pendingSettings=Boolean(pending);
  const button=$('applySettingsBtn'), chip=$('pendingSettingsChip');
  if(button){button.classList.toggle('pending',sim.pendingSettings);button.textContent=sim.pendingSettings?'● Apply changes':'Apply changes';}
  if(chip)chip.hidden=!sim.pendingSettings;
}
function markSettingsPending(){setSettingsPending(true);}

const CONTROL_HELP = {
  playBtn:'Run or pause the currently applied model. If settings are pending, apply them first.',
  stepBtn:'Advance the currently applied model by one simulation tick.',
  resetSameBtn:'Return to the same stored initial world or worlds using the currently applied settings.',
  newWorldBtn:'Create a new random starting world using the currently applied settings.',
  applySettingsBtn:'Apply pending model changes. Rule-only changes can reuse the same initial world; population or initial-world changes create a new starting world.',
  compareToggle:'Show World B. B inherits World A except for the overrides enabled in the World B overrides panel.',
  clearBOverridesBtn:'Disable every World B override in the form. Apply changes to make B inherit A exactly.',
  presetSelect:'Load a complete World A preset immediately while retaining your current World B override setup.',
  paintGroupSelect:'In Custom / paint mode, choose what a click on World A paints into a cell.',
  groupsInput:'Number of distinct population groups, from 2 through 20.',
  vacancyInput:'Fraction of grid cells initially left empty and available for vacancy-based moves.',
  colsInput:'Number of grid columns. Larger worlds contain more agents and cost more to simulate.',
  rowsInput:'Number of grid rows. Larger worlds contain more agents and cost more to simulate.',
  distributionSelect:'How groups are arranged before the simulation begins: random, loosely clustered, striped, or hand-painted.',
  seedInput:'Deterministic random seed. Reusing the same seed and structural settings recreates the same initial world.',
  neighborhoodSelect:'Which nearby cells count as neighbors: Moore includes diagonals; Von Neumann uses orthogonal cells only.',
  radiusInput:'How far outward each agent looks when evaluating its neighborhood.',
  wrapToggle:'Treat opposite edges as touching, turning the grid into a torus with no outer boundary.',
  ignoreVacanciesToggle:'Exclude empty cells from similarity and difference fractions. When off, vacancies remain in the denominator.',
  satisfactionRuleSelect:'Choose the rule that determines whether an agent is satisfied with its current neighborhood.',
  thresholdInput:'Threshold for the selected satisfaction rule. Its meaning changes with the rule.',
  isolatedSelect:'Decide whether an agent with no occupied neighbors counts as satisfied or unsatisfied.',
  variationInput:'Maximum per-agent variation around the shared threshold when heterogeneous thresholds are enabled.',
  heterogeneousToggle:'Give agents stable individual threshold differences instead of one identical threshold for everyone.',
  movementModeSelect:'Choose whether agents relocate into vacancies, swap with another group, or may do either.',
  selectionSelect:'Choose how agents are selected for movement during each update.',
  destinationSelect:'Choose how an eligible agent picks among possible destinations.',
  fallbackSelect:'What an agent does when no destination satisfies its rule.',
  searchSelect:'Search the whole grid for destinations or restrict relocation to a local radius.',
  searchRadiusInput:'Maximum relocation distance when local search is enabled.',
  allowSatisfiedToggle:'Allow already-satisfied agents to relocate when the destination does not make their score worse.',
  simulationModeSelect:'Continuous mode makes a bounded number of attempts per tick; round mode evaluates a sweep of eligible agents.',
  movesPerTickInput:'Maximum move attempts in each continuous simulation tick.',
  maxIterationsInput:'Hard upper bound on simulation iterations when the iteration-cap stop rule is enabled.',
  quietRoundsInput:'Number of consecutive no-move iterations required by the quiet-stop rule.',
  stopSatisfiedToggle:'Stop when every occupied agent is satisfied.',
  stopNoLegalToggle:'Stop when no eligible agent has a legal move under the current movement rules.',
  stopQuietToggle:'Stop after the configured number of consecutive iterations with no moves.',
  stopMaxToggle:'Stop when the maximum iteration count is reached.',
  colorSchemeSelect:'Change only the group palette; this does not alter simulation behavior.',
  markerStyleSelect:'Choose how unsatisfied agents are visually emphasized.',
  showVacanciesToggle:'Show empty cells instead of blending them into the background.',
  showUnhappyToggle:'Visually mark agents that currently fail their satisfaction rule.',
  showNeighborhoodToggle:'Highlight the neighborhood cells used to evaluate the selected agent.',
  animateMovesToggle:'Show short-lived lines for recent relocations.',
  showTrailsToggle:'Keep recent movement lines more visible for longer.',
  gridLinesToggle:'Draw cell boundaries over the world.',
  clusterOutlinesToggle:'Draw boundaries where orthogonally adjacent occupied cells belong to different groups.',
  equalSharesBtn:'Set every group weight to the same value. Changes remain pending until applied.',
  shareBtn:'Copy a URL containing the current form configuration so the experiment can be recreated.'
};

function installControlHelp() {
  for(const [id,help] of Object.entries(CONTROL_HELP)){
    const el=$(id);if(!el)continue;el.title=help;
    const label=document.querySelector(`label[for="${id}"]`);if(label)label.title=help;
    const wrappingLabel=el.closest('label');if(wrappingLabel)wrappingLabel.title=help;
  }
  document.querySelectorAll('.speed-btn').forEach(btn=>btn.title=`Run the simulation at ${btn.dataset.speed}× display speed.`);
  document.querySelectorAll('details.settings > summary').forEach(summary=>summary.title='Click to expand or collapse this group of model settings.');
}

function applyPreset(key) {
  const seed=clamp(Math.round(Number($('seedInput').value)||sim.config.population.seed),1,999999999);
  normalizeComparisonSettings(sim.config);
  const compare=deepClone(sim.config.compare);
  const next=mergeDeep(deepClone(DEFAULT_CONFIG),PRESETS[key]?.patch||{});
  next.population.seed=seed;next.compare=compare;
  sim.config=next;sim.preset=key;sim.pendingSettings=false;writeFormConfig(next);initializeSimulation(true);setSettingsPending(false);
}

function applyFormSettings() {
  const beforeA=structuralSignature(sim.config),beforeB=structuralSignature(comparisonConfig(sim.config));
  const next=readFormConfig();
  const afterA=structuralSignature(next),afterB=structuralSignature(comparisonConfig(next));
  const worldChanged=beforeA!==afterA||beforeB!==afterB;
  sim.config=next;sim.preset='modified';sim.pendingSettings=false;
  initializeSimulation(beforeA!==afterA);
  const sameInitial=comparisonUsesSameInitialWorld(sim.config);
  sim.status=worldChanged?(sameInitial?'Settings applied · new matched initial world':'Settings applied · World B has a separate initial world'):'Rules applied · existing initial world reused';
  setSettingsPending(false);updateAllUI();
}

function metricPair(formatter, key) {
  const a=sim.worldA?.stats;if(!a)return '—';
  if(!sim.config.compare.enabled)return formatter(a[key]);
  const b=sim.worldB?.stats;
  return b?`A ${formatter(a[key])} · B ${formatter(b[key])}`:`A ${formatter(a[key])}`;
}

function updateMetrics() {
  if(!sim.worldA)return;
  $('metricSatisfied').textContent=metricPair(v=>pct(v),'satisfiedFraction');
  $('metricSegregation').textContent=metricPair(v=>Number(v).toFixed(2),'segregation');
  $('metricSimilarity').textContent=metricPair(v=>pct(v),'sameShare');
  $('metricLargest').textContent=metricPair(v=>Math.round(v).toLocaleString(),'largestCluster');
  $('metricMoves').textContent=sim.config.compare.enabled?`A ${sim.worldA.moves.toLocaleString()} · B ${sim.worldB.moves.toLocaleString()}`:sim.worldA.moves.toLocaleString();
  $('metricRound').textContent=sim.config.compare.enabled?`A ${sim.worldA.iteration} · B ${sim.worldB.iteration}`:`${sim.worldA.iteration}`;
}

function updateLegend() {
  if(!sim.worldA?.stats)return;
  const total=Math.max(1,sim.worldA.stats.occupied);
  $('legend').innerHTML=sim.worldA.stats.groupCounts.map((count,g)=>`<span class="legend-item"><span class="swatch" style="background:${groupColor(g,sim.config.visual.colorScheme)}"></span>G${g+1} · ${count} · ${pct(count/total)}</span>`).join('')+`<span class="legend-item"><span class="swatch" style="background:#181b29"></span>vacant · ${sim.worldA.stats.vacancies}</span>`;
}

function updateInspector() {
  const useB=sim.selectedWorld==='B'&&sim.config.compare.enabled;
  const world=useB?sim.worldB:sim.worldA,config=useB?comparisonConfig():sim.config,index=sim.selectedIndex;
  if(index===null||!world||index<0||index>=world.grid.length){
    $('inspectorTitle').textContent='Nothing selected';$('inspectorSwatch').style.background='transparent';
    $('inspectSame').textContent='—';$('inspectDifferent').textContent='—';$('inspectShare').textContent='—';$('inspectStatus').textContent='—';
    $('inspectorCopy').textContent='Click an agent in either world. Hovering also shows a compact explanation.';return;
  }
  const id=world.grid[index],p=indexXY(index,config.population.cols),worldName=useB?'World B':'World A';
  if(id===EMPTY){
    $('inspectorTitle').textContent=`${worldName} · Vacancy · (${p.x+1}, ${p.y+1})`;$('inspectorSwatch').style.background='#181b29';
    $('inspectSame').textContent='—';$('inspectDifferent').textContent='—';$('inspectShare').textContent='—';$('inspectStatus').textContent='empty';
    $('inspectorCopy').textContent='This cell is currently available for vacancy-based movement.';return;
  }
  const agent=world.agents[id],ev=evaluateAgent(world,id,config);
  $('inspectorTitle').textContent=`${worldName} · Group ${agent.group+1} · (${p.x+1}, ${p.y+1})`;
  $('inspectorSwatch').style.background=groupColor(agent.group,config.visual.colorScheme);
  $('inspectSame').textContent=ev.stats.same;$('inspectDifferent').textContent=ev.stats.different;$('inspectShare').textContent=pct(ev.stats.similarFraction);$('inspectStatus').textContent=ev.satisfied?'satisfied':'unsatisfied';
  $('inspectorCopy').textContent=`${ev.reason}. ${ev.stats.vacant} vacant neighbor${ev.stats.vacant===1?'':'s'}; agent threshold ${formatThresholdValue(config.satisfaction.rule,ev.threshold)}.`;
}

function updateComparisonUI() {
  const compare=sim.config.compare.enabled;
  $('comparePane').hidden=!compare;$('compareBuilder').hidden=!compare;$('worldStage').classList.toggle('compare-on',compare);$('compareToggle').checked=compare;
  if(!compare)return;
  const bConfig=comparisonConfig(),sameInitial=comparisonUsesSameInitialWorld(sim.config),overrides=activeComparisonOverrides(sim.config);
  $('worldBStartLabel').textContent=sameInitial?'same initial world':'different initial world';
  $('compareStartMode').textContent=sameInitial?'Same exact initial world':'Different initial world because population/grid settings differ';
  $('worldBLabel').textContent=overrides.length===0?'inherits A exactly':`${overrides.length} override${overrides.length===1?'':'s'}`;
  $('worldBHelp').textContent=sameInitial?'Same starting cells; World B inherits A except for enabled rule/behavior overrides.':'World B uses its own reproducible starting world because at least one structural setting differs from A.';
  if(overrides.length===1&&overrides[0].key==='satisfaction.threshold')$('worldBLabel').textContent=`threshold ${formatThresholdValue(bConfig.satisfaction.rule,bConfig.satisfaction.threshold)}`;
}

function updateAllUI() {
  updateComparisonUI();
  $('topGroups').textContent=sim.config.population.groups;$('topSeed').textContent=sim.config.population.seed;
  $('worldALabel').textContent=`threshold ${formatThresholdValue(sim.config.satisfaction.rule,sim.config.satisfaction.threshold)}`;
  const compare=sim.config.compare.enabled,allStopped=Boolean(sim.worldA?.stopped&&(!compare||sim.worldB?.stopped));
  $('playBtn').textContent=sim.running?'❚❚ Pause':(allStopped?'↻ Run again':'▶ Run');
  const a=sim.worldA;
  $('simStatusChip').textContent=sim.running?'Running':(sim.status||a?.stopReason||'Ready');
  $('historyStatus').textContent=a?.stopped?a.stopReason:(a?`iteration ${a.iteration}`:'initial state');
  setSettingsPending(sim.pendingSettings);updateRangeLabels();updateMetrics();updateLegend();updateInspector();
}

async function copyExperimentLink() {
  const config=readFormConfig(),encoded=encodeConfig(config),url=new URL(window.location.href);
  url.searchParams.set('cfg',encoded);url.hash='';
  try{await navigator.clipboard.writeText(url.toString());sim.status='Experiment link copied';}
  catch{window.prompt('Copy this experiment URL:',url.toString());sim.status='Experiment link ready';}
  updateAllUI();
}

function loadConfigFromUrl() {
  const encoded=new URLSearchParams(window.location.search).get('cfg');if(!encoded)return false;
  const decoded=decodeConfig(encoded);if(!decoded)return false;
  sim.config=mergeDeep(deepClone(DEFAULT_CONFIG),decoded);
  sim.config.population.groups=clamp(Math.round(sim.config.population.groups),2,MAX_GROUPS);
  sim.config.population.groupWeights=normalizedWeights(sim.config.population.groupWeights,sim.config.population.groups);
  normalizeComparisonSettings(sim.config);writeFormConfig(sim.config);sim.config=readFormConfig();writeFormConfig(sim.config);
  sim.status='Loaded shared experiment';return true;
}
