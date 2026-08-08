// Policy decisions and experience transition collection.
function finishTransition(car,done=false){
  if(!car.lastObs)return;
  car.rollout.push({obs:car.lastObs,action:car.lastAction,reward:car.pendingReward,value:car.lastValue,logp:car.lastLogp,done});
  sim.experience++;sim.totalExperience++;sim.batchReward+=car.pendingReward;car.episodeReward+=car.pendingReward;car.totalReward+=car.pendingReward;car.pendingReward=0;
}
function chooseAction(car){
  const obs=captureObservation(car),out=forward(obs),action=sim.mode==='race'?argmax(out.probs):sampleAction(out.probs),p=Math.max(1e-7,out.probs[action]),act=actionTable[action];
  car.lastObs=obs;car.lastAction=action;car.lastValue=out.value;car.lastLogp=Math.log(p);car.lastProb=p;car.actionSteer=act.steer;car.actionThrottle=act.throttle;
  if(sim.mode==='learn'){const steerIndex=STEERS.indexOf(act.steer),throttleIndex=LONGITUDINAL.indexOf(act.throttle);sim.batchSteerCounts[steerIndex]++;sim.batchThrottleCounts[throttleIndex]++}
}
function recordEpisodeFailure(car){sim.batchResets++;sim.batchEpisodes++;sim.batchEpisodeDistance+=car.episodeProgress}
function decisionStep(){
  if(sim.learning)return;
  if(sim.mode==='race'){
    for(const car of drivers){if(car.raceStatus!=='racing')continue;if(car.pendingDone){markRaceDNF(car);continue}chooseAction(car)}
    checkRaceComplete();return;
  }
  updatePositionTelemetry();
  for(const car of drivers){
    if(car.pendingDone){finishTransition(car,true);recordEpisodeFailure(car);resetDriver(car,car.id);chooseAction(car);car.pendingDone=false}
    else{finishTransition(car,false);chooseAction(car)}
  }
  if(sim.experience>=BATCH_TARGET&&!sim.learning)performLearningUpdate();
}
