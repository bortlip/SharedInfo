// Settings, presets, group shares, metrics, inspector, and experiment sharing.
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
  const input=$('thresholdInput'), compare=$('compareThreshold');
  let min=0,max=1,step=.01,label='Minimum same-group share',fallback=.30;
  if(rule==='maxDifferentFraction'){label='Maximum different-group share';fallback=.70;}
  else if(rule==='minSameCount'){label='Minimum same-group count';min=0;max=maxNeighborsForForm();step=1;fallback=Math.min(3,max);}
  else if(rule==='majority'){label='Same-group majority';}
  else if(rule==='weightedUtility'){label='Minimum utility score';min=-1;max=1;step=.01;fallback=0;}
  $('thresholdLabel').textContent=label;
  for(const el of [input,compare]){el.min=min;el.max=max;el.step=step;el.disabled=rule==='majority';if(reset)el.value=fallback;else el.value=clamp(Number(el.value)||0,min,max);}
  $('thresholdValue').textContent=formatThresholdValue(rule,input.value);
  $('compareThresholdValue').textContent=formatThresholdValue(rule,compare.value);
}

function renderGroupShareControls(weights=null) {
  const count=clamp(Math.round(Number($('groupsInput').value)||2),2,MAX_GROUPS);
  const existing=[...document.querySelectorAll('[data-group-weight]')].map(el=>Number(el.value));
  const source=weights||existing.length? (weights||existing) : sim.config.population.groupWeights;
  const normalized=normalizedWeights(source,count);
  $('groupShares').innerHTML=Array.from({length:count},(_,g)=>`<label class="group-share"><span class="swatch" style="background:${groupColor(g,$('colorSchemeSelect').value)}"></span><span>Group ${g+1}</span><input data-group-weight="${g}" type="number" min="0" step="0.1" value="${Number((normalized[g]*count).toFixed(3))}" /></label>`).join('');
  $('paintGroupSelect').innerHTML='<option value="-1">Vacancy</option>'+Array.from({length:count},(_,g)=>`<option value="${g}">Group ${g+1}</option>`).join('');
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
  config.compare={enabled:$('compareToggle').checked,threshold:Number($('compareThreshold').value)};
  return config;
}

function writeFormConfig(config) {
  $('groupsInput').value=config.population.groups;$('vacancyInput').value=config.population.vacancyRate;$('colsInput').value=config.population.cols;$('rowsInput').value=config.population.rows;$('distributionSelect').value=config.population.distribution;$('seedInput').value=config.population.seed;
  $('neighborhoodSelect').value=config.neighborhood.type;$('radiusInput').value=config.neighborhood.radius;$('wrapToggle').checked=config.neighborhood.wrap;$('ignoreVacanciesToggle').checked=config.neighborhood.ignoreVacancies;
  $('satisfactionRuleSelect').value=config.satisfaction.rule;$('thresholdInput').value=config.satisfaction.threshold;$('heterogeneousToggle').checked=config.satisfaction.heterogeneous;$('variationInput').value=config.satisfaction.variation;$('isolatedSelect').value=config.satisfaction.isolated;
  $('movementModeSelect').value=config.movement.mode;$('selectionSelect').value=config.movement.selection;$('destinationSelect').value=config.movement.destination;$('fallbackSelect').value=config.movement.fallback;$('searchSelect').value=config.movement.search;$('searchRadiusInput').value=config.movement.searchRadius;$('allowSatisfiedToggle').checked=config.movement.allowSatisfied;
  $('simulationModeSelect').value=config.simulation.mode;$('movesPerTickInput').value=config.simulation.movesPerTick;$('maxIterationsInput').value=config.simulation.maxIterations;$('quietRoundsInput').value=config.simulation.quietRounds;$('stopSatisfiedToggle').checked=config.simulation.stopSatisfied;$('stopNoLegalToggle').checked=config.simulation.stopNoLegal;$('stopQuietToggle').checked=config.simulation.stopQuiet;$('stopMaxToggle').checked=config.simulation.stopMax;
  $('colorSchemeSelect').value=config.visual.colorScheme;$('showVacanciesToggle').checked=config.visual.showVacancies;$('showUnhappyToggle').checked=config.visual.showUnhappy;$('showNeighborhoodToggle').checked=config.visual.showNeighborhood;$('animateMovesToggle').checked=config.visual.animateMoves;$('showTrailsToggle').checked=config.visual.showTrails;$('gridLinesToggle').checked=config.visual.gridLines;$('clusterOutlinesToggle').checked=config.visual.clusterOutlines;
  $('compareToggle').checked=config.compare.enabled;$('compareThreshold').value=config.compare.threshold;
  renderGroupShareControls(config.population.groupWeights); syncThresholdControl(false); updateRangeLabels();
}

function updateRangeLabels(){
  $('vacancyValue').textContent=pct(Number($('vacancyInput').value));
  $('variationValue').textContent=`±${Math.round(Number($('variationInput').value)*100)}%`;
  $('thresholdValue').textContent=formatThresholdValue($('satisfactionRuleSelect').value,$('thresholdInput').value);
  $('compareThresholdValue').textContent=formatThresholdValue($('satisfactionRuleSelect').value,$('compareThreshold').value);
}

function applyPreset(key) {
  const seed=clamp(Math.round(Number($('seedInput').value)||sim.config.population.seed),1,999999999);
  const compareEnabled=$('compareToggle').checked;
  const next=mergeDeep(deepClone(DEFAULT_CONFIG),PRESETS[key]?.patch||{});
  next.population.seed=seed; next.compare.enabled=compareEnabled;
  sim.config=next; sim.preset=key; writeFormConfig(next); initializeSimulation(true);
}

function applyFormSettings() {
  const before=structuralSignature(sim.config);
  const next=readFormConfig();
  const needsNew=before!==structuralSignature(next);
  sim.config=next; sim.preset='modified';
  initializeSimulation(needsNew);
  sim.status=needsNew?'Population changed · new initial world':'Rules applied · same initial world';
  updateAllUI();
}

function metricPair(formatter, key) {
  const a=sim.worldA?.stats; if(!a)return '—';
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
  const index=sim.selectedIndex, world=sim.worldA;
  if(index===null||!world||index<0||index>=world.grid.length){
    $('inspectorTitle').textContent='Nothing selected'; $('inspectorSwatch').style.background='transparent';
    $('inspectSame').textContent='—'; $('inspectDifferent').textContent='—'; $('inspectShare').textContent='—'; $('inspectStatus').textContent='—';
    $('inspectorCopy').textContent='Click an agent in World A. Hovering also shows a compact explanation.'; return;
  }
  const id=world.grid[index], p=indexXY(index,sim.config.population.cols);
  if(id===EMPTY){
    $('inspectorTitle').textContent=`Vacancy · (${p.x+1}, ${p.y+1})`; $('inspectorSwatch').style.background='#181b29';
    $('inspectSame').textContent='—'; $('inspectDifferent').textContent='—'; $('inspectShare').textContent='—'; $('inspectStatus').textContent='empty';
    $('inspectorCopy').textContent='This cell is currently available for vacancy-based movement.'; return;
  }
  const agent=world.agents[id], ev=evaluateAgent(world,id,sim.config);
  $('inspectorTitle').textContent=`Group ${agent.group+1} · (${p.x+1}, ${p.y+1})`;
  $('inspectorSwatch').style.background=groupColor(agent.group,sim.config.visual.colorScheme);
  $('inspectSame').textContent=ev.stats.same; $('inspectDifferent').textContent=ev.stats.different; $('inspectShare').textContent=pct(ev.stats.similarFraction); $('inspectStatus').textContent=ev.satisfied?'satisfied':'unsatisfied';
  $('inspectorCopy').textContent=`${ev.reason}. ${ev.stats.vacant} vacant neighbor${ev.stats.vacant===1?'':'s'}; agent threshold ${formatThresholdValue(sim.config.satisfaction.rule,ev.threshold)}.`;
}

function updateAllUI() {
  const compare=sim.config.compare.enabled;
  $('comparePane').hidden=!compare;
  $('worldStage').classList.toggle('compare-on',compare);
  $('compareToggle').checked=compare;
  $('topGroups').textContent=sim.config.population.groups;
  $('topSeed').textContent=sim.config.population.seed;
  $('worldALabel').textContent=`threshold ${formatThresholdValue(sim.config.satisfaction.rule,sim.config.satisfaction.threshold)}`;
  $('worldBLabel').textContent=`threshold ${formatThresholdValue(sim.config.satisfaction.rule,sim.config.compare.threshold)}`;
  $('playBtn').textContent=sim.running?'❚❚ Pause':(sim.worldA?.stopped?'▶ Settled':'▶ Run');
  const a=sim.worldA;
  $('simStatusChip').textContent=sim.running?'Running':(sim.status||a?.stopReason||'Ready');
  $('historyStatus').textContent=a?.stopped?a.stopReason:(a?`iteration ${a.iteration}`:'initial state');
  updateRangeLabels(); updateMetrics(); updateLegend(); updateInspector();
}

async function copyExperimentLink() {
  const config=readFormConfig(), encoded=encodeConfig(config), url=new URL(window.location.href);
  url.searchParams.set('cfg',encoded); url.hash='';
  try { await navigator.clipboard.writeText(url.toString()); sim.status='Experiment link copied'; }
  catch { window.prompt('Copy this experiment URL:',url.toString()); sim.status='Experiment link ready'; }
  updateAllUI();
}

function loadConfigFromUrl() {
  const encoded=new URLSearchParams(window.location.search).get('cfg');
  if(!encoded)return false;
  const decoded=decodeConfig(encoded); if(!decoded)return false;
  sim.config=mergeDeep(deepClone(DEFAULT_CONFIG),decoded);
  sim.config.population.groups=clamp(Math.round(sim.config.population.groups),2,MAX_GROUPS);
  sim.config.population.groupWeights=normalizedWeights(sim.config.population.groupWeights,sim.config.population.groups);
  writeFormConfig(sim.config); sim.status='Loaded shared experiment'; return true;
}
