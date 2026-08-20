'use strict';

const TOTAL = 100;
const INITIAL_DRIVERS = 40;
const DAY_END = 82;
const BASE_SIM_MINUTES_PER_SECOND = 1.35;
const MILES_PER_PIXEL = 0.005;
const JAM_SPACING_MILES = 0.0050;      // ~26 ft per queued vehicle
const FOLLOW_HEADWAY_MIN = 1.5 / 60;  // 1.5 s moving headway target
const STARTUP_LOST_MIN = 2.0 / 60;    // first queued vehicle reacts to green
const ACCEL_MI_PER_MIN2 = 4.0;
const DECEL_MI_PER_MIN2 = 6.5;
const YELLOW_MIN = 3.5 / 60;
const ALL_RED_MIN = 1.5 / 60;
const SWITCH_LIMIT = 3;
const SWITCH_COOLDOWN = 2;
const SEED = 31791;
const TRAIN_PHASE = 1.0;
const TRANSIT_RIDE = 10.8;
const TRANSIT_EGRESS = 3.0;
const BASE_TRANSIT_HEADWAY = 3.6;
const REFERENCE_RIDERS = 60;

const $ = id => document.getElementById(id);
const canvas = $('worldCanvas');
const ctx = canvas.getContext('2d');
const historyCanvas = $('historyCanvas');
const hctx = historyCanvas.getContext('2d');

const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const mean = values => values.length ? values.reduce((s,v)=>s+v,0)/values.length : NaN;
const pixelDistance = (a,b) => Math.hypot(b.x-a.x,b.y-a.y);
function mulberry32(seed){return function(){let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}

const nodes = {
  W:{x:70,y:450,label:'West suburb'}, NW:{x:70,y:160,label:'Northwest homes'}, SW:{x:70,y:740,label:'Southwest homes'},
  A:{x:300,y:450,signal:true}, AN:{x:300,y:160}, AS:{x:300,y:740},
  B:{x:530,y:450,signal:true}, BN:{x:530,y:160}, BS:{x:530,y:740},
  NT1:{x:645,y:86}, NT2:{x:825,y:55}, NT3:{x:1010,y:90},
  L1:{x:620,y:300}, L2:{x:735,y:190}, L3:{x:850,y:118}, L4:{x:970,y:165}, L5:{x:1060,y:290},
  S1:{x:705,y:740}, S2:{x:875,y:740}, S3:{x:1010,y:740},
  C:{x:1120,y:450,signal:true}, CN:{x:1120,y:160}, CS:{x:1120,y:740},
  D:{x:1350,y:450,signal:true}, DN:{x:1350,y:160}, DS:{x:1350,y:740},
  E:{x:1530,y:450,label:'Downtown'}, NE:{x:1530,y:160,label:'Northeast'}, SE:{x:1530,y:740,label:'Southeast'}
};

const signalOffsets = {A:0,B:.20,C:.58,D:.78};
const uncoordinatedOffsets = {A:0,B:.43,C:.17,D:.69};

const roadSpecs = [
  {id:'west-main',a:'W',b:'A',speed:35,lanes:'arterial',kind:'arterial',axis:'EW'},
  {id:'main-ab',a:'A',b:'B',speed:35,lanes:'arterial',kind:'arterial',axis:'EW'},
  {id:'main-cd',a:'C',b:'D',speed:35,lanes:'arterial',kind:'arterial',axis:'EW'},
  {id:'main-de',a:'D',b:'E',speed:32,lanes:'arterial',kind:'arterial',axis:'EW'},

  {id:'mountain-1',a:'B',b:'L1',speed:35,lanes:1,kind:'highway',scale:1.25,axis:'EW'},
  {id:'mountain-2',a:'L1',b:'L2',speed:35,lanes:1,kind:'highway',scale:1.25,axis:'EW'},
  {id:'mountain-3',a:'L2',b:'L3',speed:35,lanes:1,kind:'highway',scale:1.25,axis:'EW'},
  {id:'mountain-4',a:'L3',b:'L4',speed:35,lanes:1,kind:'highway',scale:1.25,axis:'EW'},
  {id:'mountain-5',a:'L4',b:'L5',speed:35,lanes:1,kind:'highway',scale:1.25,axis:'EW'},
  {id:'mountain-6',a:'L5',b:'C',speed:35,lanes:1,kind:'highway',scale:1.25,axis:'EW'},
  {id:'tunnel',a:'B',b:'C',speed:60,lanes:'tunnel',kind:'tunnel',scale:1.0,axis:'EW'},

  {id:'north-wa',a:'NW',b:'AN',speed:28,lanes:1,kind:'local',axis:'EW'},
  {id:'north-ab',a:'AN',b:'BN',speed:28,lanes:1,kind:'local',axis:'EW'},
  {id:'north-b1',a:'BN',b:'NT1',speed:25,lanes:1,kind:'local',scale:1.15,axis:'EW'},
  {id:'north-12',a:'NT1',b:'NT2',speed:25,lanes:1,kind:'local',scale:1.15,axis:'EW'},
  {id:'north-23',a:'NT2',b:'NT3',speed:25,lanes:1,kind:'local',scale:1.15,axis:'EW'},
  {id:'north-3c',a:'NT3',b:'CN',speed:25,lanes:1,kind:'local',scale:1.15,axis:'EW'},
  {id:'north-cd',a:'CN',b:'DN',speed:28,lanes:1,kind:'local',axis:'EW'},
  {id:'north-de',a:'DN',b:'NE',speed:28,lanes:1,kind:'local',axis:'EW'},

  {id:'south-wa',a:'SW',b:'AS',speed:28,lanes:1,kind:'local',axis:'EW'},
  {id:'south-ab',a:'AS',b:'BS',speed:28,lanes:1,kind:'local',axis:'EW'},
  {id:'south-b1',a:'BS',b:'S1',speed:30,lanes:1,kind:'collector',axis:'EW'},
  {id:'south-12',a:'S1',b:'S2',speed:30,lanes:1,kind:'collector',axis:'EW'},
  {id:'south-23',a:'S2',b:'S3',speed:30,lanes:1,kind:'collector',axis:'EW'},
  {id:'south-3c',a:'S3',b:'CS',speed:30,lanes:1,kind:'collector',axis:'EW'},
  {id:'south-cd',a:'CS',b:'DS',speed:28,lanes:1,kind:'local',axis:'EW'},
  {id:'south-de',a:'DS',b:'SE',speed:28,lanes:1,kind:'local',axis:'EW'},

  {id:'west-n',a:'NW',b:'W',speed:24,lanes:1,kind:'local',axis:'NS'},
  {id:'west-s',a:'W',b:'SW',speed:24,lanes:1,kind:'local',axis:'NS'},
  {id:'a-n',a:'AN',b:'A',speed:25,lanes:1,kind:'local',axis:'NS'},
  {id:'a-s',a:'A',b:'AS',speed:25,lanes:1,kind:'local',axis:'NS'},
  {id:'b-n',a:'BN',b:'B',speed:25,lanes:1,kind:'local',axis:'NS'},
  {id:'b-s',a:'B',b:'BS',speed:25,lanes:1,kind:'local',axis:'NS'},
  {id:'c-n',a:'CN',b:'C',speed:25,lanes:1,kind:'local',axis:'NS'},
  {id:'c-s',a:'C',b:'CS',speed:25,lanes:1,kind:'local',axis:'NS'},
  {id:'d-n',a:'DN',b:'D',speed:25,lanes:1,kind:'local',axis:'NS'},
  {id:'d-s',a:'D',b:'DS',speed:25,lanes:1,kind:'local',axis:'NS'},
  {id:'east-n',a:'NE',b:'E',speed:24,lanes:1,kind:'local',axis:'NS'},
  {id:'east-s',a:'E',b:'SE',speed:24,lanes:1,kind:'local',axis:'NS'}
];

const roadSpecById = Object.fromEntries(roadSpecs.map(r=>[r.id,r]));
let edges = {};
let adjacency = {};

const state = {
  agents:[],day:1,tunnelOpen:false,tunnelBuiltAfter:null,dayRunning:false,paused:false,autoRun:false,speed:8,simTime:0,lastReal:performance.now(),
  vehicles:[],transitTrips:[],trains:[],history:[],lastDay:null,pendingSwitches:[],selectedAgentId:0,currentHeadway:null,maxStopped:0,stableBefore:null,stableAfter:null,
  nextVehicleId:1,animationHandle:null,lastRelease:{},leaderMap:new Map(),
  backgroundTraffic:1.2,signalCycleSec:90,greenSplit:.57,saturationFlow:1900,arterialLanes:1,tunnelLanes:2,tunnelSpeed:60,transitFeedback:1.8,coordinatedSignals:true
};

function lanesForSpec(spec){if(spec.lanes==='arterial')return state.arterialLanes;if(spec.lanes==='tunnel')return state.tunnelLanes;return spec.lanes;}
function speedForSpec(spec){return spec.kind==='tunnel'?state.tunnelSpeed:spec.speed;}
function edgeId(specId,forward){return `${specId}:${forward?'f':'r'}`;}
function buildNetwork(){
  edges={};adjacency={};for(const id of Object.keys(nodes))adjacency[id]=[];
  for(const spec of roadSpecs){
    if(spec.kind==='tunnel'&&!state.tunnelOpen)continue;
    const a=nodes[spec.a],b=nodes[spec.b],length=pixelDistance(a,b)*MILES_PER_PIXEL*(spec.scale||1),lanes=lanesForSpec(spec),speed=speedForSpec(spec);
    for(const forward of [true,false]){
      const from=forward?spec.a:spec.b,to=forward?spec.b:spec.a,id=edgeId(spec.id,forward);
      edges[id]={id,specId:spec.id,from,to,length,lanes,speed,kind:spec.kind,axis:spec.axis||null,forward};adjacency[from].push(id);
    }
  }
}

function routeCost(edge){return edge.length/(edge.speed/60)+(nodes[edge.to].signal?0.12:0);}
function shortestRoute(start,end){
  const d={},prev={},unvisited=new Set(Object.keys(nodes));for(const id of unvisited)d[id]=Infinity;d[start]=0;
  while(unvisited.size){let u=null,best=Infinity;for(const id of unvisited){if(d[id]<best){best=d[id];u=id;}}if(u===null||u===end)break;unvisited.delete(u);
    for(const eid of adjacency[u]||[]){const e=edges[eid],alt=d[u]+routeCost(e);if(alt<d[e.to]){d[e.to]=alt;prev[e.to]=eid;}}
  }
  if(start!==end&&!prev[end])return[];const route=[];let cur=end;while(cur!==start){const eid=prev[cur];if(!eid)return[];route.push(eid);cur=edges[eid].from;}return route.reverse();
}

function readControls(){
  state.backgroundTraffic=Number($('backgroundTraffic').value);state.signalCycleSec=Number($('signalCycle').value);state.greenSplit=Number($('greenSplit').value)/100;
  state.saturationFlow=Number($('saturationFlow').value);state.arterialLanes=Number($('arterialLanes').value);state.tunnelLanes=Number($('tunnelLanes').value);state.tunnelSpeed=Number($('tunnelSpeed').value);
  state.transitFeedback=Number($('transitFeedback').value);state.coordinatedSignals=$('coordinatedSignals').checked;
}
function updateControlLabels(){
  $('backgroundTrafficValue').textContent=`${Number($('backgroundTraffic').value).toFixed(1)}×`;$('signalCycleValue').textContent=`${$('signalCycle').value} s`;$('greenSplitValue').textContent=`${$('greenSplit').value}%`;
  $('saturationFlowValue').textContent=`${$('saturationFlow').value} veh/h/lane`;$('arterialLanesValue').textContent=$('arterialLanes').value;$('tunnelLanesValue').textContent=$('tunnelLanes').value;
  $('tunnelSpeedValue').textContent=`${$('tunnelSpeed').value} mph`;$('transitFeedbackValue').textContent=`${Number($('transitFeedback').value).toFixed(1)} min / 10 riders lost`;
}

const originNames={W:'West suburb',NW:'Northwest homes',SW:'Southwest homes',AN:'North side',AS:'South side'};
const transitAccess={W:4.3,NW:5.2,SW:5.5,AN:4.8,AS:5.0};
function makeAgents(){
  const rng=mulberry32(SEED+19),agents=[];
  for(let i=0;i<TOTAL;i++){
    const r=rng();const origin=r<.50?'W':r<.64?'NW':r<.78?'SW':r<.89?'AN':'AS';
    agents.push({id:i,origin,mode:i<INITIAL_DRIVERS?'drive':'transit',depart:3.0+rng()*12.0,pace:.94+rng()*.12,inertia:.35+rng()*1.05,lastSwitchDay:-99,lastTrip:null,lastRed:null,lastTraffic:null});
  }
  return agents;
}
function modeCounts(){const drivers=state.agents.filter(a=>a.mode==='drive').length;return{drivers,riders:TOTAL-drivers};}
function transitHeadway(riders){return clamp(BASE_TRANSIT_HEADWAY+(Math.max(0,REFERENCE_RIDERS-riders)/10)*state.transitFeedback,BASE_TRANSIT_HEADWAY,11.0);}
function nextTrainAt(t,headway){if(t<=TRAIN_PHASE)return TRAIN_PHASE;return TRAIN_PHASE+Math.ceil((t-TRAIN_PHASE)/headway)*headway;}

function createVehicle(type,route,depart,agentId=null,pace=1){return{id:state.nextVehicleId++,type,agentId,route,edgeIndex:0,lane:null,pos:0,speed:0,depart,active:false,done:false,start:depart,end:null,pace,redDelay:0,trafficDelay:0};}
function createCommuterVehicle(agent){return createVehicle('commuter',shortestRoute(agent.origin,'E'),agent.depart,agent.id,agent.pace);}

const ambientODs=[
  ['NW','SE'],['SE','NW'],['SW','NE'],['NE','SW'],['AN','DS'],['DS','AN'],['AS','DN'],['DN','AS'],
  ['BN','DS'],['BS','DN'],['CN','AS'],['CS','AN'],['W','NE'],['E','NW'],['W','SE'],['E','SW']
];
function createAmbientVehicles(){
  if(state.backgroundTraffic<=0)return[];const rng=mulberry32(SEED+state.day*911+(state.tunnelOpen?7001:0)),vehicles=[];const baseInterval=1.15/state.backgroundTraffic;
  ambientODs.forEach((od,ri)=>{let t=(ri*.17)%baseInterval;while(t<52){t+=baseInterval*(.72+rng()*.56);if(t>=52)break;const route=shortestRoute(od[0],od[1]);if(route.length)vehicles.push(createVehicle('ambient',route,t,null,.90+rng()*.20));}});
  return vehicles;
}
function createTransitTrips(riders){
  const headway=transitHeadway(riders);state.currentHeadway=headway;const trips=[];
  for(const a of state.agents){if(a.mode!=='transit')continue;const station=a.depart+transitAccess[a.origin],train=nextTrainAt(station,headway),end=train+TRANSIT_RIDE+TRANSIT_EGRESS;trips.push({agentId:a.id,station,train,end,done:false});}
  const trains=[];for(let t=TRAIN_PHASE;t<62;t+=headway)trains.push({depart:t,end:t+TRANSIT_RIDE});state.trains=trains;return trips;
}

function resetAgentDayState(){for(const a of state.agents){a.lastTrip=null;a.lastRed=null;a.lastTraffic=null;}}
function createDay(){
  if(state.dayRunning)return;readControls();buildNetwork();resetAgentDayState();state.simTime=0;state.maxStopped=0;state.pendingSwitches=[];state.nextVehicleId=1;state.lastRelease={};
  const counts=modeCounts();state.vehicles=state.agents.filter(a=>a.mode==='drive').map(createCommuterVehicle).filter(v=>v.route.length);state.vehicles.push(...createAmbientVehicles());state.transitTrips=createTransitTrips(counts.riders);
  state.dayRunning=true;state.paused=false;state.lastReal=performance.now();setStatus('running','Morning running');$('runDayBtn').textContent='❚❚ Pause';$('tunnelBtn').disabled=true;renderUI();
}
function pauseDay(){state.paused=true;state.dayRunning=false;$('runDayBtn').textContent='▶ Resume morning';setStatus('switching','Paused');}
function resumeDay(){state.paused=false;state.dayRunning=true;state.lastReal=performance.now();$('runDayBtn').textContent='❚❚ Pause';setStatus('running','Morning running');}

function signalState(nodeId,time=state.simTime){
  const cycle=state.signalCycleSec/60,offsets=state.coordinatedSignals?signalOffsets:uncoordinatedOffsets,offset=(offsets[nodeId]||0)*cycle;
  let p=(time+offset)%cycle;const clearance=2*(YELLOW_MIN+ALL_RED_MIN),available=Math.max(.2,cycle-clearance),ew=available*state.greenSplit,ns=available-ew;
  if(p<ew)return{phase:'EW_GREEN',axis:'EW',greenElapsed:p};p-=ew;if(p<YELLOW_MIN)return{phase:'EW_YELLOW',axis:null,greenElapsed:0};p-=YELLOW_MIN;if(p<ALL_RED_MIN)return{phase:'ALL_RED',axis:null,greenElapsed:0};p-=ALL_RED_MIN;
  if(p<ns)return{phase:'NS_GREEN',axis:'NS',greenElapsed:p};p-=ns;if(p<YELLOW_MIN)return{phase:'NS_YELLOW',axis:null,greenElapsed:0};return{phase:'ALL_RED',axis:null,greenElapsed:0};
}
function approachAxis(edge){if(edge.axis)return edge.axis;const a=nodes[edge.from],b=nodes[edge.to];return Math.abs(b.x-a.x)>=Math.abs(b.y-a.y)?'EW':'NS';}
function releaseGapMin(){return 60/state.saturationFlow;}
function signalPermission(v,edge){
  const node=nodes[edge.to];if(!node.signal)return{ok:true,reason:null};const sig=signalState(edge.to);const axis=approachAxis(edge);if(sig.axis!==axis||sig.greenElapsed<STARTUP_LOST_MIN)return{ok:false,reason:'signal'};
  const key=`${edge.to}|${edge.id}|${v.lane}`;const last=state.lastRelease[key];if(Number.isFinite(last)&&state.simTime-last<releaseGapMin())return{ok:false,reason:'signal'};return{ok:true,reason:null,key};
}

function vehiclesOnLane(edgeId,lane,excludeId=null){return state.vehicles.filter(v=>v.active&&!v.done&&v.id!==excludeId&&v.route[v.edgeIndex]===edgeId&&v.lane===lane);}
function chooseEntryLane(edgeId,seed,excludeId=null){
  const edge=edges[edgeId];if(!edge)return null;const preferred=((seed||0)%edge.lanes+edge.lanes)%edge.lanes;const order=[preferred,...Array.from({length:edge.lanes},(_,i)=>i).filter(i=>i!==preferred)];
  for(const lane of order){let nearest=Infinity;for(const v of state.vehicles){if(v.id===excludeId||!v.active||v.done||v.route[v.edgeIndex]!==edgeId||v.lane!==lane)continue;nearest=Math.min(nearest,v.pos);}if(nearest>=JAM_SPACING_MILES)return lane;}return null;
}
function transferInfo(v,edge){
  const permission=signalPermission(v,edge);if(!permission.ok)return{ok:false,reason:permission.reason};const nextId=v.route[v.edgeIndex+1];if(!nextId)return{ok:true,nextId:null,lane:null,releaseKey:permission.key||null};
  const lane=chooseEntryLane(nextId,v.id,v.id);if(lane===null)return{ok:false,reason:'downstream'};return{ok:true,nextId,lane,releaseKey:permission.key||null};
}
function activateVehicles(){
  const waiting=state.vehicles.filter(v=>!v.active&&!v.done&&state.simTime>=v.depart).sort((a,b)=>a.depart-b.depart||a.id-b.id);
  for(const v of waiting){const first=v.route[0],lane=chooseEntryLane(first,v.id,v.id);if(lane!==null){v.active=true;v.lane=lane;v.pos=0;v.speed=0;}}
}
function buildLeaderMap(){
  state.leaderMap=new Map();const buckets=new Map();for(const v of state.vehicles){if(!v.active||v.done||v.lane===null)continue;const key=`${v.route[v.edgeIndex]}|${v.lane}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(v);}
  for(const arr of buckets.values()){arr.sort((a,b)=>b.pos-a.pos);for(let i=1;i<arr.length;i++)state.leaderMap.set(arr[i].id,arr[i-1]);}
}
function updateVehicle(v,dt){
  if(!v.active||v.done)return;const edge=edges[v.route[v.edgeIndex]];if(!edge){v.done=true;v.active=false;return;}const leader=state.leaderMap.get(v.id);let desired=edge.speed/60*v.pace,cap=edge.length,reason=null;
  if(leader){const gap=leader.pos-v.pos,dynamic=JAM_SPACING_MILES+v.speed*FOLLOW_HEADWAY_MIN;if(gap<dynamic*1.15)desired=Math.min(desired,Math.max(0,(gap-JAM_SPACING_MILES)/FOLLOW_HEADWAY_MIN));cap=Math.min(cap,leader.pos-JAM_SPACING_MILES);reason='traffic';}
  if(edge.length-v.pos<.035){const transfer=transferInfo(v,edge);if(!transfer.ok){cap=Math.min(cap,edge.length-.0015);reason=transfer.reason;}}
  const delta=desired-v.speed;v.speed+=clamp(delta,-DECEL_MI_PER_MIN2*dt,ACCEL_MI_PER_MIN2*dt);v.speed=Math.max(0,v.speed);const room=Math.max(0,cap-v.pos),move=Math.min(v.speed*dt,room);v.pos+=move;if(room<=.00005)v.speed=0;
  if(v.type==='commuter'&&v.speed<5/60){if(reason==='signal'&&edge.length-v.pos<.02)v.redDelay+=dt;else if(reason==='traffic'||reason==='downstream'||leader)v.trafficDelay+=dt;}
  if(v.pos>=edge.length-.00005){const nowTransfer=transferInfo(v,edge);if(!nowTransfer.ok)return;if(nowTransfer.releaseKey)state.lastRelease[nowTransfer.releaseKey]=state.simTime;
    if(!nowTransfer.nextId){v.done=true;v.active=false;v.end=state.simTime;if(v.type==='commuter'){const a=state.agents[v.agentId];a.lastTrip=v.end-v.start;a.lastRed=v.redDelay;a.lastTraffic=v.trafficDelay;}return;}
    v.edgeIndex++;v.pos=0;v.lane=nowTransfer.lane;v.speed=Math.min(v.speed,edges[nowTransfer.nextId].speed/60*v.pace);
  }
}
function updateTransit(){for(const t of state.transitTrips){if(!t.done&&state.simTime>=t.end){t.done=true;const a=state.agents[t.agentId];a.lastTrip=t.end-a.depart;a.lastRed=0;a.lastTraffic=0;}}}
function dayFinished(){return state.agents.every(a=>Number.isFinite(a.lastTrip));}
function updateSimulation(dt){
  state.simTime+=dt;activateVehicles();buildLeaderMap();const active=state.vehicles.filter(v=>v.active&&!v.done);for(const v of active)updateVehicle(v,dt);updateTransit();
  const stopped=active.filter(v=>v.type==='commuter'&&v.speed<5/60).length;state.maxStopped=Math.max(state.maxStopped,stopped);if(dayFinished()||state.simTime>=DAY_END)finishDay();
}

function collectMetrics(){
  const counts=modeCounts(),drivers=state.agents.filter(a=>a.mode==='drive'),riders=state.agents.filter(a=>a.mode==='transit');
  return{day:state.day,tunnel:state.tunnelOpen,drivers:counts.drivers,riders:counts.riders,drive:mean(drivers.map(a=>a.lastTrip).filter(Number.isFinite)),transit:mean(riders.map(a=>a.lastTrip).filter(Number.isFinite)),red:mean(drivers.map(a=>a.lastRed).filter(Number.isFinite)),traffic:mean(drivers.map(a=>a.lastTraffic).filter(Number.isFinite)),headway:state.currentHeadway,maxStopped:state.maxStopped,ambient:state.vehicles.filter(v=>v.type==='ambient').length};
}
function chooseSwitches(metrics){
  if(!Number.isFinite(metrics.drive)||!Number.isFinite(metrics.transit))return[];const gap=metrics.drive-metrics.transit;if(Math.abs(gap)<.05)return[];const slower=gap>0?'drive':'transit',adv=Math.abs(gap);
  return state.agents.filter(a=>a.mode===slower&&state.day-a.lastSwitchDay>SWITCH_COOLDOWN&&adv>a.inertia).sort((a,b)=>a.inertia-b.inertia||a.id-b.id).slice(0,SWITCH_LIMIT).map(a=>a.id);
}
function applyPendingSwitches(){for(const id of state.pendingSwitches){const a=state.agents[id];a.mode=a.mode==='drive'?'transit':'drive';a.lastSwitchDay=state.day;}}
function finishDay(){
  state.dayRunning=false;state.paused=false;const m=collectMetrics();state.lastDay=m;state.history.push(m);state.pendingSwitches=chooseSwitches(m);updateStory(m,state.pendingSwitches.length);
  if(!state.pendingSwitches.length){if(state.tunnelOpen)state.stableAfter=m;else state.stableBefore=m;setStatus(state.tunnelOpen?'worse':'stable','Stable mode split');}else setStatus('switching',`${state.pendingSwitches.length} switch tomorrow`);
  $('runDayBtn').textContent='▶ Run next morning';$('tunnelBtn').disabled=state.tunnelOpen;applyPendingSwitches();renderUI();renderHistory();
  if(state.autoRun&&state.pendingSwitches.length){setTimeout(()=>{if(!state.autoRun)return;state.day++;createDay();},150);}else{state.autoRun=false;$('autoBtn').textContent='⏩ Run days until stable';}
}
function updateStory(m,n){
  const gap=m.drive-m.transit,faster=gap<0?'Driving':'Transit';
  if(!state.tunnelOpen){
    if(n){$('storyTitle').textContent='The old city is still finding its mode split.';$('storyText').textContent=`Driving averaged ${m.drive.toFixed(1)} minutes and transit ${m.transit.toFixed(1)}. ${faster} was faster, so ${n} commuter${n===1?'':'s'} will change modes tomorrow. The road result came from ${m.ambient} ambient trips, lane queues, signal phases, and route choices.`;}
    else{$('storyTitle').textContent='The old-city equilibrium has emerged.';$('storyText').textContent=`At ${m.drivers} drivers and ${m.riders} transit riders, nobody currently has enough incentive to switch. Drivers averaged ${m.drive.toFixed(1)} minutes, including ${m.red.toFixed(1)} minutes stopped at red lights and ${m.traffic.toFixed(1)} in traffic queues.`;}
    $('punchline').classList.remove('worse');$('punchline').textContent='The baseline is now an observed property of the city network. Build the tunnel and let both tracked commuters and background traffic reroute.';return;
  }
  const first=state.tunnelBuiltAfter!==null&&state.day===state.tunnelBuiltAfter+1;
  if(first){$('storyTitle').textContent='The tunnel changes routes immediately.';$('storyText').textContent=`Nobody changed commute mode before this morning, but road routing did change. Driving averaged ${m.drive.toFixed(1)} minutes versus ${m.transit.toFixed(1)} on transit. ${n?n+' commuters respond tomorrow':'Nobody switches yet'}.`;}
  else if(n){$('storyTitle').textContent='Induced traffic is propagating through the network.';$('storyText').textContent=`There are ${m.drivers} tracked commuter cars plus city traffic. Driving averaged ${m.drive.toFixed(1)} minutes; transit headway is ${m.headway.toFixed(1)} minutes. ${n} commuter${n===1?'':'s'} move toward ${faster.toLowerCase()} tomorrow.`;}
  else{$('storyTitle').textContent='A post-tunnel equilibrium has emerged.';$('storyText').textContent=`Nobody switches now. The final split is ${m.drivers} drivers / ${m.riders} transit riders, with ${m.drive.toFixed(1)} minutes driving and ${m.transit.toFixed(1)} minutes on transit.`;}
  if(!n&&state.stableBefore){const before=(state.stableBefore.drive*state.stableBefore.drivers+state.stableBefore.transit*state.stableBefore.riders)/TOTAL,after=(m.drive*m.drivers+m.transit*m.riders)/TOTAL,delta=after-before;$('punchline').classList.toggle('worse',delta>0);$('punchline').textContent=delta>0?`Downs-Thomson effect: after everyone responds, the average commuter is about ${delta.toFixed(1)} minutes worse off than in the stable pre-tunnel city, even though the tunnel is a genuine shortcut.`:`With these settings the tunnel does not create a worse final equilibrium. Try heavier background traffic, fewer arterial lanes, weaker signal coordination, or stronger transit feedback and compare the result.`;}
}

function buildTunnel(){if(state.dayRunning||state.tunnelOpen)return;state.autoRun=false;state.tunnelOpen=true;state.tunnelBuiltAfter=state.history.length?state.day:0;state.lastDay=null;readControls();buildNetwork();$('tunnelBtn').disabled=true;$('tunnelBtn').textContent='✓ Tunnel open';$('runDayBtn').textContent='▶ Run first tunnel morning';setStatus('switching','Tunnel open');$('storyTitle').textContent='The tunnel is open. Modes have not changed yet.';$('storyText').textContent='The next morning uses the same commute choices, but road routing can now use the direct mountain link. Ambient city traffic can reroute through it too.';renderUI();drawWorld();}
function resetCity(){
  readControls();state.agents=makeAgents();state.day=1;state.tunnelOpen=false;state.tunnelBuiltAfter=null;state.dayRunning=false;state.paused=false;state.autoRun=false;state.speed=8;state.simTime=0;state.vehicles=[];state.transitTrips=[];state.trains=[];state.history=[];state.lastDay=null;state.pendingSwitches=[];state.selectedAgentId=0;state.currentHeadway=null;state.maxStopped=0;state.stableBefore=null;state.stableAfter=null;state.nextVehicleId=1;state.lastRelease={};buildNetwork();
  document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('active',Number(b.dataset.speed)===8));$('runDayBtn').textContent='▶ Run morning';$('autoBtn').textContent='⏩ Run days until stable';$('tunnelBtn').textContent='⛏ Build tunnel';$('tunnelBtn').disabled=false;$('storyTitle').textContent='Establish the old-city equilibrium.';$('storyText').textContent='Run repeated mornings first. Commuters will move between driving and transit until their individual switching thresholds leave the old network near a stable mode split. Then build the tunnel and disturb it.';$('modeChange').innerHTML='<strong>Tomorrow:</strong> no decisions yet.';$('punchline').classList.remove('worse');$('punchline').textContent='First let the old city settle. Then open the tunnel and let the same commuters respond to the new network.';setStatus('stable','Ready');renderUI();renderHistory();drawWorld();
}
function startAuto(){if(state.autoRun){state.autoRun=false;$('autoBtn').textContent='⏩ Run days until stable';return;}state.autoRun=true;$('autoBtn').textContent='■ Stop after this day';if(!state.dayRunning){if(state.lastDay||state.history.length)state.day++;createDay();}}
function runDayButton(){if(state.dayRunning){pauseDay();return;}if(state.paused){resumeDay();return;}if(state.lastDay||state.history.length)state.day++;createDay();}
function setStatus(kind,text){const c=$('statusChip');c.className=`status ${kind}`;c.textContent=text;}

function clockText(mins){const total=6*60+30+Math.round(mins),h24=Math.floor(total/60),m=total%60,suffix=h24>=12?'PM':'AM',h=((h24-1)%12)+1;return`${h}:${String(m).padStart(2,'0')} ${suffix}`;}
function fmt(v){return Number.isFinite(v)?`${v.toFixed(1)} min`:'—';}
function currentMeasured(){if(!state.dayRunning&&state.lastDay)return state.lastDay;const d=state.agents.filter(a=>a.mode==='drive'&&Number.isFinite(a.lastTrip)),t=state.agents.filter(a=>a.mode==='transit'&&Number.isFinite(a.lastTrip));return{drive:mean(d.map(a=>a.lastTrip)),transit:mean(t.map(a=>a.lastTrip)),red:mean(d.map(a=>a.lastRed).filter(Number.isFinite)),traffic:mean(d.map(a=>a.lastTraffic).filter(Number.isFinite))};}
function renderUI(){
  const counts=modeCounts(),m=currentMeasured();$('dayTitle').textContent=`Day ${state.day} · ${state.tunnelOpen?'tunnel network':'mountain network'}`;$('simClock').textContent=clockText(state.simTime);$('driverCount').textContent=counts.drivers;$('riderCount').textContent=counts.riders;$('driveTime').textContent=fmt(m.drive);$('transitTime').textContent=fmt(m.transit);$('redDelay').textContent=fmt(m.red);$('trafficDelay').textContent=fmt(m.traffic);$('headway').textContent=state.currentHeadway?`${state.currentHeadway.toFixed(1)} min`:'—';$('discharge').textContent=`${state.saturationFlow}/h`;
  const active=state.vehicles.filter(v=>v.active&&!v.done);$('carsOnRoad').textContent=active.length;$('queueNow').textContent=active.filter(v=>v.type==='commuter'&&v.speed<5/60).length;$('maxQueue').textContent=state.maxStopped;$('ambientCars').textContent=active.filter(v=>v.type==='ambient').length;$('finishedTrips').textContent=`${state.agents.filter(a=>Number.isFinite(a.lastTrip)).length} / ${TOTAL}`;
  const verdict=$('heroVerdict');verdict.querySelector('span').textContent=state.tunnelOpen?'Tunnel era':'Before tunnel';verdict.querySelector('strong').textContent=`${counts.drivers} / ${counts.riders}`;verdict.querySelector('small').textContent='drive / transit';verdict.classList.toggle('worse',!!(state.stableAfter&&state.stableBefore&&((state.stableAfter.drive*state.stableAfter.drivers+state.stableAfter.transit*state.stableAfter.riders)>(state.stableBefore.drive*state.stableBefore.drivers+state.stableBefore.transit*state.stableBefore.riders))));
  if(state.lastDay&&state.pendingSwitches.length){const from=state.lastDay.drive>state.lastDay.transit?'drive':'transit',to=from==='drive'?'transit':'drive';$('modeChange').innerHTML=`<strong>Tomorrow:</strong> ${state.pendingSwitches.length} switch from ${from} to ${to}.`;}else if(state.lastDay)$('modeChange').innerHTML='<strong>Tomorrow:</strong> nobody currently wants to switch.';renderPeople();renderInspector();
}
function renderPeople(){const host=$('people');if(!host.childElementCount){for(const a of state.agents){const b=document.createElement('button');b.className='person';b.type='button';b.dataset.id=a.id;b.title=`Commuter #${a.id+1}`;b.addEventListener('click',()=>{state.selectedAgentId=a.id;renderPeople();renderInspector();});host.appendChild(b);}}[...host.children].forEach((el,i)=>{const a=state.agents[i];el.classList.toggle('drive',a.mode==='drive');el.classList.toggle('selected',a.id===state.selectedAgentId);});}
function renderInspector(){const a=state.agents[state.selectedAgentId]||state.agents[0];$('inspectTitle').textContent=`Commuter #${a.id+1}`;$('inspectHome').textContent=originNames[a.origin];$('inspectMode').textContent=a.mode==='drive'?'Drive':'Transit';$('inspectDepart').textContent=clockText(a.depart);$('inspectTrip').textContent=fmt(a.lastTrip);$('inspectRed').textContent=a.mode==='drive'?fmt(a.lastRed):'n/a';$('inspectTraffic').textContent=a.mode==='drive'?fmt(a.lastTraffic):'n/a';$('inspectDot').className=`person-dot ${a.mode}`;}

function roadWidth(spec){const lanes=lanesForSpec(spec);return spec.kind==='highway'||spec.kind==='tunnel'?8+lanes*5:6+lanes*4.5;}
function drawRoad(spec){if(spec.kind==='tunnel'&&!state.tunnelOpen)return;const a=nodes[spec.a],b=nodes[spec.b],width=roadWidth(spec),color=spec.kind==='highway'?'#4c5358':spec.kind==='tunnel'?'#5a4b48':spec.kind==='arterial'?'#414c56':spec.kind==='collector'?'#344653':'#2c3d4a';ctx.lineCap='round';ctx.strokeStyle='rgba(0,0,0,.42)';ctx.lineWidth=width+5;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.strokeStyle='rgba(245,210,100,.45)';ctx.lineWidth=1;ctx.setLineDash([6,7]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);}
function drawBuildings(){
  ctx.fillStyle='#132735';ctx.strokeStyle='rgba(255,255,255,.045)';const rng=mulberry32(99);for(let i=0;i<64;i++){const x=30+rng()*1510,y=35+rng()*810,w=18+rng()*34,h=14+rng()*28;if(x>500&&x<1140&&y>50&&y<430)continue;ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);}ctx.fillStyle='rgba(126,230,173,.10)';for(let i=0;i<32;i++){const x=40+rng()*1510,y=45+rng()*800;ctx.beginPath();ctx.arc(x,y,7+rng()*8,0,Math.PI*2);ctx.fill();}
}
function drawMountain(){ctx.fillStyle='#26393b';ctx.strokeStyle='#4a615f';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(535,435);ctx.lineTo(610,280);ctx.lineTo(715,145);ctx.lineTo(840,80);ctx.lineTo(965,130);ctx.lineTo(1070,275);ctx.lineTo(1115,435);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='rgba(255,255,255,.5)';ctx.font='700 12px system-ui';ctx.textAlign='center';ctx.fillText('MOUNTAIN',835,230);}
function drawSignal(id){const n=nodes[id],s=signalState(id);ctx.save();ctx.translate(n.x,n.y);ctx.fillStyle='rgba(3,8,13,.9)';ctx.fillRect(-9,-9,18,18);ctx.fillStyle=s.axis==='EW'?'#69e7a2':s.phase==='EW_YELLOW'?'#ffd166':'#ff6675';ctx.fillRect(-7,-5,14,3);ctx.fillStyle=s.axis==='NS'?'#69e7a2':s.phase==='NS_YELLOW'?'#ffd166':'#ff6675';ctx.fillRect(-1.5,-7,3,14);ctx.restore();}
function laneOffset(edge,lane){return -(2.0+lane*3.0);}
function pointOnEdge(edge,pos,lane=0){const a=nodes[edge.from],b=nodes[edge.to],t=clamp(pos/edge.length,0,1),dx=b.x-a.x,dy=b.y-a.y,mag=Math.hypot(dx,dy)||1,off=laneOffset(edge,lane),nx=-dy/mag,ny=dx/mag;return{x:a.x+dx*t+nx*off,y:a.y+dy*t+ny*off,angle:Math.atan2(dy,dx)};}
function drawTrain(t){if(state.simTime<t.depart||state.simTime>t.end)return;const p=(state.simTime-t.depart)/(t.end-t.depart),x=105+(1390)*p,y=820-10*Math.sin(p*Math.PI);ctx.save();ctx.translate(x,y);ctx.fillStyle='#65dfc1';ctx.fillRect(-10,-3,20,6);ctx.restore();}
function drawVehicle(v){if(!v.active||v.done)return;const edge=edges[v.route[v.edgeIndex]];if(!edge)return;const p=pointOnEdge(edge,v.pos,v.lane||0);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillStyle=v.type==='commuter'?'#ffb35c':'#78a9ff';ctx.fillRect(-3.2,-1.6,6.4,3.2);ctx.fillStyle='rgba(245,248,251,.68)';ctx.fillRect(.3,-1.0,1.8,2.0);ctx.restore();}
function drawWorld(){
  ctx.clearRect(0,0,canvas.width,canvas.height);const g=ctx.createLinearGradient(0,0,0,900);g.addColorStop(0,'#0a1d2b');g.addColorStop(1,'#0a1721');ctx.fillStyle=g;ctx.fillRect(0,0,1600,900);drawBuildings();drawMountain();for(const spec of roadSpecs)if(spec.kind!=='tunnel')drawRoad(spec);
  if(state.tunnelOpen){drawRoad(roadSpecById.tunnel);ctx.strokeStyle='#ff806d';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(nodes.B.x,nodes.B.y);ctx.lineTo(nodes.C.x,nodes.C.y);ctx.stroke();ctx.fillStyle='#ffc1b6';ctx.font='700 9px system-ui';ctx.textAlign='center';ctx.fillText('TUNNEL',825,464);}else{ctx.strokeStyle='rgba(255,124,102,.20)';ctx.lineWidth=2;ctx.setLineDash([7,7]);ctx.beginPath();ctx.moveTo(nodes.B.x,nodes.B.y);ctx.lineTo(nodes.C.x,nodes.C.y);ctx.stroke();ctx.setLineDash([]);}
  ctx.strokeStyle='rgba(101,223,193,.26)';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(80,820);ctx.lineTo(1520,820);ctx.stroke();ctx.strokeStyle='#65dfc1';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(80,820);ctx.lineTo(1520,820);ctx.stroke();for(const id of ['A','B','C','D'])drawSignal(id);for(const t of state.trains)drawTrain(t);for(const v of state.vehicles)drawVehicle(v);
  ctx.fillStyle='rgba(245,248,251,.72)';ctx.font='700 10px system-ui';ctx.textAlign='left';ctx.fillText('WEST SUBURBS',35,430);ctx.fillText('SOUTH PARALLEL ROAD',660,773);ctx.fillText('NORTH LOCAL ROAD',650,47);ctx.textAlign='right';ctx.fillText('DOWNTOWN',1560,430);ctx.textAlign='left';
}

function resizeHistory(){const rect=historyCanvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1,w=Math.max(320,Math.round(rect.width*dpr)),h=Math.max(220,Math.round(rect.height*dpr));if(historyCanvas.width!==w||historyCanvas.height!==h){historyCanvas.width=w;historyCanvas.height=h;}return{w:w/dpr,h:h/dpr,dpr};}
function renderHistory(){
  const{w,h,dpr}=resizeHistory();hctx.setTransform(1,0,0,1,0,0);hctx.clearRect(0,0,historyCanvas.width,historyCanvas.height);hctx.scale(dpr,dpr);const pad={l:38,r:15,t:14,b:28},values=state.history.flatMap(d=>[d.drive,d.transit]).filter(Number.isFinite),yMin=Math.max(0,Math.floor((Math.min(...values,15)-4)/5)*5),yMax=Math.ceil((Math.max(...values,35)+4)/5)*5,maxDay=Math.max(6,state.history.length),x=i=>pad.l+i/(maxDay-1)*(w-pad.l-pad.r),y=v=>pad.t+(yMax-v)/(yMax-yMin)*(h-pad.t-pad.b);
  hctx.font='9px system-ui';hctx.fillStyle='rgba(220,235,245,.65)';hctx.strokeStyle='rgba(255,255,255,.08)';for(let v=yMin;v<=yMax;v+=5){hctx.beginPath();hctx.moveTo(pad.l,y(v));hctx.lineTo(w-pad.r,y(v));hctx.stroke();hctx.fillText(`${v}m`,5,y(v)+3);}if(state.tunnelBuiltAfter!==null&&state.tunnelBuiltAfter>0){const idx=state.history.findIndex(d=>d.tunnel);if(idx>=0){hctx.strokeStyle='rgba(255,124,102,.65)';hctx.setLineDash([4,4]);hctx.beginPath();hctx.moveTo(x(idx),pad.t);hctx.lineTo(x(idx),h-pad.b);hctx.stroke();hctx.setLineDash([]);}}
  function line(key,color){hctx.strokeStyle=color;hctx.lineWidth=2.2;hctx.beginPath();let started=false;state.history.forEach((d,i)=>{if(!Number.isFinite(d[key]))return;const px=x(i),py=y(d[key]);if(!started){hctx.moveTo(px,py);started=true;}else hctx.lineTo(px,py);});hctx.stroke();state.history.forEach((d,i)=>{if(!Number.isFinite(d[key]))return;hctx.fillStyle=color;hctx.beginPath();hctx.arc(x(i),y(d[key]),2.8,0,Math.PI*2);hctx.fill();});}line('drive','#ffb35c');line('transit','#65dfc1');hctx.setTransform(1,0,0,1,0,0);
}

function frame(now){const realDt=Math.min(.05,(now-state.lastReal)/1000);state.lastReal=now;if(state.dayRunning&&!state.paused){let simDt=realDt*BASE_SIM_MINUTES_PER_SECOND*state.speed;while(simDt>0&&state.dayRunning){const step=Math.min(.012,simDt);updateSimulation(step);simDt-=step;}}renderUI();drawWorld();state.animationHandle=requestAnimationFrame(frame);}

$('runDayBtn').addEventListener('click',runDayButton);$('autoBtn').addEventListener('click',startAuto);$('tunnelBtn').addEventListener('click',buildTunnel);$('resetBtn').addEventListener('click',resetCity);
document.querySelectorAll('[data-speed]').forEach(b=>b.addEventListener('click',()=>{state.speed=Number(b.dataset.speed);document.querySelectorAll('[data-speed]').forEach(o=>o.classList.toggle('active',o===b));}));
for(const id of ['backgroundTraffic','signalCycle','greenSplit','saturationFlow','arterialLanes','tunnelLanes','tunnelSpeed','transitFeedback'])$(id).addEventListener('input',()=>{updateControlLabels();readControls();});
$('coordinatedSignals').addEventListener('change',()=>{readControls();});window.addEventListener('resize',renderHistory);

updateControlLabels();readControls();state.agents=makeAgents();buildNetwork();renderPeople();renderUI();renderHistory();drawWorld();state.lastReal=performance.now();state.animationHandle=requestAnimationFrame(frame);
