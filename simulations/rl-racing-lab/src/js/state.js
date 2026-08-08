// Shared constants, utilities, and mutable simulator state.
const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mod=(n,m)=>((n%m)+m)%m;
const randn=()=>{let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
const OBS_W=32,OBS_H=20,OBS_SCALE=2,RENDER_W=OBS_W*OBS_SCALE,RENDER_H=OBS_H*OBS_SCALE,PIXELS=OBS_W*OBS_H,INPUTS=PIXELS+2,HIDDEN=48,ACTIONS=15,DRIVER_COUNT=4,BATCH_TARGET=512;
const DECISION_DT=.10,GAMMA=.985,GAE_LAMBDA=.92,PPO_CLIP=.18,STEERS=[-1,-.5,0,.5,1],LONGITUDINAL=[-1,0,1];
const actionTable=[];for(const throttle of LONGITUDINAL)for(const steer of STEERS)actionTable.push({steer,throttle});
const sim={running:false,learning:false,mode:'learn',headless:false,speed:1,update:0,experience:0,totalExperience:0,selected:0,cameraMode:'chase',batchReward:0,collisions:0,lastLoss:0,physicsAcc:0,decisionAcc:0,lastTime:performance.now(),temperature:1.35,raceLaps:3,raceTime:0,racePlaces:0,raceFinished:false,raceTrackId:'mixed',trackMode:'mixed',resetMode:'adaptive',adaptiveResetInterval:1,updatesSinceGridReset:0,simClock:0,measureReal:performance.now(),measureSim:0,achievedSpeed:0,history:[],recentHistory:[],recentSampleAcc:0,lastMetrics:null,trainingWallSeconds:0,trainingSimSeconds:0,bestRunDistance:0,batchResets:0,batchLaps:0,batchOffRoadSeconds:0,batchDriverSeconds:0,batchEpisodeDistance:0,batchEpisodes:0,batchForwardMeters:0,batchBestRunDistance:0,batchSteerCounts:Array(STEERS.length).fill(0),batchThrottleCounts:Array(LONGITUDINAL.length).fill(0)};
function resetBatchTelemetry(){
  sim.batchReward=0;sim.collisions=0;sim.batchResets=0;sim.batchLaps=0;
  sim.batchOffRoadSeconds=0;sim.batchDriverSeconds=0;sim.batchEpisodeDistance=0;sim.batchEpisodes=0;sim.batchForwardMeters=0;sim.batchBestRunDistance=0;
  sim.batchSteerCounts.fill(0);sim.batchThrottleCounts.fill(0);
}
function resetRecentTelemetry(){sim.recentHistory=[];sim.recentSampleAcc=0}
