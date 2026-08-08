// Evaluation races on selectable tracks, locked historical training track, and versioned checkpoints.
function discardPartialRollout(reason=''){
  drivers.forEach(c=>{c.rollout=[];c.lastObs=null;c.pendingReward=0;c.pendingDone=false});sim.experience=0;resetBatchTelemetry();if(reason)log(reason);
}
function raceResultsText(){const placed=drivers.filter(c=>c.finishPlace!=null).sort((a,b)=>a.finishPlace-b.finishPlace),dnfs=drivers.filter(c=>c.raceStatus==='dnf');if(!placed.length&&!dnfs.length)return `Race in progress · ${sim.raceLaps} laps · ${sim.raceTime.toFixed(1)} s`;const parts=placed.map(c=>`P${c.finishPlace} Driver ${c.id+1} ${c.finishTime.toFixed(1)}s`);dnfs.forEach(c=>parts.push(`Driver ${c.id+1} DNF`));return parts.join(' · ')}
function chooseSpectatorRacer(){const current=drivers[sim.selected];if(current&&current.raceStatus==='racing')return;const next=drivers.find(c=>c.raceStatus==='racing');if(next)sim.selected=next.id}
function markRaceFinished(car){
  if(car.raceStatus!=='racing')return;car.raceStatus='finished';car.finishTime=sim.raceTime;car.finishPlace=++sim.racePlaces;car.speed=0;car.actionThrottle=0;car.actionSteer=0;
  const q=track[finishIndex],n=normals[finishIndex],t=tangents[finishIndex];car.x=q.x+n.x*(HALF_WIDTH+3)+t.x*((car.finishPlace-1)*2.1);car.z=q.z+n.z*(HALF_WIDTH+3)+t.z*((car.finishPlace-1)*2.1);car.heading=trackHeading(finishIndex);syncCarMesh(car);
  log(`Race: Driver ${car.id+1} finished P${car.finishPlace} in ${car.finishTime.toFixed(1)} s.`);chooseSpectatorRacer();checkRaceComplete();
}
function markRaceDNF(car){if(car.raceStatus!=='racing')return;car.raceStatus='dnf';car.speed=0;car.mesh.visible=false;log(`Race: Driver ${car.id+1} DNF.`);chooseSpectatorRacer();checkRaceComplete()}
function checkRaceComplete(){if(sim.mode!=='race'||sim.raceFinished||drivers.some(c=>c.raceStatus==='racing'))return;sim.raceFinished=true;sim.running=false;$('raceResult').innerHTML=`<strong>Race complete on ${TRACK_DEFS[activeTrackId].name}.</strong> ${raceResultsText()}`;log(`Evaluation race complete on ${TRACK_DEFS[activeTrackId].name}: ${raceResultsText()}`)}
function startEvaluationRace(){
  if(sim.learning)return;sim.mode='race';sim.headless=false;sim.raceTrackId=$('raceTrackSelect').value in TRACK_DEFS?$('raceTrackSelect').value:'mixed';sim.raceLaps=Number($('raceLaps').value);sim.raceTime=0;sim.racePlaces=0;sim.raceFinished=false;discardPartialRollout('Evaluation race started; unfinished learning batch discarded.');buildTrack(sim.raceTrackId);resetGrid();primeObservations();
  drivers.forEach(c=>{c.lap=0;c.raceStatus='racing';c.finishTime=null;c.finishPlace=null;c.mesh.visible=true});drivers.forEach(chooseAction);sim.running=true;$('raceResult').innerHTML=`<strong>Evaluation race:</strong> ${sim.raceLaps} laps on ${TRACK_DEFS[activeTrackId].name}. Policy frozen; deterministic actions; no backprop.`;log(`Started ${sim.raceLaps}-lap ${TRACK_DEFS[activeTrackId].name} evaluation race with policy from update ${sim.update}.`);updateUI();
}
function enterLearningMode(){
  if(sim.learning)return;sim.mode='learn';sim.trackMode='mixed';sim.raceFinished=false;discardPartialRollout('Learning mode resumed on the historical Balanced Loop.');buildTrack('mixed');resetGrid();primeObservations();drivers.forEach(c=>{c.lap=0;c.mesh.visible=true});drivers.forEach(chooseAction);sim.running=true;$('raceResult').textContent='Learning active on the historical Balanced Loop. Every 512-sample update resets all four cars to the clean starting grid.';updateUI();
}
function changeTrackMode(){sim.trackMode='mixed';$('trackSelect').value='mixed';log('Training track remains locked to the historical Balanced Loop.')}
function checkpointObject(){return{format:'pov-rl-racing-lab-checkpoint',version:3,savedAt:new Date().toISOString(),architecture:{obsW:OBS_W,obsH:OBS_H,inputs:INPUTS,hidden:HIDDEN,actions:ACTIONS,observation:'single-frame'},training:{update:sim.update,totalExperience:sim.totalExperience,temperature:sim.temperature,trackMode:'mixed',activeTrackId:'mixed',history:sim.history,trainingWallSeconds:sim.trainingWallSeconds,trainingSimSeconds:sim.trainingSimSeconds,bestRunDistance:sim.bestRunDistance},net:{w1:Array.from(net.w1),b1:Array.from(net.b1),wp:Array.from(net.wp),bp:Array.from(net.bp),wv:Array.from(net.wv),bv:net.bv}}}
function saveCheckpoint(){const data=JSON.stringify(checkpointObject()),blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`pov-racer-v3-update-${sim.update}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);log(`Saved brain checkpoint at update ${sim.update}.`)}
function loadJointNetwork(n){
  if(n.w1?.length!==HIDDEN*INPUTS||n.b1?.length!==HIDDEN||n.wp?.length!==ACTIONS*HIDDEN||n.bp?.length!==ACTIONS||n.wv?.length!==HIDDEN)throw new Error('Checkpoint weight arrays are incomplete.');
  return{w1:Float32Array.from(n.w1),b1:Float32Array.from(n.b1),wp:Float32Array.from(n.wp),bp:Float32Array.from(n.bp),wv:Float32Array.from(n.wv),bv:Number(n.bv)||0};
}
function migrateV2Checkpoint(data){
  const a=data.architecture||{},n=data.net||{},oldInputs=PIXELS*2+2;
  if(a.inputs!==oldInputs||a.hidden!==HIDDEN||a.steerActions!==STEERS.length||a.throttleActions!==LONGITUDINAL.length||n.w1?.length!==HIDDEN*oldInputs||n.ws?.length!==STEERS.length*HIDDEN||n.wt?.length!==LONGITUDINAL.length*HIDDEN)throw new Error('This v2 checkpoint cannot be migrated.');
  const migrated=createNetwork();migrated.w1.fill(0);
  for(let j=0;j<HIDDEN;j++){const oldBase=j*oldInputs,newBase=j*INPUTS;for(let i=0;i<PIXELS;i++)migrated.w1[newBase+i]=n.w1[oldBase+i];migrated.w1[newBase+PIXELS]=n.w1[oldBase+PIXELS*2];migrated.w1[newBase+PIXELS+1]=n.w1[oldBase+PIXELS*2+1]}
  migrated.b1.set(n.b1);
  for(let t=0;t<LONGITUDINAL.length;t++)for(let st=0;st<STEERS.length;st++){const action=t*STEERS.length+st;migrated.bp[action]=(n.bs?.[st]||0)+(n.bt?.[t]||0);for(let j=0;j<HIDDEN;j++)migrated.wp[action*HIDDEN+j]=(n.ws?.[st*HIDDEN+j]||0)+(n.wt?.[t*HIDDEN+j]||0)}
  migrated.wv.set(n.wv);migrated.bv=Number(n.bv)||0;return migrated;
}
function loadCheckpointData(data){
  if(data?.format!=='pov-rl-racing-lab-checkpoint')throw new Error('Not a POV RL Racing Lab checkpoint.');const a=data.architecture||{},n=data.net||{};let migratedFrom=null;
  if(data.version===2){net=migrateV2Checkpoint(data);migratedFrom='v2'}
  else if((data.version===1||data.version===3)&&a.inputs===INPUTS&&a.hidden===HIDDEN&&a.actions===ACTIONS){net=loadJointNetwork(n);migratedFrom=data.version===1?'v1':null}
  else throw new Error('Checkpoint network architecture does not match this release.');
  sim.update=Number(data.training?.update)||0;sim.totalExperience=Number(data.training?.totalExperience)||0;sim.temperature=clamp(Number(data.training?.temperature)||1.0,.72,1.35);sim.history=Array.isArray(data.training?.history)?data.training.history.slice(-240):[];sim.lastMetrics=sim.history.at(-1)||null;sim.trainingWallSeconds=Number(data.training?.trainingWallSeconds)||0;sim.trainingSimSeconds=Number(data.training?.trainingSimSeconds)||0;sim.bestRunDistance=Number(data.training?.bestRunDistance)||Math.max(0,...sim.history.map(x=>Number(x.bestRunDistance)||Number(x.batchBestRunDistance)||0));
  sim.trackMode='mixed';sim.running=false;sim.mode='learn';sim.headless=false;sim.raceFinished=false;discardPartialRollout();buildTrack('mixed');$('trackSelect').value='mixed';resetGrid();primeObservations();drivers.forEach(c=>{c.lap=0;c.totalReward=0;c.totalProgress=0;c.collisions=0;c.mesh.visible=true});
  $('raceResult').innerHTML=migratedFrom?`<strong>${migratedFrom} checkpoint migrated.</strong> Brain loaded onto the historical Balanced Loop.`:`<strong>Checkpoint loaded.</strong> Brain restored from update ${sim.update}.`;
  log(migratedFrom?`Migrated ${migratedFrom} checkpoint from update ${sim.update}.`:`Loaded checkpoint from update ${sim.update}.`);updateUI();
}
