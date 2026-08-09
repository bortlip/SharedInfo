// Human-facing live network inspection: image input, hidden activations, policy outputs, and input sensitivity.
let lastBrainVizAt=0;
function actionLabel(index){const a=actionTable[index],steer=a.steer<=-.75?'hard L':a.steer<-.1?'left':a.steer>=.75?'hard R':a.steer>.1?'right':'straight',drive=a.throttle>0?'throttle':a.throttle<0?'brake':'coast';return`${steer} + ${drive}`}
function policyEntropy(probs){let h=0;for(const p of probs||[])if(p>1e-9)h-=p*Math.log(p);return h}
function refreshBrainSetupSummary(){
  const vision=$('visionSelect')?.value||brainConfig.visionId,network=$('networkSelect')?.value||brainConfig.networkId,c=normalizedBrainConfig({visionId:vision,networkId:network}),sizes=brainLayerSizes(c),params=parameterCountForConfig(c),tensor=modelTensorBytesForConfig(c),macs=forwardMacCountForConfig(c),weight=params>700000?'very heavy':params>250000?'heavy':params>90000?'medium':'light';
  if($('brainSetupSummary')){const seed=normalizeExperimentSeed($('seedInput')?.value??DEFAULT_EXPERIMENT_SEED);$('brainSetupSummary').innerHTML=`<strong>${sizes.join(' → ')}</strong><span>${params.toLocaleString()} params · ${formatBytes(tensor)} tensors · ${compactNumber(macs)} MAC/decision · seed ${seed} · ${weight} browser workload</span>`}
}
function drawInspectorInput(canvas,rgba){if(!canvas||!rgba)return;drawPreview(canvas,rgba)}
function drawSaliency(canvas,car){
  if(!canvas||!car?.lastObs)return;canvas.width=OBS_W;canvas.height=OBS_H;const ctx=canvas.getContext('2d'),grad=inputGradientForAction(car.lastObs,car.lastAction),scores=new Float32Array(PIXELS);let max=1e-9;
  for(let p=0;p<PIXELS;p++){let s=0;if(CHANNELS===1)s=Math.abs(grad[p]);else{const b=p*3;s=(Math.abs(grad[b])+Math.abs(grad[b+1])+Math.abs(grad[b+2]))/3}scores[p]=s;if(s>max)max=s}
  const image=ctx.createImageData(OBS_W,OBS_H),src=car.latestRGBA;for(let p=0;p<PIXELS;p++){const dst=p*4,v=Math.sqrt(scores[p]/max),base=src?(src[dst]+src[dst+1]+src[dst+2])/3:0;image.data[dst]=Math.min(255,base*.28+255*v);image.data[dst+1]=Math.min(255,base*.20+175*v*v);image.data[dst+2]=Math.min(255,base*.18+35*v*v);image.data[dst+3]=255}ctx.putImageData(image,0,0);
}
function sampledNodeIndices(length,maxCount,include=[]){
  const picked=[...new Set(include.filter(i=>i>=0&&i<length))];
  const slots=Math.max(0,maxCount-picked.length);
  for(let k=0;k<slots;k++){
    const index=slots===1?0:Math.round(k*(length-1)/(slots-1));
    if(!picked.includes(index))picked.push(index);
  }
  for(let i=0;picked.length<Math.min(maxCount,length)&&i<length;i++)if(!picked.includes(i))picked.push(i);
  return picked.sort((a,b)=>a-b).slice(0,maxCount);
}
function drawNetworkActivity(canvas,car){
  if(!canvas)return;
  const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#08131d';ctx.fillRect(0,0,w,h);
  const out=car?.lastForward,obs=car?.lastObs;
  if(!out||!obs){ctx.fillStyle='#718493';ctx.font='12px system-ui';ctx.fillText('Network activity appears after the first policy decision.',16,h/2);return}

  const inputIndices=sampledNodeIndices(INPUTS,14,[VISUAL_INPUTS,VISUAL_INPUTS+1]);
  const layers=[{label:`${INPUTS} inputs`,indices:inputIndices,values:obs,type:'input'}];
  out.hidden.forEach((values,i)=>layers.push({label:`${values.length} tanh`,indices:sampledNodeIndices(values.length,18),values,type:'hidden',layerIndex:i}));
  layers.push({label:'15 policy + V',indices:Array.from({length:ACTIONS+1},(_,i)=>i),values:null,type:'output'});

  const left=44,right=w-44,top=38,bottom=h-52,xStep=(right-left)/Math.max(1,layers.length-1);
  const xs=layers.map((_,i)=>left+i*xStep),ys=layers.map(layer=>layer.indices.map((_,i)=>layer.indices.length===1?(top+bottom)/2:top+i*(bottom-top)/(layer.indices.length-1)));
  const sourceActivation=(layer,index)=>Number(layer.values?.[index])||0;
  const edgeWeight=(transition,sourceIndex,targetIndex)=>{
    if(transition<net.layers.length){const layer=net.layers[transition];return layer.w[targetIndex*layer.inputSize+sourceIndex]||0}
    const last=net.layers.at(-1).outputSize;
    return targetIndex<ACTIONS?(net.policy.w[targetIndex*last+sourceIndex]||0):(net.value.w[sourceIndex]||0);
  };

  for(let transition=0;transition<layers.length-1;transition++){
    const source=layers[transition],target=layers[transition+1],edges=[];let maxWeight=1e-9,maxContribution=1e-9;
    source.indices.forEach((sourceIndex,si)=>target.indices.forEach((targetIndex,ti)=>{
      const weight=edgeWeight(transition,sourceIndex,targetIndex),activation=sourceActivation(source,sourceIndex),contribution=weight*activation,edge={si,ti,weight,contribution};
      maxWeight=Math.max(maxWeight,Math.abs(weight));maxContribution=Math.max(maxContribution,Math.abs(contribution));edges.push(edge);
    }));
    for(const edge of edges){
      const weightStrength=Math.sqrt(Math.abs(edge.weight)/maxWeight),liveStrength=Math.sqrt(Math.abs(edge.contribution)/maxContribution),alpha=.035+.62*liveStrength;
      ctx.strokeStyle=edge.contribution>=0?`rgba(85,219,234,${alpha})`:`rgba(255,125,136,${alpha})`;ctx.lineWidth=.25+2.1*weightStrength;
      ctx.beginPath();ctx.moveTo(xs[transition]+6,ys[transition][edge.si]);ctx.lineTo(xs[transition+1]-6,ys[transition+1][edge.ti]);ctx.stroke();
    }
  }

  ctx.textAlign='center';ctx.font='10px system-ui';
  layers.forEach((layer,li)=>{
    ctx.fillStyle='#9fb0bf';ctx.fillText(layer.label,xs[li],18);
    layer.indices.forEach((index,ni)=>{
      const x=xs[li],y=ys[li][ni];
      if(layer.type==='output'){
        if(index<ACTIONS){const p=out.probs[index],maxP=Math.max(...out.probs),strength=p/Math.max(1e-9,maxP);ctx.fillStyle=index===car.lastAction?'#ffd166':`rgba(200,165,255,${.25+.75*strength})`;ctx.beginPath();ctx.arc(x,y,3.2+3.6*strength,0,Math.PI*2);ctx.fill()}
        else{const v=Math.tanh(out.value/5),strength=Math.abs(v);ctx.fillStyle=v>=0?`rgba(131,239,182,${.3+.7*strength})`:`rgba(255,125,136,${.3+.7*strength})`;ctx.beginPath();ctx.arc(x,y,3.2+3.6*strength,0,Math.PI*2);ctx.fill();ctx.fillStyle='#9fb0bf';ctx.font='8px system-ui';ctx.fillText('V',x+12,y+3);ctx.font='10px system-ui'}
        return;
      }
      const value=sourceActivation(layer,index),strength=Math.min(1,Math.abs(value)),radius=3+4*strength;ctx.fillStyle=value>=0?`rgba(85,219,234,${.22+.78*strength})`:`rgba(255,125,136,${.22+.78*strength})`;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
      if(layer.type==='input'&&(index===VISUAL_INPUTS||index===VISUAL_INPUTS+1)){ctx.fillStyle='#c8d2da';ctx.font='8px system-ui';ctx.textAlign='right';ctx.fillText(index===VISUAL_INPUTS?'speed':'damage',x-9,y+3);ctx.textAlign='center';ctx.font='10px system-ui'}
    });
  });
  ctx.textAlign='left';ctx.font='9px system-ui';ctx.fillStyle='#718493';ctx.fillText('Sampled real connections · line width = |weight| · opacity = live |weight × activation| · cyan/red = signed contribution',12,h-15);
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
