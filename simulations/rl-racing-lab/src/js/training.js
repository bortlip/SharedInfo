// PPO-style batch construction, backpropagation, and policy updates.
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
function trainSample(e,lr){
  const {h,probs,value}=forward(e.obs),newLog=Math.log(Math.max(1e-7,probs[e.action])),ratio=Math.exp(clamp(newLog-e.logp,-10,10));
  const clipped=(e.adv>=0&&ratio>1+PPO_CLIP)||(e.adv<0&&ratio<1-PPO_CLIP),dLogP=clipped?0:-e.adv*ratio,dLogits=new Float32Array(ACTIONS);
  for(let a=0;a<ACTIONS;a++)dLogits[a]=clamp(dLogP*((a===e.action?1:0)-probs[a]),-3,3);
  const dValue=clamp(.35*(value-e.ret),-3,3),dh=new Float32Array(HIDDEN);
  for(let j=0;j<HIDDEN;j++){let g=net.wv[j]*dValue;for(let a=0;a<ACTIONS;a++)g+=net.wp[a*HIDDEN+j]*dLogits[a];dh[j]=clamp(g*(1-h[j]*h[j]),-3,3)}
  for(let a=0;a<ACTIONS;a++){const base=a*HIDDEN,g=dLogits[a];for(let j=0;j<HIDDEN;j++)net.wp[base+j]-=lr*g*h[j];net.bp[a]-=lr*g}
  for(let j=0;j<HIDDEN;j++)net.wv[j]-=lr*dValue*h[j];net.bv-=lr*dValue;
  for(let j=0;j<HIDDEN;j++){const base=j*INPUTS,g=dh[j];for(let i=0;i<INPUTS;i++)net.w1[base+i]-=lr*g*e.obs[i];net.b1[j]-=lr*g}
  const policyLoss=-Math.min(ratio*e.adv,clamp(ratio,1-PPO_CLIP,1+PPO_CLIP)*e.adv),valueLoss=.5*(value-e.ret)*(value-e.ret);
  return policyLoss+.35*valueLoss;
}
async function performLearningUpdate(){
  sim.learning=true;sim.running=false;$('learningOverlay').classList.add('show');$('phaseText').textContent='BACKPROP';$('learningText').textContent=`Training on ${sim.experience} experiences…`;updateUI();
  await new Promise(r=>setTimeout(r,90));
  const batch=buildTrainingBatch();let loss=0,count=0;
  for(let epoch=0;epoch<3;epoch++){
    shuffle(batch);
    for(const e of batch){loss+=trainSample(e,.00055);count++}
    $('learningText').textContent=`Backprop pass ${epoch+1}/3 · ${batch.length} samples`;await new Promise(r=>setTimeout(r,0));
  }
  sim.lastLoss=loss/Math.max(1,count);sim.update++;sim.temperature=Math.max(.72,1.35-sim.update*.005);
  const avgReward=sim.batchReward/Math.max(1,sim.experience);
  log(`Update ${sim.update}: ${batch.length} exp · reward/step ${avgReward.toFixed(3)} · loss ${sim.lastLoss.toFixed(3)} · temp ${sim.temperature.toFixed(2)}`);
  drivers.forEach(c=>{c.rollout=[];c.lastObs=null;c.pendingReward=0});
  sim.experience=0;sim.batchReward=0;sim.collisions=0;maybeRotateTrainingTrack();drivers.forEach(chooseAction);
  sim.learning=false;sim.running=true;$('learningOverlay').classList.remove('show');
}


