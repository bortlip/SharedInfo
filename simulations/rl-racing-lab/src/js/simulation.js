// Policy decisions and experience transition collection.
function finishTransition(car,done=false){
  if(!car.lastObs)return;
  car.rollout.push({obs:car.lastObs,steerAction:car.lastSteerAction,throttleAction:car.lastThrottleAction,reward:car.pendingReward,value:car.lastValue,logp:car.lastLogp,done});
  sim.experience++;sim.totalExperience++;sim.batchReward+=car.pendingReward;
  car.episodeReward+=car.pendingReward;car.totalReward+=car.pendingReward;car.pendingReward=0;
}
function chooseAction(car){
  const obs=captureObservation(car),out=forward(obs);
  const steerAction=sim.mode==='race'?argmax(out.steerProbs):sampleAction(out.steerProbs);
  const throttleAction=sim.mode==='race'?argmax(out.throttleProbs):sampleAction(out.throttleProbs);
  const pSteer=Math.max(1e-7,out.steerProbs[steerAction]),pThrottle=Math.max(1e-7,out.throttleProbs[throttleAction]);
  car.lastObs=obs;car.lastSteerAction=steerAction;car.lastThrottleAction=throttleAction;car.lastValue=out.value;
  car.lastLogp=Math.log(pSteer)+Math.log(pThrottle);car.lastSteerProb=pSteer;car.lastThrottleProb=pThrottle;car.lastProb=Math.sqrt(pSteer*pThrottle);
  car.actionSteer=STEERS[steerAction];car.actionThrottle=LONGITUDINAL[throttleAction];
  if(sim.mode==='learn'){sim.batchSteerCounts[steerAction]++;sim.batchThrottleCounts[throttleAction]++}
}
function recordEpisodeFailure(car){
  sim.batchResets++;sim.batchEpisodes++;sim.batchEpisodeDistance+=car.episodeProgress;
}
function decisionStep(){
  if(sim.learning)return;
  if(sim.mode==='race'){
    for(const car of drivers){
      if(car.raceStatus!=='racing')continue;
      if(car.pendingDone){markRaceDNF(car);continue}
      chooseAction(car);
    }
    checkRaceComplete();return;
  }
  updatePositionTelemetry();
  for(const car of drivers){
    if(car.pendingDone){
      finishTransition(car,true);recordEpisodeFailure(car);resetDriver(car,car.id);chooseAction(car);car.pendingDone=false;
    }else{
      finishTransition(car,false);chooseAction(car);
    }
  }
  if(sim.experience>=BATCH_TARGET&&!sim.learning)performLearningUpdate();
}
