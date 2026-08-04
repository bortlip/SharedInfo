import { TOTAL, METHODS, META, FIXED_DT } from "./constants.js";
import { APP_VERSION } from "./version.js";
import { clamp } from "./random.js";
import { makeManifest } from "./manifest.js";
import { BoardingSim } from "./simulation.js";
import { drawSim } from "./render.js";
import { benchmarkSignature, formatTime, sameBenchmarkResults, stats } from "./format.js";
import { rankRace, simultaneousBlockers } from "./race.js";
import {
  SCENARIO_PRESETS,
  DEFAULT_SCENARIO_SETTINGS,
  matchingPreset,
  normalizeScenarioSettings,
  parseScenarioSearch,
  serializeScenarioSettings
} from "./scenarios.js";

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
let activePresetId = "custom";
let toastTimer = null;
let selectedMethods = new Set(METHODS);
let raceLayout = "standard";
const raceHud={
  leader:null,
  events:[],
  seen:new Set(),
  blocking:new Map(),
  finished:new Set(),
  leadFlash:new Map(),
  spotlightTimer:null,
  lastPaint:-Infinity
};

function activeMethods(){
  return METHODS.filter(method=>selectedMethods.has(method));
}

function ordinal(value){
  const mod100=value%100;
  if(mod100>=11 && mod100<=13) return `${value}th`;
  return `${value}${value%10===1?"st":value%10===2?"nd":value%10===3?"rd":"th"}`;
}

function clearRaceHud(){
  raceHud.leader=null;
  raceHud.events=[];
  raceHud.seen.clear();
  raceHud.blocking.clear();
  raceHud.finished.clear();
  raceHud.leadFlash.clear();
  raceHud.lastPaint=-Infinity;
  document.querySelectorAll(".sim-card[data-method]").forEach(card=>{
    card.classList.remove("spotlight","event-pulse","finished-card");
    delete card.dataset.finishPlace;
  });
  $("raceLeaderboard").innerHTML="";
  $("raceEvents").innerHTML='<span class="race-events-empty">Lead changes, long bag stows, conflict clusters, and finish moments will appear here.</span>';
  $("raceClock").textContent="00:00";
}

function pulseMethod(method){
  const card=document.querySelector(`.sim-card[data-method="${method}"]`);
  if(!card || card.hidden) return;
  card.classList.remove("event-pulse");
  void card.offsetWidth;
  card.classList.add("event-pulse");
  setTimeout(()=>card.classList.remove("event-pulse"),1050);
}

function focusMethod(method){
  const card=document.querySelector(`.sim-card[data-method="${method}"]`);
  if(!card || card.hidden) return;
  document.querySelectorAll(".sim-card.spotlight").forEach(item=>item.classList.remove("spotlight"));
  card.classList.add("spotlight");
  card.scrollIntoView({behavior:"smooth",block:"nearest"});
  clearTimeout(raceHud.spotlightTimer);
  raceHud.spotlightTimer=setTimeout(()=>card.classList.remove("spotlight"),1800);
}

function addRaceEvent(method,icon,text,key){
  if(key && raceHud.seen.has(key)) return;
  if(key) raceHud.seen.add(key);
  raceHud.events.unshift({method,icon,text,time:sims[method]?.time||0});
  raceHud.events=raceHud.events.slice(0,8);
  pulseMethod(method);
}

function detectRaceEvents(rows){
  if(!rows.length) return;
  const leader=rows[0].method;
  const leaderTime=sims[leader]?.time||0;
  if(!raceHud.leader){
    raceHud.leader=leader;
  }else if(running && leaderTime>1 && raceHud.leader!==leader){
    raceHud.leader=leader;
    raceHud.leadFlash.set(leader,performance.now()+1200);
    addRaceEvent(leader,"▲",`${META[leader].label} takes the lead`,`lead:${leader}:${Math.round(leaderTime*10)}`);
  }

  for(const row of rows){
    const method=row.method;
    const sim=sims[method];
    if(!sim) continue;

    for(const passenger of sim.active){
      if(passenger.state==="stowing" && passenger.hasBag && passenger.stowDuration>=11.5){
        addRaceEvent(
          method,
          "🧳",
          `${META[method].label}: ${passenger.stowDuration.toFixed(1)}s carry-on at row ${passenger.row}`,
          `bag:${method}:${passenger.id}`
        );
      }
      if(passenger.state==="seating" && passenger.visualBlockers>=2){
        addRaceEvent(
          method,
          "💺",
          `${META[method].label}: double seat conflict at row ${passenger.row}`,
          `seat:${method}:${passenger.id}`
        );
      }
    }

    const blockers=simultaneousBlockers(sim);
    const blocking=raceHud.blocking.get(method)||false;
    if(blockers>=3 && !blocking){
      raceHud.blocking.set(method,true);
      addRaceEvent(
        method,
        "⛔",
        `${META[method].label}: ${blockers} simultaneous aisle blockers`,
        `block:${method}:${Math.round(sim.time*10)}`
      );
    }else if(blockers<2){
      raceHud.blocking.set(method,false);
    }

    if(sim.done && !raceHud.finished.has(method)){
      raceHud.finished.add(method);
      const finishers=METHODS.filter(candidate=>sims[candidate]?.done)
        .sort((a,b)=>sims[a].time-sims[b].time || METHODS.indexOf(a)-METHODS.indexOf(b));
      const place=finishers.indexOf(method)+1;
      addRaceEvent(
        method,
        "🏁",
        `${META[method].label} finishes ${ordinal(place)} at ${formatTime(sim.time)}`,
        `finish:${method}`
      );
    }
  }
}

function gapLabel(row,leader){
  if(row.done){
    if(row.rank===1) return "First finisher";
    return `+${formatTime(Math.max(0,row.time-leader.time))}`;
  }
  if(row.rank===1) return "Leader";
  const gap=Math.max(0,leader.completed-row.completed);
  if(gap===0) return "Tied on seated";
  return `${gap} passenger${gap===1?"":"s"} back`;
}

function renderRaceHud(force=false){
  const now=performance.now();
  if(!force && now-raceHud.lastPaint<120) return;
  raceHud.lastPaint=now;
  const methods=activeMethods();
  if(!methods.length || !methods.every(method=>sims[method])) return;
  const rows=rankRace(methods,sims);
  detectRaceEvents(rows);
  const leader=rows[0];
  const maxTime=Math.max(...METHODS.map(method=>sims[method]?.time||0));
  $("raceClock").textContent=formatTime(maxTime);

  $("raceLeaderboard").innerHTML=rows.map(row=>{
    const flash=(raceHud.leadFlash.get(row.method)||0)>now;
    const place=row.done && row.rank<=3?["🥇","🥈","🥉"][row.rank-1]:row.rank;
    const status=row.done?`${formatTime(row.time)} finish`:`${Math.round(row.percent)}% seated`;
    return `<button type="button" class="race-row${row.rank===1?" leader":""}${row.done?" finished":""}${flash?" lead-change":""}" data-method="${row.method}">
      <span class="race-rank">${place}</span>
      <span class="race-name">${META[row.method].label}</span>
      <span class="race-stat">${status}</span>
      <span class="race-progress" aria-hidden="true"><span style="width:${clamp(row.percent,0,100).toFixed(1)}%"></span></span>
      <span class="race-gap">${gapLabel(row,leader)}</span>
    </button>`;
  }).join("");

  document.querySelectorAll(".sim-card[data-method]").forEach(card=>{
    card.classList.remove("finished-card");
    delete card.dataset.finishPlace;
  });
  for(const row of rows.filter(item=>item.done)){
    const card=document.querySelector(`.sim-card[data-method="${row.method}"]`);
    if(!card) continue;
    card.classList.add("finished-card");
    card.dataset.finishPlace=ordinal(row.rank);
  }

  const visibleEvents=raceHud.events.filter(event=>selectedMethods.has(event.method)).slice(0,5);
  $("raceEvents").innerHTML=visibleEvents.length
    ? visibleEvents.map(event=>`<button type="button" class="race-event" data-method="${event.method}"><span aria-hidden="true">${event.icon}</span> ${event.text} <time>${formatTime(event.time)}</time></button>`).join("")
    : '<span class="race-events-empty">Lead changes, long bag stows, conflict clusters, and finish moments will appear here.</span>';
}

function initializeRaceHud(){
  for(const id of ["raceLeaderboard","raceEvents"]){
    $(id).addEventListener("click",event=>{
      const target=event.target.closest("[data-method]");
      if(target) focusMethod(target.dataset.method);
    });
  }
}

function parseRaceView(search){
  const params=new URLSearchParams(search||"");
  const requested=(params.get("m")||"").split(",").filter(method=>METHODS.includes(method));
  const methods=[...new Set(requested)];
  return {
    methods:methods.length?methods:[...METHODS],
    layout:params.get("view")==="compact"?"compact":"standard"
  };
}

function updateRaceView(){
  const methods=activeMethods();
  document.querySelectorAll(".sim-card[data-method]").forEach(card=>{
    card.hidden=!selectedMethods.has(card.dataset.method);
  });
  document.querySelectorAll(".method-option input").forEach(input=>{
    input.checked=selectedMethods.has(input.value);
  });
  const grid=$("simGrid");
  grid.classList.toggle("compact-view",raceLayout==="compact");
  grid.dataset.layout=raceLayout;
  for(const button of document.querySelectorAll("[data-layout]")){
    const active=button.dataset.layout===raceLayout;
    button.classList.toggle("active",active);
    button.setAttribute("aria-pressed",String(active));
  }
  $("methodSelectionStatus").textContent=`${methods.length} method${methods.length===1?"":"s"} selected · ${raceLayout==="compact"?"Compact fleet":"Roomy"} view`;
}

function clearBenchmark(){
  benchmarkResult=null;
  $("benchBody").innerHTML='<tr><td colspan="5" class="empty">No benchmark results yet.</td></tr>';
  $("barBox").innerHTML="";
  $("benchSubtitle").textContent="Run a benchmark to average over different manifests and delays.";
  $("benchStatus").textContent="Ready. Benchmarking uses a snapshot of the current settings and runs independently of the animation.";
}

function applyMethodSelection(methods,{announce=false}={}){
  const valid=[...new Set(methods)].filter(method=>METHODS.includes(method));
  if(!valid.length) return false;
  selectedMethods=new Set(valid);
  updateRaceView();
  clearBenchmark();
  raceHud.leader=null;
  renderAll();
  if(announce){
    const count=valid.length;
    const continuation=running
      ? " All six simulations are still running in sync."
      : " All six simulations remain synchronized behind the view.";
    $("status").textContent=`Showing ${count} boarding method${count===1?"":"s"}.${continuation}`;
  }
  return true;
}

function setRaceLayout(layout){
  raceLayout=layout==="compact"?"compact":"standard";
  updateRaceView();
  renderAll();
}

function setMethodControlsDisabled(disabled){
  document.querySelectorAll(".method-option input").forEach(input=>input.disabled=disabled);
  $("selectAllMethodsBtn").disabled=disabled;
}

function renderMethodPicker(){
  const picker=$("methodPicker");
  picker.innerHTML="";
  for(const method of METHODS){
    const label=document.createElement("label");
    label.className="method-option";
    const input=document.createElement("input");
    input.type="checkbox";
    input.value=method;
    input.checked=true;
    const text=document.createElement("span");
    text.textContent=META[method].label;
    label.append(input,text);
    input.addEventListener("change",()=>{
      const next=new Set(selectedMethods);
      if(input.checked) next.add(method);
      else next.delete(method);
      if(!next.size){
        input.checked=true;
        $("methodSelectionStatus").textContent="At least one boarding method must remain selected.";
        return;
      }
      applyMethodSelection([...next],{announce:true});
    });
    picker.appendChild(label);
  }
  $("selectAllMethodsBtn").addEventListener("click",()=>applyMethodSelection(METHODS,{announce:true}));
  $("standardLayoutBtn").addEventListener("click",()=>setRaceLayout("standard"));
  $("compactLayoutBtn").addEventListener("click",()=>setRaceLayout("compact"));
  updateRaceView();
}

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

function snapshotScenarioSettings(){
  return normalizeScenarioSettings({
    loadFactor:controls.loadFactor.value,
    familyShare:controls.familyShare.value,
    partyWeights:[controls.party2.value,controls.party3.value,controls.party4.value,controls.party5.value],
    assistedParties:controls.assistedParties.value,
    bagRate:controls.bagRate.value,
    sequenceCompliance:controls.sequenceCompliance.value,
    priorityPolicy:controls.priorityPolicy.value,
    speed:controls.speed.value,
    seed:controls.seed.value,
    trials:controls.trials.value
  });
}

function writeScenarioSettings(settings){
  const value=normalizeScenarioSettings(settings);
  controls.loadFactor.value=String(value.loadFactor);
  controls.familyShare.value=String(value.familyShare);
  [controls.party2,controls.party3,controls.party4,controls.party5].forEach((control,index)=>{
    control.value=String(value.partyWeights[index]);
  });
  controls.assistedParties.value=String(value.assistedParties);
  controls.bagRate.value=String(value.bagRate);
  controls.sequenceCompliance.value=String(value.sequenceCompliance);
  controls.priorityPolicy.value=value.priorityPolicy;
  controls.speed.value=String(value.speed);
  controls.seed.value=String(value.seed);
  controls.trials.value=String(value.trials);
  updateControlDisplays();
  return value;
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

function currentScenarioName(){
  if(activePresetId==="custom") return "Custom scenario";
  return SCENARIO_PRESETS.find(preset=>preset.id===activePresetId)?.name||"Custom scenario";
}

function setActivePreset(presetId){
  activePresetId=presetId||"custom";
  const selected=SCENARIO_PRESETS.find(preset=>preset.id===activePresetId && preset.included!==false && !preset.disabled);
  $("activeScenarioLabel").textContent=selected?.name||"Custom scenario";
  $("activeScenarioLabel").dataset.scenarioId=selected?.id||"custom";
  document.querySelectorAll(".scenario-card").forEach(card=>{
    const active=card.dataset.scenarioId===selected?.id;
    card.classList.toggle("active",active);
    card.setAttribute("aria-pressed",String(active));
  });
}

function detectActivePreset(){
  setActivePreset(matchingPreset(snapshotScenarioSettings())?.id||"custom");
}

function scenarioPreview(settings){
  return [
    `${settings.loadFactor}% full`,
    `${settings.familyShare}% families`,
    `${settings.bagRate}% bags`,
    `${settings.sequenceCompliance}% compliance`
  ];
}

function renderScenarioCards(){
  const grid=$("scenarioGrid");
  grid.innerHTML="";
  for(const preset of SCENARIO_PRESETS.filter(preset=>preset.included!==false)){
    const button=document.createElement("button");
    button.type="button";
    button.className="scenario-card";
    button.dataset.scenarioId=preset.id;
    button.disabled=!!preset.disabled;
    button.setAttribute("aria-pressed","false");

    const heading=document.createElement("span");
    heading.className="scenario-card-heading";
    heading.innerHTML=`<span class="scenario-emoji" aria-hidden="true">${preset.emoji}</span><strong>${preset.name}</strong>`;
    button.appendChild(heading);

    const description=document.createElement("span");
    description.className="scenario-description";
    description.textContent=preset.description;
    button.appendChild(description);

    if(preset.disabled){
      const soon=document.createElement("span");
      soon.className="scenario-coming";
      soon.textContent="Coming when the character-event system lands";
      button.appendChild(soon);
    }else{
      const chips=document.createElement("span");
      chips.className="scenario-chips";
      for(const text of scenarioPreview(preset.settings)){
        const chip=document.createElement("span");
        chip.className="scenario-chip";
        chip.textContent=text;
        chips.appendChild(chip);
      }
      button.appendChild(chips);
      button.addEventListener("click",()=>{
        writeScenarioSettings(preset.settings);
        setActivePreset(preset.id);
        reset();
        $("status").textContent=`${preset.name} loaded. Seed ${Number(controls.seed.value).toLocaleString()} is ready to race.`;
      });
    }
    grid.appendChild(button);
  }
}

function reset(){
  const normalized=writeScenarioSettings(snapshotScenarioSettings());
  const cfg=config();
  manifest=makeManifest(cfg.seed,cfg);
  sims={};
  for(const method of METHODS) sims[method]=new BoardingSim(manifest,method,cfg);
  clearRaceHud();
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
  $("benchSeedValue").textContent=normalized.seed.toLocaleString();
  $("status").textContent=`${currentScenarioName()} · seed ${normalized.seed.toLocaleString()} · ${manifest.passengers.length}/${TOTAL} seats occupied, ${familyUnits.length} families (${familySummary}${maxFamily?`; max ${maxFamily}`:""}), ${manifest.units.filter(u=>u.groupType==="assisted").length} assisted parties.${fallbackNote}`;
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
  const methods=activeMethods();
  const allDone=METHODS.every(method=>sims[method]?.done);
  for(const method of methods){
    const sim=sims[method];
    if(!sim) continue;
    drawSim(sim,$(META[method].canvas));
    const el=panelElements(method);
    el.time.textContent=formatTime(sim.time);
    el.done.textContent=`${sim.completed} / ${sim.queue.length}`;
    el.conflicts.textContent=String(sim.seatConflicts);
    el.blocked.textContent=`${Math.round(sim.blockedSeconds)} s`;
    el.queue.textContent=String(sim.queue.length-sim.pending);
  }
  renderRaceHud();
  if(allDone && running){
    running=false;
    const winner=methods.slice().sort((a,b)=>sims[a].time-sims[b].time)[0];
    $("status").textContent=methods.length===1
      ? `Complete. ${META[winner].label} finished ${currentScenarioName()} at ${formatTime(sims[winner].time)}.`
      : `Complete. ${META[winner].label} won ${currentScenarioName()} at ${formatTime(sims[winner].time)}.`;
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
  const methods=activeMethods();
  if(!manifest || METHODS.every(method=>sims[method]?.done)) reset();
  running=true;
  $("pauseBtn").textContent="Pause";
  $("status").textContent=`Showing ${methods.length} selected method${methods.length===1?"":"s"} while all six simulations run in sync…`;
}

function pause(){
  if(!running && METHODS.every(method=>sims[method]?.time===0)){
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
  const methods=activeMethods();
  for(const method of METHODS) sims[method].runToEnd(.15);
  renderAll();
  const winner=methods.slice().sort((a,b)=>sims[a].time-sims[b].time)[0];
  $("status").textContent=methods.length===1
    ? `Complete. ${META[winner].label} finished ${currentScenarioName()} at ${formatTime(sims[winner].time)}.`
    : `Complete. ${META[winner].label} won ${currentScenarioName()} at ${formatTime(sims[winner].time)}.`;
}

function renderBenchmark(result){
  const body=$("benchBody");
  body.innerHTML="";
  const methods=result.methods;
  const bestMean=Math.min(...methods.map(m=>result[m].stats.mean));
  const maxMean=Math.max(...methods.map(m=>result[m].stats.mean));
  for(const m of methods){
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
  const repeatNote=result.repeated?" · exact rerun; deterministic results unchanged":"";
  $("benchSubtitle").textContent=`${result.trials} trials · base seed ${result.seed.toLocaleString()} · same manifest per trial · lower is better${repeatNote}`;
  const box=$("barBox");
  box.innerHTML="";
  for(const m of methods){
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
  setMethodControlsDisabled(true);

  // Capture an independent scenario snapshot. The visible simulations keep their
  // current state and continue animating while these fresh trial instances run.
  const cfg=config();
  const methods=activeMethods();
  const trials=clamp(Math.floor(+controls.trials.value||40),5,200);
  const signature=benchmarkSignature(cfg,trials,methods);
  const previousResult=benchmarkResult;
  const times=Object.fromEntries(methods.map(m=>[m,[]]));
  const wins=Object.fromEntries(methods.map(m=>[m,0]));

  try{
    for(let t=0;t<trials;t++){
      const trialCfg={...cfg,seed:cfg.seed+t*7919};
      const man=makeManifest(trialCfg.seed,trialCfg);
      const trialTimes={};
        for(const method of methods){
        const sim=new BoardingSim(man,method,trialCfg);
        trialTimes[method]=sim.runToEnd(.20);
        times[method].push(trialTimes[method]);
      }
      const win=methods.slice().sort((a,b)=>trialTimes[a]-trialTimes[b])[0];
      wins[win]++;
      benchStatus.textContent=`Benchmarking ${t+1}/${trials} from base seed ${cfg.seed.toLocaleString()}… The animation remains independent.`;

      // Yield after each trial so the browser can paint and advance a running sim.
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    const nextResult={trials,seed:cfg.seed,signature,methods:[...methods]};
    for(const method of methods) nextResult[method]={stats:stats(times[method]),wins:wins[method]};
    const exactRepeat=previousResult?.signature===signature;
    nextResult.repeated=exactRepeat && sameBenchmarkResults(previousResult,nextResult,methods);
    benchmarkResult=nextResult;
    renderBenchmark(benchmarkResult);
    if(nextResult.repeated){
      benchStatus.textContent=`Exact benchmark rerun: the settings, ${trials} trials, and base seed ${cfg.seed.toLocaleString()} are unchanged, so the deterministic results are unchanged.`;
    }else if(exactRepeat){
      benchStatus.textContent=`This exact benchmark unexpectedly changed. The deterministic model should be investigated.`;
    }else{
      benchStatus.textContent=`Benchmark complete: ${trials} trials from base seed ${cfg.seed.toLocaleString()}.`;
    }
  }finally{
    benchmarking=false;
    button.disabled=false;
    button.textContent="Run benchmark";
    setMethodControlsDisabled(false);
  }
}

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

function updateControlDisplays(){
  $("loadOut").textContent=`${controls.loadFactor.value}%`;
  $("familyOut").textContent=`${controls.familyShare.value}%`;
  $("bagOut").textContent=`${controls.bagRate.value}%`;
  $("complianceOut").textContent=`${controls.sequenceCompliance.value}%`;
  $("benchSeedValue").textContent=Number(controls.seed.value||DEFAULT_SCENARIO_SETTINGS.seed).toLocaleString();
  updatePartyWeightDisplay();
}

function generatedSeed(){
  const max=2147483646;
  if(globalThis.crypto?.getRandomValues){
    const values=new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return 1+(values[0]%max);
  }
  return 1+Math.floor(Math.random()*max);
}

function randomizeSeed(){
  controls.seed.value=String(generatedSeed());
  updateControlDisplays();
  setActivePreset("custom");
  reset();
  $("status").textContent=`New random seed ${Number(controls.seed.value).toLocaleString()} is ready.`;
}

function showToast(message){
  const toast=$("copyToast");
  toast.textContent=message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toast.classList.remove("visible"),2600);
}

function fallbackCopy(text){
  const area=document.createElement("textarea");
  area.value=text;
  area.setAttribute("readonly","");
  area.style.position="fixed";
  area.style.opacity="0";
  document.body.appendChild(area);
  area.select();
  const copied=document.execCommand("copy");
  area.remove();
  return copied;
}

async function copyScenarioLink(){
  const settings=snapshotScenarioSettings();
  const preset=matchingPreset(settings);
  const url=new URL(location.href);
  url.search=serializeScenarioSettings(settings,preset?.id||"custom");
  url.searchParams.set("m",activeMethods().join(","));
  url.searchParams.set("view",raceLayout);
  url.hash="";
  let copied=false;
  try{
    await navigator.clipboard.writeText(url.toString());
    copied=true;
  }catch{
    copied=fallbackCopy(url.toString());
  }
  showToast(copied
    ? `Scenario link copied — seed and race view included.`
    : "Could not copy automatically. The scenario URL is now in the address bar.");
  if(!copied) history.replaceState(null,"",url);
}

function handleManualControlChange(control){
  const normalized=writeScenarioSettings(snapshotScenarioSettings());
  setActivePreset("custom");
  if(control!==controls.speed && control!==controls.trials) reset();
  else $("benchSeedValue").textContent=normalized.seed.toLocaleString();
}

function initialize(){
  document.querySelectorAll("[data-app-version]").forEach(element=>{
    element.textContent=`v${APP_VERSION}`;
  });
  renderScenarioCards();
  renderMethodPicker();
  initializeRaceHud();
  const fromUrl=parseScenarioSearch(location.search);
  const raceView=parseRaceView(location.search);
  writeScenarioSettings(fromUrl||DEFAULT_SCENARIO_SETTINGS);
  applyMethodSelection(raceView.methods);
  setRaceLayout(raceView.layout);
  detectActivePreset();

  controls.loadFactor.addEventListener("input",()=>{$("loadOut").textContent=`${controls.loadFactor.value}%`;});
  controls.familyShare.addEventListener("input",()=>{$("familyOut").textContent=`${controls.familyShare.value}%`;});
  controls.bagRate.addEventListener("input",()=>{$("bagOut").textContent=`${controls.bagRate.value}%`;});
  controls.sequenceCompliance.addEventListener("input",()=>{$("complianceOut").textContent=`${controls.sequenceCompliance.value}%`;});
  [controls.party2,controls.party3,controls.party4,controls.party5].forEach(el=>el.addEventListener("input",updatePartyWeightDisplay));

  $("runBtn").addEventListener("click",run);
  $("pauseBtn").addEventListener("click",pause);
  $("finishBtn").addEventListener("click",finish);
  $("resetBtn").addEventListener("click",reset);
  $("benchBtn").addEventListener("click",benchmark);
  $("randomizeSeedBtn").addEventListener("click",randomizeSeed);
  $("benchRandomizeSeedBtn").addEventListener("click",randomizeSeed);
  $("copyScenarioBtn").addEventListener("click",copyScenarioLink);

  Object.values(controls).forEach(control=>control.addEventListener("change",()=>handleManualControlChange(control)));

  window.addEventListener("resize",renderAll);
  reset();
  if(fromUrl){
    $("status").textContent=`Shared ${currentScenarioName().toLowerCase()} loaded from the URL with seed ${Number(controls.seed.value).toLocaleString()}.`;
  }
  if(!new URLSearchParams(location.search).has("static")){
    requestAnimationFrame(animate);
  }else{
    renderAll();
  }
}

initialize();
