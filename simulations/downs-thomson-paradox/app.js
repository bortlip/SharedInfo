'use strict';

const TOTAL = 100;
const INITIAL_DRIVERS = 13;
const DAY_END = 72;
const CAR_GAP = 17;
const STOP_LINE_GAP = 5;
const BASE_RATE = 1.5;
const TRAIN_PHASE = 1.2;
const TRANSIT_RIDE = 24;
const TRANSIT_EGRESS = 4.5;
const SWITCH_LIMIT = 3;
const SWITCH_COOLDOWN = 2;
const SEED = 94271;

const $ = id => document.getElementById(id);
const canvas = $('worldCanvas');
const ctx = canvas.getContext('2d');
const historyCanvas = $('historyCanvas');
const hctx = historyCanvas.getContext('2d');

function mulberry32(seed){return function(){let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const baseRng=mulberry32(SEED);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:NaN;
const dist=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);

const nodes={
  W:{x:55,y:332,label:'West subdivision'}, A:{x:245,y:332,signal:'A'}, B:{x:410,y:332,signal:'B'},
  L1:{x:465,y:215},L2:{x:545,y:118},L3:{x:660,y:78},L4:{x:770,y:125},L5:{x:835,y:220},C:{x:855,y:332},
  D:{x:1010,y:332,signal:'D'}, E:{x:1150,y:332,label:'Downtown'},
  AN:{x:245,y:55},AS:{x:245,y:615},BN:{x:410,y:55},BS:{x:410,y:615},DN:{x:1010,y:55},DS:{x:1010,y:615},
  NW:{x:105,y:105},SW:{x:105,y:565}
};

const edgeDefs=[
  ['W_A','W','A',58],['AN_A','AN','A',46],['A_AN','A','AN',46],['AS_A','AS','A',46],['A_AS','A','AS',46],
  ['A_B','A','B',58],['BN_B','BN','B',46],['B_BN','B','BN',46],['BS_B','BS','B',46],['B_BS','B','BS',46],
  ['B_L1','B','L1',49],['L1_L2','L1','L2',47],['L2_L3','L2','L3',45],['L3_L4','L3','L4',45],['L4_L5','L4','L5',47],['L5_C','L5','C',49],
  ['B_C_T','B','C',42.6],['C_D','C','D',58],['DN_D','DN','D',46],['D_DN','D','DN',46],['DS_D','DS','D',46],['D_DS','D','DS',46],['D_E','D','E',55]
];
const edges={};
for(const [id,from,to,speed] of edgeDefs){edges[id]={id,from,to,speed,length:dist(nodes[from],nodes[to])};}

const signals={A:{offset:0},B:{offset:.63},D:{offset:1.18}};
const loopRoute=['A_B','B_L1','L1_L2','L2_L3','L3_L4','L4_L5','L5_C','C_D','D_E'];
const tunnelRoute=['A_B','B_C_T','C_D','D_E'];
const homeStarts={west:['W_A'],north:['AN_A'],south:['AS_A']};
const homeNames={west:'West subdivision',north:'North side street',south:'South side street'};
const homeAccess={west:5.0,north:5.8,south:6.3};

const state={
  agents:[],day:1,tunnelOpen:false,tunnelBuiltAfter:null,dayRunning:false,paused:false,autoRun:false,speed:8,simTime:0,lastReal:performance.now(),
  vehicles:[],transitTrips:[],trains:[],history:[],lastDay:null,pendingSwitches:[],selectedAgentId:0,currentHeadway:null,
  crossTraffic:1,signalCycle:2.4,maxStopped:0,stableBefore:null,stableAfter:null,nextVehicleId:1,animationHandle:null
};

function makeAgents(){
  const rng=mulberry32(SEED+11);const a=[];
  for(let i=0;i<TOTAL;i++){
    const r=rng();const home=r<.62?'west':r<.81?'north':'south';
    a.push({id:i,home,mode:i<INITIAL_DRIVERS?'drive':'transit',depart:3.2+rng()*9.2,pace:.92+rng()*.16,inertia:.55+rng()*1.15,lastSwitchDay:-99,lastTrip:null,lastStopped:null});
  }
  return a;
}

function signalPhase(id,time=state.simTime){
  const cycle=state.signalCycle;const ew=cycle*.57,all=cycle*.06,ns=cycle-ew-all*2;const p=(time+signals[id].offset)%cycle;
  if(p<ew)return'EW';if(p<ew+all)return'ALL';if(p<ew+all+ns)return'NS';return'ALL';
}
function approachAxis(edge){const a=nodes[edge.from],b=nodes[edge.to];return Math.abs(b.x-a.x)>=Math.abs(b.y-a.y)?'EW':'NS';}
function signalAllows(edge){const node=nodes[edge.to];if(!node.signal)return true;return signalPhase(node.signal)===approachAxis(edge);}
function routeForAgent(a){return [...homeStarts[a.home],...(state.tunnelOpen?tunnelRoute:loopRoute)];}
function modeCounts(){const drivers=state.agents.filter(a=>a.mode==='drive').length;return{drivers,riders:TOTAL-drivers};}
function transitHeadway(riders){return clamp(3.4+(87-riders)*.22,3.2,9.5);}
function nextTrainAt(t,headway){if(t<=TRAIN_PHASE)return TRAIN_PHASE;return TRAIN_PHASE+Math.ceil((t-TRAIN_PHASE)/headway)*headway;}

function createCommuterVehicle(agent){return{id:state.nextVehicleId++,type:'commuter',agentId:agent.id,route:routeForAgent(agent),edgeIndex:0,pos:0,speed:0,depart:agent.depart,active:false,done:false,start:agent.depart,end:null,stopped:0,pace:agent.pace};}
function createCrossVehicle(route,depart){const id=state.nextVehicleId++;return{id,type:'cross',agentId:null,route,edgeIndex:0,pos:0,speed:0,depart,active:false,done:false,start:depart,end:null,stopped:0,pace:.95+((id*37)%13)/100};}

function crossSchedules(){
  const out=[];if(state.crossTraffic<=0)return out;
  const rng=mulberry32(SEED+state.day*101);const routes=[['AN_A','A_AS'],['AS_A','A_AN'],['BN_B','B_BS'],['BS_B','B_BN'],['DN_D','D_DS'],['DS_D','D_DN']];
  const base=2.15/state.crossTraffic;
  routes.forEach((route,ri)=>{let t=(ri*.31)%base;while(t<42){t+=base*(.78+rng()*.44);if(t<42)out.push(createCrossVehicle(route,t));}});
  return out;
}

function createTransitTrips(riders){
  const headway=transitHeadway(riders);state.currentHeadway=headway;const trips=[];
  for(const a of state.agents){if(a.mode!=='transit')continue;const station=a.depart+homeAccess[a.home];const train=nextTrainAt(station,headway);const end=train+TRANSIT_RIDE+TRANSIT_EGRESS;trips.push({agentId:a.id,station,train,end,done:false});}
  const trains=[];for(let t=TRAIN_PHASE;t<55;t+=headway)trains.push({depart:t,end:t+TRANSIT_RIDE});state.trains=trains;return trips;
}

function resetAgentDayState(){for(const a of state.agents){a.lastTrip=null;a.lastStopped=null;}}
function createDay(){
  if(state.dayRunning)return;resetAgentDayState();state.simTime=0;state.maxStopped=0;state.pendingSwitches=[];state.nextVehicleId=1;
  const counts=modeCounts();state.vehicles=state.agents.filter(a=>a.mode==='drive').map(createCommuterVehicle);state.vehicles.push(...crossSchedules());state.transitTrips=createTransitTrips(counts.riders);
  state.dayRunning=true;state.paused=false;state.lastReal=performance.now();setStatus('running','Morning running');$('runDayBtn').textContent='❚❚ Pause';$('tunnelBtn').disabled=true;renderUI();
}
function pauseDay(){state.paused=true;state.dayRunning=false;$('runDayBtn').textContent='▶ Resume morning';setStatus('switching','Paused');}
function resumeDay(){state.paused=false;state.dayRunning=true;state.lastReal=performance.now();$('runDayBtn').textContent='❚❚ Pause';setStatus('running','Morning running');}

function edgeVehicles(edgeId,excludeId=null){return state.vehicles.filter(v=>v.active&&!v.done&&v.id!==excludeId&&v.route[v.edgeIndex]===edgeId);}
function entryFree(edgeId,excludeId=null){return !edgeVehicles(edgeId,excludeId).some(v=>v.pos<CAR_GAP);}
function leaderOnEdge(v){let best=null,bestPos=Infinity;for(const o of state.vehicles){if(o.id===v.id||!o.active||o.done||o.route[o.edgeIndex]!==v.route[v.edgeIndex]||o.pos<=v.pos)continue;if(o.pos<bestPos){best=o;bestPos=o.pos;}}return best;}
function canLeaveEdge(v,edge){
  if(!signalAllows(edge))return false;
  const nextId=v.route[v.edgeIndex+1];if(!nextId)return true;return entryFree(nextId,v.id);
}
function activateVehicles(){
  const waiting=state.vehicles.filter(v=>!v.active&&!v.done&&state.simTime>=v.depart).sort((a,b)=>a.depart-b.depart||a.id-b.id);
  for(const v of waiting){if(entryFree(v.route[0],v.id)){v.active=true;v.pos=0;v.speed=0;}}
}

function updateVehicle(v,dt){
  if(!v.active||v.done)return;const edge=edges[v.route[v.edgeIndex]];let desired=edge.speed*v.pace;const leader=leaderOnEdge(v);let cap=edge.length;
  if(leader)cap=Math.min(cap,leader.pos-CAR_GAP);
  const atEndBlocked=!canLeaveEdge(v,edge);if(atEndBlocked)cap=Math.min(cap,edge.length-STOP_LINE_GAP);
  const room=Math.max(0,cap-v.pos);const accel=90*dt;v.speed=Math.min(desired,v.speed+accel);let move=Math.min(v.speed*dt,room);
  if(room<.0001){v.speed=0;move=0;}else if(move>=room-.001)v.speed=Math.min(v.speed,room/Math.max(dt,.0001));
  v.pos+=move;if(v.type==='commuter'&&v.speed<5)v.stopped+=dt;
  if(v.pos>=edge.length-.001&&canLeaveEdge(v,edge)){
    const next=v.route[v.edgeIndex+1];
    if(!next){v.done=true;v.active=false;v.end=state.simTime;if(v.type==='commuter'){const a=state.agents[v.agentId];a.lastTrip=v.end-v.start;a.lastStopped=v.stopped;}return;}
    v.edgeIndex++;v.pos=0;v.speed=Math.min(v.speed,edges[next].speed*v.pace);
  }
}

function updateTransit(){for(const t of state.transitTrips){if(!t.done&&state.simTime>=t.end){t.done=true;const a=state.agents[t.agentId];a.lastTrip=t.end-a.depart;a.lastStopped=0;}}}
function dayFinished(){return state.agents.every(a=>Number.isFinite(a.lastTrip));}

function updateSimulation(dt){
  state.simTime+=dt;activateVehicles();
  const active=state.vehicles.filter(v=>v.active&&!v.done).sort((a,b)=>b.edgeIndex-a.edgeIndex||b.pos-a.pos);for(const v of active)updateVehicle(v,dt);
  updateTransit();const stopped=state.vehicles.filter(v=>v.type==='commuter'&&v.active&&!v.done&&v.speed<5).length;state.maxStopped=Math.max(state.maxStopped,stopped);
  if(dayFinished()||state.simTime>=DAY_END)finishDay();
}

function collectMetrics(){
  const counts=modeCounts();const drivers=state.agents.filter(a=>a.mode==='drive');const riders=state.agents.filter(a=>a.mode==='transit');
  const driveTimes=drivers.map(a=>a.lastTrip).filter(Number.isFinite),transitTimes=riders.map(a=>a.lastTrip).filter(Number.isFinite),stops=drivers.map(a=>a.lastStopped).filter(Number.isFinite);
  return{day:state.day,tunnel:state.tunnelOpen,drivers:counts.drivers,riders:counts.riders,drive:mean(driveTimes),transit:mean(transitTimes),stopped:mean(stops),headway:state.currentHeadway,maxStopped:state.maxStopped};
}

function chooseSwitches(metrics){
  if(!Number.isFinite(metrics.drive)||!Number.isFinite(metrics.transit))return[];const gap=metrics.drive-metrics.transit;if(Math.abs(gap)<.05)return[];
  const slower=gap>0?'drive':'transit',adv=Math.abs(gap);const candidates=state.agents.filter(a=>a.mode===slower&&state.day-a.lastSwitchDay>SWITCH_COOLDOWN&&adv>a.inertia).sort((a,b)=>a.inertia-b.inertia||a.id-b.id);
  return candidates.slice(0,SWITCH_LIMIT).map(a=>a.id);
}
function applyPendingSwitches(){for(const id of state.pendingSwitches){const a=state.agents[id];a.mode=a.mode==='drive'?'transit':'drive';a.lastSwitchDay=state.day;}}

function finishDay(){
  state.dayRunning=false;state.paused=false;const m=collectMetrics();state.lastDay=m;state.history.push(m);state.pendingSwitches=chooseSwitches(m);updateStory(m,state.pendingSwitches.length);
  if(!state.pendingSwitches.length){if(state.tunnelOpen)state.stableAfter=m;else state.stableBefore=m;setStatus(state.tunnelOpen?'worse':'stable','Stable mode split');}else setStatus('switching',`${state.pendingSwitches.length} switch tomorrow`);
  $('runDayBtn').textContent='▶ Run next morning';$('tunnelBtn').disabled=state.tunnelOpen;applyPendingSwitches();renderUI();renderHistory();
  if(state.autoRun&&state.pendingSwitches.length){setTimeout(()=>{if(!state.autoRun)return;state.day++;createDay();},180);}else{state.autoRun=false;$('autoBtn').textContent='⏩ Run days until stable';}
}

function updateStory(m,n){
  const gap=m.drive-m.transit;const faster=gap<0?'Driving':'Transit';
  if(!state.tunnelOpen){
    if(n){$('storyTitle').textContent='The old street network is still settling.';$('storyText').textContent=`Driving averaged ${m.drive.toFixed(1)} minutes and transit ${m.transit.toFixed(1)}. ${faster} was faster, so ${n} commuter${n===1?'':'s'} will change modes tomorrow. The driving time came from actual queues at the three signals plus the mountain route.`;}
    else{$('storyTitle').textContent='The baseline has stabilized.';$('storyText').textContent=`At ${m.drivers} drivers and ${m.riders} transit riders, nobody has enough incentive to switch. Drivers averaged ${m.drive.toFixed(1)} minutes with ${m.stopped.toFixed(1)} minutes stopped; transit riders averaged ${m.transit.toFixed(1)} minutes. Now build the tunnel.`;}
    $('punchline').classList.remove('worse');$('punchline').textContent='The old-network equilibrium is now an observed result of cars, lights, cross traffic, and train schedules. Build the tunnel to perturb that system.';return;
  }
  const first=state.tunnelBuiltAfter!==null&&state.day===state.tunnelBuiltAfter+1;
  if(first){$('storyTitle').textContent='The tunnel changed the street network immediately.';$('storyText').textContent=`The mountain shortcut is physically open, but commuters began today with yesterday's modes. Driving averaged ${m.drive.toFixed(1)} minutes versus ${m.transit.toFixed(1)} for transit. ${n?n+' commuters will respond tomorrow':'Nobody switches yet'}.`;}
  else if(n){$('storyTitle').textContent='Behavior is feeding back into traffic.';$('storyText').textContent=`There are ${m.drivers} commuter cars plus background traffic. Driving averaged ${m.drive.toFixed(1)} minutes, with ${m.stopped.toFixed(1)} minutes stopped at queues and lights. Transit headway is now ${m.headway.toFixed(1)} minutes. ${n} commuter${n===1?'':'s'} move toward ${faster.toLowerCase()} tomorrow.`;}
  else{$('storyTitle').textContent='A post-tunnel equilibrium has emerged.';$('storyText').textContent=`Nobody is switching now. The final split is ${m.drivers} drivers / ${m.riders} transit riders: ${m.drive.toFixed(1)} minutes driving and ${m.transit.toFixed(1)} minutes on transit.`;}
  if(!n&&state.stableBefore){const before=(state.stableBefore.drive+state.stableBefore.transit)/2,after=(m.drive+m.transit)/2,delta=after-before;$('punchline').classList.toggle('worse',delta>0);$('punchline').textContent=delta>0?`Downs-Thomson effect achieved: after individual responses settle, the two-mode commute is about ${delta.toFixed(1)} minutes worse on average than the stable pre-tunnel system, despite the tunnel being a genuine physical shortcut.`:`This run did not produce a worse final equilibrium. The tunnel helped the road, but the behavioral/transit feedback was not strong enough under these settings to overturn that gain.`;}
}

function buildTunnel(){
  if(state.dayRunning||state.tunnelOpen)return;state.autoRun=false;state.tunnelOpen=true;state.tunnelBuiltAfter=state.history.length?state.day:0;state.lastDay=null;$('tunnelBtn').disabled=true;$('tunnelBtn').textContent='✓ Tunnel open';$('runDayBtn').textContent='▶ Run first tunnel morning';setStatus('switching','Tunnel open');$('storyTitle').textContent='The tunnel is open. Nobody has changed modes yet.';$('storyText').textContent='The next morning uses the same commuter choices but a different road graph: cars can travel straight through the mountain instead of climbing around it. Run the morning to see the immediate effect before behavior catches up.';renderUI();drawWorld();
}
function resetCity(){
  state.agents=makeAgents();state.day=1;state.tunnelOpen=false;state.tunnelBuiltAfter=null;state.dayRunning=false;state.paused=false;state.autoRun=false;state.speed=8;state.simTime=0;state.vehicles=[];state.transitTrips=[];state.trains=[];state.history=[];state.lastDay=null;state.pendingSwitches=[];state.selectedAgentId=0;state.currentHeadway=null;state.maxStopped=0;state.stableBefore=null;state.stableAfter=null;state.crossTraffic=Number($('crossTraffic').value);state.signalCycle=Number($('signalCycle').value);state.nextVehicleId=1;
  document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('active',Number(b.dataset.speed)===8));$('runDayBtn').textContent='▶ Run morning';$('autoBtn').textContent='⏩ Run days until stable';$('tunnelBtn').textContent='⛏ Build tunnel';$('tunnelBtn').disabled=false;$('storyTitle').textContent='Run the baseline morning.';$('storyText').textContent='Thirteen commuters currently drive and eighty-seven use transit. This default population is calibrated close to the old-network equilibrium; run the morning and let the street network verify it.';$('modeChange').innerHTML='<strong>Tomorrow:</strong> no decisions yet.';$('punchline').classList.remove('worse');$('punchline').textContent='The paradox has not happened yet. Establish the baseline, build the tunnel, then let commuters respond over multiple days.';setStatus('stable','Ready');renderUI();renderHistory();drawWorld();
}
function startAuto(){if(state.autoRun){state.autoRun=false;$('autoBtn').textContent='⏩ Run days until stable';return;}state.autoRun=true;$('autoBtn').textContent='■ Stop after this day';if(!state.dayRunning){if(state.lastDay||state.history.length)state.day++;createDay();}}
function runDayButton(){if(state.dayRunning){pauseDay();return;}if(state.paused){resumeDay();return;}if(state.lastDay||state.history.length)state.day++;createDay();}
function setStatus(kind,text){const c=$('statusChip');c.className=`status ${kind}`;c.textContent=text;}

function clockText(mins){const total=6*60+30+Math.round(mins);let h=Math.floor(total/60),m=total%60;const suffix=h>=12?'PM':'AM';h=((h-1)%12)+1;return`${h}:${String(m).padStart(2,'0')} ${suffix}`;}
function fmt(v){return Number.isFinite(v)?`${v.toFixed(1)} min`:'—';}
function currentMeasured(){if(!state.dayRunning&&state.lastDay)return state.lastDay;const d=state.agents.filter(a=>a.mode==='drive'&&Number.isFinite(a.lastTrip)),t=state.agents.filter(a=>a.mode==='transit'&&Number.isFinite(a.lastTrip));return{drive:mean(d.map(a=>a.lastTrip)),transit:mean(t.map(a=>a.lastTrip)),stopped:mean(d.map(a=>a.lastStopped).filter(Number.isFinite))};}
function renderUI(){
  const counts=modeCounts(),m=currentMeasured();$('dayTitle').textContent=`Day ${state.day} · ${state.tunnelOpen?'tunnel route':'mountain detour'}`;$('simClock').textContent=clockText(state.simTime);$('driverCount').textContent=counts.drivers;$('riderCount').textContent=counts.riders;$('driveTime').textContent=fmt(m.drive);$('transitTime').textContent=fmt(m.transit);$('queueDelay').textContent=fmt(m.stopped);$('headway').textContent=state.currentHeadway?`${state.currentHeadway.toFixed(1)} min`:'—';
  const active=state.vehicles.filter(v=>v.active&&!v.done);$('carsOnRoad').textContent=active.length;$('queueNow').textContent=active.filter(v=>v.type==='commuter'&&v.speed<5).length;$('maxQueue').textContent=state.maxStopped;$('crossCars').textContent=active.filter(v=>v.type==='cross').length;$('finishedTrips').textContent=`${state.agents.filter(a=>Number.isFinite(a.lastTrip)).length} / ${TOTAL}`;
  const verdict=$('heroVerdict');verdict.querySelector('span').textContent=state.tunnelOpen?'Tunnel era':'Before tunnel';verdict.querySelector('strong').textContent=`${counts.drivers} / ${counts.riders}`;verdict.querySelector('small').textContent='drive / transit';verdict.classList.toggle('worse',!!(state.stableAfter&&state.stableBefore&&((state.stableAfter.drive+state.stableAfter.transit)>(state.stableBefore.drive+state.stableBefore.transit))));
  if(state.lastDay&&state.pendingSwitches.length){const from=state.lastDay.drive>state.lastDay.transit?'drive':'transit',to=from==='drive'?'transit':'drive';$('modeChange').innerHTML=`<strong>Tomorrow:</strong> ${state.pendingSwitches.length} switch from ${from} to ${to}.`;}else if(state.lastDay)$('modeChange').innerHTML='<strong>Tomorrow:</strong> nobody currently wants to switch.';
  renderPeople();renderInspector();
}
function renderPeople(){const host=$('people');if(!host.childElementCount){for(const a of state.agents){const b=document.createElement('button');b.className='person';b.type='button';b.dataset.id=a.id;b.title=`Commuter #${a.id+1}`;b.addEventListener('click',()=>{state.selectedAgentId=a.id;renderPeople();renderInspector();});host.appendChild(b);}}[...host.children].forEach((el,i)=>{const a=state.agents[i];el.classList.toggle('drive',a.mode==='drive');el.classList.toggle('selected',a.id===state.selectedAgentId);});}
function renderInspector(){const a=state.agents[state.selectedAgentId]||state.agents[0];$('inspectTitle').textContent=`Commuter #${a.id+1}`;$('inspectHome').textContent=homeNames[a.home];$('inspectMode').textContent=a.mode==='drive'?'Drive':'Transit';$('inspectDepart').textContent=clockText(a.depart);$('inspectTrip').textContent=fmt(a.lastTrip);$('inspectStopped').textContent=a.mode==='drive'?fmt(a.lastStopped):'n/a';$('inspectInertia').textContent=`${a.inertia.toFixed(1)} min`;$('inspectDot').className=`person-dot ${a.mode}`;}

function pointOnEdge(edge,pos){const a=nodes[edge.from],b=nodes[edge.to],t=clamp(pos/edge.length,0,1);return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,angle:Math.atan2(b.y-a.y,b.x-a.x)};}
function drawRoad(edge,width=18,color='#344352'){const a=nodes[edge.from],b=nodes[edge.to];ctx.strokeStyle='rgba(0,0,0,.42)';ctx.lineWidth=width+6;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=1;ctx.setLineDash([8,10]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);}
function drawBuildings(){
  ctx.fillStyle='#14293a';ctx.strokeStyle='rgba(255,255,255,.06)';ctx.lineWidth=1;const blocks=[[35,78,120,72],[45,445,125,90],[285,70,88,72],[288,520,88,82],[455,505,110,88],[900,78,70,95],[1050,75,112,100],[1052,500,105,92]];for(const [x,y,w,h] of blocks){ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);for(let yy=y+14;yy<y+h-5;yy+=18)for(let xx=x+12;xx<x+w-5;xx+=24){ctx.fillStyle='rgba(255,209,102,.13)';ctx.fillRect(xx,yy,8,6);ctx.fillStyle='#14293a';}}
  ctx.fillStyle='rgba(126,230,173,.10)';for(const [x,y] of [[185,95],[185,555],[925,130],[935,535],[740,520]]){ctx.beginPath();ctx.arc(x,y,25,0,Math.PI*2);ctx.fill();}
}
function drawMountain(){ctx.fillStyle='#263b3d';ctx.strokeStyle='#49605f';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(430,316);ctx.lineTo(490,196);ctx.lineTo(560,108);ctx.lineTo(660,55);ctx.lineTo(760,106);ctx.lineTo(825,204);ctx.lineTo(875,316);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='rgba(255,255,255,.5)';ctx.font='700 11px system-ui';ctx.textAlign='center';ctx.fillText('MOUNTAIN',655,155);}
function drawSignal(id){const n=nodes[id],phase=signalPhase(id);ctx.save();ctx.translate(n.x,n.y);ctx.fillStyle='rgba(4,9,15,.88)';ctx.fillRect(-12,-12,24,24);ctx.fillStyle=phase==='EW'?'#68e6a1':'#ff6675';ctx.beginPath();ctx.arc(0,-5,3.8,0,Math.PI*2);ctx.fill();ctx.fillStyle=phase==='NS'?'#68e6a1':'#ff6675';ctx.beginPath();ctx.arc(0,5,3.8,0,Math.PI*2);ctx.fill();ctx.restore();}
function drawTrain(t){if(state.simTime<t.depart||state.simTime>t.end)return;const p=(state.simTime-t.depart)/(t.end-t.depart),x=85+(1045-85)*p,y=522-12*Math.sin(p*Math.PI);ctx.save();ctx.translate(x,y);ctx.fillStyle='#65dfc1';ctx.fillRect(-13,-5,26,10);ctx.fillStyle='#d7fff4';ctx.fillRect(-7,-3,5,3);ctx.fillRect(2,-3,5,3);ctx.restore();}
function drawVehicle(v){if(!v.active||v.done)return;const edge=edges[v.route[v.edgeIndex]],p=pointOnEdge(edge,v.pos);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillStyle=v.type==='commuter'?'#ffb35c':'#78a9ff';ctx.fillRect(-6,-3.3,12,6.6);ctx.fillStyle='rgba(245,248,251,.72)';ctx.fillRect(0,-2.2,3.3,4.4);ctx.restore();}
function drawWorld(){
  ctx.clearRect(0,0,canvas.width,canvas.height);const g=ctx.createLinearGradient(0,0,0,660);g.addColorStop(0,'#0b2030');g.addColorStop(1,'#0b1722');ctx.fillStyle=g;ctx.fillRect(0,0,1200,660);drawBuildings();drawMountain();
  const side=['AN_A','A_AS','AS_A','A_AN','BN_B','B_BS','BS_B','B_BN','DN_D','D_DS','DS_D','D_DN'];for(const id of side)drawRoad(edges[id],14,'#334555');drawRoad(edges.W_A,20,'#4a4e51');drawRoad(edges.A_B,20,'#4a4e51');for(const id of ['B_L1','L1_L2','L2_L3','L3_L4','L4_L5','L5_C'])drawRoad(edges[id],20,'#4a4e51');drawRoad(edges.C_D,20,'#4a4e51');drawRoad(edges.D_E,20,'#4a4e51');
  if(state.tunnelOpen){drawRoad(edges.B_C_T,20,'#5a4b48');const a=nodes.B,b=nodes.C;ctx.strokeStyle='#ff7c66';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.fillStyle='rgba(255,124,102,.9)';ctx.font='700 10px system-ui';ctx.fillText('TUNNEL',625,348);}else{ctx.strokeStyle='rgba(255,124,102,.22)';ctx.lineWidth=2;ctx.setLineDash([6,7]);ctx.beginPath();ctx.moveTo(nodes.B.x,nodes.B.y);ctx.lineTo(nodes.C.x,nodes.C.y);ctx.stroke();ctx.setLineDash([]);}
  ctx.strokeStyle='rgba(101,223,193,.35)';ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(75,526);ctx.lineTo(1110,526);ctx.stroke();ctx.strokeStyle='#65dfc1';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(75,526);ctx.lineTo(1110,526);ctx.stroke();ctx.fillStyle='#b8f5e7';ctx.font='700 10px system-ui';ctx.fillText('SUBURB STATION',120,548);ctx.fillText('DOWNTOWN STATION',1035,548);
  for(const id of ['A','B','D'])drawSignal(id);for(const t of state.trains)drawTrain(t);for(const v of state.vehicles)drawVehicle(v);
  ctx.fillStyle='rgba(245,248,251,.78)';ctx.font='700 11px system-ui';ctx.textAlign='left';ctx.fillText('SUBURBS',45,307);ctx.textAlign='right';ctx.fillText('DOWNTOWN',1160,307);ctx.textAlign='left';
}

function resizeHistory(){const rect=historyCanvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1,w=Math.max(320,Math.round(rect.width*dpr)),h=Math.max(220,Math.round(rect.height*dpr));if(historyCanvas.width!==w||historyCanvas.height!==h){historyCanvas.width=w;historyCanvas.height=h;}return{w:w/dpr,h:h/dpr,dpr};}
function renderHistory(){const{w,h,dpr}=resizeHistory();hctx.setTransform(1,0,0,1,0,0);hctx.clearRect(0,0,historyCanvas.width,historyCanvas.height);hctx.scale(dpr,dpr);const pad={l:38,r:16,t:16,b:30};hctx.font='9px system-ui';hctx.fillStyle='rgba(220,235,245,.65)';hctx.strokeStyle='rgba(255,255,255,.08)';hctx.lineWidth=1;const maxDay=Math.max(6,state.history.length),yMin=20,yMax=55,x=i=>pad.l+i/(maxDay-1)*(w-pad.l-pad.r),y=v=>pad.t+(yMax-v)/(yMax-yMin)*(h-pad.t-pad.b);for(let v=20;v<=55;v+=5){hctx.beginPath();hctx.moveTo(pad.l,y(v));hctx.lineTo(w-pad.r,y(v));hctx.stroke();hctx.fillText(`${v}m`,6,y(v)+3);}if(state.tunnelBuiltAfter!==null&&state.tunnelBuiltAfter>0){const idx=state.history.findIndex(d=>d.tunnel);if(idx>=0){hctx.strokeStyle='rgba(255,124,102,.65)';hctx.setLineDash([4,4]);hctx.beginPath();hctx.moveTo(x(idx),pad.t);hctx.lineTo(x(idx),h-pad.b);hctx.stroke();hctx.setLineDash([]);}}
  function line(key,color){hctx.strokeStyle=color;hctx.lineWidth=2.4;hctx.beginPath();let started=false;state.history.forEach((d,i)=>{if(!Number.isFinite(d[key]))return;const px=x(i),py=y(d[key]);if(!started){hctx.moveTo(px,py);started=true;}else hctx.lineTo(px,py);});hctx.stroke();state.history.forEach((d,i)=>{if(!Number.isFinite(d[key]))return;hctx.fillStyle=color;hctx.beginPath();hctx.arc(x(i),y(d[key]),3,0,Math.PI*2);hctx.fill();});}line('drive','#ffb35c');line('transit','#65dfc1');hctx.setTransform(1,0,0,1,0,0);
}

function frame(now){const realDt=Math.min(.05,(now-state.lastReal)/1000);state.lastReal=now;if(state.dayRunning&&!state.paused){let simDt=realDt*BASE_RATE*state.speed;while(simDt>0&&state.dayRunning){const step=Math.min(.035,simDt);updateSimulation(step);simDt-=step;}}renderUI();drawWorld();state.animationHandle=requestAnimationFrame(frame);}

$('runDayBtn').addEventListener('click',runDayButton);$('autoBtn').addEventListener('click',startAuto);$('tunnelBtn').addEventListener('click',buildTunnel);$('resetBtn').addEventListener('click',resetCity);
document.querySelectorAll('[data-speed]').forEach(b=>b.addEventListener('click',()=>{state.speed=Number(b.dataset.speed);document.querySelectorAll('[data-speed]').forEach(o=>o.classList.toggle('active',o===b));}));
$('crossTraffic').addEventListener('input',e=>{state.crossTraffic=Number(e.target.value);$('crossTrafficValue').textContent=`${state.crossTraffic.toFixed(2)}×`;});$('signalCycle').addEventListener('input',e=>{state.signalCycle=Number(e.target.value);$('signalCycleValue').textContent=`${state.signalCycle.toFixed(1)} min`;});
window.addEventListener('resize',renderHistory);

state.agents=makeAgents();renderPeople();renderUI();renderHistory();drawWorld();state.lastReal=performance.now();state.animationHandle=requestAnimationFrame(frame);
