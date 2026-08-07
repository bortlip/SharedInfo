// Shared actor-critic neural network with independent steering and throttle policy heads.
function createNetwork(){
  const s1=Math.sqrt(1/INPUTS),s2=Math.sqrt(1/HIDDEN);
  return{
    w1:Float32Array.from({length:HIDDEN*INPUTS},()=>randn()*s1),b1:new Float32Array(HIDDEN),
    ws:Float32Array.from({length:STEER_ACTIONS*HIDDEN},()=>randn()*s2),bs:new Float32Array(STEER_ACTIONS),
    wt:Float32Array.from({length:THROTTLE_ACTIONS*HIDDEN},()=>randn()*s2),bt:new Float32Array(THROTTLE_ACTIONS),
    wv:Float32Array.from({length:HIDDEN},()=>randn()*s2),bv:0
  };
}
let net=createNetwork();
function softmaxHead(weights,biases,count,h,temperature){
  const logits=new Float32Array(count);let mx=-Infinity;
  for(let a=0;a<count;a++){let sum=biases[a],o=a*HIDDEN;for(let j=0;j<HIDDEN;j++)sum+=weights[o+j]*h[j];logits[a]=sum/temperature;if(logits[a]>mx)mx=logits[a]}
  const probs=new Float32Array(count);let total=0;
  for(let a=0;a<count;a++){probs[a]=Math.exp(logits[a]-mx);total+=probs[a]}
  for(let a=0;a<count;a++)probs[a]/=total;
  return probs;
}
function forward(obs,temperature=sim.temperature){
  const h=new Float32Array(HIDDEN);
  for(let j=0;j<HIDDEN;j++){let sum=net.b1[j],o=j*INPUTS;for(let i=0;i<INPUTS;i++)sum+=net.w1[o+i]*obs[i];h[j]=Math.tanh(sum)}
  const steerProbs=softmaxHead(net.ws,net.bs,STEER_ACTIONS,h,temperature),throttleProbs=softmaxHead(net.wt,net.bt,THROTTLE_ACTIONS,h,temperature);
  let value=net.bv;for(let j=0;j<HIDDEN;j++)value+=net.wv[j]*h[j];
  return{h,steerProbs,throttleProbs,value};
}
function argmax(probs){let best=0;for(let i=1;i<probs.length;i++)if(probs[i]>probs[best])best=i;return best}
function sampleAction(probs){let r=Math.random(),sum=0;for(let a=0;a<probs.length;a++){sum+=probs[a];if(r<=sum)return a}return probs.length-1}
