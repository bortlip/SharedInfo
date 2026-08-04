from pathlib import Path
import re

root=Path('simulations/group-aware-boarding')
js=root/'src/js'

def replace_once(path,old,new):
    text=path.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'missing replacement in {path}: {old[:80]!r}')
    path.write_text(text.replace(old,new,1),encoding='utf-8')

# Version.
version=js/'version.js'
version.write_text(version.read_text(encoding='utf-8').replace('3.2.0','3.3.0'),encoding='utf-8')

# Preserve the full seating duration for visual interpolation only.
simulation=js/'simulation.js'
replace_once(
    simulation,
    '          p.state="seating";\n          p.remaining=this.computeSeat(p);',
    '          p.state="seating";\n          p.seatingDuration=this.computeSeat(p);\n          p.remaining=p.seatingDuration;'
)

# Generic character metadata hooks. They are inert until a scenario assigns values.
manifest=js/'manifest.js'
replace_once(
    manifest,
    '      unitId:unit.id, groupType:type, isChild,isReduced, hasBag, bagBase, seatBase, walkSpeed\n',
    '      unitId:unit.id, groupType:type, isChild,isReduced, hasBag, bagBase, seatBase, walkSpeed,\n      displayName:null, characterId:null, characterRole:null, characterStatus:null, eventState:null\n'
)

render=r'''import { ROWS, COLS, palette } from "./constants.js";
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

export function cabinGeometry(w,h){
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
  return {w,h,top,bottom,rowH,seatW,gap,aisleW,binW,blockW,totalW,left,leftBinX,aisleX,rightBinX,rightX};
}

export function seatRect(geometry,row,col){
  const ci=COLS.indexOf(col);
  if(ci<0 || row<1 || row>ROWS) return null;
  const x=ci<3
    ? geometry.left+ci*(geometry.seatW+geometry.gap)
    : geometry.rightX+(ci-3)*(geometry.seatW+geometry.gap);
  const y=geometry.top+(row-1)*geometry.rowH+1;
  return {x,y,w:geometry.seatW,h:geometry.rowH-2,cx:x+geometry.seatW/2,cy:y+(geometry.rowH-2)/2};
}

export function passengerPoint(passenger,geometry){
  const aisleCenter=geometry.aisleX+geometry.aisleW/2;
  const baseX=aisleCenter+((passenger.id%3)-1)*Math.min(4,geometry.aisleW*.08);
  let x=baseX;
  let y=geometry.top+(clamp(passenger.pos,0,ROWS)-.5)*geometry.rowH;
  let seatingProgress=0;
  if(passenger.state==="seating"){
    const target=seatRect(geometry,passenger.row,passenger.col);
    const duration=Math.max(.001,passenger.seatingDuration||passenger.remaining||1);
    seatingProgress=clamp(1-passenger.remaining/duration,0,1);
    const eased=seatingProgress<.5
      ? 2*seatingProgress*seatingProgress
      : 1-Math.pow(-2*seatingProgress+2,2)/2;
    x=baseX+(target.cx-baseX)*eased;
    y=target.cy-Math.sin(seatingProgress*Math.PI)*Math.min(4,geometry.rowH*.18);
  }
  return {p:passenger,x,y,seatingProgress};
}

export function hitTestSim(sim,canvas,clientX,clientY){
  const rect=canvas.getBoundingClientRect();
  if(!rect.width || !rect.height) return null;
  const x=(clientX-rect.left)*canvas.width/rect.width;
  const y=(clientY-rect.top)*canvas.height/rect.height;
  const geometry=cabinGeometry(canvas.width,canvas.height);

  const active=(sim.active||[]).map(passenger=>passengerPoint(passenger,geometry));
  for(let index=active.length-1;index>=0;index--){
    const point=active[index];
    const radius=(point.p.isChild?4.3:5.6)+5;
    if(Math.hypot(x-point.x,y-point.y)<=radius){
      return {kind:"passenger",passenger:point.p,point};
    }
  }

  for(let row=1;row<=ROWS;row++){
    for(const col of COLS){
      const seat=seatRect(geometry,row,col);
      if(x<seat.x || x>seat.x+seat.w || y<seat.y || y>seat.y+seat.h) continue;
      const seatKey=`${row}${col}`;
      const occupant=sim.occupancy.get(seatKey)||null;
      const assigned=occupant||sim.queue.find(passenger=>passenger.seatKey===seatKey)||null;
      return {
        kind:"seat",
        row,
        col,
        seatKey,
        occupant,
        assigned,
        isAssigned:sim.assignedSeats.has(seatKey),
        rect:seat
      };
    }
  }
  return null;
}

export function drawSim(sim,canvas){
  const ctx=canvas.getContext("2d");
  const w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);

  const geometry=cabinGeometry(w,h);
  const {top,bottom,rowH,seatW,gap,aisleW,binW,left,leftBinX,aisleX,rightBinX,rightX}=geometry;

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
      const seat=seatRect(geometry,r,col);
      const key=`${r}${col}`;
      const occ=sim.occupancy.get(key);
      const assigned=sim.assignedSeats.has(key);
      ctx.fillStyle=occ
        ? (occ.groupType==="family"? (occ.partySeatedColor||"#c38a38") : occ.groupType==="assisted" ? "#9a61b9" : palette.seated)
        : assigned ? palette.empty : palette.unassigned;
      ctx.fillRect(seat.x,seat.y,seat.w,seat.h);
      ctx.strokeStyle=occ?"rgba(255,255,255,.22)":palette.grid;
      ctx.strokeRect(seat.x+.5,seat.y+.5,seat.w-1,seat.h-1);
      if(rowH>17){
        ctx.fillStyle=occ?"rgba(255,255,255,.78)":"rgba(220,235,255,.45)";
        ctx.font="9px system-ui";
        ctx.fillText(col,seat.cx,seat.cy);
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

  const points=sim.active.map(passenger=>passengerPoint(passenger,geometry));
  const activeFamilies=new Map();
  for(const point of points){
    if(point.p.groupType!=="family") continue;
    if(!activeFamilies.has(point.p.unitId)) activeFamilies.set(point.p.unitId,[]);
    activeFamilies.get(point.p.unitId).push(point);
  }

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

  for(const {p,x,y,seatingProgress} of points){
    const color=p.groupType==="family"?(p.partyColor||palette.family):palette[p.groupType];
    if(p.state==="seating"){
      const target=seatRect(geometry,p.row,p.col);
      ctx.save();
      ctx.setLineDash([3,3]);
      ctx.strokeStyle=`rgba(134,220,255,${.24+.34*(1-seatingProgress)})`;
      ctx.lineWidth=1.2;
      ctx.beginPath();
      ctx.moveTo(aisleX+aisleW/2,target.cy);
      ctx.lineTo(target.cx,target.cy);
      ctx.stroke();
      ctx.restore();
    }

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
    if(p.characterId){
      ctx.beginPath();
      ctx.arc(x,y,radius+3.5,0,Math.PI*2);
      ctx.strokeStyle="#fff0a8";
      ctx.lineWidth=1.7;
      ctx.stroke();
    }
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
'''
(js/'render.js').write_text(render,encoding='utf-8')

interaction=r'''function escapeHtml(value){
  return String(value??"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

function passengerName(passenger){
  return passenger.displayName||`Passenger ${passenger.id+1}`;
}

function travelerType(passenger){
  if(passenger.isReduced) return "reduced-mobility traveler";
  if(passenger.isChild) return "child";
  if(passenger.groupType==="assisted") return "assisted-party companion";
  return "adult";
}

function partyText(passenger){
  if(passenger.groupType==="single") return "traveling alone";
  const label=passenger.partyLabel||passenger.unitId;
  const kind=passenger.groupType==="family"?"family":"assisted party";
  return `${kind} ${label} · ${passenger.partySize||2} people`;
}

function stateText(passenger,sim){
  if(passenger.state==="walking") return `walking the aisle · near row ${Math.max(1,Math.ceil(passenger.pos||0))}`;
  if(passenger.state==="stowing") return `stowing carry-on · ${Math.max(0,passenger.remaining||0).toFixed(1)}s left`;
  if(passenger.state==="seating") return `entering row ${passenger.row} toward seat ${passenger.seatKey} · ${Math.max(0,passenger.remaining||0).toFixed(1)}s left`;
  if(passenger.state==="seated" || sim.occupancy.has(passenger.seatKey)) return "seated";
  if((passenger.queueIndex??Infinity)>=sim.pending) return `waiting at gate · ${Math.max(0,(passenger.queueIndex??0)-sim.pending)} ahead before release`;
  return passenger.state||"waiting";
}

function row(label,value){
  return `<div class="sim-tooltip-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function passengerDetails(passenger,sim){
  const character=[];
  if(passenger.characterRole) character.push(row("Role",passenger.characterRole));
  if(passenger.characterStatus) character.push(row("Character",passenger.characterStatus));
  if(passenger.eventState) character.push(row("Current event",passenger.eventState));
  return `
    <div class="sim-tooltip-title">${escapeHtml(passengerName(passenger))}</div>
    <div class="sim-tooltip-subtitle">Seat ${escapeHtml(passenger.seatKey)} · ${escapeHtml(travelerType(passenger))}</div>
    ${row("Party",partyText(passenger))}
    ${row("Boarding order",`${(passenger.queueIndex??0)+1} of ${sim.queue.length}`)}
    ${row("Current state",stateText(passenger,sim))}
    ${row("Walking speed",`${passenger.walkSpeed.toFixed(2)} rows/sec`)}
    ${row("Carry-on",passenger.hasBag?(passenger.bagStowed?"stowed overhead":`${passenger.bagBase.toFixed(1)}s base stow`):"none")}
    ${row("Base seating",`${passenger.seatBase.toFixed(1)}s`)}
    ${character.join("")}`;
}

export function tooltipHtml(hit,sim){
  if(hit.kind==="passenger") return passengerDetails(hit.passenger,sim);
  const passenger=hit.occupant||hit.assigned;
  if(!hit.isAssigned){
    return `<div class="sim-tooltip-title">Seat ${escapeHtml(hit.seatKey)}</div><div class="sim-tooltip-subtitle">Unassigned on this flight</div>${row("Status","empty")}`;
  }
  const status=hit.occupant?"occupied":passenger?.state==="seating"?"passenger entering row":"assigned · passenger not seated yet";
  return `<div class="sim-tooltip-title">Seat ${escapeHtml(hit.seatKey)}</div><div class="sim-tooltip-subtitle">${escapeHtml(status)}</div>${passenger?passengerDetails(passenger,sim):""}`;
}
'''
(js/'interaction.js').write_text(interaction,encoding='utf-8')

# Build order and source documentation.
build=root/'tools/build_simulator.py'
replace_once(build,'    "render.js",\n    "app.js",','    "render.js",\n    "interaction.js",\n    "app.js",')
src_readme=root/'src/README.md'
replace_once(src_readme,'- `js/render.js` draws one simulation.\n','- `js/render.js` draws one simulation and provides canvas hit testing.\n- `js/interaction.js` formats passenger, seat, and future named-character explanations.\n')

# App wiring: hover never pauses or mutates the simulation.
app=js/'app.js'
replace_once(app,'import { drawSim } from "./render.js";','import { drawSim, hitTestSim } from "./render.js";\nimport { tooltipHtml } from "./interaction.js";')
replace_once(app,'let raceLayout = "standard";','let raceLayout = "standard";\nconst simHover={method:null,canvas:null,clientX:0,clientY:0};')

hover_functions=r'''
function hideSimTooltip(){
  simHover.method=null;
  simHover.canvas=null;
  const tooltip=$("simTooltip");
  tooltip.hidden=true;
  document.querySelectorAll(".sim-card canvas").forEach(canvas=>canvas.style.cursor="default");
}

function positionSimTooltip(clientX,clientY){
  const tooltip=$("simTooltip");
  const gap=14;
  const rect=tooltip.getBoundingClientRect();
  let left=clientX+gap;
  let top=clientY+gap;
  if(left+rect.width>innerWidth-8) left=clientX-rect.width-gap;
  if(top+rect.height>innerHeight-8) top=clientY-rect.height-gap;
  tooltip.style.left=`${Math.max(8,left)}px`;
  tooltip.style.top=`${Math.max(8,top)}px`;
}

function refreshSimTooltip(){
  if(!simHover.method || !simHover.canvas || simHover.canvas.closest("article")?.hidden){
    hideSimTooltip();
    return;
  }
  const sim=sims[simHover.method];
  if(!sim) return;
  const hit=hitTestSim(sim,simHover.canvas,simHover.clientX,simHover.clientY);
  if(!hit){
    $("simTooltip").hidden=true;
    simHover.canvas.style.cursor="default";
    return;
  }
  const tooltip=$("simTooltip");
  tooltip.innerHTML=tooltipHtml(hit,sim);
  tooltip.hidden=false;
  simHover.canvas.style.cursor="help";
  positionSimTooltip(simHover.clientX,simHover.clientY);
}

function initializeSimHover(){
  for(const method of METHODS){
    const canvas=$(META[method].canvas);
    canvas.addEventListener("pointermove",event=>{
      simHover.method=method;
      simHover.canvas=canvas;
      simHover.clientX=event.clientX;
      simHover.clientY=event.clientY;
      refreshSimTooltip();
    });
    canvas.addEventListener("pointerleave",hideSimTooltip);
  }
  window.addEventListener("scroll",hideSimTooltip,{passive:true});
}
'''
replace_once(app,'function parseRaceView(search){',hover_functions+'\nfunction parseRaceView(search){')
replace_once(app,'  clearRaceHud();\n  running=false;','  clearRaceHud();\n  hideSimTooltip();\n  running=false;')
replace_once(app,'  renderRaceHud();\n  if(allDone && running){','  renderRaceHud();\n  if(simHover.method) refreshSimTooltip();\n  if(allDone && running){')
replace_once(app,'  initializeRaceHud();\n  const fromUrl','  initializeRaceHud();\n  initializeSimHover();\n  const fromUrl')

# Tooltip container.
index=root/'src/index.html'
replace_once(index,'\n<script type="module" src="./js/app.js"></script>','\n<div id="simTooltip" class="sim-tooltip" role="tooltip" hidden></div>\n\n<script type="module" src="./js/app.js"></script>')

styles=root/'src/styles.css'
styles.write_text(styles.read_text(encoding='utf-8')+r'''

.sim-tooltip{
  position:fixed;
  z-index:1000;
  width:min(300px,calc(100vw - 16px));
  padding:11px 12px;
  border:1px solid #5a7898;
  border-radius:12px;
  background:rgba(5,15,27,.97);
  color:#e9f5ff;
  box-shadow:0 16px 42px rgba(0,0,0,.48);
  pointer-events:none;
  backdrop-filter:blur(8px);
}
.sim-tooltip[hidden]{display:none}
.sim-tooltip-title{font-size:.9rem;font-weight:850;line-height:1.2}
.sim-tooltip-subtitle{margin:2px 0 8px;color:#9fdcf1;font-size:.72rem;line-height:1.3}
.sim-tooltip-row{display:grid;grid-template-columns:minmax(78px,.72fr) minmax(0,1.28fr);gap:8px;padding:3px 0;border-top:1px solid rgba(66,94,122,.32);font-size:.69rem;line-height:1.3}
.sim-tooltip-row span{color:#8ea8c1}
.sim-tooltip-row strong{min-width:0;color:#e8f4ff;font-weight:650;text-align:right;overflow-wrap:anywhere}
''',encoding='utf-8')

# Canonical model documentation.
model=root/'MODEL.md'
model_text=model.read_text(encoding='utf-8')
insert='''### Passenger and seat hover explanations\n\nHovering a visible passenger dot or seat shows a non-blocking tooltip. Passenger tooltips are derived from that method's live simulation object and include seat, party, boarding position, traveler type, current state, walking speed, carry-on status, and base seating time. Seat tooltips distinguish unassigned, assigned-but-not-seated, actively entering, and occupied seats. Hovering never pauses or changes the simulation.\n\nDuring the existing `seating` state, the renderer now interpolates the passenger laterally from the aisle toward the assigned seat. The interpolation uses the already-calculated seating duration, including any seat-conflict delay, but it is visual only: the state transition still completes at exactly the same simulated time.\n\nPassenger records also expose optional display-name, character-role, character-status, and event-state fields. Ordinary passengers leave these fields empty. They are presentation hooks for deterministic named characters such as Barbara and do not introduce event behavior on their own.\n\n'''
if '### Passenger and seat hover explanations' not in model_text:
    model_text=model_text.replace('### Live race HUD and race graph\n',insert+'### Live race HUD and race graph\n',1)
model.write_text(model_text,encoding='utf-8')

(root/'tasks/TASK-002-passenger-inspector-and-explainability.md').write_text('''# TASK-002: Passenger Inspector and Explainability\n\n**Status:** In progress\n\n## Goal\n\nTurn passengers from anonymous dots into understandable participants while keeping the race moving.\n\n## Hover-first slice — done in candidate\n\n- hovering an active passenger shows live passenger details without pausing\n- hovering any seat explains whether it is unassigned, waiting for its passenger, being entered, or occupied\n- tooltips report seat, party, boarding order, traveler type, current state, walking speed, carry-on status, and base seating time\n- the passenger visibly moves laterally from the aisle toward the assigned seat during the existing seating state\n- optional display-name and character-status fields are supported for future named characters\n- all values come from simulation state and the visual layer does not change results\n\n## Later explainability\n\n- explicit stop reasons such as door spacing, a passenger ahead, stowing, or party coordination\n- touch and keyboard access that does not depend on hover\n- richer family-level inspection\n- event history and named-character timelines\n\n## Acceptance criteria\n\n- Every visible active passenger and every seat can be explained\n- Tooltip values come from simulation state, not duplicated model calculations\n- Hover never pauses or changes the simulation\n- Row-entry animation completes on the existing seating-state schedule\n- Character metadata can appear without special-case UI code\n''',encoding='utf-8')

barbara=root/'tasks/TASK-003-event-and-character-framework-barbara.md'
barbara_text=barbara.read_text(encoding='utf-8')
foundation='''## Foundation now available\n\nThe passenger/seat hover slice provides reusable character presentation hooks before Barbara changes behavior:\n\n- optional passenger display name, role, status, and current-event fields\n- a tooltip renderer that automatically displays those fields\n- lateral row-entry motion that future character actions can reuse\n- canvas hit testing for following a named passenger while the race continues\n\nBarbara is not active yet; these fields are inert for ordinary passengers and no event timing has been introduced.\n\n'''
if '## Foundation now available' not in barbara_text:
    barbara_text=barbara_text.replace('## Barbara concept\n',foundation+'## Barbara concept\n',1)
barbara.write_text(barbara_text,encoding='utf-8')
