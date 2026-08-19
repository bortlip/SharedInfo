'use strict';

const TOTAL = 100;
const INITIAL_DRIVERS = 37;
const DEPARTURE_WINDOW = 8;
const LOOP_FREE_FLOW = 34;
const TUNNEL_FREE_FLOW = 29;
const BOTTLENECK_FRACTION = 0.84;
const BOTTLENECK_HEADWAY = 0.85;
const SAFE_GAP = 0.10;
const TRANSIT_ACCESS = 6;
const TRANSIT_RIDE = 28;
const TRANSIT_EGRESS = 7.1;
const TRAIN_PHASE = 10;
const SWITCH_THRESHOLD = 0.25;
const MAX_SWITCHES_PER_DAY = 2;
const BASE_SIM_MINUTES_PER_SECOND = 2.5;
const MAX_DAY_MINUTES = 90;
const SEED = 7419;

const LOOP_POINTS = [[74,315],[170,315],[250,275],[305,192],[355,120],[430,79],[535,70],[632,99],[700,154],[746,230],[812,280],[930,292],[1027,292]];
const TUNNEL_POINTS = [[74,315],[170,315],[270,282],[360,259],[470,252],[585,253],[695,260],[812,280],[930,292],[1027,292]];
const RAIL_POINTS = [[78,417],[200,424],[350,430],[515,431],[685,427],[850,416],[1027,397]];

const $ = id => document.getElementById(id);
const canvas = $('worldCanvas');
const ctx = canvas.getContext('2d');
const historyCanvas = $('historyCanvas');
const historyCtx = historyCanvas.getContext('2d');

function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function shuffled(values, rng) {
  const a = values.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function mean(values) { return values.length ? values.reduce((a,b)=>a+b,0) / values.length : NaN; }
function fmtMinutes(v) { return Number.isFinite(v) ? `${v.toFixed(1)} min` : '—'; }
function modeCounts() {
  const drivers = state.agents.filter(a=>a.mode === 'drive').length;
  return { drivers, riders: TOTAL - drivers };
}

function makeAgents() {
  const rng = mulberry32(SEED);
  const agents = Array.from({length:TOTAL}, (_, id) => ({
    id,
    departure: rng() * DEPARTURE_WINDOW,
    mode: 'transit',
    lastTrip: null,
    lastSwitchDay: null,
    switching: false,
    status: 'waiting'
  }));
  const order = shuffled(agents.map(a=>a.id), rng);
  order.slice(0, INITIAL_DRIVERS).forEach(id => agents[id].mode = 'drive');
  return agents;
}

const state = {
  agents: makeAgents(),
  selectedAgentId: 0,
  tunnelOpen: false,
  tunnelBuiltDay: null,
  day: 1,
  dayRunning: false,
  autoRun: false,
  speed: 12,
  simTime: 0,
  cars: [],
  transitTrips: [],
  trains: [],
  gateNextRelease: 0,
  maxQueue: 0,
  currentQueue: 0,
  currentHeadway: null,
  history: [],
  lastDay: null,
  pendingSwitches: [],
  autoTimer: null,
  lastFrame: performance.now()
};

function transitHeadway(riders) {
  return clamp(31 - 0.35 * riders, 6, 22);
}

function nextTrainDeparture(stationArrival, headway) {
  const k = Math.ceil((stationArrival - TRAIN_PHASE) / headway);
  return TRAIN_PHASE + k * headway;
}

function routeFreeFlow() { return state.tunnelOpen ? TUNNEL_FREE_FLOW : LOOP_FREE_FLOW; }
function routePoints() { return state.tunnelOpen ? TUNNEL_POINTS : LOOP_POINTS; }

function polylineLengths(points) {
  const lengths = [0];
  let total = 0;
  for (let i=1;i<points.length;i++) {
    total += Math.hypot(points[i][0]-points[i-1][0], points[i][1]-points[i-1][1]);
    lengths.push(total);
  }
  return { lengths, total };
}

function pointOnPolyline(points, fraction) {
  const {lengths,total} = polylineLengths(points);
  const target = clamp(fraction,0,1) * total;
  for (let i=1;i<points.length;i++) {
    if (target <= lengths[i]) {
      const seg = lengths[i]-lengths[i-1] || 1;
      const t = (target-lengths[i-1]) / seg;
      return {
        x: points[i-1][0] + (points[i][0]-points[i-1][0])*t,
        y: points[i-1][1] + (points[i][1]-points[i-1][1])*t,
        angle: Math.atan2(points[i][1]-points[i-1][1], points[i][0]-points[i-1][0])
      };
    }
  }
  const a=points[points.length-2], b=points[points.length-1];
  return {x:b[0],y:b[1],angle:Math.atan2(b[1]-a[1],b[0]-a[0])};
}

function drawPolyline(g, points) {
  g.beginPath();
  g.moveTo(points[0][0],points[0][1]);
  for(let i=1;i<points.length;i++) g.lineTo(points[i][0],points[i][1]);
}

function resetAgentDayState() {
  state.agents.forEach(a=>{a.lastTrip=null;a.switching=false;a.status='waiting';});
  state.pendingSwitches=[];
}

function createDay() {
  if (state.dayRunning) return;
  clearTimeout(state.autoTimer);
  state.autoTimer = null;
  resetAgentDayState();
  state.simTime = 0;
  state.maxQueue = 0;
  state.currentQueue = 0;
  state.gateNextRelease = 0;
  const counts = modeCounts();
  state.currentHeadway = transitHeadway(counts.riders);
  const freeFlow = routeFreeFlow();

  state.cars = state.agents.filter(a=>a.mode==='drive').map(a=>({
    agentId:a.id,
    depart:a.departure,
    distance:0,
    active:false,
    done:false,
    crossedGate:false,
    waiting:false,
    finish:null,
    freeFlow
  }));

  state.transitTrips = state.agents.filter(a=>a.mode==='transit').map(a=>{
    const stationArrival = a.departure + TRANSIT_ACCESS;
    const trainDeparture = nextTrainDeparture(stationArrival,state.currentHeadway);
    const finish = trainDeparture + TRANSIT_RIDE + TRANSIT_EGRESS;
    return {agentId:a.id,homeDeparture:a.departure,stationArrival,trainDeparture,finish,done:false};
  });

  const firstTrain = TRAIN_PHASE + Math.floor((0-TRAIN_PHASE)/state.currentHeadway)*state.currentHeadway;
  state.trains=[];
  for(let t=firstTrain;t<=MAX_DAY_MINUTES;t+=state.currentHeadway) {
    if(t+TRANSIT_RIDE>=0) state.trains.push({depart:t});
  }

  state.dayRunning = true;
  state.lastFrame = performance.now();
  setStatus('running','Morning in progress');
  $('runDayBtn').textContent='❚❚ Pause morning';
  $('tunnelBtn').disabled=true;
  renderUI();
}

function pauseDay() {
  state.dayRunning=false;
  state.autoRun=false;
  setStatus('stable','Paused');
  $('runDayBtn').textContent='▶ Resume morning';
  $('autoBtn').textContent='⏩ Run until stable';
  renderUI();
}

function resumeDay() {
  state.dayRunning=true;
  state.lastFrame=performance.now();
  setStatus('running','Morning in progress');
  $('runDayBtn').textContent='❚❚ Pause morning';
}

function currentQueueCars() {
  return state.cars.filter(c=>c.active&&!c.done&&!c.crossedGate&&c.waiting).length;
}

function advanceTraffic(dt) {
  const t = state.simTime;
  const routeLen = routeFreeFlow();
  const gateDist = routeLen * BOTTLENECK_FRACTION;

  state.cars.forEach(car=>{
    if(!car.active && !car.done && t >= car.depart) {
      car.active=true;
      state.agents[car.agentId].status='driving';
    }
    car.waiting=false;
  });

  const active = state.cars.filter(c=>c.active&&!c.done).sort((a,b)=>b.distance-a.distance || a.depart-b.depart);
  let leader = null;
  for(const car of active) {
    let desired = car.distance + dt;
    if(leader) desired=Math.min(desired, leader.distance-SAFE_GAP);

    if(!car.crossedGate && desired>=gateDist) {
      const leaderClear = !leader || leader.distance-gateDist>=SAFE_GAP;
      if(t>=state.gateNextRelease && leaderClear) {
        car.crossedGate=true;
        state.gateNextRelease=t+BOTTLENECK_HEADWAY;
        desired=Math.max(car.distance,Math.min(desired,gateDist+0.02));
      } else {
        desired=Math.min(desired,gateDist-0.001);
        car.waiting=true;
      }
    } else if(!car.crossedGate && leader && desired<=car.distance+0.0001 && gateDist-car.distance<6) {
      car.waiting=true;
    }

    car.distance=Math.max(car.distance,desired);
    if(car.distance>=routeLen) {
      car.distance=routeLen;
      car.done=true;
      car.active=false;
      car.finish=t;
      const agent=state.agents[car.agentId];
      agent.lastTrip=car.finish-car.depart;
      agent.status='arrived';
    }
    leader=car;
  }

  state.currentQueue=currentQueueCars();
  state.maxQueue=Math.max(state.maxQueue,state.currentQueue);
}

function advanceTransit() {
  const t=state.simTime;
  for(const trip of state.transitTrips) {
    const agent=state.agents[trip.agentId];
    if(trip.done) continue;
    if(t<trip.homeDeparture) agent.status='waiting';
    else if(t<trip.stationArrival) agent.status='walking to station';
    else if(t<trip.trainDeparture) agent.status='waiting for train';
    else if(t<trip.trainDeparture+TRANSIT_RIDE) agent.status='on train';
    else if(t<trip.finish) agent.status='walking downtown';
    else {
      trip.done=true;
      agent.status='arrived';
      agent.lastTrip=trip.finish-trip.homeDeparture;
    }
  }
}

function advanceSimulation(minutes) {
  let remaining=minutes;
  while(remaining>0 && state.dayRunning) {
    const dt=Math.min(0.06,remaining);
    state.simTime+=dt;
    advanceTraffic(dt);
    advanceTransit();
    remaining-=dt;
    if(dayFinished() || state.simTime>=MAX_DAY_MINUTES) finishDay();
  }
}

function dayFinished() {
  return state.cars.every(c=>c.done) && state.transitTrips.every(t=>t.done);
}

function measuredDayMetrics() {
  const driveTrips=state.agents.filter(a=>a.mode==='drive'&&Number.isFinite(a.lastTrip)).map(a=>a.lastTrip);
  const transitTrips=state.agents.filter(a=>a.mode==='transit'&&Number.isFinite(a.lastTrip)).map(a=>a.lastTrip);
  const all=driveTrips.concat(transitTrips);
  const free=routeFreeFlow();
  return {
    day:state.day,
    tunnel:state.tunnelOpen,
    drivers:state.cars.length,
    riders:state.transitTrips.length,
    drive:mean(driveTrips),
    transit:mean(transitTrips),
    average:mean(all),
    headway:state.currentHeadway,
    queueDelay:Number.isFinite(mean(driveTrips))?Math.max(0,mean(driveTrips)-free):NaN,
    maxQueue:state.maxQueue
  };
}

function chooseSwitches(metrics) {
  const diff=metrics.drive-metrics.transit;
  if(!Number.isFinite(diff)||Math.abs(diff)<=SWITCH_THRESHOLD) return [];
  const slower=diff>0?'drive':'transit';
  const candidates=state.agents.filter(a=>a.mode===slower).sort((a,b)=>{
    const sinceA=a.lastSwitchDay===null?999:state.day-a.lastSwitchDay;
    const sinceB=b.lastSwitchDay===null?999:state.day-b.lastSwitchDay;
    if(sinceA!==sinceB)return sinceB-sinceA;
    return a.id-b.id;
  });
  return candidates.slice(0,MAX_SWITCHES_PER_DAY);
}

function finishDay() {
  if(!state.dayRunning) return;
  state.dayRunning=false;
  const metrics=measuredDayMetrics();
  state.lastDay=metrics;
  state.history.push(metrics);
  const switching=chooseSwitches(metrics);
  state.pendingSwitches=switching.map(a=>a.id);
  switching.forEach(a=>a.switching=true);

  const gap=Math.abs(metrics.drive-metrics.transit);
  if(switching.length) {
    const from=switching[0].mode;
    const to=from==='drive'?'transit':'drive';
    setStatus('switching',`${switching.length} switching tomorrow`);
    $('modeChange').innerHTML=`<strong>Tomorrow:</strong> ${switching.length} commuter${switching.length===1?'':'s'} switch${switching.length===1?'es':''} from ${from} to ${to}; today's average gap was ${gap.toFixed(1)} minutes.`;
  } else {
    setStatus(state.tunnelOpen?'worse':'stable','Stable mode split');
    $('modeChange').innerHTML=`<strong>Tomorrow:</strong> nobody switches; the observed modes are within ${SWITCH_THRESHOLD.toFixed(2)} minutes.`;
  }

  updateStory(metrics,switching.length);
  $('runDayBtn').textContent='▶ Run next morning';
  $('tunnelBtn').disabled=state.tunnelOpen;
  applyPendingSwitchesForTomorrow();
  renderUI();
  renderHistory();

  if(state.autoRun && switching.length) {
    state.autoTimer=setTimeout(()=>{
      state.day+=1;
      createDay();
    },220);
  } else {
    state.autoRun=false;
    $('autoBtn').textContent='⏩ Run until stable';
  }
}

function applyPendingSwitchesForTomorrow() {
  for(const id of state.pendingSwitches) {
    const a=state.agents[id];
    a.mode=a.mode==='drive'?'transit':'drive';
    a.lastSwitchDay=state.day;
  }
}

function updateStory(metrics,switchCount) {
  const gap=metrics.drive-metrics.transit;
  const roadFaster=gap<0;
  if(!state.tunnelOpen) {
    if(switchCount===0) {
      $('storyTitle').textContent='The baseline is stable.';
      $('storyText').textContent=`The road produced an average ${metrics.drive.toFixed(1)}-minute trip, including a ${metrics.queueDelay.toFixed(1)}-minute average queue penalty. Transit riders averaged ${metrics.transit.toFixed(1)} minutes from their individual station waits and train trips. Neither mode has a meaningful advantage.`;
    } else {
      $('storyTitle').textContent='The old city is still finding its balance.';
      $('storyText').textContent=`${roadFaster?'Driving':'Transit'} was faster by ${Math.abs(gap).toFixed(1)} minutes, so a couple of commuters will try it tomorrow. Repeated mornings let the mode split emerge instead of solving for it algebraically.`;
    }
    $('punchline').classList.remove('worse');
    $('punchline').textContent='The baseline has been measured. Build the tunnel, then run more mornings and watch both the road queue and train frequency respond.';
    return;
  }

  const firstTunnelDay=state.tunnelBuiltDay===state.day;
  if(firstTunnelDay) {
    $('storyTitle').textContent='The tunnel really works — today.';
    $('storyText').textContent=`The same commuters got a physically shorter route. Drivers averaged ${metrics.drive.toFixed(1)} minutes versus ${metrics.transit.toFixed(1)} on transit, so ${switchCount||'no'} rider${switchCount===1?'':'s'} ${switchCount?'will try driving tomorrow':'switches yet'}. The important part is what happens after that response.`;
  } else if(switchCount) {
    $('storyTitle').textContent='The shortcut is recruiting more traffic.';
    $('storyText').textContent=`There are now ${metrics.drivers} cars. Their queue reached ${metrics.maxQueue} vehicles and added ${metrics.queueDelay.toFixed(1)} minutes on average. Meanwhile ${metrics.riders} transit riders receive a ${metrics.headway.toFixed(1)}-minute headway. ${switchCount} more commuter${switchCount===1?'':'s'} will move toward ${roadFaster?'driving':'transit'} tomorrow.`;
  } else {
    const before=state.history.find(h=>!h.tunnel && Math.abs(h.drive-h.transit)<=SWITCH_THRESHOLD+0.2);
    $('storyTitle').textContent='A new equilibrium has emerged.';
    $('storyText').textContent=`Nobody is scheduled to change modes. The tunnel route is still five free-flow minutes shorter, but ${metrics.drivers} cars now create enough bottleneck delay that driving averages ${metrics.drive.toFixed(1)} minutes. With only ${metrics.riders} riders, transit averages ${metrics.transit.toFixed(1)} minutes.`;
    if(before) {
      const beforeAvg=(before.drive+before.transit)/2;
      const afterAvg=(metrics.drive+metrics.transit)/2;
      const delta=afterAvg-beforeAvg;
      $('punchline').classList.toggle('worse',delta>0);
      $('punchline').textContent=delta>0?`Paradox achieved: the stable post-tunnel commute is about ${delta.toFixed(1)} minutes slower than the stable pre-tunnel commute, even though the physical road shortcut remains five minutes shorter.`:'This parameter set did not produce a worse equilibrium on this run. Change in behavior matters more than the existence of the tunnel itself.';
    }
  }
}

function buildTunnel() {
  if(state.dayRunning||state.tunnelOpen)return;
  clearTimeout(state.autoTimer);state.autoTimer=null;
  state.autoRun=false;
  if(!state.lastDay && state.history.length===0) {
    $('storyTitle').textContent='You can build it now, but measure the baseline first.';
    $('storyText').textContent='The sim allows premature infrastructure enthusiasm, naturally, but running the old corridor once gives you something to compare against.';
  }
  state.tunnelOpen=true;
  state.tunnelBuiltDay=state.history.length?state.day+1:state.day;
  state.lastDay=null;
  state.simTime=0;state.cars=[];state.transitTrips=[];state.trains=[];state.currentHeadway=null;state.maxQueue=0;state.currentQueue=0;
  resetAgentDayState();
  $('tunnelBtn').disabled=true;
  $('tunnelBtn').textContent='✓ Tunnel built';
  $('runDayBtn').textContent='▶ Run first tunnel morning';
  setStatus('switching','Tunnel open');
  $('storyTitle').textContent='The five-minute shortcut is open.';
  $('storyText').textContent='No commuter has changed modes yet. Run the next morning with the same people and watch the tunnel change only the physical route first; behavioral feedback comes afterward.';
  renderUI();
  drawWorld();
}

function resetCity() {
  clearTimeout(state.autoTimer);state.autoTimer=null;
  state.agents=makeAgents();state.selectedAgentId=0;state.tunnelOpen=false;state.tunnelBuiltDay=null;state.day=1;state.dayRunning=false;state.autoRun=false;state.speed=12;state.simTime=0;state.cars=[];state.transitTrips=[];state.trains=[];state.currentHeadway=null;state.history=[];state.lastDay=null;state.pendingSwitches=[];state.maxQueue=0;state.currentQueue=0;
  document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('active',Number(b.dataset.speed)===12));
  $('runDayBtn').textContent='▶ Run morning';$('autoBtn').textContent='⏩ Run until stable';$('tunnelBtn').textContent='⛏ Build tunnel';$('tunnelBtn').disabled=false;
  $('storyTitle').textContent='Run the baseline morning.';
  $('storyText').textContent='The city begins near an established mode split: 37 people drive and 63 use transit. Run the morning to see whether those choices are actually stable when travel times are produced by the traffic and timetable simulations.';
  $('modeChange').innerHTML='<strong>Tomorrow:</strong> no decisions yet.';
  $('punchline').classList.remove('worse');$('punchline').textContent='The paradox has not happened yet. That is what the tunnel button is for.';
  setStatus('stable','Ready');renderPeople();renderUI();renderHistory();drawWorld();
}

function setStatus(kind,text) {
  const chip=$('statusChip');chip.className=`status ${kind}`;chip.textContent=text;
}

function startAuto() {
  if(state.autoRun){state.autoRun=false;$('autoBtn').textContent='⏩ Run until stable';return;}
  state.autoRun=true;$('autoBtn').textContent='■ Stop after this day';
  if(!state.dayRunning) {
    if(state.lastDay||state.history.length){state.day+=1;}
    createDay();
  }
}

function runDayButton() {
  if(state.dayRunning){pauseDay();return;}
  if(state.cars.length && !dayFinished() && state.simTime>0){resumeDay();return;}
  if(state.lastDay||state.history.length) state.day+=1;
  createDay();
}

function clockText(mins) {
  const total=6*60+30+Math.round(mins);
  const h=Math.floor(total/60),m=total%60;
  return `${h}:${String(m).padStart(2,'0')} AM`;
}

function visibleAverages() {
  if(!state.dayRunning&&state.lastDay)return {drive:state.lastDay.drive,transit:state.lastDay.transit};
  const drive=state.cars.filter(c=>c.done&&Number.isFinite(state.agents[c.agentId].lastTrip)).map(c=>state.agents[c.agentId].lastTrip);
  const transit=state.transitTrips.filter(t=>t.done&&Number.isFinite(state.agents[t.agentId].lastTrip)).map(t=>state.agents[t.agentId].lastTrip);
  return {drive:mean(drive),transit:mean(transit)};
}

function renderUI() {
  const counts=modeCounts();
  const measuredCounts=(!state.dayRunning&&state.lastDay)?state.lastDay:counts;
  const visible=visibleAverages();
  $('dayTitle').textContent=`Day ${state.day} · ${state.tunnelOpen?'tunnel corridor':'mountain detour'}`;
  $('simClock').textContent=clockText(state.simTime);
  $('driverCount').textContent=measuredCounts.drivers;$('riderCount').textContent=measuredCounts.riders;
  $('driveTime').textContent=fmtMinutes(visible.drive);$('transitTime').textContent=fmtMinutes(visible.transit);
  $('headway').textContent=state.currentHeadway?`${state.currentHeadway.toFixed(1)} min`:'—';
  $('queueDelay').textContent=Number.isFinite(visible.drive)?`${Math.max(0,visible.drive-routeFreeFlow()).toFixed(1)} min`:'—';
  $('carsOnRoad').textContent=state.cars.filter(c=>c.active&&!c.done).length;
  $('queueNow').textContent=state.currentQueue;$('maxQueue').textContent=state.maxQueue;
  const finished=state.agents.filter(a=>Number.isFinite(a.lastTrip)).length;$('finishedTrips').textContent=`${finished} / ${TOTAL}`;
  const verdict=$('heroVerdict');verdict.classList.toggle('worse',state.tunnelOpen&&state.lastDay&&state.pendingSwitches.length===0);
  verdict.querySelector('span').textContent=state.tunnelOpen?'Tunnel era':'Before the tunnel';
  verdict.querySelector('strong').textContent=`${counts.drivers} / ${counts.riders}`;verdict.querySelector('small').textContent='drive / transit';
  renderPeople();renderInspector();
}

function renderPeople() {
  const host=$('people');
  if(!host.childElementCount) {
    state.agents.forEach(a=>{
      const b=document.createElement('button');b.className='person';b.type='button';b.title=`Commuter #${a.id+1}`;b.dataset.id=a.id;b.addEventListener('click',()=>{state.selectedAgentId=a.id;renderPeople();renderInspector();});host.appendChild(b);
    });
  }
  [...host.children].forEach((el,i)=>{
    const a=state.agents[i];el.className=`person ${a.mode}${a.switching?' switching':''}${state.selectedAgentId===i?' selected':''}`;
  });
}

function renderInspector() {
  const a=state.agents[state.selectedAgentId];if(!a)return;
  $('inspectTitle').textContent=`Commuter #${a.id+1}`;
  const mode=$('inspectMode');mode.className=`person-mode ${a.mode}`;mode.textContent=a.mode;
  $('inspectDeparture').textContent=clockText(a.departure);
  $('inspectTrip').textContent=Number.isFinite(a.lastTrip)?fmtMinutes(a.lastTrip):'not finished';
  $('inspectSwitch').textContent=a.lastSwitchDay===null?'never':`day ${a.lastSwitchDay}`;
  $('inspectStatus').textContent=a.status;
}

function resizeCanvasToDisplay(canvasEl,g) {
  const rect=canvasEl.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
  const w=Math.max(320,Math.round(rect.width*dpr)),h=Math.max(180,Math.round(rect.height*dpr));
  if(canvasEl.width!==w||canvasEl.height!==h){canvasEl.width=w;canvasEl.height=h;}
  g.setTransform(dpr,0,0,dpr,0,0);return {w:w/dpr,h:h/dpr,dpr};
}

function drawWorld() {
  const {w,h}=resizeCanvasToDisplay(canvas,ctx);
  const sx=w/1100,sy=h/540;
  ctx.save();ctx.scale(sx,sy);ctx.clearRect(0,0,1100,540);
  const sky=ctx.createLinearGradient(0,0,0,540);sky.addColorStop(0,'#102d3d');sky.addColorStop(.55,'#0c2533');sky.addColorStop(1,'#10271f');ctx.fillStyle=sky;ctx.fillRect(0,0,1100,540);

  ctx.fillStyle='rgba(75,112,91,.27)';for(let i=0;i<18;i++){const x=(i*83+41)%1100,y=330+(i*47)%180;ctx.beginPath();ctx.arc(x,y,18+(i%4)*7,0,Math.PI*2);ctx.fill();}
  ctx.fillStyle='#314954';ctx.beginPath();ctx.moveTo(330,272);ctx.lineTo(490,73);ctx.lineTo(565,126);ctx.lineTo(650,72);ctx.lineTo(778,275);ctx.closePath();ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.07)';ctx.beginPath();ctx.moveTo(490,73);ctx.lineTo(565,126);ctx.lineTo(522,138);ctx.closePath();ctx.fill();

  const drawRoad=(points,color,width,alpha=1)=>{ctx.save();ctx.globalAlpha=alpha;drawPolyline(ctx,points);ctx.strokeStyle='rgba(2,7,12,.72)';ctx.lineWidth=width+10;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();drawPolyline(ctx,points);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();ctx.setLineDash([5,10]);drawPolyline(ctx,points);ctx.strokeStyle='rgba(255,244,210,.55)';ctx.lineWidth=1.5;ctx.stroke();ctx.restore();};
  drawRoad(LOOP_POINTS,state.tunnelOpen?'#6f7278':'#b77c47',13,state.tunnelOpen?.46:1);
  if(state.tunnelOpen)drawRoad(TUNNEL_POINTS,'#d89555',14,1);

  drawPolyline(ctx,RAIL_POINTS);ctx.strokeStyle='rgba(0,0,0,.55)';ctx.lineWidth=13;ctx.stroke();drawPolyline(ctx,RAIL_POINTS);ctx.strokeStyle='#4fbba4';ctx.lineWidth=6;ctx.stroke();ctx.setLineDash([2,8]);drawPolyline(ctx,RAIL_POINTS);ctx.strokeStyle='rgba(225,255,246,.65)';ctx.lineWidth=1.2;ctx.stroke();ctx.setLineDash([]);

  const gate=pointOnPolyline(routePoints(),BOTTLENECK_FRACTION);ctx.save();ctx.translate(gate.x,gate.y);ctx.rotate(gate.angle);ctx.fillStyle='rgba(255,138,152,.92)';ctx.fillRect(-4,-18,8,36);ctx.fillStyle='#fff';ctx.font='800 9px system-ui';ctx.textAlign='center';ctx.rotate(-gate.angle);ctx.fillText('DOWNTOWN MERGE',0,-25);ctx.restore();

  ctx.fillStyle='rgba(7,17,31,.82)';ctx.strokeStyle='rgba(255,255,255,.15)';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(26,270,112,83,12);ctx.fill();ctx.stroke();ctx.fillStyle='#edf5f8';ctx.font='800 12px system-ui';ctx.fillText('SUBURBS',48,337);
  for(let i=0;i<7;i++){ctx.fillStyle=i%2?'#9fb7c4':'#6d8b99';ctx.fillRect(38+i*13,286-(i%3)*5,10,28+(i%3)*5);}
  ctx.fillStyle='rgba(7,17,31,.82)';ctx.beginPath();ctx.roundRect(986,238,92,105,12);ctx.fill();ctx.stroke();for(let i=0;i<5;i++){ctx.fillStyle=i%2?'#8aa8b8':'#567487';ctx.fillRect(996+i*14,258-(i%3)*14,11,57+(i%3)*14);}ctx.fillStyle='#edf5f8';ctx.fillText('DOWNTOWN',997,333);

  if(state.tunnelOpen){ctx.fillStyle='rgba(255,202,117,.12)';ctx.strokeStyle='rgba(255,202,117,.65)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(536,253,68,20,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#ffd99d';ctx.font='800 10px system-ui';ctx.fillText('TUNNEL',512,257);}
  else{ctx.fillStyle='#a8b8bf';ctx.font='800 9px system-ui';ctx.fillText('5-MINUTE DETOUR',487,48);}

  const free=routeFreeFlow();
  for(const car of state.cars) {
    if(!car.active||car.done)continue;
    const p=pointOnPolyline(routePoints(),car.distance/free);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillStyle=car.waiting?'#ff8a98':'#ffb35c';ctx.fillRect(-5,-3,10,6);ctx.fillStyle='rgba(15,25,31,.8)';ctx.fillRect(-2.6,-2.2,4.6,4.4);ctx.restore();
  }

  const t=state.simTime;
  for(const train of state.trains) {
    const progress=(t-train.depart)/TRANSIT_RIDE;if(progress<0||progress>1)continue;
    const p=pointOnPolyline(RAIL_POINTS,progress);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillStyle='#65dfc1';ctx.fillRect(-13,-5,26,10);ctx.fillStyle='#dffff7';ctx.fillRect(-8,-3,5,3);ctx.fillRect(1,-3,5,3);ctx.restore();
  }

  ctx.restore();
}

function renderHistory() {
  const {w,h}=resizeCanvasToDisplay(historyCanvas,historyCtx);const g=historyCtx;g.clearRect(0,0,w,h);
  const pad={l:42,r:18,t:18,b:34};g.strokeStyle='rgba(255,255,255,.08)';g.fillStyle='rgba(225,235,242,.66)';g.font='9px system-ui';
  const minY=35,maxY=60;const x=i=>state.history.length<=1?pad.l+(w-pad.l-pad.r)/2:pad.l+i/(state.history.length-1)*(w-pad.l-pad.r);const y=v=>pad.t+(maxY-v)/(maxY-minY)*(h-pad.t-pad.b);
  for(let v=35;v<=60;v+=5){g.beginPath();g.moveTo(pad.l,y(v));g.lineTo(w-pad.r,y(v));g.stroke();g.fillText(`${v}m`,6,y(v)+3);}
  if(!state.history.length){g.textAlign='center';g.fillStyle='rgba(225,235,242,.45)';g.font='11px system-ui';g.fillText('Run a morning to start the history.',w/2,h/2);return;}
  const css=getComputedStyle(document.documentElement),drive=css.getPropertyValue('--drive').trim(),transit=css.getPropertyValue('--transit').trim();
  const line=(key,color)=>{g.beginPath();state.history.forEach((d,i)=>{const px=x(i),py=y(d[key]);i?g.lineTo(px,py):g.moveTo(px,py);});g.strokeStyle=color;g.lineWidth=2.5;g.stroke();state.history.forEach((d,i)=>{g.beginPath();g.arc(x(i),y(d[key]),3.5,0,Math.PI*2);g.fillStyle=color;g.fill();});};line('drive',drive);line('transit',transit);
  g.textAlign='center';g.font='8px system-ui';state.history.forEach((d,i)=>{g.fillStyle='rgba(225,235,242,.6)';g.fillText(`D${d.day}`,x(i),h-17);g.fillStyle=d.tunnel?'rgba(255,202,117,.8)':'rgba(225,235,242,.42)';g.fillText(`${d.drivers} cars`,x(i),h-6);});
}

function animationLoop(now) {
  const realDt=Math.min(.05,(now-state.lastFrame)/1000);state.lastFrame=now;
  if(state.dayRunning) advanceSimulation(realDt*BASE_SIM_MINUTES_PER_SECOND*state.speed);
  drawWorld();renderUI();requestAnimationFrame(animationLoop);
}

$('resetBtn').addEventListener('click',resetCity);
$('runDayBtn').addEventListener('click',runDayButton);
$('autoBtn').addEventListener('click',startAuto);
$('tunnelBtn').addEventListener('click',buildTunnel);
document.querySelectorAll('[data-speed]').forEach(btn=>btn.addEventListener('click',()=>{state.speed=Number(btn.dataset.speed);document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('active',b===btn));}));
window.addEventListener('resize',()=>{drawWorld();renderHistory();});

renderPeople();renderUI();renderHistory();drawWorld();requestAnimationFrame(animationLoop);
