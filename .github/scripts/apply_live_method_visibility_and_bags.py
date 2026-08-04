from pathlib import Path

ROOT = Path('simulations/group-aware-boarding')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'Could not locate {label}')
    return text.replace(old, new, 1)

# Method selection controls visibility only. Every method exists and advances in sync.
app_path = ROOT / 'src/js/app.js'
app = app_path.read_text(encoding='utf-8')
old_apply = '''function applyMethodSelection(methods,{resetRace=false}={}){
  const valid=[...new Set(methods)].filter(method=>METHODS.includes(method));
  if(!valid.length) return false;
  selectedMethods=new Set(valid);
  updateRaceView();
  if(resetRace){
    clearBenchmark();
    reset();
  }
  return true;
}'''
new_apply = '''function applyMethodSelection(methods,{announce=false}={}){
  const valid=[...new Set(methods)].filter(method=>METHODS.includes(method));
  if(!valid.length) return false;
  selectedMethods=new Set(valid);
  updateRaceView();
  clearBenchmark();
  renderAll();
  if(announce){
    const count=valid.length;
    const continuation=running
      ? " All six simulations are still running in sync."
      : " All six simulations remain synchronized behind the view.";
    $("status").textContent=`Showing ${count} boarding method${count===1?"":"s"}.${continuation}`;
  }
  return true;
}'''
app = replace_once(app, old_apply, new_apply, 'method selection behavior')
app = replace_once(
    app,
    '      applyMethodSelection([...next],{resetRace:true});',
    '      applyMethodSelection([...next],{announce:true});',
    'method toggle handler',
)
app = replace_once(
    app,
    '  $("selectAllMethodsBtn").addEventListener("click",()=>applyMethodSelection(METHODS,{resetRace:true}));',
    '  $("selectAllMethodsBtn").addEventListener("click",()=>applyMethodSelection(METHODS,{announce:true}));',
    'select all handler',
)
app = replace_once(
    app,
    '  for(const method of activeMethods()) sims[method]=new BoardingSim(manifest,method,cfg);',
    '  for(const method of METHODS) sims[method]=new BoardingSim(manifest,method,cfg);',
    'reset simulation creation',
)
old_render = '''function renderAll(){
  const methods=activeMethods();
  let allDone=methods.length>0;
  for(const method of methods){
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
    const winner=methods.slice().sort((a,b)=>sims[a].time-sims[b].time)[0];
    $("status").textContent=methods.length===1
      ? `Complete. ${META[winner].label} finished ${currentScenarioName()} at ${formatTime(sims[winner].time)}.`
      : `Complete. ${META[winner].label} won ${currentScenarioName()} at ${formatTime(sims[winner].time)}.`;
  }
}'''
new_render = '''function renderAll(){
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
  if(allDone && running){
    running=false;
    const winner=methods.slice().sort((a,b)=>sims[a].time-sims[b].time)[0];
    $("status").textContent=methods.length===1
      ? `Complete. ${META[winner].label} finished ${currentScenarioName()} at ${formatTime(sims[winner].time)}.`
      : `Complete. ${META[winner].label} won ${currentScenarioName()} at ${formatTime(sims[winner].time)}.`;
  }
}'''
app = replace_once(app, old_render, new_render, 'renderAll function')
app = replace_once(
    app,
    '      for(const method of activeMethods()) sims[method].step(FIXED_DT);',
    '      for(const method of METHODS) sims[method].step(FIXED_DT);',
    'animation loop',
)
old_run = '''function run(){
  const methods=activeMethods();
  if(!manifest || methods.some(method=>sims[method]?.done)) reset();
  running=true;
  $("pauseBtn").textContent="Pause";
  $("status").textContent=`Running ${currentScenarioName()} through ${methods.length} selected method${methods.length===1?"":"s"}…`;
}'''
new_run = '''function run(){
  const methods=activeMethods();
  if(!manifest || METHODS.every(method=>sims[method]?.done)) reset();
  running=true;
  $("pauseBtn").textContent="Pause";
  $("status").textContent=`Showing ${methods.length} selected method${methods.length===1?"":"s"} while all six simulations run in sync…`;
}'''
app = replace_once(app, old_run, new_run, 'run function')
app = replace_once(
    app,
    '  if(!running && activeMethods().every(method=>sims[method]?.time===0)){',
    '  if(!running && METHODS.every(method=>sims[method]?.time===0)){',
    'pause empty-state check',
)
old_finish = '''function finish(){
  running=false;
  $("pauseBtn").textContent="Pause";
  const methods=activeMethods();
  for(const method of methods) sims[method].runToEnd(.15);
  renderAll();
  const winner=methods.slice().sort((a,b)=>sims[a].time-sims[b].time)[0];
  $("status").textContent=methods.length===1
    ? `Complete. ${META[winner].label} finished ${currentScenarioName()} at ${formatTime(sims[winner].time)}.`
    : `Complete. ${META[winner].label} won ${currentScenarioName()} at ${formatTime(sims[winner].time)}.`;
}'''
new_finish = '''function finish(){
  running=false;
  $("pauseBtn").textContent="Pause";
  const methods=activeMethods();
  for(const method of METHODS) sims[method].runToEnd(.15);
  renderAll();
  const winner=methods.slice().sort((a,b)=>sims[a].time-sims[b].time)[0];
  $("status").textContent=methods.length===1
    ? `Complete. ${META[winner].label} finished ${currentScenarioName()} at ${formatTime(sims[winner].time)}.`
    : `Complete. ${META[winner].label} won ${currentScenarioName()} at ${formatTime(sims[winner].time)}.`;
}'''
app = replace_once(app, old_finish, new_finish, 'finish function')
app_path.write_text(app, encoding='utf-8')

# Persist bag placement after stowing so the renderer can show overhead contents.
simulation_path = ROOT / 'src/js/simulation.js'
simulation = simulation_path.read_text(encoding='utf-8')
simulation = replace_once(
    simulation,
    '    this.binLoad=new Map();\n    this.seatConflicts=0;',
    '    this.binLoad=new Map();\n    this.stowedBags=[];\n    this.seatConflicts=0;',
    'stowed bag collection',
)
simulation = replace_once(
    simulation,
    '''        if(p.remaining<=0){
          p.state="seating";
          p.remaining=this.computeSeat(p);
        }''',
    '''        if(p.remaining<=0){
          if(p.hasBag && !p.bagStowed){
            p.bagStowed=true;
            this.stowedBags.push({
              passengerId:p.id,
              row:p.row,
              side:p.side,
              groupType:p.groupType,
              color:p.partyColor||null
            });
          }
          p.state="seating";
          p.remaining=this.computeSeat(p);
        }''',
    'stowing completion',
)
simulation = replace_once(
    simulation,
    '''          p.pos=p.row;
          p.state="stowing";
          p.remaining=this.computeStow(p);''',
    '''          p.pos=p.row;
          p.state="stowing";
          p.stowDuration=this.computeStow(p);
          p.remaining=p.stowDuration;''',
    'stowing start',
)
simulation_path.write_text(simulation, encoding='utf-8')

# Replace the canvas renderer with a luggage-aware cabin view.
render_path = ROOT / 'src/js/render.js'
render_path.write_text('''import { ROWS, COLS, palette } from "./constants.js";
import { clamp } from "./random.js";
import { formatTime } from "./format.js";

function roundedRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  if(ctx.roundRect) ctx.roundRect(x,y,w,h,r);
  else ctx.rect(x,y,w,h);
}

function drawBag(ctx,x,y,w,h,color,alpha=1){
  ctx.save();
  ctx.globalAlpha=alpha;
  roundedRect(ctx,x,y,w,h,Math.min(2,w*.25,h*.25));
  ctx.fillStyle=color;
  ctx.fill();
  ctx.strokeStyle="rgba(255,255,255,.72)";
  ctx.lineWidth=Math.max(.7,w*.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x+w*.34,y);
  ctx.lineTo(x+w*.34,y-h*.18);
  ctx.lineTo(x+w*.66,y-h*.18);
  ctx.lineTo(x+w*.66,y);
  ctx.strokeStyle="rgba(235,247,255,.8)";
  ctx.lineWidth=Math.max(.6,w*.08);
  ctx.stroke();
  ctx.restore();
}

function bagColor(item){
  if(item.groupType==="family") return item.color||palette.family;
  return palette[item.groupType]||palette.single;
}

export function drawSim(sim,canvas){
  const ctx=canvas.getContext("2d");
  const w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);

  const top=34,bottom=h-18;
  const rowH=(bottom-top)/ROWS;
  const seatW=Math.min(38,(w-130)/6);
  const gap=3;
  const aisleW=Math.max(42,w*.13);
  const binW=Math.max(9,Math.min(11,w*.026));
  const blockW=3*seatW+2*gap;
  const totalW=blockW*2+aisleW+binW*2;
  const left=(w-totalW)/2;
  const leftBinX=left+blockW;
  const aisleX=leftBinX+binW;
  const rightBinX=aisleX+aisleW;
  const rightX=rightBinX+binW;

  const bagsByBin=new Map();
  for(const bag of sim.stowedBags||[]){
    const key=`${bag.row}${bag.side}`;
    if(!bagsByBin.has(key)) bagsByBin.set(key,[]);
    bagsByBin.get(key).push(bag);
  }
  const activeStows=new Set(
    sim.active
      .filter(p=>p.state==="stowing" && p.hasBag)
      .map(p=>`${p.row}${p.side}`)
  );

  ctx.fillStyle=palette.aisle;
  ctx.fillRect(aisleX-5,top-8,aisleW+10,bottom-top+16);
  ctx.strokeStyle=palette.grid;
  ctx.lineWidth=1;
  ctx.strokeRect(aisleX-5,top-8,aisleW+10,bottom-top+16);

  ctx.font="11px system-ui";
  ctx.textAlign="center";
  ctx.textBaseline="middle";

  for(let r=1;r<=ROWS;r++){
    const y=top+(r-1)*rowH;
    if(r%5===0 || r===1 || r===31){
      ctx.fillStyle=palette.text;
      ctx.textAlign="right";
      ctx.fillText(String(r),left-7,y+rowH/2);
      ctx.textAlign="center";
    }

    for(const [side,bx] of [["L",leftBinX],["R",rightBinX]]){
      const key=`${r}${side}`;
      ctx.fillStyle=activeStows.has(key)?"#244d67":"#10283c";
      ctx.fillRect(bx,y+1,binW,rowH-2);
      ctx.strokeStyle=activeStows.has(key)?"#70d9ff":palette.grid;
      ctx.strokeRect(bx+.5,y+1.5,binW-1,rowH-3);
    }

    for(let ci=0;ci<6;ci++){
      const col=COLS[ci];
      const x=ci<3 ? left+ci*(seatW+gap) : rightX+(ci-3)*(seatW+gap);
      const key=`${r}${col}`;
      const occ=sim.occupancy.get(key);
      const assigned=sim.assignedSeats.has(key);
      ctx.fillStyle=occ
        ? (occ.groupType==="family"? (occ.partySeatedColor||"#c38a38") : occ.groupType==="assisted" ? "#9a61b9" : palette.seated)
        : assigned ? palette.empty : palette.unassigned;
      ctx.fillRect(x,y+1,seatW,rowH-2);
      ctx.strokeStyle=occ?"rgba(255,255,255,.22)":palette.grid;
      ctx.strokeRect(x+.5,y+1.5,seatW-1,rowH-3);
      if(rowH>17){
        ctx.fillStyle=occ?"rgba(255,255,255,.78)":"rgba(220,235,255,.45)";
        ctx.font="9px system-ui";
        ctx.fillText(col,x+seatW/2,y+rowH/2);
      }
    }

    for(const [side,bx] of [["L",leftBinX],["R",rightBinX]]){
      const bags=bagsByBin.get(`${r}${side}`)||[];
      if(!bags.length) continue;
      const bagH=Math.min(4.5,(rowH-4-(bags.length-1))/bags.length);
      const totalH=bags.length*bagH+(bags.length-1);
      const startY=y+(rowH-totalH)/2;
      bags.forEach((bag,index)=>{
        drawBag(ctx,bx+2,startY+index*(bagH+1),Math.max(4,binW-4),bagH,bagColor(bag),.95);
      });
    }
  }

  ctx.fillStyle="#0b1726";
  ctx.fillRect(aisleX,top-29,aisleW,22);
  ctx.strokeStyle=palette.grid;
  ctx.strokeRect(aisleX+.5,top-28.5,aisleW-1,21);
  ctx.fillStyle=palette.text;
  ctx.font="10px system-ui";
  ctx.fillText(`door · ${sim.queue.length-sim.pending} waiting`,aisleX+aisleW/2,top-18);

  const activePoint=p=>({
    p,
    y:top+(clamp(p.pos,0,ROWS)-.5)*rowH,
    x:aisleX+aisleW/2 + ((p.id%3)-1)*Math.min(4,aisleW*.08)
  });
  const points=sim.active.map(activePoint);
  const activeFamilies=new Map();
  for(const point of points){
    if(point.p.groupType!=="family") continue;
    if(!activeFamilies.has(point.p.unitId)) activeFamilies.set(point.p.unitId,[]);
    activeFamilies.get(point.p.unitId).push(point);
  }

  // Subtle connectors make contiguous members of the same family read as one party.
  for(const members of activeFamilies.values()){
    if(members.length<2) continue;
    members.sort((a,b)=>a.p.queueIndex-b.p.queueIndex);
    ctx.save();
    ctx.globalAlpha=.48;
    ctx.strokeStyle=members[0].p.partyColor||palette.family;
    ctx.lineWidth=2.2;
    ctx.beginPath();
    ctx.moveTo(members[0].x,members[0].y);
    for(let i=1;i<members.length;i++) ctx.lineTo(members[i].x,members[i].y);
    ctx.stroke();
    ctx.restore();
  }

  for(const {p,x,y} of points){
    const color=p.groupType==="family"?(p.partyColor||palette.family):palette[p.groupType];
    if(p.hasBag && !p.bagStowed){
      let bagX=x+(p.side==="L"?-10:4);
      let bagY=y-2;
      if(p.state==="stowing"){
        const targetX=p.side==="L"?leftBinX+binW/2:rightBinX+binW/2;
        const duration=Math.max(.001,p.stowDuration||p.remaining||1);
        const progress=clamp(1-p.remaining/duration,0,1);
        const eased=1-Math.pow(1-progress,2);
        bagX=(x-3.5)+(targetX-x)*eased;
        bagY=y-4-Math.sin(progress*Math.PI)*5;
        ctx.save();
        ctx.setLineDash([2,3]);
        ctx.strokeStyle="rgba(153,226,255,.42)";
        ctx.beginPath();
        ctx.moveTo(x,y);
        ctx.lineTo(targetX,y);
        ctx.stroke();
        ctx.restore();
      }
      drawBag(ctx,bagX,bagY,7,8,color,.98);
    }

    const radius=p.isChild?4.3:5.6;
    ctx.beginPath();
    ctx.arc(x,y,radius,0,Math.PI*2);
    ctx.fillStyle=color;
    ctx.fill();
    if(p.isChild){
      ctx.strokeStyle=palette.child;
      ctx.lineWidth=1.5;
      ctx.stroke();
    }else if(p.isReduced){
      ctx.strokeStyle="#f6e7ff";
      ctx.lineWidth=1.7;
      ctx.stroke();
    }
  }

  // Keep one label visible per active family. As the leader sits, the next member inherits it.
  for(const members of activeFamilies.values()){
    const carrier=members.reduce((best,item)=>item.p.queueIndex<best.p.queueIndex?item:best);
    const label=`${carrier.p.partyLabel}·${carrier.p.partySize}`;
    ctx.save();
    ctx.font="700 8px system-ui";
    ctx.textAlign="left";
    ctx.textBaseline="middle";
    const padX=3;
    const boxW=ctx.measureText(label).width+padX*2;
    const boxH=13;
    let labelX=carrier.x+8;
    if(labelX+boxW>w-3) labelX=carrier.x-8-boxW;
    const labelY=clamp(carrier.y-boxH/2-7,2,h-boxH-2);
    roundedRect(ctx,labelX,labelY,boxW,boxH,4);
    ctx.fillStyle="rgba(5,14,25,.90)";
    ctx.fill();
    ctx.strokeStyle=carrier.p.partyColor||palette.family;
    ctx.lineWidth=1;
    ctx.stroke();
    ctx.fillStyle="#f8fbff";
    ctx.fillText(label,labelX+padX,labelY+boxH/2+.25);
    ctx.restore();
  }

  if(sim.done){
    const plaqueW=Math.min(190,w-24);
    const plaqueH=62;
    const plaqueX=(w-plaqueW)/2;
    const plaqueY=h/2-plaqueH/2;
    roundedRect(ctx,plaqueX,plaqueY,plaqueW,plaqueH,12);
    ctx.fillStyle="rgba(6,15,27,.92)";
    ctx.fill();
    ctx.strokeStyle="#4c7898";
    ctx.lineWidth=1.2;
    ctx.stroke();
    ctx.fillStyle="#e9f8ff";
    ctx.font="800 25px system-ui";
    ctx.fillText(formatTime(sim.time),w/2,plaqueY+23);
    ctx.fillStyle="#9eb0c9";
    ctx.font="12px system-ui";
    ctx.fillText("boarding complete",w/2,plaqueY+45);
  }
}
''', encoding='utf-8')

# Explain the visual without implying finite-capacity bin behavior.
index_path = ROOT / 'src/index.html'
index = index_path.read_text(encoding='utf-8')
index = replace_once(
    index,
    '        <span><i class="dot" style="background:var(--assist)"></i>assisted party</span>',
    '        <span><i class="dot" style="background:var(--assist)"></i>assisted party</span>\n        <span title="Carry-ons travel with passengers, animate into their row-side overhead bin, and remain visible there.">🧳 carry-on and overhead-bin placement</span>',
    'luggage legend',
)
index = replace_once(
    index,
    '        <p><strong>Blocked aisle:</strong> cumulative simulated wall-clock time during which at least one passenger is stowing a bag or entering a seat. Multiple simultaneous blockers are counted once for that time interval, and ordinary walking queues do not add to this metric.</p>',
    '        <p><strong>Blocked aisle:</strong> cumulative simulated wall-clock time during which at least one passenger is stowing a bag or entering a seat. Multiple simultaneous blockers are counted once for that time interval, and ordinary walking queues do not add to this metric.</p>\n        <p><strong>Visible luggage:</strong> passengers with carry-ons keep a suitcase marker while walking. During stowing it moves into the overhead strip on the correct row side, then remains visible there. This visualizes the existing luggage timing model; bins still have no hard capacity or overflow search.</p>',
    'visible luggage explanation',
)
index_path.write_text(index, encoding='utf-8')

# Update task documentation.
task19_path = ROOT / 'tasks/TASK-019-method-selection-and-race-layouts.md'
task19 = task19_path.read_text(encoding='utf-8')
task19 = task19.replace(
    '- Method changes reset the visible race and clear benchmark results because the comparison field changed.\n',
    '- Method toggles are a view choice only: all six simulations are created together and continue advancing in sync, including hidden methods.\n- Revealing a method mid-run immediately shows its current synchronized state; hiding or revealing methods never pauses or resets the race.\n- Method changes clear benchmark results because the benchmark comparison field changed, but they do not alter the animation.\n',
    1,
)
task19_path.write_text(task19, encoding='utf-8')

readme_path = ROOT / 'tasks/README.md'
readme = readme_path.read_text(encoding='utf-8')
entry = '20. [TASK-020: Visible Luggage and Overhead Bins](TASK-020-visible-luggage-and-overhead-bins.md)\n'
if entry not in readme:
    readme = replace_once(
        readme,
        '19. [TASK-019: Method Selection and Race Layouts](TASK-019-method-selection-and-race-layouts.md)\n',
        '19. [TASK-019: Method Selection and Race Layouts](TASK-019-method-selection-and-race-layouts.md)\n' + entry,
        'TASK-020 backlog entry',
    )
readme_path.write_text(readme, encoding='utf-8')

(ROOT / 'tasks/TASK-020-visible-luggage-and-overhead-bins.md').write_text('''# TASK-020: Visible Luggage and Overhead Bins

**Status: In progress**

## Goal

Make carry-ons part of the visible story of the race rather than an invisible delay number.

## Functional behavior

- A passenger with a carry-on has a small suitcase marker while walking down the aisle.
- While the passenger is stowing, the suitcase moves from the passenger toward the overhead bin on the correct side of the assigned row.
- After stowing completes, the suitcase remains visible in that row-side bin for the rest of the simulation.
- Each method has its own independent overhead-bin contents because its boarding order creates a different stowing history.
- The completed-flight plaque no longer darkens the entire cabin, so seated passengers and stored luggage remain visible.
- The existing bag probability, stow-duration, and congestion calculations are unchanged.
- This is not finite-bin-capacity modeling: there is still no overflow search, gate checking, or alternate-row placement.

## Release safety

This task changes modular source and regenerates `dist/simulator.html`. It must not modify the released root `simulator.html` or root `index.html`.
''', encoding='utf-8')
