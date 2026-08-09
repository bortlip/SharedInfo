// Policy decisions and experience transition collection.
function finishTransition(car,done=false){if(!car.lastObs)return;car.rollout.push({obs:car.lastObs,action:car.lastAction,reward:car.pendingReward,value:car.lastValue,logp:car.lastLogp,entropy:car.lastEntropy,temperature:car.lastTemperature,done});sim.experience++;sim.totalExperience++;sim.batchReward+=car.pendingReward;car.episodeReward+=car.pendingReward;car.totalReward+=car.pendingReward;car.pendingReward=0}
function chooseAction(car){
  const obs=captureObservation(car),temperature=sim.mode==='learn'?explorationTemperatureForExperience(sim.totalExperience):sim.temperature;sim.temperature=temperature;const out=forward(obs,temperature),action=sim.mode==='race'?argmax(out.probs):sampleAction(out.probs),p=Math.max(1e-7,out.probs[action]),act=actionTable[action];let entropy=0;for(const prob of out.probs)if(prob>0)entropy-=prob*Math.log(prob);car.lastObs=obs;car.lastForward=out;car.lastAction=action;car.lastValue=out.value;car.lastLogp=Math.log(p);car.lastProb=p;car.lastEntropy=entropy;car.lastTemperature=temperature;car.actionSteer=act.steer;car.actionThrottle=act.throttle;
  if(sim.mode==='learn'){const steerIndex=STEERS.indexOf(act.steer),throttleIndex=LONGITUDINAL.indexOf(act.throttle);sim.batchSteerCounts[steerIndex]++;sim.batchThrottleCounts[throttleIndex]++}
}
function recordEpisodeFailure(car){sim.batchResets++;sim.batchEpisodes++;sim.batchEpisodeDistance+=car.episodePeakProgress;sim.batchBestRunDistance=Math.max(sim.batchBestRunDistance,car.episodePeakProgress)}
function decisionStep(){
  if(sim.learning)return;if(sim.mode==='race'){for(const car of drivers){if(car.raceStatus!=='racing')continue;if(car.pendingDone){markRaceDNF(car);continue}chooseAction(car)}checkRaceComplete();return}
  updatePositionTelemetry();for(const car of drivers){if(car.pendingDone){finishTransition(car,true);recordEpisodeFailure(car);resetDriver(car,car.id)}else finishTransition(car,false)}if(sim.experience>=sim.ppoBatchTarget&&!sim.learning){performLearningUpdate();return}drivers.forEach(chooseAction);
}
