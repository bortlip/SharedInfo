import { TOTAL, METHODS, META, FIXED_DT } from "./constants.js";
import { clamp } from "./random.js";
import { makeManifest } from "./manifest.js";
import { BoardingSim } from "./simulation.js";
import { drawSim } from "./render.js";
import { formatTime, stats } from "./format.js";

const $ = id => document.getElementById(id);
const controls = {
  loadFactor:$("loadFactor"),
  familyShare:$("familyShare"),
  party2:$("party2"),
  party3:$("party3"),
  party4:$("party4"),
  party5:$("party5"),
  assistedParties:$("assistedParties"),
  bagRate:$("bagRate"),
  sequenceCompliance:$("sequenceCompliance"),
  priorityPolicy:$("priorityPolicy"),
  speed:$("speed"),
  seed:$("seed"),
  trials:$("trials")
};

let sims = {};
let manifest = null;
let running = false;
let lastFrame = performance.now();
let accumulator = 0;
let benchmarking = false;
let benchmarkResult = null;

function normalizedPartyWeights(){
  const raw=[controls.party2,controls.party3,controls.party4,controls.party5].map(el=>{
    const value=Number(el.value);
    return Number.isFinite(value) && value>0 ? value : 0;
  });
  const max=Math.max(...raw);
  if(max<=0) return {raw,normalized:[25,25,25,25],fallback:true};
  // Divide by the largest input first so even enormous finite weights normalize safely.
  const scaled=raw.map(value=>value/max);
  const scaledTotal=scaled.reduce((a,b)=>a+b,0);
  return {
    raw,
    normalized:scaled.map(value=>100*value/scaledTotal),
    fallback:false
  };
}
function config(){
  const partyWeightConfig=normalizedPartyWeights();
  return {
    loadFactor:+controls.loadFactor.value/100,
    familyShare:+controls.familyShare.value/100,
    partyWeights:partyWeightConfig.normalized,
    partyWeightsFallback:partyWeightConfig.fallback,
    assistedParties:clamp(+controls.assistedParties.value||0,0,12),
    bagRate:+controls.bagRate.value/100,
    sequenceCompliance:+controls.sequenceCompliance.value/100,
    priorityPolicy:controls.priorityPolicy.value,
    seed:clamp(Math.floor(+controls.seed.value||1),1,2147483646)
  };
}
function reset(){
  const cfg=config();
  manifest=makeManifest(cfg.seed,cfg);
  sims={};
  for(const method of METHODS) sims[method]=new BoardingSim(manifest,method,cfg);
  running=false;
  accumulator=0;
  $("pauseBtn").textContent="Pause";
  const familyUnits=manifest.units.filter(u=>u.groupType==="family");
  const familyCounts=new Map();
  for(const unit of familyUnits) familyCounts.set(unit.passengers.length,(familyCounts.get(unit.passengers.length)||0)+1);
  const familySummary=familyUnits.length
    ? [...familyCounts.entries()].sort((a,b)=>a[0]-b[0]).map(([size,count])=>`${count}×${size}`).join(", ")
    : "none";
  const maxFamily=familyUnits.length?Math.max(...familyUnits.map(u=>u.passengers.length)):0;
  const fallbackNote=cfg.partyWeightsFallback?" Party weights were all zero, so an equal split was used.":"";
  $("status").textContent=`Ready: ${manifest.passengers.length}/${TOTAL} seats occupied, ${familyUnits.length} families (${familySummary}${maxFamily?`; max ${maxFamily}`:""}), ${manifest.units.filter(u=>u.groupType==="assisted").length} assisted parties.${fallbackNote}`;
  renderAll();
}

function panelElements(method){
  return {
    time:$(method+"Time"),
    done:$(method+"Done"),
    conflicts:$(method+"Conflicts"),
    blocked:$(method+"Blocked"),
    queue:$(method+"Queue")
  };
}

function renderAll(){
  let allDone=true;
  for(const method of METHODS){
    const sim=sims[method];
    if(!sim) continue;
    allDone=allDone&&sim.done;
    drawSim(sim,$(META[method].canvas));
    const el=panelElements(method);
    el.time.textContent=formatTime(sim.time);
    el.done.textContent=`${sim.completed} / ${sim.queue.length}`;
    el.conflicts.textContent=String(sim.seatConflicts);
    el.blocked.textContent=`${Math.round(sim.blockedSeconds)} s`;
    el.queue.textContent=String(sim.queue.length-sim.pending);
  }
  if(allDone && running){
    running=false;
    const winner=METHODS.slice().sort((a,b)=>sims[a].time-sims[b].time)[0];
    $("status").textContent=`Complete. ${META[winner].label} won this run at ${formatTime(sims[winner].time)}.`;
  }
}

function animate(now){
  const elapsed=Math.min(.1,(now-lastFrame)/1000);
  lastFrame=now;
  if(running){
    accumulator += elapsed * (+controls.speed.value);
    let guard=0;
    while(accumulator>=FIXED_DT && guard<5000){
      for(const method of METHODS) sims[method].step(FIXED_DT);
      accumulator-=FIXED_DT;
      guard++;
    }
  }
  renderAll();
  requestAnimationFrame(animate);
}

function run(){
  if(!manifest || METHODS.some(m=>sims[m].done)) reset();
  running=true;
  $("pauseBtn").textContent="Pause";
  $("status").textContent="Running the same manifest through all six methods…";
}
function pause(){
  if(!running && METHODS.every(m=>sims[m].time===0)){
    $("status").textContent="Nothing is running yet.";
    return;
  }
  running=!running;
  $("pauseBtn").textContent=running?"Pause":"Resume";
  $("status").textContent=running?"Running…":"Paused.";
}
function finish(){
  running=false;
  $("pauseBtn").textContent="Pause";
  for(const method of METHODS) sims[method].runToEnd(.15);
  renderAll();
  const winner=METHODS.slice().sort((a,b)=>sims[a].time-sims[b].time)[0];
  $("status").textContent=`Complete. ${META[winner].label} won this run at ${formatTime(sims[winner].time)}.`;
}

function renderBenchmark(result){
  const body=$("benchBody");
  body.innerHTML="";
  const bestMean=Math.min(...METHODS.map(m=>result[m].stats.mean));
  const maxMean=Math.max(...METHODS.map(m=>result[m].stats.mean));
  for(const m of METHODS){
    const row=document.createElement("tr");
    const st=result[m].stats;
    row.innerHTML=`
      <td>${META[m].label}</td>
      <td class="${st.mean===bestMean?"winner":""}">${formatTime(st.mean)}</td>
      <td>${formatTime(st.median)}</td>
      <td>${formatTime(st.p90)}</td>
      <td>${result[m].wins}</td>`;
    body.appendChild(row);
  }
  $("benchSubtitle").textContent=`${result.trials} trials · same manifest per trial · lower is better`;
  const box=$("barBox");
  box.innerHTML="";
  for(const m of METHODS){
    const st=result[m].stats;
    const row=document.createElement("div");
    row.className="barrow";
    const pct=maxMean?100*st.mean/maxMean:0;
    row.innerHTML=`<span>${META[m].label}</span><div class="track"><div class="fill" style="width:${pct}%"></div></div><strong>${formatTime(st.mean)}</strong>`;
    box.appendChild(row);
  }
}

async function benchmark(){
  if(benchmarking) return;
  benchmarking=true;
  const button=$("benchBtn");
  const benchStatus=$("benchStatus");
  button.disabled=true;
  button.textContent="Benchmarking…";

  // Capture an independent scenario snapshot. The visible simulations keep their
  // current state and continue animating while these fresh trial instances run.
  const cfg=config();
  const trials=clamp(Math.floor(+controls.trials.value||40),5,200);
  const times=Object.fromEntries(METHODS.map(m=>[m,[]]));
  const wins=Object.fromEntries(METHODS.map(m=>[m,0]));

  try{
    for(let t=0;t<trials;t++){
      const trialCfg={...cfg,seed:cfg.seed+t*7919};
      const man=makeManifest(trialCfg.seed,trialCfg);
      const trialTimes={};
      for(const method of METHODS){
        const sim=new BoardingSim(man,method,trialCfg);
        trialTimes[method]=sim.runToEnd(.20);
        times[method].push(trialTimes[method]);
      }
      const win=METHODS.slice().sort((a,b)=>trialTimes[a]-trialTimes[b])[0];
      wins[win]++;
      benchStatus.textContent=`Benchmarking ${t+1}/${trials}… The animation remains independent.`;

      // Yield after each trial so the browser can paint and advance a running sim.
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    benchmarkResult={trials};
    for(const method of METHODS) benchmarkResult[method]={stats:stats(times[method]),wins:wins[method]};
    renderBenchmark(benchmarkResult);
    benchStatus.textContent=`Benchmark complete: ${trials} trials using the settings captured at start.`;
  }finally{
    benchmarking=false;
    button.disabled=false;
    button.textContent="Run benchmark";
  }
}

controls.loadFactor.addEventListener("input",()=>{$("loadOut").textContent=`${controls.loadFactor.value}%`;});
function formatWeight(value){
  if(!Number.isFinite(value)) return "∞";
  if(Math.abs(value)>=1e6) return value.toExponential(2);
  return value.toLocaleString(undefined,{maximumFractionDigits:2});
}
function updatePartyWeightDisplay(){
  const {raw,normalized,fallback}=normalizedPartyWeights();
  const rawTotal=raw.reduce((a,b)=>a+b,0);
  $("partyWeightTotal").textContent=`raw total ${formatWeight(rawTotal)}`;
  $("partyWeightNormalized").textContent=fallback
    ? "All weights are zero, so the run-time fallback is 25.0% · 25.0% · 25.0% · 25.0%."
    : `Normalized at run time: ${normalized.map(value=>value.toFixed(1)+"%").join(" · ")}`;
}
[controls.party2,controls.party3,controls.party4,controls.party5].forEach(el=>el.addEventListener("input",updatePartyWeightDisplay));
updatePartyWeightDisplay();
controls.familyShare.addEventListener("input",()=>{$("familyOut").textContent=`${controls.familyShare.value}%`;});
controls.bagRate.addEventListener("input",()=>{$("bagOut").textContent=`${controls.bagRate.value}%`;});
controls.sequenceCompliance.addEventListener("input",()=>{$("complianceOut").textContent=`${controls.sequenceCompliance.value}%`;});
$("runBtn").addEventListener("click",run);
$("pauseBtn").addEventListener("click",pause);
$("finishBtn").addEventListener("click",finish);
$("resetBtn").addEventListener("click",reset);
$("benchBtn").addEventListener("click",benchmark);
Object.values(controls).forEach(el=>el.addEventListener("change",()=>{
  if(el!==controls.speed && el!==controls.trials) reset();
}));

window.addEventListener("resize",renderAll);
reset();
if(!new URLSearchParams(location.search).has("static")){
  requestAnimationFrame(animate);
}else{
  renderAll();
}
