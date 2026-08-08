// Fixed-step simulation scheduler plus presentation-only render throttling and application startup.
let uiAcc=0,renderAcc=0;
function headlessActive(){return sim.headless&&sim.mode==='learn'}
function advanceSimulation(simSeconds){
  const FIXED=1/60,MAX_STEPS=900,MAX_BACKLOG=2.5;sim.physicsAcc=Math.min(MAX_BACKLOG,sim.physicsAcc+simSeconds);let steps=0;
  while(sim.physicsAcc+1e-9>=FIXED&&steps++<MAX_STEPS&&sim.running&&!sim.learning){
    physicsStep(FIXED);if(sim.mode==='learn')sim.trainingSimSeconds+=FIXED;sim.physicsAcc-=FIXED;sim.decisionAcc+=FIXED;
    if(sim.decisionAcc+1e-9>=DECISION_DT&&!sim.learning){sim.decisionAcc-=DECISION_DT;decisionStep()}
  }
}
function spectatorPeriod(){if(headlessActive())return Infinity;if(sim.mode!=='learn')return 0;if(sim.speed>=50)return .25;if(sim.speed>=10)return .10;return 0}
function dashboardPeriod(){if(headlessActive())return 1;if(sim.mode==='learn'&&sim.speed>=50)return .60;if(sim.mode==='learn'&&sim.speed>=10)return .30;return .16}
function renderSpectator(){updateMainCamera();renderer.setRenderTarget(null);const selectedMesh=drivers[sim.selected].mesh,hideOwnCar=sim.cameraMode==='pov',wasVisible=selectedMesh.visible;if(hideOwnCar)selectedMesh.visible=false;renderer.render(scene,mainCamera);if(hideOwnCar)selectedMesh.visible=wasVisible}
function animate(now){
  requestAnimationFrame(animate);const rawDt=Math.max(0,(now-sim.lastTime)/1000),realDt=Math.min(.05,rawDt);sim.lastTime=now;
  if(sim.mode==='learn'&&(sim.running||sim.learning))sim.trainingWallSeconds+=rawDt;
  if(sim.running&&!sim.learning)advanceSimulation(realDt*sim.speed);
  const headless=headlessActive(),period=spectatorPeriod();container.classList.toggle('fast-paused',headless);renderAcc+=rawDt;if(!headless&&(period===0||renderAcc>=period)){renderAcc=0;renderSpectator()}
  if(now-sim.measureReal>=1000){const realSeconds=(now-sim.measureReal)/1000;sim.achievedSpeed=(sim.simClock-sim.measureSim)/Math.max(.001,realSeconds);sim.measureReal=now;sim.measureSim=sim.simClock}
  uiAcc+=rawDt;if(uiAcc>=dashboardPeriod()){uiAcc=0;updateUI()}
}
$('runBtn').addEventListener('click',()=>{if(sim.learning)return;sim.running=!sim.running;if(sim.running&&drivers.every(c=>c.lastObs===null)&&sim.mode==='learn')drivers.forEach(chooseAction);updateUI()});
document.querySelectorAll('.speed-btn').forEach(b=>b.addEventListener('click',()=>{sim.speed=Number(b.dataset.speed);document.querySelectorAll('.speed-btn').forEach(x=>x.classList.toggle('active',x===b));log(`Requested simulation speed: ${sim.speed}×. Simulation rules are unchanged; spectator/dashboard repaint cadence may be reduced.`)}));
$('headlessBtn').addEventListener('click',()=>{if(sim.mode!=='learn')return;sim.headless=!sim.headless;log(sim.headless?'Headless display enabled. Training scheduler, POV observations, rewards, PPO batches, and resets are unchanged; only spectator/dashboard painting is suppressed.':'Headless display disabled. Training itself is unchanged.');updateUI()});
$('cameraBtn').addEventListener('click',()=>{sim.cameraMode=sim.cameraMode==='chase'?'pov':'chase';$('cameraBtn').textContent=sim.cameraMode==='chase'?'Chase camera':'POV camera'});$('learnBtn').addEventListener('click',enterLearningMode);
$('trackSelect').addEventListener('change',changeTrackMode);$('raceTrackSelect').addEventListener('change',event=>sim.raceTrackId=event.target.value);$('raceBtn').addEventListener('click',startEvaluationRace);$('raceLaps').addEventListener('change',()=>sim.raceLaps=Number($('raceLaps').value));$('saveBtn').addEventListener('click',saveCheckpoint);$('loadBtn').addEventListener('click',()=>$('loadInput').click());$('loadInput').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{loadCheckpointData(JSON.parse(await file.text()))}catch(error){log(`Load failed: ${error.message}`);$('raceResult').innerHTML=`<strong>Load failed.</strong> ${error.message}`}event.target.value=''});
$('resetBtn').addEventListener('click',()=>{if(sim.learning)return;sim.running=false;sim.mode='learn';sim.headless=false;sim.trackMode='mixed';sim.update=0;sim.experience=0;sim.totalExperience=0;sim.temperature=1.35;sim.lastLoss=0;sim.raceFinished=false;sim.history=[];sim.lastMetrics=null;sim.trainingWallSeconds=0;sim.trainingSimSeconds=0;sim.bestRunDistance=0;sim.physicsAcc=0;sim.decisionAcc=0;resetBatchTelemetry();net=createNetwork();buildTrack('mixed');$('trackSelect').value='mixed';drivers.forEach(c=>{c.rollout=[];c.totalReward=0;c.totalProgress=0;c.lap=0;c.collisions=0;c.overtakes=0;c.lastObs=null;c.latestRGBA=null;c.mesh.visible=true});resetGrid();primeObservations();$('log').innerHTML='';$('raceResult').textContent='Learning reset. Fresh random brain on the historical Balanced Loop.';log('Fresh brain created. Historical training behavior preserved.');updateUI()});
sim.trackMode='mixed';buildTrack('mixed');resetBatchTelemetry();resetGrid();primeObservations();mainCamera.position.set(0,12,45);drivers.forEach(c=>syncCarMesh(c));$('trackSelect').value='mixed';$('raceTrackSelect').value=sim.raceTrackId;log('Ready. One shared 642→48→15 actor-critic brain; speed and headless controls now alter throughput/presentation only, not training semantics.');updateUI();animate(performance.now());
