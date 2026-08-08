// Human-facing live network inspection: image input, hidden activations, policy outputs, and input sensitivity.
let lastBrainVizAt=0;
function actionLabel(index){const a=actionTable[index],steer=a.steer<=-.75?'hard L':a.steer<-.1?'left':a.steer>=.75?'hard R':a.steer>.1?'right':'straight',drive=a.throttle>0?'throttle':a.throttle<0?'brake':'coast';return`${steer} + ${drive}`}
function policyEntropy(probs){let h=0;for(const p of probs||[])if(p>1e-9)h-=p*Math.log(p);return h}
function refreshBrainSetupSummary(){
  const vision=$('visionSelect')?.value||brainConfig.visionId,network=$('networkSelect')?.value||brainConfig.networkId,c=normalizedBrainConfig({visionId:vision,networkId:network}),sizes=brainLayerSizes(c),params=parameterCountForConfig(c),tensor=modelTensorBytesForConfig(c),macs=forwardMacCountForConfig(c),weight=params>700000?'very heavy':params>250000?'heavy':params>90000?'medium':'light';
  if($('brainSetupSummary'))$('brainSetupSummary').innerHTML=`<strong>${sizes.join(' → ')}</strong><span>${params.toLocaleString()} params · ${formatBytes(tensor)} tensors · ${compactNumber(macs)} MAC/decision · ${weight} browser workload</span>`;
}
function drawInspectorInput(canvas,rgba){if(!canvas||!rgba)return;drawPreview(canvas,rgba)}
function drawSaliency(canvas,car){
  if(!canvas||!car?.lastObs)return;canvas.width=OBS_W;canvas.height=OBS_H;const ctx=canvas.getContext('2d'),grad=inputGradientForAction(car.lastObs,car.lastAction),scores=new Float32Array(PIXELS);let max=1e-9;
  for(let p=0;p<PIXELS;p++){let s=0;if(CHANNELS===1)s=Math.abs(grad[p]);else{const b=p*3;s=(Math.abs(grad[b])+Math.abs(grad[b+1])+Math.abs(grad[b+2]))/3}scores[p]=s;if(s>max)max=s}
  const image=ctx.createImageData(OBS_W,OBS_H),src=car.latestRGBA;for(let p=0;p<PIXELS;p++){const dst=p*4,v=Math.sqrt(scores[p]/max),base=src?(src[dst]+src[dst+1]+src[dst+2])/3:0;image.data[dst]=Math.min(255,base*.28+255*v);image.data[dst+1]=Math.min(255,base*.20+175*v*v);image.data[dst+2]=Math.min(255,base*.18+35*v*v);image.data[dst+3]=255}ctx.putImageData(image,0,0);
}
function drawNetworkActivity(canvas,car){
  if(!canvas)return;const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#08131d';ctx.fillRect(0,0,w,h);const out=car?.lastForward;if(!out){ctx.fillStyle='#718493';ctx.font='12px system-ui';ctx.fillText('Network activity appears after the first policy decision.',16,h/2);return}
  const layerCount=out.hidden.length+2,xStep=(w-80)/Math.max(1,layerCount-1),xs=Array.from({length:layerCount},(_,i)=>40+i*xStep);ctx.strokeStyle='rgba(255,255,255,.10)';ctx.lineWidth=1;for(let i=0;i<layerCount-1;i++){ctx.beginPath();ctx.moveTo(xs[i]+14,h/2);ctx.lineTo(xs[i+1]-14,h/2);ctx.stroke()}
  ctx.fillStyle='#9fb0bf';ctx.font='10px system-ui';ctx.textAlign='center';ctx.fillText(`${INPUTS} inputs`,xs[0],18);ctx.fillStyle='#55dbea';ctx.fillRect(xs[0]-13,h/2-38,26,76);
  out.hidden.forEach((layer,li)=>{const x=xs[li+1],shown=Math.min(24,layer.length),gap=(h-50)/Math.max(1,shown-1);ctx.fillStyle='#9fb0bf';ctx.fillText(`${layer.length} tanh`,x,18);for(let k=0;k<shown;k++){const index=shown===1?0:Math.round(k*(layer.length-1)/(shown-1)),v=layer[index],y=30+k*gap,r=3.2+Math.abs(v)*3.7;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=v>=0?`rgba(85,219,234,${.2+.8*Math.abs(v)})`:`rgba(255,125,136,${.2+.8*Math.abs(v)})`;ctx.fill()}});
  const x=xs.at(-1);ctx.fillStyle='#9fb0bf';ctx.fillText('policy + value',x,18);const max=Math.max(...out.probs);for(let a=0;a<ACTIONS;a++){const y=32+a*(h-52)/(ACTIONS-1),p=out.probs[a];ctx.fillStyle=a===car.lastAction?'#ffd166':p===max?'#83efb6':'rgba(200,165,255,.72)';ctx.fillRect(x-10,y-2,20*Math.max(.08,p/max),4)}ctx.textAlign='left';
}
function renderActionProbabilities(car){const wrap=$('actionProbabilities');if(!wrap)return;const probs=car?.lastForward?.probs;if(!probs){wrap.textContent='Action probabilities appear after the first policy decision.';return}wrap.innerHTML=Array.from(probs,(p,a)=>`<div class="prob-row${a===car.lastAction?' chosen':''}"><span>${actionLabel(a)}</span><div><i style="width:${Math.max(1,p*100)}%"></i></div><b>${(p*100).toFixed(1)}%</b></div>`).join('')}
function updateBrainInspector(force=false){
  if((typeof headlessActive==='function'&&headlessActive())||!$('brainActivityCanvas'))return;
  const now=performance.now();if(!force&&now-lastBrainVizAt<700)return;lastBrainVizAt=now;
  const car=drivers[sim.selected],out=car.lastForward;
  if($('brainInspectorTitle'))$('brainInspectorTitle').textContent=`${activeBrain()?.name||'Active brain'} · Driver ${sim.selected+1}`;
  if($('brainInspectorConfig'))$('brainInspectorConfig').textContent=`${brainConfigLabel()} · ${networkParameterCount().toLocaleString()} params`;
  if($('brainChosen'))$('brainChosen').textContent=out?actionLabel(car.lastAction):'—';
  if($('brainValue'))$('brainValue').textContent=out?out.value.toFixed(2):'—';
  if($('brainEntropy'))$('brainEntropy').textContent=out?policyEntropy(out.probs).toFixed(2):'—';
  if($('brainTemp'))$('brainTemp').textContent=sim.temperature.toFixed(2);
  drawInspectorInput($('brainInputCanvas'),car.latestRGBA);drawSaliency($('saliencyCanvas'),car);drawNetworkActivity($('brainActivityCanvas'),car);renderActionProbabilities(car);
}
