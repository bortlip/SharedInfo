from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SIM = ROOT / "simulations" / "group-aware-boarding"


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected one match in {path}, found {count}: {old[:80]!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


race_js = '''import { METHODS } from "./constants.js";
import { clamp } from "./random.js";

export function simultaneousBlockers(sim){
  return sim.active.filter(passenger=>passenger.state==="stowing" || passenger.state==="seating").length;
}

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
'''
(SIM / "src" / "js" / "race.js").write_text(race_js, encoding="utf-8")

replace_once(
    SIM / "tools" / "build_simulator.py",
    '    "format.js",\n    "render.js",',
    '    "format.js",\n    "race.js",\n    "render.js",'
)

replace_once(
    SIM / "src" / "js" / "version.js",
    'export const APP_VERSION = "3.0.0";\n',
    'export const APP_VERSION = "3.1.0";\n'
)

replace_once(
    SIM / "src" / "README.md",
    '- `js/format.js` contains time and benchmark-statistic helpers.\n- `js/render.js` draws one simulation.',
    '- `js/format.js` contains time and benchmark-statistic helpers.\n- `js/race.js` ranks synchronized methods for the visual race HUD.\n- `js/render.js` draws one simulation.'
)

replace_once(
    SIM / "src" / "js" / "simulation.js",
    '''    if(blockers){
      this.seatConflicts+=blockers;
      this.conflictSeconds+=penalty;
    }
    return p.seatBase+penalty;''',
    '''    p.visualBlockers=blockers;
    p.visualConflictTime=blockers?this.time:null;
    if(blockers){
      this.seatConflicts+=blockers;
      this.conflictSeconds+=penalty;
    }
    return p.seatBase+penalty;'''
)

hud_html = '''  <section class="card race-hud" aria-labelledby="raceHudHeading">
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
  </section>

'''
replace_once(
    SIM / "src" / "index.html",
    '  <main class="sim-grid" id="simGrid">\n',
    hud_html + '  <main class="sim-grid" id="simGrid">\n'
)

hud_css = '''
.race-hud{padding:16px;margin-bottom:16px;overflow:hidden}
.race-hud-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:12px}
.race-title-line{display:flex;align-items:center;flex-wrap:wrap;gap:8px}
.race-title-line h2{margin:0;font-size:1.12rem}
.race-hud-head p{margin:4px 0 0;color:var(--muted);font-size:.77rem;line-height:1.4}
.provisional-badge{padding:3px 7px;border:1px solid #5c6f3a;border-radius:999px;background:#192416;color:#d5eca0;font-size:.62rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
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
.race-events-wrap{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:start;gap:9px;margin-top:11px;padding-top:10px;border-top:1px solid #29405f}
.race-events-label{padding-top:5px;color:var(--muted);font-size:.64rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em}
.race-events{display:flex;flex-wrap:wrap;gap:6px;min-height:28px}
.race-event{padding:5px 8px;border:1px solid #36516f;border-radius:999px;background:#081625;color:#cfe6f7;font-size:.68rem;line-height:1.25;transform:none}
.race-event:hover{transform:none;border-color:#67aac5;background:#10253d}
.race-event time{color:#7fa0bb;font-variant-numeric:tabular-nums}
.race-events-empty{padding:5px 0;color:#7890a8;font-size:.7rem}
.sim-card{position:relative;transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease}
.sim-card.spotlight{border-color:var(--accent);box-shadow:0 0 0 3px rgba(99,215,255,.22),0 16px 50px rgba(0,0,0,.28);transform:translateY(-2px)}
.sim-card.event-pulse{animation:card-event-pulse .95s ease}
.sim-card.finished-card::before{content:attr(data-finish-place) " finish";position:absolute;z-index:3;top:-9px;right:13px;padding:4px 8px;border:1px solid #7385a1;border-radius:999px;background:#101d2e;color:#e8f4ff;font-size:.62rem;font-weight:850;text-transform:uppercase;letter-spacing:.05em;box-shadow:0 5px 15px rgba(0,0,0,.3)}
@keyframes leader-pop{0%{box-shadow:0 0 0 0 rgba(112,225,161,.55)}45%{box-shadow:0 0 0 5px rgba(112,225,161,.14)}100%{box-shadow:inset 0 0 0 1px rgba(112,225,161,.18)}}
@keyframes card-event-pulse{0%,100%{border-color:var(--line)}45%{border-color:var(--warn);box-shadow:0 0 0 4px rgba(255,201,107,.13),0 16px 50px rgba(0,0,0,.25)}}
@media(max-width:760px){
  .race-hud-head{flex-direction:column}
  .race-clock{justify-items:start}
  .race-events-wrap{grid-template-columns:1fr}
}
'''
replace_once(
    SIM / "src" / "styles.css",
    '\n.sim-grid{\n',
    hud_css + '\n.sim-grid{\n'
)

replace_once(
    SIM / "src" / "js" / "app.js",
    'import { benchmarkSignature, formatTime, sameBenchmarkResults, stats } from "./format.js";\n',
    'import { benchmarkSignature, formatTime, sameBenchmarkResults, stats } from "./format.js";\nimport { rankRace, simultaneousBlockers } from "./race.js";\n'
)

replace_once(
    SIM / "src" / "js" / "app.js",
    'let selectedMethods = new Set(METHODS);\nlet raceLayout = "standard";\n',
    '''let selectedMethods = new Set(METHODS);
let raceLayout = "standard";
const raceHud={
  leader:null,
  events:[],
  seen:new Set(),
  blocking:new Map(),
  finished:new Set(),
  leadFlash:new Map(),
  spotlightTimer:null,
  lastPaint:0
};
'''
)

hud_js = '''
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
  raceHud.lastPaint=0;
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
'''
replace_once(
    SIM / "src" / "js" / "app.js",
    '''function activeMethods(){
  return METHODS.filter(method=>selectedMethods.has(method));
}
''',
    '''function activeMethods(){
  return METHODS.filter(method=>selectedMethods.has(method));
}
''' + hud_js
)

replace_once(
    SIM / "src" / "js" / "app.js",
    '''  clearBenchmark();
  renderAll();
  if(announce){''',
    '''  clearBenchmark();
  raceHud.leader=null;
  renderAll();
  if(announce){'''
)

replace_once(
    SIM / "src" / "js" / "app.js",
    '''  sims={};
  for(const method of METHODS) sims[method]=new BoardingSim(manifest,method,cfg);
  running=false;''',
    '''  sims={};
  for(const method of METHODS) sims[method]=new BoardingSim(manifest,method,cfg);
  clearRaceHud();
  running=false;'''
)

replace_once(
    SIM / "src" / "js" / "app.js",
    '''  }
  if(allDone && running){''',
    '''  }
  renderRaceHud();
  if(allDone && running){'''
)

replace_once(
    SIM / "src" / "js" / "app.js",
    '''  renderScenarioCards();
  renderMethodPicker();
  const fromUrl=parseScenarioSearch(location.search);''',
    '''  renderScenarioCards();
  renderMethodPicker();
  initializeRaceHud();
  const fromUrl=parseScenarioSearch(location.search);'''
)

replace_once(
    SIM / "MODEL.md",
    '''"Finish instantly" completes all six animated method simulations. The completion message ranks only the methods currently visible.

### Roomy and Compact Fleet display''',
    '''"Finish instantly" completes all six animated method simulations. The completion message ranks only the methods currently visible.

### Live race HUD and visual event callouts

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

### Roomy and Compact Fleet display'''
)

new_task = '''# TASK-004: Race Presentation, Replay, and Turning Points

**Status:** In progress

## Goal

Make six simultaneous simulations entertaining to watch and easy to understand as a competitive race.

## First visual slice — done in candidate

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

## Replay

Store deterministic event/state information so the user can:

- pause and step
- scrub through time
- jump to conflicts or character events
- replay the final minute
- synchronize two methods at the same simulated time

## Turning points

After completion, identify a small set of meaningful moments such as:

- largest single blockage
- burst of parallel stowing
- major seat-conflict cluster
- late event that changed the lead
- final passenger entering the aircraft

## Acceptance criteria

- Race mode never changes model results
- Replay reproduces the same final fingerprint
- Lead calculations are documented
- Users can jump to at least three event categories
- The post-race recap explains why the winner gained time
'''
(SIM / "tasks" / "TASK-004-race-presentation-replay-and-turning-points.md").write_text(new_task, encoding="utf-8")
