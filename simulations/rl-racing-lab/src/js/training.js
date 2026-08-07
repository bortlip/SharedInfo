// PPO-style batch construction, entropy-regularized backpropagation, and learning telemetry.
function buildTrainingBatch(){
  const batch=[];
  for(const car of drivers){
    let nextValue=car.lastValue,gae=0;
    for(let i=car.rollout.length-1;i>=0;i--){
      const e=car.rollout[i],mask=e.done?0:1,delta=e.reward+GAMMA*nextValue*mask-e.value;
      gae=delta+GAMMA*GAE_LAMBDA*mask*gae;e.adv=gae;e.ret=e.value+gae;nextValue=e.value;
    }
    batch.push(...car.rollout);
  }
  let mean=0;for(const e of batch)mean+=e.adv;mean/=Math.max(1,batch.length);
  let variance=0;for(const e of batch){const d=e.adv-mean;variance+=d*d}variance/=Math.max(1,batch.length);
  const sd=Math.sqrt(variance)+1e-6;for(const e of batch)e.adv=(e.adv-mean)/sd;
  return batch;
}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[a[i],a[j]]=[a[j],a[i]]}}
function entropyOf(probs){let h=0;for(const p of probs)if(p>1e-8)h-=p*Math.log(p);return h}
function policyGradients(probs,selected,dLogP,entropy){
  const grad=new Float32Array(probs.length);
  for(let a=0;a<probs.length;a++){
    const p=Math.max(1e-8,probs[a]);
    const policy=dLogP*((a===selected?1:0)-p);
    const entropyGrad=ENTROPY_COEF*p*(Math.log(p)+entropy);
    grad[a]=clamp((policy+entropyGrad)/Math.max(.5,sim.temperature),-3,3);
  }
  return grad;
}
function trainSample(e,lr){
  const {h,steerProbs,throttleProbs,value}=forward(e.obs);
  const newLog=Math.log(Math.max(1e-7,steerProbs[e.steerAction]))+Math.log(Math.max(1e-7,throttleProbs[e.throttleAction]));
  const ratio=Math.exp(clamp(newLog-e.logp,-10,10)),clipped=(e.adv>=0&&ratio>1+PPO_CLIP)||(e.adv<0&&ratio<1-PPO_CLIP),dLogP=clipped?0:-e.adv*ratio;
  const steerEntropy=entropyOf(steerProbs),throttleEntropy=entropyOf(throttleProbs);
  const dSteer=policyGradients(steerProbs,e.steerAction,dLogP,steerEntropy),dThrottle=policyGradients(throttleProbs,e.throttleAction,dLogP,throttleEntropy);
  const dValue=clamp(.35*(value-e.ret),-3,3),dh=new Float32Array(HIDDEN);

  for(let j=0;j<HIDDEN;j++){
    let g=net.wv[j]*dValue;
    for(let a=0;a<STEER_ACTIONS;a++)g+=net.ws[a*HIDDEN+j]*dSteer[a];
    for(let a=0;a<THROTTLE_ACTIONS;a++)g+=net.wt[a*HIDDEN+j]*dThrottle[a];
    dh[j]=clamp(g*(1-h[j]*h[j]),-3,3);
  }
  for(let a=0;a<STEER_ACTIONS;a++){const base=a*HIDDEN,g=dSteer[a];for(let j=0;j<HIDDEN;j++)net.ws[base+j]-=lr*g*h[j];net.bs[a]-=lr*g}
  for(let a=0;a<THROTTLE_ACTIONS;a++){const base=a*HIDDEN,g=dThrottle[a];for(let j=0;j<HIDDEN;j++)net.wt[base+j]-=lr*g*h[j];net.bt[a]-=lr*g}
  for(let j=0;j<HIDDEN;j++)net.wv[j]-=lr*dValue*h[j];net.bv-=lr*dValue;
  for(let j=0;j<HIDDEN;j++){const base=j*INPUTS,g=dh[j];for(let i=0;i<INPUTS;i++)net.w1[base+i]-=lr*g*e.obs[i];net.b1[j]-=lr*g}

  const policyLoss=-Math.min(ratio*e.adv,clamp(ratio,1-PPO_CLIP,1+PPO_CLIP)*e.adv),valueLoss=.5*(value-e.ret)*(value-e.ret);
  return policyLoss+.35*valueLoss-ENTROPY_COEF*(steerEntropy+throttleEntropy);
}
function captureBatchMetrics(avgReward){
  const metrics={
    update:sim.update,rewardPerExp:avgReward,forwardPerExp:sim.batchForwardMeters/Math.max(1,sim.experience),
    offRoadPct:sim.batchOffRoadSeconds/Math.max(.001,sim.batchDriverSeconds)*100,
    avgFailDistance:sim.batchEpisodes?sim.batchEpisodeDistance/sim.batchEpisodes:drivers.reduce((sum,c)=>sum+c.episodeProgress,0)/DRIVER_COUNT,
    resets:sim.batchResets,laps:sim.batchLaps,collisions:sim.collisions,loss:sim.lastLoss,
    steer:[...sim.batchSteerCounts],throttle:[...sim.batchThrottleCounts]
  };
  sim.lastMetrics=metrics;sim.history.push(metrics);if(sim.history.length>120)sim.history.shift();
  return metrics;
}
async function performLearningUpdate(){
  sim.learning=true;sim.running=false;$('learningOverlay').classList.add('show');$('phaseText').textContent='BACKPROP';$('learningText').textContent=`Training on ${sim.experience} experiences…`;updateUI();
  await new Promise(r=>setTimeout(r,70));
  const batch=buildTrainingBatch(),avgReward=sim.batchReward/Math.max(1,sim.experience);let loss=0,count=0;
  for(let epoch=0;epoch<3;epoch++){
    shuffle(batch);
    for(const e of batch){loss+=trainSample(e,.00045);count++}
    $('learningText').textContent=`Backprop pass ${epoch+1}/3 · ${batch.length} samples`;await new Promise(r=>setTimeout(r,0));
  }
  sim.lastLoss=loss/Math.max(1,count);sim.update++;sim.temperature=Math.max(.90,1.25-sim.update*.002);
  const metrics=captureBatchMetrics(avgReward);
  log(`Update ${sim.update}: r/exp ${metrics.rewardPerExp.toFixed(3)} · forward/exp ${metrics.forwardPerExp.toFixed(2)}m · off-road ${metrics.offRoadPct.toFixed(0)}% · resets ${metrics.resets} · laps ${metrics.laps} · loss ${sim.lastLoss.toFixed(3)}`);
  drivers.forEach(c=>{c.rollout=[];c.lastObs=null;c.pendingReward=0});
  sim.experience=0;resetBatchTelemetry();maybeRotateTrainingTrack();drivers.forEach(chooseAction);
  sim.learning=false;sim.running=true;$('learningOverlay').classList.remove('show');
}
