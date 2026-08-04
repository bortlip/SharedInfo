#!/usr/bin/env python3
from pathlib import Path

ROOT = Path("simulations/group-aware-boarding")
SRC = ROOT / "src"
JS = SRC / "js"


def replace(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"Expected text not found in {path}: {old[:120]!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


replace(
    JS / "constants.js",
    '''export const META = {
  random:{label:"Random", canvas:"randomCanvas"},
  back:{label:"Strict back to front", canvas:"backCanvas"},
  front:{label:"Strict front to back", canvas:"frontCanvas"},
  zones:{label:"Airline zones", canvas:"zonesCanvas"},
  wilma:{label:"WilMA, group-safe", canvas:"wilmaCanvas"},
  steffen:{label:"Steffen, group-safe", canvas:"steffenCanvas"}
};''',
    '''export const META = {
  random:{label:"Random", shortLabel:"Random", chartColor:"#63d7ff", canvas:"randomCanvas"},
  back:{label:"Strict back to front", shortLabel:"Back → Front", chartColor:"#70e1a1", canvas:"backCanvas"},
  front:{label:"Strict front to back", shortLabel:"Front → Back", chartColor:"#ff9aaa", canvas:"frontCanvas"},
  zones:{label:"Airline zones", shortLabel:"Zones", chartColor:"#ffc96b", canvas:"zonesCanvas"},
  wilma:{label:"WilMA, group-safe", shortLabel:"WilMA", chartColor:"#d994ff", canvas:"wilmaCanvas"},
  steffen:{label:"Steffen, group-safe", shortLabel:"Steffen", chartColor:"#9fa8ff", canvas:"steffenCanvas"}
};'''
)

(JS / "race.js").write_text('''import { METHODS } from "./constants.js";
import { clamp } from "./random.js";

export function aisleProgress(sim){
  return sim.active.reduce((sum,passenger)=>{
    if(passenger.state==="walking"){
      return sum+clamp(passenger.pos/Math.max(1,passenger.row),0,1);
    }
    if(passenger.state==="stowing") return sum+.8;
    if(passenger.state==="seating") return sum+.92;
    return sum;
  },0);
}

export function rankRace(methods,sims){
  return methods.map(method=>{
    const sim=sims[method];
    const total=sim?.queue.length||0;
    return {
      method,
      done:!!sim?.done,
      time:sim?.time||0,
      completed:sim?.completed||0,
      entered:sim?.pending||0,
      aisleProgress:sim?aisleProgress(sim):0,
      total
    };
  }).sort((a,b)=>{
    if(a.done!==b.done) return a.done?-1:1;
    if(a.done && b.done){
      return a.time-b.time || METHODS.indexOf(a.method)-METHODS.indexOf(b.method);
    }
    return b.completed-a.completed
      || b.entered-a.entered
      || b.aisleProgress-a.aisleProgress
      || METHODS.indexOf(a.method)-METHODS.indexOf(b.method);
  }).map((row,index)=>({
    ...row,
    rank:index+1,
    percent:row.total?100*row.completed/row.total:0
  }));
}
''', encoding="utf-8")

replace(
    JS / "simulation.js",
    '''    p.visualBlockers=blockers;
    p.visualConflictTime=blockers?this.time:null;
''',
    ''''''
)

app = (JS / "app.js").read_text(encoding="utf-8")
app = app.replace(
    'import { rankRace, simultaneousBlockers } from "./race.js";',
    'import { rankRace } from "./race.js";'
)
old_hud_state = '''const raceHud={
  leader:null,
  events:[],
  seen:new Set(),
  blocking:new Map(),
  finished:new Set(),
  leadFlash:new Map(),
  spotlightTimer:null,
  lastPaint:-Infinity
};'''
new_hud_state = '''const raceHud={
  leader:null,
  leadFlash:new Map(),
  spotlightTimer:null,
  lastPaint:-Infinity,
  chartSize:"small",
  history:Object.fromEntries(METHODS.map(method=>[method,[]]))
};'''
if old_hud_state not in app:
    raise RuntimeError("raceHud state block not found")
app = app.replace(old_hud_state, new_hud_state, 1)
start = app.index("function ordinal")
end = app.index("function parseRaceView", start)
new_hud_functions = r'''function ordinal(value){
  const mod100=value%100;
  if(mod100>=11 && mod100<=13) return `${value}th`;
  return `${value}${value%10===1?"st":value%10===2?"nd":value%10===3?"rd":"th"}`;
}

function freshRaceHistory(){
  return Object.fromEntries(METHODS.map(method=>[method,[]]));
}

function clearRaceHud(){
  raceHud.leader=null;
  raceHud.leadFlash.clear();
  raceHud.lastPaint=-Infinity;
  raceHud.history=freshRaceHistory();
  document.querySelectorAll(".sim-card[data-method]").forEach(card=>{
    card.classList.remove("spotlight","finished-card");
    delete card.dataset.finishPlace;
  });
  $("raceLeaderboard").innerHTML="";
  $("raceChartLegend").innerHTML="";
  $("raceClock").textContent="00:00";
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

function recordRaceHistory(force=false){
  for(const method of METHODS){
    const sim=sims[method];
    if(!sim) continue;
    const points=raceHud.history[method]||(raceHud.history[method]=[]);
    const last=points.at(-1);
    const changed=!last || last.time!==sim.time || last.seated!==sim.completed;
    const intervalReached=!last || sim.time-last.time>=.5;
    if(changed && (force || intervalReached || sim.done)){
      points.push({time:sim.time,seated:sim.completed});
    }
  }
}

function setRaceChartSize(size){
  const valid=["small","medium","large"];
  raceHud.chartSize=valid.includes(size)?size:"small";
  $("raceHud").dataset.chartSize=raceHud.chartSize;
  document.querySelectorAll("[data-chart-size]").forEach(button=>{
    const active=button.dataset.chartSize===raceHud.chartSize;
    button.classList.toggle("active",active);
    button.setAttribute("aria-pressed",String(active));
  });
  raceHud.lastPaint=-Infinity;
  renderRaceHud(true);
}

function drawRaceChart(methods){
  const canvas=$("raceChart");
  const rect=canvas.getBoundingClientRect();
  if(rect.width<20 || rect.height<20) return;
  const dpr=Math.min(2,globalThis.devicePixelRatio||1);
  const pixelWidth=Math.max(1,Math.round(rect.width*dpr));
  const pixelHeight=Math.max(1,Math.round(rect.height*dpr));
  if(canvas.width!==pixelWidth || canvas.height!==pixelHeight){
    canvas.width=pixelWidth;
    canvas.height=pixelHeight;
  }
  const ctx=canvas.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const width=rect.width;
  const height=rect.height;
  ctx.clearRect(0,0,width,height);

  const margin={left:46,right:14,top:13,bottom:27};
  const plotW=Math.max(1,width-margin.left-margin.right);
  const plotH=Math.max(1,height-margin.top-margin.bottom);
  const total=Math.max(1,...METHODS.map(method=>sims[method]?.queue.length||0));
  const observedMax=Math.max(0,...METHODS.map(method=>sims[method]?.time||0));
  const maxTime=Math.max(60,observedMax);
  const x=time=>margin.left+clamp(time/maxTime,0,1)*plotW;
  const y=seated=>margin.top+plotH-clamp(seated/total,0,1)*plotH;

  ctx.font="10px system-ui";
  ctx.lineWidth=1;
  ctx.textBaseline="middle";
  for(let index=0;index<=4;index++){
    const seated=Math.round(total*index/4);
    const py=y(seated);
    ctx.strokeStyle="rgba(72,102,133,.38)";
    ctx.beginPath();
    ctx.moveTo(margin.left,py);
    ctx.lineTo(width-margin.right,py);
    ctx.stroke();
    ctx.fillStyle="#8da6bf";
    ctx.textAlign="right";
    ctx.fillText(String(seated),margin.left-7,py);
  }
  for(let index=0;index<=4;index++){
    const time=maxTime*index/4;
    const px=x(time);
    ctx.strokeStyle="rgba(72,102,133,.23)";
    ctx.beginPath();
    ctx.moveTo(px,margin.top);
    ctx.lineTo(px,margin.top+plotH);
    ctx.stroke();
    ctx.fillStyle="#8da6bf";
    ctx.textAlign=index===0?"left":index===4?"right":"center";
    ctx.textBaseline="top";
    ctx.fillText(formatTime(time),px,height-margin.bottom+7);
  }

  ctx.save();
  ctx.translate(12,margin.top+plotH/2);
  ctx.rotate(-Math.PI/2);
  ctx.fillStyle="#8da6bf";
  ctx.font="10px system-ui";
  ctx.textAlign="center";
  ctx.textBaseline="top";
  ctx.fillText("Passengers seated",0,0);
  ctx.restore();

  for(const method of methods){
    const points=raceHud.history[method]||[];
    if(!points.length) continue;
    ctx.strokeStyle=META[method].chartColor;
    ctx.fillStyle=META[method].chartColor;
    ctx.lineWidth=2.2;
    ctx.lineJoin="round";
    ctx.lineCap="round";
    ctx.beginPath();
    ctx.moveTo(x(points[0].time),y(points[0].seated));
    for(let index=1;index<points.length;index++){
      const previous=points[index-1];
      const point=points[index];
      ctx.lineTo(x(point.time),y(previous.seated));
      ctx.lineTo(x(point.time),y(point.seated));
    }
    ctx.stroke();
    const last=points.at(-1);
    ctx.beginPath();
    ctx.arc(x(last.time),y(last.seated),3.2,0,Math.PI*2);
    ctx.fill();
  }

  $("raceChartLegend").innerHTML=methods.map(method=>
    `<span><i style="--series-color:${META[method].chartColor}"></i>${META[method].shortLabel}</span>`
  ).join("");
}

function renderRaceHud(force=false){
  const now=performance.now();
  if(!force && now-raceHud.lastPaint<120) return;
  raceHud.lastPaint=now;
  recordRaceHistory(force);
  const methods=activeMethods();
  if(!methods.length || !methods.every(method=>sims[method])) return;
  const rows=rankRace(methods,sims);
  const leader=rows[0];
  const leaderTime=sims[leader.method]?.time||0;
  if(!raceHud.leader){
    raceHud.leader=leader.method;
  }else if(running && leaderTime>1 && raceHud.leader!==leader.method){
    raceHud.leader=leader.method;
    raceHud.leadFlash.set(leader.method,now+1200);
  }
  const maxTime=Math.max(...METHODS.map(method=>sims[method]?.time||0));
  $("raceClock").textContent=formatTime(maxTime);

  $("raceLeaderboard").innerHTML=rows.map(row=>{
    const flash=(raceHud.leadFlash.get(row.method)||0)>now;
    const place=row.done && row.rank<=3?["🥇","🥈","🥉"][row.rank-1]:row.rank;
    const status=row.done?`${formatTime(row.time)} finish`:`${Math.round(row.percent)}% seated`;
    return `<button type="button" class="race-row${row.rank===1?" leader":""}${row.done?" finished":""}${flash?" lead-change":""}" data-method="${row.method}" title="${META[row.method].label}">
      <span class="race-rank">${place}</span>
      <span class="race-name">${META[row.method].shortLabel}</span>
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
  drawRaceChart(methods);
}

function initializeRaceHud(){
  $("raceLeaderboard").addEventListener("click",event=>{
    const target=event.target.closest("[data-method]");
    if(target) focusMethod(target.dataset.method);
  });
  document.querySelectorAll("[data-chart-size]").forEach(button=>{
    button.addEventListener("click",()=>setRaceChartSize(button.dataset.chartSize));
  });
}

'''
app = app[:start] + new_hud_functions + app[end:]
old_parse = '''function parseRaceView(search){
  const params=new URLSearchParams(search||"");
  const requested=(params.get("m")||"").split(",").filter(method=>METHODS.includes(method));
  const methods=[...new Set(requested)];
  return {
    methods:methods.length?methods:[...METHODS],
    layout:params.get("view")==="compact"?"compact":"standard"
  };
}'''
new_parse = '''function parseRaceView(search){
  const params=new URLSearchParams(search||"");
  const requested=(params.get("m")||"").split(",").filter(method=>METHODS.includes(method));
  const methods=[...new Set(requested)];
  const chartSize=["small","medium","large"].includes(params.get("chart"))?params.get("chart"):"small";
  return {
    methods:methods.length?methods:[...METHODS],
    layout:params.get("view")==="compact"?"compact":"standard",
    chartSize
  };
}'''
if old_parse not in app:
    raise RuntimeError("parseRaceView block not found")
app = app.replace(old_parse, new_parse, 1)
app = app.replace(
    '''  raceHud.leader=null;
  renderAll();''',
    '''  raceHud.leader=null;
  raceHud.lastPaint=-Infinity;
  renderAll();''',
    1
)
app = app.replace(
    '''  url.searchParams.set("view",raceLayout);
  url.hash="";''',
    '''  url.searchParams.set("view",raceLayout);
  url.searchParams.set("chart",raceHud.chartSize);
  url.hash="";''',
    1
)
app = app.replace(
    '''  setRaceLayout(raceView.layout);
  detectActivePreset();''',
    '''  setRaceLayout(raceView.layout);
  setRaceChartSize(raceView.chartSize);
  detectActivePreset();''',
    1
)
app = app.replace(
    '''  window.addEventListener("resize",renderAll);''',
    '''  window.addEventListener("resize",()=>{
    raceHud.lastPaint=-Infinity;
    renderAll();
  });''',
    1
)
(JS / "app.js").write_text(app, encoding="utf-8")

index = (SRC / "index.html").read_text(encoding="utf-8")
old_section = '''  <section class="card race-hud" aria-labelledby="raceHudHeading">
    <div class="race-hud-head">
      <div>
        <div class="race-title-line">
          <h2 id="raceHudHeading">Live race</h2>
          <span class="provisional-badge">provisional ranking</span>
        </div>
        <p>Ranked by seated passengers; ties use passengers entered and aisle progress. The HUD never changes the simulation.</p>
      </div>
      <div class="race-clock" aria-label="Current simulated race time">
        <span>Race clock</span>
        <strong id="raceClock">00:00</strong>
      </div>
    </div>
    <div class="race-leaderboard" id="raceLeaderboard" aria-label="Live boarding method leaderboard"></div>
    <div class="race-events-wrap">
      <span class="race-events-label">Race moments</span>
      <div class="race-events" id="raceEvents" aria-live="polite">
        <span class="race-events-empty">Lead changes, long bag stows, conflict clusters, and finish moments will appear here.</span>
      </div>
    </div>
  </section>'''
new_section = '''  <section class="card race-hud" id="raceHud" data-chart-size="small" aria-labelledby="raceHudHeading">
    <div class="race-hud-head">
      <div>
        <div class="race-title-line">
          <h2 id="raceHudHeading">Live race</h2>
          <span class="provisional-badge">provisional ranking</span>
        </div>
        <p>Short names keep the standings readable. The graph shows simulated time against passengers seated and never changes the race.</p>
      </div>
      <div class="race-hud-tools">
        <div class="graph-size-control">
          <span>Graph size</span>
          <div class="segmented-control" role="group" aria-label="Live graph size">
            <button type="button" data-chart-size="small" aria-pressed="true">Small</button>
            <button type="button" data-chart-size="medium" aria-pressed="false">Medium</button>
            <button type="button" data-chart-size="large" aria-pressed="false">Large</button>
          </div>
        </div>
        <div class="race-clock" aria-label="Current simulated race time">
          <span>Race clock</span>
          <strong id="raceClock">00:00</strong>
        </div>
      </div>
    </div>
    <div class="race-leaderboard" id="raceLeaderboard" aria-label="Live boarding method leaderboard"></div>
    <div class="race-chart-heading">
      <strong>Passengers seated over time</strong>
      <div class="race-chart-legend" id="raceChartLegend" aria-label="Graph series"></div>
    </div>
    <canvas class="race-chart" id="raceChart" width="1200" height="220" role="img" aria-label="Live step graph with simulated time on the horizontal axis and passengers seated on the vertical axis"></canvas>
  </section>'''
if old_section not in index:
    raise RuntimeError("race HUD HTML section not found")
(SRC / "index.html").write_text(index.replace(old_section, new_section, 1), encoding="utf-8")

styles_path = SRC / "styles.css"
styles = styles_path.read_text(encoding="utf-8")
css_start = styles.index(".race-hud{")
css_end = styles.index("\n.sim-grid{", css_start)
new_css = '''.race-hud{padding:16px;margin-bottom:16px;overflow:hidden}
.race-hud-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:12px}
.race-title-line{display:flex;align-items:center;flex-wrap:wrap;gap:8px}
.race-title-line h2{margin:0;font-size:1.12rem}
.race-hud-head p{margin:4px 0 0;color:var(--muted);font-size:.77rem;line-height:1.4}
.provisional-badge{padding:3px 7px;border:1px solid #5c6f3a;border-radius:999px;background:#192416;color:#d5eca0;font-size:.62rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
.race-hud-tools{display:flex;align-items:flex-end;gap:9px;flex:0 0 auto}
.graph-size-control{display:grid;gap:4px;justify-items:end}
.graph-size-control>span{color:var(--muted);font-size:.62rem;text-transform:uppercase;letter-spacing:.08em}
.graph-size-control .segmented-control button{padding:6px 8px;font-size:.68rem}
.race-clock{display:grid;justify-items:end;gap:2px;min-width:90px;padding:8px 10px;border:1px solid #36516f;border-radius:11px;background:#081625}
.race-clock span{color:var(--muted);font-size:.62rem;text-transform:uppercase;letter-spacing:.08em}
.race-clock strong{font-size:1rem;color:#dff7ff;font-variant-numeric:tabular-nums}
.race-leaderboard{display:grid;grid-template-columns:repeat(auto-fit,minmax(205px,1fr));gap:8px}
.race-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:"rank name stat" "rank progress gap";align-items:center;gap:4px 8px;min-width:0;padding:9px 10px;border-color:#36516f;background:#091827;text-align:left;transform:none}
.race-row:hover{transform:none;background:#10253d}
.race-row.leader{border-color:var(--good);box-shadow:inset 0 0 0 1px rgba(112,225,161,.18)}
.race-row.finished{border-color:#6b7690;background:#111d2d}
.race-row.lead-change{animation:leader-pop 1.15s ease}
.race-rank{grid-area:rank;display:grid;width:29px;height:29px;place-items:center;border:1px solid #476581;border-radius:9px;background:#10243a;color:#dff7ff;font-weight:900;font-variant-numeric:tabular-nums}
.race-row.leader .race-rank{border-color:var(--good);background:#17382c;color:#c9ffe1}
.race-name{grid-area:name;min-width:0;color:#e8f4ff;font-size:.76rem;font-weight:760;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.race-stat{grid-area:stat;color:#dff7ff;font-size:.71rem;font-variant-numeric:tabular-nums;white-space:nowrap}
.race-progress{grid-area:progress;height:8px;border-radius:999px;background:#061321;overflow:hidden}
.race-progress>span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#4b91ff,#70e1a1);transition:width .18s linear}
.race-gap{grid-area:gap;color:var(--muted);font-size:.65rem;white-space:nowrap}
.race-chart-heading{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:12px;padding-top:11px;border-top:1px solid #29405f}
.race-chart-heading>strong{font-size:.72rem;color:#cfe9fa;text-transform:uppercase;letter-spacing:.06em}
.race-chart-legend{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px 11px}
.race-chart-legend span{display:inline-flex;align-items:center;gap:5px;color:var(--muted);font-size:.68rem}
.race-chart-legend i{width:14px;height:3px;border-radius:999px;background:var(--series-color)}
.race-hud canvas.race-chart{width:100%;display:block;margin-top:8px;border:1px solid #29405f;border-radius:12px;background:linear-gradient(180deg,#07131f,#091a2b);transition:height .18s ease}
.race-hud[data-chart-size="small"] canvas.race-chart{height:170px}
.race-hud[data-chart-size="medium"] canvas.race-chart{height:270px}
.race-hud[data-chart-size="large"] canvas.race-chart{height:410px}
.sim-card{position:relative;transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease}
.sim-card.spotlight{border-color:var(--accent);box-shadow:0 0 0 3px rgba(99,215,255,.22),0 16px 50px rgba(0,0,0,.28);transform:translateY(-2px)}
.sim-card.finished-card::before{content:attr(data-finish-place) " finish";position:absolute;z-index:3;top:-9px;right:13px;padding:4px 8px;border:1px solid #7385a1;border-radius:999px;background:#101d2e;color:#e8f4ff;font-size:.62rem;font-weight:850;text-transform:uppercase;letter-spacing:.05em;box-shadow:0 5px 15px rgba(0,0,0,.3)}
@keyframes leader-pop{0%{box-shadow:0 0 0 0 rgba(112,225,161,.55)}45%{box-shadow:0 0 0 5px rgba(112,225,161,.14)}100%{box-shadow:inset 0 0 0 1px rgba(112,225,161,.18)}}
@media(max-width:760px){
  .race-hud-head{flex-direction:column}
  .race-hud-tools{width:100%;justify-content:space-between}
  .graph-size-control{justify-items:start}
  .race-clock{justify-items:start}
  .race-chart-heading{align-items:flex-start}
  .race-chart-legend{justify-content:flex-start}
}
'''
styles_path.write_text(styles[:css_start] + new_css + styles[css_end:], encoding="utf-8")

replace(JS / "version.js", 'export const APP_VERSION = "3.1.0";', 'export const APP_VERSION = "3.2.0";')

model_path = ROOT / "MODEL.md"
model = model_path.read_text(encoding="utf-8")
old_model = '''### Live race HUD and visual event callouts

The live race HUD ranks only the currently visible methods. Before every visible method has finished, ranking uses these deterministic comparisons in order:

1. more seated passengers
2. more passengers released through the aircraft door
3. greater summed fractional aisle progress among active passengers
4. the fixed method-list order as a final tie breaker

After methods finish, completed methods rank by their final completion time. The displayed progress percentage is simply seated passengers divided by total passengers. A gap such as "3 passengers back" is a difference in seated counts, not a prediction of how many seconds remain.

The HUD also derives visual-only race moments from existing state:

- a lead change among the visible methods
- a carry-on stow lasting at least 11.5 seconds
- a seating event with two or more already-seated blockers
- an episode with at least three simultaneous stowing or seating passengers
- each method's finish position and time

These rankings, pulses, ribbons, and callouts do not alter queue order, timing, random draws, simulation steps, or results. Clicking a HUD row or event only emphasizes and scrolls to the corresponding aircraft panel.
'''
new_model = '''### Live race HUD and race graph

The live race HUD ranks only the currently visible methods. Before every visible method has finished, ranking uses these deterministic comparisons in order:

1. more seated passengers
2. more passengers released through the aircraft door
3. greater summed fractional aisle progress among active passengers
4. the fixed method-list order as a final tie breaker

After methods finish, completed methods rank by their final completion time. The displayed progress percentage is simply seated passengers divided by total passengers. A gap such as "3 passengers back" is a difference in seated counts, not a prediction of how many seconds remain.

The compact leaderboard names are presentation aliases only: Random, Back → Front, Front → Back, Zones, WilMA, and Steffen. The full method names and algorithms are unchanged.

The live graph places simulated time on the horizontal axis and cumulative seated passengers on the vertical axis. It records display samples for all six synchronized simulations, including methods whose aircraft panels are currently hidden. Revealing a method later therefore reveals its earlier graph trajectory as well as its current aircraft state. The graph draws only the currently selected methods.

Small, Medium, and Large change only the graph's rendered height. Graph sampling happens during UI paints, so points may be farther apart at very high animation speeds; the line is a visual history of existing state rather than a new simulation measurement. The leaderboard, graph, lead animation, finish ribbons, and click-to-emphasize behavior do not alter queue order, timing, random draws, simulation steps, or results.
'''
if old_model not in model:
    raise RuntimeError("old MODEL HUD section not found")
model_path.write_text(model.replace(old_model, new_model, 1), encoding="utf-8")

task_path = ROOT / "tasks" / "TASK-004-race-presentation-replay-and-turning-points.md"
task = task_path.read_text(encoding="utf-8")
old_task = '''## First visual slice — done in candidate

The first race-presentation slice now includes:

- a live leaderboard above the aircraft cards
- current rank, seated percentage, and seated-passenger gap for every visible method
- deterministic tie breakers using passengers entered and active aisle progress
- animated lead-change moments
- finish-position ribbons and finish events
- callouts for unusually long bag stows, double seat conflicts, and three-or-more simultaneous blockers
- click-to-emphasize behavior from leaderboard rows and event chips
- no changes to simulation rules or numerical results

The exact ranking and callout rules are documented in `MODEL.md` and the generated model guide.

## Remaining race presentation

- richer current-bottleneck explanations
- optional full-field overview separate from the aircraft cards
- more deliberate finish ceremony and final standings
- configurable event density or quiet mode
'''
new_task = '''## First two visual slices — done in candidate

The race presentation now includes:

- a live leaderboard above the aircraft cards
- compact method names that remain readable in narrow layouts
- current rank, seated percentage, and seated-passenger gap for every visible method
- deterministic tie breakers using passengers entered and active aisle progress
- animated lead changes and finish-position ribbons
- click-to-emphasize behavior from leaderboard rows
- a live step graph with simulated time on the horizontal axis and passengers seated on the vertical axis
- graph history for all six synchronized methods, even while some panels are hidden
- Small, Medium, and Large graph sizes that do not reset or alter the race
- no changes to simulation rules or numerical results

The Race Moments ticker was removed after review because it added visual noise without enough explanatory value. The exact ranking and graph rules are documented in `MODEL.md` and the generated model guide.

## Remaining race presentation

- richer current-bottleneck explanations inside the aircraft view, only when they clarify something visible
- optional full-field overview separate from the aircraft cards
- more deliberate finish ceremony and final standings
- post-race explanation of where the winner gained time
'''
if old_task not in task:
    raise RuntimeError("old task slice not found")
task_path.write_text(task.replace(old_task, new_task, 1), encoding="utf-8")
