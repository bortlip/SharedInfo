// Input wiring, canvas interaction, guarded bootstrap, and animation loop.
'use strict';

function contextForCanvas(target) { return target === compareCanvas ? compareCtx : ctx; }
function configForCanvas(target) { return target === compareCanvas ? comparisonConfig() : sim.config; }
function worldForCanvas(target) { return target === compareCanvas ? sim.worldB : sim.worldA; }

function eventToCell(event, target, config) {
  const rect=target.getBoundingClientRect();
  const px=(event.clientX-rect.left)/rect.width*target.width;
  const py=(event.clientY-rect.top)/rect.height*target.height;
  const geom=canvasGeometry(contextForCanvas(target),config);
  const x=Math.floor((px-geom.pad)/geom.cellW),y=Math.floor((py-geom.pad)/geom.cellH);
  if(x<0||y<0||x>=geom.cols||y>=geom.rows)return null;
  return xyIndex(x,y,geom.cols);
}

function showCellTooltip(event, target) {
  const config=configForCanvas(target),world=worldForCanvas(target);
  const index=eventToCell(event,target,config);
  if(index===null||!world){$('tooltip').classList.remove('show');return;}
  const id=world.grid[index],p=indexXY(index,config.population.cols),worldName=target===compareCanvas?'World B':'World A';
  $('tooltip').style.left=`${event.clientX}px`;$('tooltip').style.top=`${event.clientY}px`;$('tooltip').classList.add('show');
  if(id===EMPTY){$('tooltip').innerHTML=`<strong>${worldName} · Vacancy</strong><div>Cell ${p.x+1}, ${p.y+1}</div><div>Available to vacancy-based moves.</div>`;return;}
  const agent=world.agents[id],ev=evaluateAgent(world,id,config);
  $('tooltip').innerHTML=`<strong>${worldName} · Group ${agent.group+1}</strong><div>Cell ${p.x+1}, ${p.y+1} · ${ev.satisfied?'satisfied':'unsatisfied'}</div><div>${ev.stats.same} same · ${ev.stats.different} different · ${ev.stats.vacant} vacant</div><div>${ev.reason}</div>`;
}

function handleWorldClick(event, target) {
  const config=configForCanvas(target),world=worldForCanvas(target);
  const index=eventToCell(event,target,config);if(index===null||!world)return;
  if(target===canvas&&sim.config.population.distribution==='custom'&&!sim.running){
    paintWorldCell(sim.worldA,index,Number($('paintGroupSelect').value),sim.config);
    sim.initialSnapshot=snapshotWorld(sim.worldA);
    sim.initialSignature=structuralSignature(sim.config);
    initializeSimulation(false);
    sim.status='Custom World A edited';
  }
  sim.selectedWorld=target===compareCanvas?'B':'A';
  sim.selectedIndex=index;updateAllUI();renderAll();
}

function applyVisualSettingsOnly() {
  const next=readFormConfig();
  sim.config.visual=next.visual;
  renderGroupShareControls();
  updateLegend();renderAll();
}

function ensureAppliedSettings() {
  if(!sim.pendingSettings)return true;
  sim.status='Apply pending settings before running';
  setSettingsPending(true);updateAllUI();$('applySettingsBtn')?.focus();
  return false;
}

function toggleRun() {
  if(!sim.running&&!ensureAppliedSettings())return;
  if(sim.worldA?.stopped&&(!sim.config.compare.enabled||sim.worldB?.stopped))resetSameWorld();
  sim.running=!sim.running;sim.status=sim.running?'Running':'Paused';sim.lastFrame=performance.now();updateAllUI();
}

function resetAppliedWorld() {
  const hadPending=sim.pendingSettings;
  resetSameWorld();
  sim.status=hadPending?'Applied world reset · pending settings not applied':'Same initial world reset';
  setSettingsPending(hadPending);updateAllUI();
}

function newAppliedWorld() {
  const hadPending=sim.pendingSettings,newSeed=randomSeed();
  sim.config.population.seed=newSeed;
  if(!hadPending)$('seedInput').value=newSeed;
  initializeSimulation(true);
  sim.status=hadPending?'New applied world · pending settings not applied':'New random world';
  setSettingsPending(hadPending);updateAllUI();
}

for(const target of [canvas,compareCanvas]){
  target.addEventListener('mousemove',event=>showCellTooltip(event,target));
  target.addEventListener('mouseleave',()=>{$('tooltip').classList.remove('show');sim.hoveredIndex=null;});
  target.addEventListener('click',event=>handleWorldClick(event,target));
}

$('playBtn').addEventListener('click',toggleRun);
$('stepBtn').addEventListener('click',()=>{if(!ensureAppliedSettings())return;const done=sim.worldA?.stopped&&(!sim.config.compare.enabled||sim.worldB?.stopped);if(!done){stepSimulation();sim.status='Stepped once';updateAllUI();renderAll();}});
$('resetSameBtn').addEventListener('click',resetAppliedWorld);
$('newWorldBtn').addEventListener('click',newAppliedWorld);
$('applySettingsBtn').addEventListener('click',applyFormSettings);
$('shareBtn').addEventListener('click',copyExperimentLink);
$('presetSelect').addEventListener('change',event=>applyPreset(event.target.value));
$('clearBOverridesBtn')?.addEventListener('click',clearComparisonOverrideForm);

$('groupsInput').addEventListener('change',()=>renderGroupShareControls());
$('equalSharesBtn').addEventListener('click',()=>{document.querySelectorAll('[data-group-weight]').forEach(input=>input.value='1');markSettingsPending();});
$('satisfactionRuleSelect').addEventListener('change',()=>{syncThresholdControl(true);updateRangeLabels();});
$('neighborhoodSelect').addEventListener('change',()=>syncThresholdControl(false));
$('radiusInput').addEventListener('change',()=>syncThresholdControl(false));
for(const id of ['vacancyInput','thresholdInput','variationInput'])$(id).addEventListener('input',updateRangeLabels);
$('colorSchemeSelect').addEventListener('change',applyVisualSettingsOnly);
$('markerStyleSelect')?.addEventListener('change',applyVisualSettingsOnly);
for(const id of ['showVacanciesToggle','showUnhappyToggle','showNeighborhoodToggle','animateMovesToggle','showTrailsToggle','gridLinesToggle','clusterOutlinesToggle'])$(id).addEventListener('change',applyVisualSettingsOnly);
for(const id of PENDING_SETTING_IDS){const el=$(id);if(!el)continue;el.addEventListener(el.type==='range'?'input':'change',markSettingsPending);}
$('groupShares').addEventListener('input',event=>{if(event.target.matches('[data-group-weight]'))markSettingsPending();});
const compareOverrideControls=$('compareOverrideControls');
if(compareOverrideControls){
  compareOverrideControls.addEventListener('change',event=>{
    if(event.target.matches('[data-b-override-enable]'))syncComparisonOverrideControlStates();
    if(event.target.matches('[data-b-override-enable],[data-b-override-value]'))markSettingsPending();
  });
  compareOverrideControls.addEventListener('input',event=>{if(event.target.matches('[data-b-override-value]'))markSettingsPending();});
}

document.querySelectorAll('.speed-btn').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.speed-btn').forEach(other=>other.classList.remove('active'));
  btn.classList.add('active');sim.speed=Number(btn.dataset.speed)||1;
}));

$('compareToggle').addEventListener('change',event=>{
  sim.config.compare.enabled=event.target.checked;
  sim.status=sim.config.compare.enabled?(comparisonUsesSameInitialWorld(sim.config)?'Comparison enabled · same initial world':'Comparison enabled · World B has a separate initial world'):'Comparison disabled';
  resetSameWorld();setSettingsPending(sim.pendingSettings);
});

function animationLoop(now) {
  const dt=Math.min(.10,(now-sim.lastFrame)/1000);sim.lastFrame=now;
  if(sim.running){
    sim.accumulator+=dt*sim.speed;
    const interval=.08;let steps=0;
    while(sim.accumulator>=interval&&steps<30&&sim.running){stepSimulation();sim.accumulator-=interval;steps++;}
  }
  sim.uiTimer+=dt;
  if(sim.uiTimer>=.12){sim.uiTimer=0;updateAllUI();}
  renderAll();requestAnimationFrame(animationLoop);
}

function showBootFailure(error) {
  console.error('Schelling Segregation Lab failed to start.',error);
  const notice=document.createElement('div');notice.className='boot-error';
  notice.innerHTML=`<div><strong>Schelling Segregation Lab could not start</strong><span>${String(error?.message||error)}</span><small>Refresh the page. If this persists, the source link in the footer points to the current files.</small></div>`;
  document.body.appendChild(notice);
}

window.__schellingLab=sim;
try {
  normalizeComparisonSettings(sim.config);
  writeFormConfig(sim.config);
  loadConfigFromUrl();
  installControlHelp();
  setSettingsPending(false);
  initializeSimulation(true);
  requestAnimationFrame(animationLoop);
} catch(error) {
  showBootFailure(error);
}
