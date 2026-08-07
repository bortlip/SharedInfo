// Evaluation races, track modes, and versioned checkpoint save/load.
function discardPartialRollout(reason=''){
  drivers.forEach(c=>{c.rollout=[];c.lastObs=null;c.prevFrame=null;c.pendingReward=0;c.pendingDone=false});
  sim.experience=0;resetBatchTelemetry();
  if(reason)log(reason);
}
function raceResultsText(){
  const placed=drivers.filter(c=>c.finishPlace!=null).sort((a,b)=>a.finishPlace-b.finishPlace),dnfs=drivers.filter(c=>c.raceStatus==='dnf');
  if(!placed.length&&!dnfs.length)return `Race in progress · ${sim.raceLaps} laps · ${sim.raceTime.toFixed(1)} s`;
  const parts=placed.map(c=>`P${c.finishPlace} Driver ${c.id+1} ${c.finishTime.toFixed(1)}s`);dnfs.forEach(c=>parts.push(`Driver ${c.id+1} DNF`));return parts.join(' · ');
}
function chooseSpectatorRacer(){const current=drivers[sim.selected];if(current&&current.raceStatus==='racing')return;const next=drivers.find(c=>c.raceStatus==='racing');if(next)sim.selected=next.id}
function markRaceFinished(car){
  if(car.raceStatus!=='racing')return;
  car.raceStatus='finished';car.finishTime=sim.raceTime;car.finishPlace=++sim.racePlaces;car.speed=0;car.vx=0;car.vz=0;car.actionThrottle=0;car.actionSteer=0;
  const q=track[finishIndex],n=normals[finishIndex],t=tangents[finishIndex];car.x=q.x+n.x*(HALF_WIDTH+3)+t.x*((car.finishPlace-1)*2.1);car.z=q.z+n.z*(HALF_WIDTH+3)+t.z*((car.finishPlace-1)*2.1);
  car.heading=trackHeading(finishIndex);syncCarMesh(car);log(`Race: Driver ${car.id+1} finished P${car.finishPlace} in ${car.finishTime.toFixed(1)} s.`);chooseSpectatorRacer();checkRaceComplete();
}
function markRaceDNF(car){if(car.raceStatus!=='racing')return;car.raceStatus='dnf';car.speed=0;car.vx=0;car.vz=0;car.mesh.visible=false;log(`Race: Driver ${car.id+1} DNF.`);chooseSpectatorRacer();checkRaceComplete()}
function checkRaceComplete(){
  if(sim.mode!=='race'||sim.raceFinished||drivers.some(c=>c.raceStatus==='racing'))return;
  sim.raceFinished=true;sim.running=false;$('raceResult').innerHTML=`<strong>Race complete.</strong> ${raceResultsText()}`;log(`Evaluation race complete: ${raceResultsText()}`);
}
function startEvaluationRace(){
  if(sim.learning)return;
  sim.mode='race';sim.raceLaps=Number($('raceLaps').value);sim.raceTime=0;sim.racePlaces=0;sim.raceFinished=false;
  discardPartialRollout('Evaluation race started; unfinished learning batch discarded.');resetGrid();
  drivers.forEach(c=>{c.lap=0;c.raceStatus='racing';c.finishTime=null;c.finishPlace=null;c.mesh.visible=true});drivers.forEach(chooseAction);sim.running=true;
  $('raceResult').innerHTML=`<strong>Official evaluation race:</strong> ${sim.raceLaps} laps. Policy frozen; deterministic actions; no backprop.`;
  log(`Started ${sim.raceLaps}-lap evaluation race with policy from update ${sim.update}.`);updateUI();
}
function enterLearningMode(){
  if(sim.learning)return;
  sim.mode='learn';sim.raceFinished=false;discardPartialRollout('Learning mode resumed with the current saved brain.');
  resetGrid();drivers.forEach(c=>{c.lap=0;c.mesh.visible=true});drivers.forEach(chooseAction);sim.running=true;
  $('raceResult').textContent='Learning mode active. Experience is accumulating again; the next 512-sample batch will trigger backprop.';updateUI();
}
function chooseRandomTrainingTrack(){const choices=TRAINING_TRACKS.filter(id=>id!==activeTrackId);return choices[(Math.random()*choices.length)|0]||'mixed'}
function changeTrackMode(value){
  if(sim.learning)return;
  sim.running=false;sim.mode='learn';sim.trackMode=value;discardPartialRollout();
  const id=value==='random'?chooseRandomTrainingTrack():value;buildTrack(id);resetGrid();
  drivers.forEach(c=>{c.lap=0;c.totalProgress=0;c.lastRank=null;c.mesh.visible=true});
  $('raceResult').innerHTML=`<strong>Track changed:</strong> ${TRACK_DEFS[activeTrackId].name}. ${value==='random'?'Training will rotate to another circuit every '+sim.trackRotationEvery+' updates.':'Ready to learn or run an evaluation race.'}`;
  log(`Loaded track: ${TRACK_DEFS[activeTrackId].name}.`);updateUI();
}
function maybeRotateTrainingTrack(){
  if(sim.trackMode!=='random'||sim.update===0||sim.update%sim.trackRotationEvery!==0)return false;
  const id=chooseRandomTrainingTrack();buildTrack(id);resetGrid();drivers.forEach(c=>{c.lap=0;c.lastRank=null;c.mesh.visible=true});log(`Multi-track training rotated to ${TRACK_DEFS[id].name}.`);return true;
}
function checkpointObject(){
  return{
    format:'pov-rl-racing-lab-checkpoint',version:2,savedAt:new Date().toISOString(),
    architecture:{obsW:OBS_W,obsH:OBS_H,inputs:INPUTS,hidden:HIDDEN,steerActions:STEER_ACTIONS,throttleActions:THROTTLE_ACTIONS,temporal:'frame-difference'},
    training:{update:sim.update,totalExperience:sim.totalExperience,temperature:sim.temperature,trackMode:sim.trackMode,activeTrackId,history:sim.history},
    net:{w1:Array.from(net.w1),b1:Array.from(net.b1),ws:Array.from(net.ws),bs:Array.from(net.bs),wt:Array.from(net.wt),bt:Array.from(net.bt),wv:Array.from(net.wv),bv:net.bv}
  };
}
function saveCheckpoint(){
  const data=JSON.stringify(checkpointObject()),blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`pov-racer-v2-update-${sim.update}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);log(`Saved v2 brain checkpoint at update ${sim.update}.`);
}
function migrateV1Checkpoint(data){
  const a=data.architecture||{},n=data.net||{};
  if(a.inputs!==PIXELS+2||a.hidden!==HIDDEN||a.actions!==15||n.w1?.length!==HIDDEN*(PIXELS+2)||n.b1?.length!==HIDDEN||n.wp?.length!==15*HIDDEN||n.bp?.length!==15||n.wv?.length!==HIDDEN)throw new Error('This v1 checkpoint cannot be migrated.');
  const migrated=createNetwork();migrated.w1.fill(0);
  for(let j=0;j<HIDDEN;j++){
    const oldBase=j*(PIXELS+2),newBase=j*INPUTS;
    for(let i=0;i<PIXELS;i++)migrated.w1[newBase+i]=n.w1[oldBase+i];
    migrated.w1[newBase+PIXELS*2]=n.w1[oldBase+PIXELS];migrated.w1[newBase+PIXELS*2+1]=n.w1[oldBase+PIXELS+1];
  }
  migrated.b1.set(n.b1);
  for(let s=0;s<STEER_ACTIONS;s++){
    let bias=0;for(let t=0;t<THROTTLE_ACTIONS;t++)bias+=n.bp[t*STEER_ACTIONS+s];migrated.bs[s]=bias/THROTTLE_ACTIONS;
    for(let j=0;j<HIDDEN;j++){let sum=0;for(let t=0;t<THROTTLE_ACTIONS;t++)sum+=n.wp[(t*STEER_ACTIONS+s)*HIDDEN+j];migrated.ws[s*HIDDEN+j]=sum/THROTTLE_ACTIONS}
  }
  for(let t=0;t<THROTTLE_ACTIONS;t++){
    let bias=0;for(let s=0;s<STEER_ACTIONS;s++)bias+=n.bp[t*STEER_ACTIONS+s];migrated.bt[t]=bias/STEER_ACTIONS;
    for(let j=0;j<HIDDEN;j++){let sum=0;for(let s=0;s<STEER_ACTIONS;s++)sum+=n.wp[(t*STEER_ACTIONS+s)*HIDDEN+j];migrated.wt[t*HIDDEN+j]=sum/STEER_ACTIONS}
  }
  migrated.wv.set(n.wv);migrated.bv=Number(n.bv)||0;return migrated;
}
function loadCheckpointData(data){
  if(data?.format!=='pov-rl-racing-lab-checkpoint')throw new Error('Not a POV RL Racing Lab checkpoint.');
  const a=data.architecture||{},n=data.net||{};let migrated=false;
  if(data.version===1){net=migrateV1Checkpoint(data);migrated=true}
  else{
    if(data.version!==2||a.inputs!==INPUTS||a.hidden!==HIDDEN||a.steerActions!==STEER_ACTIONS||a.throttleActions!==THROTTLE_ACTIONS)throw new Error('Checkpoint network architecture does not match this release.');
    if(n.w1?.length!==HIDDEN*INPUTS||n.b1?.length!==HIDDEN||n.ws?.length!==STEER_ACTIONS*HIDDEN||n.bs?.length!==STEER_ACTIONS||n.wt?.length!==THROTTLE_ACTIONS*HIDDEN||n.bt?.length!==THROTTLE_ACTIONS||n.wv?.length!==HIDDEN)throw new Error('Checkpoint weight arrays are incomplete.');
    net={w1:Float32Array.from(n.w1),b1:Float32Array.from(n.b1),ws:Float32Array.from(n.ws),bs:Float32Array.from(n.bs),wt:Float32Array.from(n.wt),bt:Float32Array.from(n.bt),wv:Float32Array.from(n.wv),bv:Number(n.bv)||0};
  }
  sim.update=Number(data.training?.update)||0;sim.totalExperience=Number(data.training?.totalExperience)||0;sim.temperature=Math.max(.9,Number(data.training?.temperature)||1.0);
  sim.trackMode=data.training?.trackMode||'mixed';sim.history=Array.isArray(data.training?.history)?data.training.history.slice(-120):[];sim.lastMetrics=sim.history.at(-1)||null;
  sim.running=false;sim.mode='learn';sim.raceFinished=false;discardPartialRollout();
  buildTrack(data.training?.activeTrackId in TRACK_DEFS?data.training.activeTrackId:(sim.trackMode in TRACK_DEFS?sim.trackMode:'mixed'));$('trackSelect').value=sim.trackMode;
  resetGrid();drivers.forEach(c=>{c.lap=0;c.totalReward=0;c.totalProgress=0;c.collisions=0;c.mesh.visible=true});
  $('raceResult').innerHTML=migrated?`<strong>Legacy checkpoint migrated.</strong> The v1 single-frame/15-action brain was approximately factorized into the new temporal steering + throttle policy. Continue learning before judging it.`:`<strong>Checkpoint loaded.</strong> Brain restored from update ${sim.update}. Start learning or run an evaluation race.`;
  log(migrated?`Migrated v1 checkpoint from update ${sim.update} into the v2 architecture.`:`Loaded v2 checkpoint from update ${sim.update}.`);updateUI();
}
