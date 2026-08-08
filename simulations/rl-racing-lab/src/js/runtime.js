// Chronological simulation scheduler, high-speed/headless controls, and application startup.
let uiAcc=0;
function headlessActive(){return sim.headless&&sim.mode==='learn'&&sim.running}
function advanceSimulation(simSeconds){
  const FIXED=1/60,maxSteps=headlessActive()?900:360;sim.physicsAcc+=simSeconds;let steps=0;
  while(sim.physicsAcc+1e-9>=FIXED&&steps++<maxSteps&&sim.running&&!sim.learning){
    physicsStep(FIXED);if(sim.mode==='learn')sim.trainingSimSeconds+=FIXED;sim.physicsAcc-=FIXED;sim.decisionAcc+=FIXED;
    if(sim.decisionAcc+1e-9>=DECISION_DT&&!sim.learning){sim.decisionAcc-=DECISION_DT;decisionStep()}
  }
  sim.physicsAcc=Math.min(sim.physicsAcc,headlessActive()?2.5:.75);
}
function animate(now){
  requestAnimationFrame(animate);const rawDt=Math.max(0,(now-sim.lastTime)/1000),realDt=Math.min(.05,rawDt);sim.lastTime=now;
  if(sim.mode==='learn'&&(sim.running||sim.learning))sim.trainingWallSeconds+=rawDt;
  if(sim.running&&!sim.learning)advanceSimulation(realDt*sim.speed);
  const headless=headlessActive();container.classList.toggle('fast-paused',headless);if(!headless){updateMainCamera();renderer.setRenderTarget(null);const selectedMesh=drivers[sim.selected].mesh,hideOwnCar=sim.cameraMode==='pov',wasVisible=selectedMesh.visible;if(hideOwnCar)selectedMesh.visible=false;renderer.render(scene,mainCamera);if(hideOwnCar)selectedMesh.visible=wasVisible}
  if(now-sim.measureReal>=1000){const realSeconds=(now-sim.measureReal)/1000;sim.achievedSpeed=(sim.simClock-sim.measureSim)/Math.max(.001,realSeconds);sim.measureReal=now;sim.measureSim=sim.simClock}uiAcc+=realDt;const uiPeriod=headless?.75:.16;if(uiAcc>uiPeriod){uiAcc=0;updateUI()}
}
$('runBtn').addEventListener('click',()=>{if(sim.learning)return;sim.running=!sim.running;if(sim.running&&drivers.every(c=>c.lastObs===null)&&sim.mode==='learn')drivers.forEach(chooseAction);updateUI()});
document.querySelectorAll('.speed-btn').forEach(b=>b.addEventListener('click',()=>{sim.speed=Number(b.dataset.speed);document.querySelectorAll('.speed-btn').forEach(x=>x.classList.toggle('active',x===b));log(`Requested simulation speed: ${sim.speed}×.`)}));
$('headlessBtn').addEventListener('click',()=>{if(sim.mode!=='learn')return;sim.headless=!sim.headless;log(sim.headless?'Headless training enabled: spectator and dashboard rendering are throttled; neural POV renders remain active.':'Headless training disabled.');updateUI()});
$('cameraBtn').addEventListener('click',()=>{sim.cameraMode=sim.cameraMode==='chase'?'pov':'chase';$('cameraBtn').textContent=sim.cameraMode==='chase'?'Chase camera':'POV camera'});$('learnBtn').addEventListener('click',enterLearningMode);
$('trackSelect').addEventListener('change',changeTrackMode);$('raceTrackSelect').addEventListener('change',event=>sim.raceTrackId=event.target.value);$('raceBtn').addEventListener('click',startEvaluationRace);$('raceLaps').addEventListener('change',()=>sim.raceLaps=Number($('raceLaps').value));$('saveBtn').addEventListener('click',saveCheckpoint);$('loadBtn').addEventListener('click',()=>$('loadInput').click());$('loadInput').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{loadCheckpointData(JSON.parse(await file.text()))}catch(error){log(`Load failed: ${error.message}`);$('raceResult').innerHTML=`<strong>Load failed.</strong> ${error.message}`}event.target.value=''});
$('resetBtn').addEventListener('click',()=>{if(sim.learning)return;sim.running=false;sim.mode='learn';sim.headless=false;sim.trackMode='mixed';sim.update=0;sim.experience=0;sim.totalExperience=0;sim.temperature=1.35;sim.lastLoss=0;sim.raceFinished=false;sim.history=[];sim.lastMetrics=null;sim.trainingWallSeconds=0;sim.trainingSimSeconds=0;sim.bestRunDistance=0;sim.physicsAcc=0;sim.decisionAcc=0;resetBatchTelemetry();net=createNetwork();buildTrack('mixed');$('trackSelect').value='mixed';drivers.forEach(c=>{c.rollout=[];c.totalReward=0;c.totalProgress=0;c.lap=0;c.collisions=0;c.overtakes=0;c.lastObs=null;c.latestRGBA=null;c.mesh.visible=true});resetGrid();primeObservations();$('log').innerHTML='';$('raceResult').textContent='Learning reset. Fresh random brain on the historical Balanced Loop.';log('Fresh brain created. Historical training behavior preserved.');updateUI()});
sim.trackMode='mixed';buildTrack('mixed');resetBatchTelemetry();resetGrid();primeObservations();mainCamera.position.set(0,12,45);drivers.forEach(c=>syncCarMesh(c));$('trackSelect').value='mixed';$('raceTrackSelect').value=sim.raceTrackId;log('Ready. Historical learner preserved; safe chronological 1×–50× scheduling, headless training, progress telemetry, and evaluation races enabled.');updateUI();animate(performance.now());
