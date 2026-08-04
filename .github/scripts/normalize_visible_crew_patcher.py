#!/usr/bin/env python3
import subprocess
from pathlib import Path

path=Path('.github/scripts/apply_visible_crew_assistance.py')
text=path.read_text(encoding='utf-8')

interaction_start=text.index("interaction=JS/'interaction.js'")
interaction_end=text.index("render=JS/'render.js'",interaction_start)
interaction_replacement=r"""interaction=JS/'interaction.js'
write(interaction,textwrap.dedent('''\
function escapeHtml(value){
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
  if(passenger.state==="walking-to-restroom") return `backtracking toward front lavatory · near row ${Math.max(1,Math.ceil(passenger.pos||0))}`;
  if(passenger.state==="restroom") return `inside front lavatory · ${Math.max(0,passenger.remaining||0).toFixed(1)}s left`;
  if(passenger.state==="incident-pause") return `${passenger.incidentType||"incident"} delay in aisle · ${Math.max(0,passenger.remaining||0).toFixed(1)}s left`;
  if(passenger.state==="walking-from-restroom") return `returning toward row ${passenger.row} · near row ${Math.max(1,Math.ceil(passenger.pos||0))}`;
  if(passenger.state==="failed-lift") return `failed overhead-bin lift · ${Math.max(0,passenger.remaining||0).toFixed(1)}s left`;
  if(passenger.state==="awaiting-crew") return "blocking the aisle while waiting for cabin crew";
  if(passenger.state==="crew-assist") return `crew lifting carry-on · ${Math.max(0,passenger.remaining||0).toFixed(1)}s left`;
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
  if(passenger.originalQueueIndex!=null && passenger.lateQueueIndex!=null){
    character.push(row(
      "Late arrival",
      `joined ${passenger.lateQueueIndex+1} of ${sim.queue.length} · normal method position was ${passenger.originalQueueIndex+1}`
    ));
  }
  if(passenger.characterStatus) character.push(row("Character",passenger.characterStatus));
  if(passenger.eventState) character.push(row("Current event",passenger.eventState));
  if(passenger.restroomTripStarted){
    character.push(row("Aisle crossings",`${passenger.squeezePasses||0} passenger squeezes`));
    character.push(row("Restroom trip",passenger.restroomTripComplete
      ? `${(passenger.restroomTripElapsed||0).toFixed(1)}s elapsed · ${(passenger.restroomExtraDelay||0).toFixed(1)}s extra`
      : `${(passenger.restroomTripElapsed||0).toFixed(1)}s elapsed`));
  }
  if(passenger.baselineWalkSpeed) character.push(row("Normal walking speed",`${passenger.baselineWalkSpeed.toFixed(2)} rows/sec`));
  if(passenger.incidentStops) character.push(row("Incident stops",`${passenger.incidentStopIndex||0} of ${passenger.incidentStops.length} completed`));
  if(passenger.disruptionDelaySeconds) character.push(row("Passenger disruption",`${passenger.disruptionDelaySeconds.toFixed(1)}s slowed by ${passenger.disruptedByCharacter||"another traveler"}`));
  if(passenger.crewYieldSeconds) character.push(row("Yielded to crew",`${passenger.crewYieldSeconds.toFixed(1)}s across ${passenger.crewYieldCount||1} crossing${passenger.crewYieldCount===1?"":"s"}`));
  if(passenger.requiresCrewHelp){
    const help=passenger.crewAssistanceComplete
      ? `${(passenger.crewEventDelay||0).toFixed(1)}s · completed by Maya`
      : passenger.crewRequestQueued?"requested · crew responding":"required at the overhead bin";
    character.push(row("Crew help",help));
  }
  if(passenger.characterId) character.push(row("Direct event delay",`${(passenger.eventDelaySeconds||0).toFixed(1)}s`));
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

function crewDetails(crew,sim){
  const target=crew.targetPassengerId==null?null:sim.queue.find(p=>p.id===crew.targetPassengerId);
  return `
    <div class="sim-tooltip-title">${escapeHtml(crew.displayName)}</div>
    <div class="sim-tooltip-subtitle">Cabin crew · front-cabin responder</div>
    ${row("Current state",crew.status||crew.state)}
    ${row("Current task",crew.eventState||"available")}
    ${row("Position",crew.state==="idle"?"front door":`near row ${Math.max(1,Math.ceil(crew.pos||0))}`)}
    ${row("Target",target?`${passengerName(target)} · row ${target.row}`:"none")}
    ${row("Assists completed",String(crew.assistsCompleted||0))}
    ${row("Aisle travel",`${(crew.travelDistance||0).toFixed(1)} rows`)}
    ${row("Passenger squeezes",String(crew.squeezePasses||0))}`;
}

export function tooltipHtml(hit,sim){
  if(hit.kind==="crew") return crewDetails(hit.crew,sim);
  if(hit.kind==="passenger") return passengerDetails(hit.passenger,sim);
  const passenger=hit.occupant||hit.assigned;
  if(!hit.isAssigned){
    return `<div class="sim-tooltip-title">Seat ${escapeHtml(hit.seatKey)}</div><div class="sim-tooltip-subtitle">Unassigned on this flight</div>${row("Status","empty")}`;
  }
  const status=hit.occupant?"occupied":passenger?.state==="seating"?"passenger entering row":"assigned · passenger not seated yet";
  return `<div class="sim-tooltip-title">Seat ${escapeHtml(hit.seatKey)}</div><div class="sim-tooltip-subtitle">${escapeHtml(status)}</div>${passenger?passengerDetails(passenger,sim):""}`;
}
'''))

"""
text=text[:interaction_start]+interaction_replacement+text[interaction_end:]

render_start=text.index("render=JS/'render.js'")
render_end=text.index("model=ROOT/'MODEL.md'",render_start)
render_replacement=r"""render=JS/'render.js'
replace_once(render,'''export function passengerPoint(passenger,geometry){
  const aisleCenter=geometry.aisleX+geometry.aisleW/2;
''','''export function crewPoint(crew,geometry){
  const aisleCenter=geometry.aisleX+geometry.aisleW/2;
  let x=aisleCenter;
  let y=geometry.top+(clamp(crew.pos,0,ROWS)-.5)*geometry.rowH;
  if(crew.state==="idle"){
    x=aisleCenter-geometry.aisleW*.28;
    y=geometry.top-18;
  }else if(crew.state==="walking-to-passenger") x=aisleCenter-geometry.aisleW*.24;
  else if(crew.state==="returning-front") x=aisleCenter+geometry.aisleW*.24;
  else if(crew.state==="assisting") x=aisleCenter+(crew.targetPassengerId%2?1:-1)*geometry.aisleW*.2;
  if((crew.squeezeDelayRemaining||0)>0) x+=Math.sin(crew.pos*8)*2;
  return {crew,x,y};
}

export function passengerPoint(passenger,geometry){
  const aisleCenter=geometry.aisleX+geometry.aisleW/2;
''')
replace_once(render,'''  }else if((passenger.squeezeDelayRemaining||0)>0){
    x=baseX+geometry.aisleW*.18;
''','''  }else if((passenger.squeezeDelayRemaining||0)>0 || (passenger.crewYieldRemaining||0)>0){
    x=baseX+geometry.aisleW*.18;
''')
replace_once(render,'''  const active=(sim.active||[]).map(passenger=>passengerPoint(passenger,geometry));
  for(let index=active.length-1;index>=0;index--){
''','''  const crew=crewPoint(sim.crew,geometry);
  if(Math.hypot(x-crew.x,y-crew.y)<=12){
    return {kind:"crew",crew:sim.crew,point:crew};
  }

  const active=(sim.active||[]).map(passenger=>passengerPoint(passenger,geometry));
  for(let index=active.length-1;index>=0;index--){
''')
replace_once(render,'.filter(p=>p.state==="stowing" && p.hasBag)','.filter(p=>(p.state==="stowing" || p.state==="crew-assist") && p.hasBag)')
replace_once(render,'''      if(p.state==="stowing"){
        const targetX=p.side==="L"?leftBinX+binW/2:rightBinX+binW/2;
        const duration=Math.max(.001,p.stowDuration||p.remaining||1);
        const progress=clamp(1-p.remaining/duration,0,1);
''','''      if(p.state==="stowing" || p.state==="crew-assist"){
        const targetX=p.side==="L"?leftBinX+binW/2:rightBinX+binW/2;
        const duration=Math.max(.001,p.state==="crew-assist"?(p.crewAssistTotal||p.remaining||1):(p.stowDuration||p.remaining||1));
        const progress=clamp(1-p.remaining/duration,0,1);
''')
replace_once(render,'''  for(const {p,x,y} of points){
    if(p.characterId && p.bubbleText && (p.bubbleUntil||0)>=sim.time){
      drawCharacterBubble(ctx,p.bubbleText,x,y,w,h);
    }
  }

  for(const members of activeFamilies.values()){
''','''  const crewVisual=crewPoint(sim.crew,geometry);
  const crewTarget=sim.crew.targetPassengerId==null?null:points.find(point=>point.p.id===sim.crew.targetPassengerId);
  if(sim.crew.state==="assisting" && crewTarget){
    ctx.save();
    ctx.setLineDash([3,3]);
    ctx.strokeStyle="rgba(86,224,181,.7)";
    ctx.lineWidth=1.5;
    ctx.beginPath();
    ctx.moveTo(crewVisual.x,crewVisual.y);
    ctx.lineTo(crewTarget.x,crewTarget.y);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  const crewRadius=6.2;
  if(sim.crew.state==="assisting"){
    ctx.beginPath();
    ctx.arc(crewVisual.x,crewVisual.y,crewRadius+3+Math.sin(sim.time*6)*.7,0,Math.PI*2);
    ctx.strokeStyle="rgba(141,255,218,.88)";
    ctx.lineWidth=1.5;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(crewVisual.x,crewVisual.y,crewRadius,0,Math.PI*2);
  ctx.fillStyle=sim.crew.color||"#56e0b5";
  ctx.fill();
  ctx.strokeStyle="#eafff7";
  ctx.lineWidth=1.2;
  ctx.stroke();
  ctx.fillStyle="#09261e";
  ctx.font="900 6px system-ui";
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.fillText("FA",crewVisual.x,crewVisual.y+.2);
  ctx.restore();

  for(const {p,x,y} of points){
    if(p.bubbleText && (p.bubbleUntil||0)>=sim.time){
      drawCharacterBubble(ctx,p.bubbleText,x,y,w,h);
    }
  }
  if(sim.crew.bubbleText && (sim.crew.bubbleUntil||0)>=sim.time){
    drawCharacterBubble(ctx,sim.crew.bubbleText,crewVisual.x,crewVisual.y,w,h);
  }

  for(const members of activeFamilies.values()){
''')

"""
text=text[:render_start]+render_replacement+text[render_end:]
path.write_text(text,encoding='utf-8')

site=Path('.github/scripts/sitecustomize.py')
if site.exists():
    site.unlink()
    subprocess.run(['git','add',str(site)],check=True)
