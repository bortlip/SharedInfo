// Configurable dense actor-critic network with one or more tanh hidden layers.
function createDenseLayer(inputSize,outputSize){const scale=Math.sqrt(1/Math.max(1,inputSize));return{inputSize,outputSize,w:Float32Array.from({length:inputSize*outputSize},()=>randn()*scale),b:new Float32Array(outputSize)}}
function createNetwork(){
  const sizes=[INPUTS,...HIDDEN_LAYERS],layers=[];for(let i=0;i<sizes.length-1;i++)layers.push(createDenseLayer(sizes[i],sizes[i+1]));const last=sizes.at(-1),scale=Math.sqrt(1/Math.max(1,last));
  return{kind:'mlp',config:brainConfigSnapshot(),layers,policy:{w:Float32Array.from({length:ACTIONS*last},()=>randn()*scale),b:new Float32Array(ACTIONS)},value:{w:Float32Array.from({length:last},()=>randn()*scale),b:0}};
}
let net=createNetwork();
function networkParameterCount(network=net){let n=0;for(const l of network.layers)n+=l.w.length+l.b.length;return n+network.policy.w.length+network.policy.b.length+network.value.w.length+1}
function forwardWithNetwork(obs,network=net,temperature=sim.temperature){
  let current=obs;const hidden=[];
  for(const layer of network.layers){const out=new Float32Array(layer.outputSize);for(let j=0;j<layer.outputSize;j++){let s=layer.b[j],base=j*layer.inputSize;for(let i=0;i<layer.inputSize;i++)s+=layer.w[base+i]*current[i];out[j]=Math.tanh(s)}hidden.push(out);current=out}
  const last=current,logits=new Float32Array(ACTIONS);let mx=-Infinity;for(let a=0;a<ACTIONS;a++){let s=network.policy.b[a],base=a*last.length;for(let j=0;j<last.length;j++)s+=network.policy.w[base+j]*last[j];logits[a]=s/temperature;if(logits[a]>mx)mx=logits[a]}
  const probs=new Float32Array(ACTIONS);let sum=0;for(let a=0;a<ACTIONS;a++){probs[a]=Math.exp(logits[a]-mx);sum+=probs[a]}for(let a=0;a<ACTIONS;a++)probs[a]/=sum;
  let value=network.value.b;for(let j=0;j<last.length;j++)value+=network.value.w[j]*last[j];return{hidden,probs,value,logits};
}
function forward(obs,temperature=sim.temperature){return forwardWithNetwork(obs,net,temperature)}
function argmax(probs){let best=0;for(let i=1;i<probs.length;i++)if(probs[i]>probs[best])best=i;return best}
function sampleAction(probs){let r=experimentRandom('policy'),s=0;for(let a=0;a<probs.length;a++){s+=probs[a];if(r<=s)return a}return probs.length-1}
function networkSnapshot(network=net){return{kind:'mlp',config:{...network.config},layers:network.layers.map(l=>({inputSize:l.inputSize,outputSize:l.outputSize,w:new Float32Array(l.w),b:new Float32Array(l.b)})),policy:{w:new Float32Array(network.policy.w),b:new Float32Array(network.policy.b)},value:{w:new Float32Array(network.value.w),b:Number(network.value.b)||0}}}
function networkFromSnapshot(snapshot){
  if(snapshot?.kind!=='mlp'||!Array.isArray(snapshot.layers)||!snapshot.layers.length)throw new Error('Unsupported or incomplete brain network.');const config=normalizedBrainConfig(snapshot.config),expected=brainLayerSizes(config),expectedHidden=expected.slice(1,-1),restored={kind:'mlp',config,layers:[],policy:null,value:null};
  if(snapshot.layers.length!==expectedHidden.length)throw new Error('Brain hidden-layer count does not match its architecture preset.');
  for(let l=0;l<snapshot.layers.length;l++){const source=snapshot.layers[l],inputSize=Number(source.inputSize),outputSize=Number(source.outputSize),expectedInput=l===0?expected[0]:expectedHidden[l-1],expectedOutput=expectedHidden[l],w=Float32Array.from(source.w||[]),b=Float32Array.from(source.b||[]);if(inputSize!==expectedInput||outputSize!==expectedOutput||w.length!==inputSize*outputSize||b.length!==outputSize)throw new Error('Brain hidden-layer arrays do not match the declared vision/network preset.');restored.layers.push({inputSize,outputSize,w,b})}
  const last=restored.layers.at(-1).outputSize,pw=Float32Array.from(snapshot.policy?.w||[]),pb=Float32Array.from(snapshot.policy?.b||[]),vw=Float32Array.from(snapshot.value?.w||[]);if(pw.length!==ACTIONS*last||pb.length!==ACTIONS||vw.length!==last)throw new Error('Brain output arrays do not match the network shape.');restored.policy={w:pw,b:pb};restored.value={w:vw,b:Number(snapshot.value?.b)||0};return restored;
}
function inputGradientForAction(obs,action,network=net){
  const out=forwardWithNetwork(obs,network,1),last=out.hidden.at(-1);let grad=new Float32Array(last.length),base=action*last.length;for(let j=0;j<last.length;j++)grad[j]=network.policy.w[base+j];
  for(let l=network.layers.length-1;l>=0;l--){const act=out.hidden[l],layer=network.layers[l],dz=new Float32Array(layer.outputSize);for(let j=0;j<dz.length;j++)dz[j]=grad[j]*(1-act[j]*act[j]);const prev=new Float32Array(layer.inputSize);for(let j=0;j<layer.outputSize;j++){const g=dz[j],row=j*layer.inputSize;for(let i=0;i<layer.inputSize;i++)prev[i]+=layer.w[row+i]*g}grad=prev}
  return grad;
}
