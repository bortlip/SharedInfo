#!/usr/bin/env python3
from pathlib import Path

path=Path('.github/scripts/apply_visible_crew_assistance.py')
text=path.read_text(encoding='utf-8')
start=text.index("interaction=JS/'interaction.js'")
end=text.index("render=JS/'render.js'",start)
replacement=r'''interaction=JS/'interaction.js'
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

'''
path.write_text(text[:start]+replacement+text[end:],encoding='utf-8')
