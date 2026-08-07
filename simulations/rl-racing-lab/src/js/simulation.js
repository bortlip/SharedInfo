// Policy decisions and experience transition collection.
function finishTransition(car,done=false){
  if(!car.lastObs)return;
  car.rollout.push({obs:car.lastObs,action:car.lastAction,reward:car.pendingReward,value:car.lastValue,logp:car.lastLogp,done});
  sim.experience++;sim.totalExperience++;sim.batchReward+=car.pendingReward;
  car.episodeReward+=car.pendingReward;car.totalReward+=car.pendingReward;car.pendingReward=0;
}
function chooseAction(car){
  const obs=captureObservation(car,car.id===sim.selected),out=forward(obs),action=sim.mode==='race'?argmax(out.probs):sampleAction(out.probs),p=Math.max(1e-7,out.probs[action]),act=actionTable[action];
  car.lastObs=obs;car.lastAction=action;car.lastValue=out.value;car.lastLogp=Math.log(p);car.lastProb=p;car.actionSteer=act.steer;car.actionThrottle=act.throttle;
}
function decisionStep(){
  if(sim.learning)return;
  if(sim.mode==='race'){
    for(const car of drivers){
      if(car.raceStatus!=='racing')continue;
      if(car.pendingDone){markRaceDNF(car);continue}
      chooseAction(car);
    }
    checkRaceComplete();
    return;
  }
  applyPositionRewards();
  for(const car of drivers){
    if(car.pendingDone){
      finishTransition(car,true);
      resetDriver(car,car.id);
      chooseAction(car);
      car.pendingDone=false;
    }else{
      finishTransition(car,false);
      chooseAction(car);
    }
  }
  if(sim.experience>=BATCH_TARGET&&!sim.learning)performLearningUpdate();
}
