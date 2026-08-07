// Evaluation races, track modes, and checkpoint save/load.
function discardPartialRollout(reason=''){
  drivers.forEach(c=>{c.rollout=[];c.lastObs=null;c.pendingReward=0;c.pendingDone=false});
  sim.experience=0;sim.batchReward=0;sim.collisions=0;
  if(reason)log(reason);
}
function raceResultsText(){
  const placed=drivers.filter(c=>c.finishPlace!=null).sort((a,b)=>a.finishPlace-b.finishPlace);
  const dnfs=drivers.filter(c=>c.raceStatus==='dnf');
  if(!placed.length&&!dnfs.length)return `Race in progress · ${sim.raceLaps} laps · ${sim.raceTime.toFixed(1)} s`;
  const parts=placed.map(c=>`P${c.finishPlace} Driver ${c.id+1} ${c.finishTime.toFixed(1)}s`);
  dnfs.forEach(c=>parts.push(`Driver ${c.id+1} DNF`));
  return parts.join(' · ');
}
function chooseSpectatorRacer(){
  const current=drivers[sim.selected];
  if(current&&current.raceStatus==='racing')return;
  const next=drivers.find(c=>c.raceStatus==='racing');
  if(next)sim.selected=next.id;
}
function markRaceFinished(car){
  if(car.raceStatus!=='racing')return;
  car.raceStatus='finished';car.finishTime=sim.raceTime;car.finishPlace=++sim.racePlaces;car.speed=0;car.actionThrottle=0;car.actionSteer=0;
  const q=track[finishIndex],n=normals[finishIndex],t=tangents[finishIndex];
  car.x=q.x+n.x*(HALF_WIDTH+3.0)+t.x*((car.finishPlace-1)*2.1);
  car.z=q.z+n.z*(HALF_WIDTH+3.0)+t.z*((car.finishPlace-1)*2.1);
  car.heading=trackHeading(finishIndex);syncCarMesh(car);
  log(`Race: Driver ${car.id+1} finished P${car.finishPlace} in ${car.finishTime.toFixed(1)} s.`);
  chooseSpectatorRacer();checkRaceComplete();
}
function markRaceDNF(car){
  if(car.raceStatus!=='racing')return;
  car.raceStatus='dnf';car.speed=0;car.mesh.visible=false;
  log(`Race: Driver ${car.id+1} DNF.`);
  chooseSpectatorRacer();checkRaceComplete();
}
function checkRaceComplete(){
  if(sim.mode!=='race'||sim.raceFinished)return;
  if(drivers.some(c=>c.raceStatus==='racing'))return;
  sim.raceFinished=true;sim.running=false;
  $('raceResult').innerHTML=`<strong>Race complete.</strong> ${raceResultsText()}`;
  log(`Evaluation race complete: ${raceResultsText()}`);
}
function startEvaluationRace(){
  if(sim.learning)return;
  sim.mode='race';sim.raceLaps=Number($('raceLaps').value);sim.raceTime=0;sim.racePlaces=0;sim.raceFinished=false;
  discardPartialRollout('Evaluation race started; unfinished learning batch discarded.');
  resetGrid();
  drivers.forEach(c=>{c.lap=0;c.raceStatus='racing';c.finishTime=null;c.finishPlace=null;c.mesh.visible=true});
  drivers.forEach(chooseAction);
  sim.running=true;
  $('raceResult').innerHTML=`<strong>Official evaluation race:</strong> ${sim.raceLaps} laps. Policy frozen; deterministic actions; no backprop.`;
  log(`Started ${sim.raceLaps}-lap evaluation race with policy from update ${sim.update}.`);
  updateUI();
}
function enterLearningMode(){
  if(sim.learning)return;
  sim.mode='learn';sim.raceFinished=false;
  discardPartialRollout('Learning mode resumed with the current saved brain.');
  resetGrid();drivers.forEach(c=>{c.lap=0;c.mesh.visible=true});
  drivers.forEach(chooseAction);
  sim.running=true;
  $('raceResult').textContent='Learning mode active. Experience is accumulating again; the next 512-sample batch will trigger backprop.';
  updateUI();
}
function chooseRandomTrainingTrack(){
  const choices=TRAINING_TRACKS.filter(id=>id!==activeTrackId);
  return choices[(Math.random()*choices.length)|0]||'mixed';
}
function changeTrackMode(value){
  if(sim.learning)return;
  sim.running=false;sim.mode='learn';sim.trackMode=value;
  discardPartialRollout();
  const id=value==='random'?chooseRandomTrainingTrack():value;
  buildTrack(id);resetGrid();
  drivers.forEach(c=>{c.lap=0;c.totalProgress=0;c.lastRank=null;c.mesh.visible=true});
  $('raceResult').innerHTML=`<strong>Track changed:</strong> ${TRACK_DEFS[activeTrackId].name}. ${value==='random'?'Training will rotate to another circuit every '+sim.trackRotationEvery+' updates.':'Ready to learn or run an evaluation race.'}`;
  log(`Loaded track: ${TRACK_DEFS[activeTrackId].name}.`);
  updateUI();
}
function maybeRotateTrainingTrack(){
  if(sim.trackMode!=='random'||sim.update===0||sim.update%sim.trackRotationEvery!==0)return false;
  const id=chooseRandomTrainingTrack();buildTrack(id);resetGrid();
  drivers.forEach(c=>{c.lap=0;c.lastRank=null;c.mesh.visible=true});
  log(`Multi-track training rotated to ${TRACK_DEFS[id].name}.`);
  return true;
}

function checkpointObject(){
  return{
    format:'pov-rl-racing-lab-checkpoint',version:1,savedAt:new Date().toISOString(),
    architecture:{obsW:OBS_W,obsH:OBS_H,inputs:INPUTS,hidden:HIDDEN,actions:ACTIONS},
    training:{update:sim.update,totalExperience:sim.totalExperience,temperature:sim.temperature,trackMode:sim.trackMode,activeTrackId},
    net:{w1:Array.from(net.w1),b1:Array.from(net.b1),wp:Array.from(net.wp),bp:Array.from(net.bp),wv:Array.from(net.wv),bv:net.bv}
  };
}
function saveCheckpoint(){
  const data=JSON.stringify(checkpointObject());
  const blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`pov-racer-update-${sim.update}.json`;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  log(`Saved brain checkpoint at update ${sim.update}.`);
}
function loadCheckpointData(data){
  if(data?.format!=='pov-rl-racing-lab-checkpoint')throw new Error('Not a POV RL Racing Lab checkpoint.');
  const a=data.architecture||{},n=data.net||{};
  if(a.inputs!==INPUTS||a.hidden!==HIDDEN||a.actions!==ACTIONS)throw new Error('Checkpoint network architecture does not match this prototype.');
  if(n.w1?.length!==HIDDEN*INPUTS||n.b1?.length!==HIDDEN||n.wp?.length!==ACTIONS*HIDDEN||n.bp?.length!==ACTIONS||n.wv?.length!==HIDDEN)throw new Error('Checkpoint weight arrays are incomplete.');
  net={w1:Float32Array.from(n.w1),b1:Float32Array.from(n.b1),wp:Float32Array.from(n.wp),bp:Float32Array.from(n.bp),wv:Float32Array.from(n.wv),bv:Number(n.bv)||0};
  sim.update=Number(data.training?.update)||0;sim.totalExperience=Number(data.training?.totalExperience)||0;sim.temperature=Number(data.training?.temperature)||1.0;sim.trackMode=data.training?.trackMode||'mixed';
  sim.running=false;sim.mode='learn';sim.raceFinished=false;discardPartialRollout();
  buildTrack(data.training?.activeTrackId in TRACK_DEFS?data.training.activeTrackId:(sim.trackMode in TRACK_DEFS?sim.trackMode:'mixed'));$('trackSelect').value=sim.trackMode;
  resetGrid();drivers.forEach(c=>{c.lap=0;c.totalReward=0;c.totalProgress=0;c.collisions=0;c.mesh.visible=true});
  $('raceResult').innerHTML=`<strong>Checkpoint loaded.</strong> Brain restored from update ${sim.update}. Start learning or run an evaluation race.`;
  log(`Loaded checkpoint from update ${sim.update}.`);
  updateUI();
}

