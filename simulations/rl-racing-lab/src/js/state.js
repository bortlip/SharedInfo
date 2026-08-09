// Shared constants, configurable brain/vision presets, utilities, and mutable simulator state.
const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mod=(n,m)=>((n%m)+m)%m;
const DEFAULT_EXPERIMENT_SEED=1597463007;
function normalizeExperimentSeed(value,fallback=DEFAULT_EXPERIMENT_SEED){const n=Number(value);return Number.isFinite(n)?Math.trunc(n)>>>0:Math.trunc(fallback)>>>0}
function randomExperimentSeed(){const values=new Uint32Array(1);if(globalThis.crypto?.getRandomValues){globalThis.crypto.getRandomValues(values);return values[0]>>>0}return((Date.now()>>>0)^((Math.random()*0xffffffff)>>>0))>>>0}
function mixExperimentSeed(seed,salt){let x=(normalizeExperimentSeed(seed)^salt)>>>0;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);return(x^(x>>>15))>>>0}
function makeExperimentRngState(seed){seed=normalizeExperimentSeed(seed);return{init:mixExperimentSeed(seed,0x13579bdf),policy:mixExperimentSeed(seed,0x2468ace0),shuffle:mixExperimentSeed(seed,0x9e3779b9)}}
function normalizeExperimentRngState(state,seed){const fresh=makeExperimentRngState(seed);if(!state||typeof state!=='object')return fresh;for(const key of Object.keys(fresh)){const n=Number(state[key]);if(Number.isFinite(n))fresh[key]=Math.trunc(n)>>>0}return fresh}
function resetExperimentRng(seed,state=null){sim.experimentSeed=normalizeExperimentSeed(seed);sim.rngState=state?normalizeExperimentRngState(state,sim.experimentSeed):makeExperimentRngState(sim.experimentSeed);return sim.experimentSeed}
function experimentRandom(stream='policy'){let a=((sim.rngState?.[stream]??makeExperimentRngState(sim.experimentSeed)[stream])+0x6d2b79f5)>>>0;sim.rngState[stream]=a;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}
const randn=()=>{let u=0,v=0;while(!u)u=experimentRandom('init');while(!v)v=experimentRandom('init');return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
const uid=prefix=>`${prefix}-${globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
const escapeHtml=value=>String(value??'').replace(/[&<>\"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]));
function formatDuration(seconds){seconds=Math.max(0,Math.floor(seconds||0));const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;return h?`${h}h ${String(m).padStart(2,'0')}m`:m?`${m}m ${String(s).padStart(2,'0')}s`:`${s}s`}
function compactNumber(n){return n>=1e6?`${(n/1e6).toFixed(n>=1e7?1:2)}M`:n>=1e3?`${(n/1e3).toFixed(n>=1e5?0:1)}k`:String(Math.round(n))}
function formatBytes(bytes){bytes=Math.max(0,Number(bytes)||0);if(bytes>=1024**3)return`${(bytes/1024**3).toFixed(2)} GiB`;if(bytes>=1024**2)return`${(bytes/1024**2).toFixed(2)} MiB`;if(bytes>=1024)return`${(bytes/1024).toFixed(bytes>=1024*100?0:1)} KiB`;return`${Math.round(bytes)} B`}
function formatMs(ms){ms=Number(ms)||0;if(ms<=0)return'—';return ms>=1000?`${(ms/1000).toFixed(ms>=10000?1:2)} s`:`${ms.toFixed(ms>=100?0:1)} ms`}

const VISION_PRESETS={
  gray32:{id:'gray32',label:'32×20 grayscale',w:32,h:20,channels:1,renderScale:2,color:false},
  gray64:{id:'gray64',label:'64×40 grayscale',w:64,h:40,channels:1,renderScale:2,color:false},
  rgb32:{id:'rgb32',label:'32×20 RGB color',w:32,h:20,channels:3,renderScale:2,color:true},
  rgb64:{id:'rgb64',label:'64×40 RGB color',w:64,h:40,channels:3,renderScale:2,color:true}
};
const NETWORK_PRESETS={
  baseline:{id:'baseline',label:'Baseline · 48',hidden:[48]},
  wide:{id:'wide',label:'Wide · 128',hidden:[128]},
  deep:{id:'deep',label:'Deep · 96 → 48',hidden:[96,48]},
  deepwide:{id:'deepwide',label:'Deep + wide · 128 → 64',hidden:[128,64]}
};
let brainConfig={visionId:'gray32',networkId:'baseline'};
let OBS_W=32,OBS_H=20,OBS_SCALE=2,CHANNELS=1,RENDER_W=64,RENDER_H=40,PIXELS=640,VISUAL_INPUTS=640,INPUTS=642,HIDDEN_LAYERS=[48];
function normalizedBrainConfig(config={}){return{visionId:config.visionId in VISION_PRESETS?config.visionId:'gray32',networkId:config.networkId in NETWORK_PRESETS?config.networkId:'baseline'}}
function applyBrainConfiguration(config){
  brainConfig=normalizedBrainConfig(config);const v=VISION_PRESETS[brainConfig.visionId],n=NETWORK_PRESETS[brainConfig.networkId];
  OBS_W=v.w;OBS_H=v.h;OBS_SCALE=v.renderScale;CHANNELS=v.channels;RENDER_W=OBS_W*OBS_SCALE;RENDER_H=OBS_H*OBS_SCALE;PIXELS=OBS_W*OBS_H;VISUAL_INPUTS=PIXELS*CHANNELS;INPUTS=VISUAL_INPUTS+2;HIDDEN_LAYERS=[...n.hidden];return brainConfig;
}
function brainConfigSnapshot(){return{visionId:brainConfig.visionId,networkId:brainConfig.networkId}}
function brainConfigLabel(config=brainConfig){const c=normalizedBrainConfig(config);return`${VISION_PRESETS[c.visionId].label} · ${NETWORK_PRESETS[c.networkId].label}`}
function brainLayerSizes(config=brainConfig){const c=normalizedBrainConfig(config),v=VISION_PRESETS[c.visionId],n=NETWORK_PRESETS[c.networkId],inputs=v.w*v.h*v.channels+2;return[inputs,...n.hidden,15]}
function parameterCountForConfig(config=brainConfig){const sizes=brainLayerSizes(config);let total=0;for(let i=0;i<sizes.length-2;i++)total+=sizes[i]*sizes[i+1]+sizes[i+1];const last=sizes[sizes.length-2];return total+last*15+15+last+1}
function forwardMacCountForConfig(config=brainConfig){const sizes=brainLayerSizes(config),hidden=sizes.slice(1,-1);let previous=sizes[0],total=0;for(const size of hidden){total+=previous*size;previous=size}return total+previous*ACTIONS+previous}
function modelTensorBytesForConfig(config=brainConfig){return parameterCountForConfig(config)*4}
applyBrainConfiguration(brainConfig);

const ACTIONS=15,DRIVER_COUNT=4,DECISION_DT=.10,GAMMA=.985,GAE_LAMBDA=.92,STEERS=[-1,-.5,0,.5,1],LONGITUDINAL=[-1,0,1];
const PPO_BATCH_OPTIONS=[256,512,1024],PPO_EPOCH_OPTIONS=[1,3,5],PPO_LR_OPTIONS=[.00025,.00055,.001],PPO_CLIP_OPTIONS=[.10,.18,.25];
const PPO_DEFAULTS={batchTarget:512,epochs:3,learningRate:.00055,clip:.18};
const actionTable=[];for(const throttle of LONGITUDINAL)for(const steer of STEERS)actionTable.push({steer,throttle});
const sim={running:false,learning:false,pauseAfterLearning:false,mode:'learn',headless:false,speed:1,update:0,experience:0,totalExperience:0,selected:0,cameraMode:'chase',batchReward:0,collisions:0,lastLoss:0,lastPpoMs:0,ppoTotalMs:0,ppoCount:0,ppoBatchTarget:PPO_DEFAULTS.batchTarget,ppoEpochs:PPO_DEFAULTS.epochs,ppoLearningRate:PPO_DEFAULTS.learningRate,ppoClip:PPO_DEFAULTS.clip,experimentSeed:DEFAULT_EXPERIMENT_SEED,rngState:makeExperimentRngState(DEFAULT_EXPERIMENT_SEED),physicsAcc:0,decisionAcc:0,lastTime:performance.now(),temperature:1.35,raceLaps:3,raceTime:0,racePlaces:0,raceFinished:false,raceTrackId:'mixed',trackMode:'mixed',resetMode:'adaptive',adaptiveResetInterval:1,updatesSinceGridReset:0,simClock:0,measureReal:performance.now(),measureSim:0,achievedSpeed:0,history:[],recentHistory:[],recentSampleAcc:0,lastMetrics:null,trainingWallSeconds:0,trainingSimSeconds:0,bestRunDistance:0,batchResets:0,batchLaps:0,batchOffRoadSeconds:0,batchDriverSeconds:0,batchEpisodeDistance:0,batchEpisodes:0,batchForwardMeters:0,batchBestRunDistance:0,batchSteerCounts:Array(STEERS.length).fill(0),batchThrottleCounts:Array(LONGITUDINAL.length).fill(0)};
function ppoOption(value,options,fallback){const n=Number(value);return options.includes(n)?n:fallback}
function normalizedPpoSettings(settings={}){return{batchTarget:ppoOption(settings.batchTarget,PPO_BATCH_OPTIONS,PPO_DEFAULTS.batchTarget),epochs:ppoOption(settings.epochs,PPO_EPOCH_OPTIONS,PPO_DEFAULTS.epochs),learningRate:ppoOption(settings.learningRate,PPO_LR_OPTIONS,PPO_DEFAULTS.learningRate),clip:ppoOption(settings.clip,PPO_CLIP_OPTIONS,PPO_DEFAULTS.clip)}}
function applyPpoSettings(settings={}){const p=normalizedPpoSettings(settings);sim.ppoBatchTarget=p.batchTarget;sim.ppoEpochs=p.epochs;sim.ppoLearningRate=p.learningRate;sim.ppoClip=p.clip;return p}
function ppoSettingsSnapshot(){return{batchTarget:sim.ppoBatchTarget,epochs:sim.ppoEpochs,learningRate:sim.ppoLearningRate,clip:sim.ppoClip}}
function resetBatchTelemetry(){sim.batchReward=0;sim.collisions=0;sim.batchResets=0;sim.batchLaps=0;sim.batchOffRoadSeconds=0;sim.batchDriverSeconds=0;sim.batchEpisodeDistance=0;sim.batchEpisodes=0;sim.batchForwardMeters=0;sim.batchBestRunDistance=0;sim.batchSteerCounts.fill(0);sim.batchThrottleCounts.fill(0)}
function resetRecentTelemetry(){sim.recentHistory=[];sim.recentSampleAcc=0}
