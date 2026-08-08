// Shared constants, configurable brain/vision presets, utilities, and mutable simulator state.
const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mod=(n,m)=>((n%m)+m)%m;
const randn=()=>{let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
const uid=prefix=>`${prefix}-${globalThis.crypto?.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

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

const ACTIONS=15,DRIVER_COUNT=4,BATCH_TARGET=512,DECISION_DT=.10,GAMMA=.985,GAE_LAMBDA=.92,PPO_CLIP=.18,STEERS=[-1,-.5,0,.5,1],LONGITUDINAL=[-1,0,1];
const actionTable=[];for(const throttle of LONGITUDINAL)for(const steer of STEERS)actionTable.push({steer,throttle});
const sim={running:false,learning:false,pauseAfterLearning:false,mode:'learn',headless:false,speed:1,update:0,experience:0,totalExperience:0,selected:0,cameraMode:'chase',batchReward:0,collisions:0,lastLoss:0,lastPpoMs:0,ppoTotalMs:0,ppoCount:0,physicsAcc:0,decisionAcc:0,lastTime:performance.now(),temperature:1.35,raceLaps:3,raceTime:0,racePlaces:0,raceFinished:false,raceTrackId:'mixed',trackMode:'mixed',resetMode:'adaptive',adaptiveResetInterval:1,updatesSinceGridReset:0,simClock:0,measureReal:performance.now(),measureSim:0,achievedSpeed:0,history:[],recentHistory:[],recentSampleAcc:0,lastMetrics:null,trainingWallSeconds:0,trainingSimSeconds:0,bestRunDistance:0,batchResets:0,batchLaps:0,batchOffRoadSeconds:0,batchDriverSeconds:0,batchEpisodeDistance:0,batchEpisodes:0,batchForwardMeters:0,batchBestRunDistance:0,batchSteerCounts:Array(STEERS.length).fill(0),batchThrottleCounts:Array(LONGITUDINAL.length).fill(0)};
function resetBatchTelemetry(){sim.batchReward=0;sim.collisions=0;sim.batchResets=0;sim.batchLaps=0;sim.batchOffRoadSeconds=0;sim.batchDriverSeconds=0;sim.batchEpisodeDistance=0;sim.batchEpisodes=0;sim.batchForwardMeters=0;sim.batchBestRunDistance=0;sim.batchSteerCounts.fill(0);sim.batchThrottleCounts.fill(0)}
function resetRecentTelemetry(){sim.recentHistory=[];sim.recentSampleAcc=0}
