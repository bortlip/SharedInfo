'use strict';

const TOTAL = 100;
const BASE_DIRECT_DRIVE = 20;
const DETOUR = 5;
const CONGESTION_PER_DRIVER = 0.50;
const TRANSIT_BASE = 35;
const TRANSIT_FEEDBACK = 0.25;

const state = {
  tunnelOpen: false,
  drivers: 40,
  running: false,
  timer: null,
  phase: 'old-equilibrium'
};

const $ = id => document.getElementById(id);
const commuterEls = [];

function driveCost(drivers, tunnelOpen = state.tunnelOpen) {
  return BASE_DIRECT_DRIVE + (tunnelOpen ? 0 : DETOUR) + CONGESTION_PER_DRIVER * drivers;
}

function transitCost(drivers) {
  return TRANSIT_BASE + TRANSIT_FEEDBACK * drivers;
}

function averageCost(drivers, tunnelOpen = state.tunnelOpen) {
  const transit = TOTAL - drivers;
  return (drivers * driveCost(drivers, tunnelOpen) + transit * transitCost(drivers)) / TOTAL;
}

function equilibriumDrivers(tunnelOpen = state.tunnelOpen) {
  const roadBase = BASE_DIRECT_DRIVE + (tunnelOpen ? 0 : DETOUR);
  return Math.max(0, Math.min(TOTAL, (TRANSIT_BASE - roadBase) / (CONGESTION_PER_DRIVER - TRANSIT_FEEDBACK)));
}

function createCommuters() {
  const host = $('commuters');
  for (let i = 0; i < TOTAL; i++) {
    const dot = document.createElement('span');
    dot.className = 'commuter';
    dot.setAttribute('aria-hidden', 'true');
    host.appendChild(dot);
    commuterEls.push(dot);
  }
}

function setPhase(phase) {
  state.phase = phase;
  const chip = $('statusChip');
  chip.className = 'status';

  if (phase === 'old-equilibrium') {
    $('sceneTitle').textContent = 'Before the tunnel: a stable split';
    chip.textContent = 'Nash equilibrium';
    chip.classList.add('old');
  } else if (phase === 'shock') {
    $('sceneTitle').textContent = 'The tunnel opens: driving suddenly wins';
    chip.textContent = 'Not an equilibrium';
    chip.classList.add('shock');
  } else if (phase === 'adjusting') {
    $('sceneTitle').textContent = 'Commuters respond to the faster choice';
    chip.textContent = 'Adapting';
    chip.classList.add('moving');
  } else if (phase === 'new-equilibrium') {
    $('sceneTitle').textContent = 'After adaptation: the paradox appears';
    chip.textContent = 'Worse equilibrium';
    chip.classList.add('worse');
  } else {
    $('sceneTitle').textContent = 'Manual mode split';
    chip.textContent = 'Explore';
    chip.classList.add('moving');
  }
}

function stopRunning() {
  state.running = false;
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
  $('adaptBtn').textContent = '▶ Let commuters adapt';
}

function fasterChoice() {
  const drive = driveCost(state.drivers);
  const transit = transitCost(state.drivers);
  if (Math.abs(drive - transit) < 0.001) return 'Neither';
  return drive < transit ? 'Driving' : 'Transit';
}

function nextDriverCount() {
  const drive = driveCost(state.drivers);
  const transit = transitCost(state.drivers);
  if (Math.abs(drive - transit) < 0.001) return state.drivers;
  return Math.max(0, Math.min(TOTAL, state.drivers + (drive < transit ? 1 : -1)));
}

function stepOnce() {
  const next = nextDriverCount();
  if (next === state.drivers) {
    stopRunning();
    if (state.tunnelOpen && Math.abs(state.drivers - equilibriumDrivers(true)) < 0.001) setPhase('new-equilibrium');
    render();
    return false;
  }
  state.drivers = next;
  $('driverSlider').value = state.drivers;
  if (state.tunnelOpen) setPhase('adjusting');
  render();
  if (Math.abs(driveCost(state.drivers) - transitCost(state.drivers)) < 0.001) {
    stopRunning();
    setPhase(state.tunnelOpen ? 'new-equilibrium' : 'old-equilibrium');
    render();
    return false;
  }
  return true;
}

function runAdaptation() {
  if (state.running) {
    stopRunning();
    render();
    return;
  }
  state.running = true;
  setPhase('adjusting');
  $('adaptBtn').textContent = '❚❚ Pause adaptation';
  state.timer = setInterval(stepOnce, 150);
  render();
}

function resetStory() {
  stopRunning();
  state.tunnelOpen = false;
  state.drivers = 40;
  $('driverSlider').value = 40;
  setPhase('old-equilibrium');
  render();
}

function openTunnel() {
  stopRunning();
  state.tunnelOpen = true;
  setPhase(Math.abs(state.drivers - equilibriumDrivers(true)) < 0.001 ? 'new-equilibrium' : 'shock');
  render();
}

function manualSplit(value) {
  stopRunning();
  state.drivers = Number(value);
  const target = equilibriumDrivers(state.tunnelOpen);
  if (Math.abs(state.drivers - target) < 0.001) {
    setPhase(state.tunnelOpen ? 'new-equilibrium' : 'old-equilibrium');
  } else {
    setPhase('manual');
  }
  render();
}

function narrative() {
  const D = state.drivers;
  const drive = driveCost(D);
  const transit = transitCost(D);
  const target = equilibriumDrivers(state.tunnelOpen);
  const eq = Math.abs(D - target) < 0.001;

  if (!state.tunnelOpen && eq) {
    return {
      title: 'Nobody can improve by switching.',
      text: 'At 40 drivers, both choices take 45 minutes. A commuter who treats their own effect on the whole system as negligible has no reason to change modes. This is the mode-choice Nash equilibrium.'
    };
  }
  if (state.tunnelOpen && D === 40) {
    return {
      title: 'The tunnel works — at first.',
      text: 'With the old 40/60 split, driving instantly drops from 45 to 40 minutes while transit remains at 45. Any transit rider can now save time by driving, so the old equilibrium cannot survive.'
    };
  }
  if (state.tunnelOpen && eq) {
    return {
      title: 'Everyone followed their incentive. Everyone lost.',
      text: 'At 60 drivers, congestion has pushed driving back to 50 minutes. Transit has also risen to 50 minutes because it lost riders. Nobody can gain by switching now — but the new equilibrium is five minutes worse than the old one.'
    };
  }
  if (drive < transit) {
    return {
      title: 'Driving is faster, so transit loses riders.',
      text: `At this split, driving is ${(transit-drive).toFixed(1)} minutes faster. Commuters have an individual incentive to switch into cars, which raises road congestion and weakens transit service in the model.`
    };
  }
  return {
    title: 'Transit is faster, so drivers peel away.',
    text: `At this split, transit is ${(drive-transit).toFixed(1)} minutes faster. Drivers have an individual incentive to switch to transit until the two travel times meet.`
  };
}

function renderCommuters() {
  commuterEls.forEach((dot, i) => dot.classList.toggle('drive', i < state.drivers));
}

function renderChart() {
  const canvas = $('costChart');
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(300, Math.round(rect.width * dpr));
  const h = Math.max(220, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,w,h);
  ctx.save();
  ctx.scale(dpr,dpr);
  const W = w/dpr, H = h/dpr;
  const pad = {l:47,r:18,t:18,b:38};
  const x = D => pad.l + D/100*(W-pad.l-pad.r);
  const yMin=20,yMax=75;
  const y = t => pad.t + (yMax-t)/(yMax-yMin)*(H-pad.t-pad.b);
  const css = getComputedStyle(document.documentElement);
  const road = css.getPropertyValue('--road').trim();
  const road2 = css.getPropertyValue('--road2').trim();
  const transit = css.getPropertyValue('--transit').trim();
  const muted = 'rgba(255,255,255,.20)';
  const text = 'rgba(230,239,246,.72)';

  ctx.lineWidth=1;ctx.strokeStyle='rgba(255,255,255,.08)';ctx.fillStyle=text;ctx.font='10px system-ui';
  for(let t=20;t<=70;t+=10){ctx.beginPath();ctx.moveTo(pad.l,y(t));ctx.lineTo(W-pad.r,y(t));ctx.stroke();ctx.fillText(`${t}m`,8,y(t)+3);}
  for(let D=0;D<=100;D+=20){ctx.beginPath();ctx.moveTo(x(D),pad.t);ctx.lineTo(x(D),H-pad.b);ctx.stroke();ctx.textAlign='center';ctx.fillText(String(D),x(D),H-17);}
  ctx.textAlign='center';ctx.fillText('number of drivers',pad.l+(W-pad.l-pad.r)/2,H-3);ctx.textAlign='left';

  function drawCurve(fn,color,width=3,dash=[]){ctx.beginPath();for(let D=0;D<=100;D++){const px=x(D),py=y(fn(D));if(D===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);}
  drawCurve(D=>driveCost(D,false),state.tunnelOpen?muted:road,state.tunnelOpen?2:3,state.tunnelOpen?[6,5]:[]);
  if(state.tunnelOpen) drawCurve(D=>driveCost(D,true),road2,3,[]);
  drawCurve(transitCost,transit,3,[]);

  const oldEq=equilibriumDrivers(false),newEq=equilibriumDrivers(true);
  function dot(D,t,color,ghost=false){ctx.beginPath();ctx.arc(x(D),y(t),ghost?4:5,0,Math.PI*2);ctx.fillStyle=color;ctx.globalAlpha=ghost ? .45 : 1;ctx.fill();ctx.globalAlpha=1;}
  dot(oldEq,driveCost(oldEq,false),road,state.tunnelOpen);
  if(state.tunnelOpen) dot(newEq,driveCost(newEq,true),road2,false);

  ctx.beginPath();ctx.moveTo(x(state.drivers),pad.t);ctx.lineTo(x(state.drivers),H-pad.b);ctx.strokeStyle='rgba(255,255,255,.42)';ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.stroke();ctx.setLineDash([]);
  const currentDrive=driveCost(state.drivers),currentTransit=transitCost(state.drivers);
  dot(state.drivers,currentDrive,state.tunnelOpen?road2:road,false);dot(state.drivers,currentTransit,transit,false);
  ctx.fillStyle='rgba(255,255,255,.85)';ctx.font='700 10px system-ui';ctx.textAlign='center';ctx.fillText(`D = ${state.drivers}`,x(state.drivers),pad.t+11);
  ctx.restore();
}

function render() {
  const D = state.drivers;
  const T = TOTAL - D;
  const drive = driveCost(D);
  const transit = transitCost(D);
  const avg = averageCost(D);
  const faster = fasterChoice();
  const target = equilibriumDrivers(state.tunnelOpen);
  const atEq = Math.abs(D-target) < 0.001;
  const n = narrative();

  $('routeScene').classList.toggle('tunnel-open', state.tunnelOpen);
  $('driveCount').textContent = D;
  $('transitCount').textContent = T;
  $('sliderDrivers').textContent = D;
  $('driveTime').textContent = drive.toFixed(1);
  $('transitTime').textContent = transit.toFixed(1);
  $('averageTime').textContent = avg.toFixed(1);
  $('roadRouteTime').textContent = `${drive.toFixed(1)} min`;
  $('transitRouteTime').textContent = `${transit.toFixed(1)} min`;
  $('roadRouteNote').textContent = state.tunnelOpen ? 'tunnel removes the 5-minute detour' : 'includes 5-minute mountain detour';
  $('transitRouteNote').textContent = `${T} riders · ${T >= 60 ? 'stronger' : 'weaker'} service in the toy model`;
  $('fasterChoice').textContent = faster;
  $('switchHint').textContent = faster === 'Neither' ? 'no incentive to switch' : `${faster.toLowerCase()} attracts commuters`;
  $('explanationTitle').textContent = n.title;
  $('explanationText').textContent = n.text;
  $('equationBox').innerHTML = `<span>Driving</span><code>${state.tunnelOpen?'20':'25'} + 0.50 × ${D} = ${drive.toFixed(1)}</code><span>Transit</span><code>35 + 0.25 × ${D} = ${transit.toFixed(1)}</code>`;

  const verdict = $('heroVerdict');
  verdict.classList.toggle('worse', state.tunnelOpen && atEq);
  verdict.querySelector('span').textContent = atEq ? (state.tunnelOpen ? 'New equilibrium' : 'Current equilibrium') : 'Current average';
  verdict.querySelector('strong').textContent = `${(atEq ? drive : avg).toFixed(0)} min`;
  verdict.querySelector('small').textContent = `${D} drive · ${T} transit`;

  $('tunnelBtn').disabled = state.tunnelOpen;
  $('tunnelBtn').textContent = state.tunnelOpen ? '✓ Tunnel open' : '⛏ Build the tunnel';
  $('adaptBtn').disabled = !state.tunnelOpen || atEq;
  $('stepBtn').disabled = atEq;
  if (!state.running) $('adaptBtn').textContent = atEq ? '✓ At equilibrium' : '▶ Let commuters adapt';

  renderCommuters();
  renderChart();
}

$('resetBtn').addEventListener('click',resetStory);
$('tunnelBtn').addEventListener('click',openTunnel);
$('adaptBtn').addEventListener('click',runAdaptation);
$('stepBtn').addEventListener('click',stepOnce);
$('driverSlider').addEventListener('input',event=>manualSplit(event.target.value));
window.addEventListener('resize',renderChart);

createCommuters();
setPhase('old-equilibrium');
render();
