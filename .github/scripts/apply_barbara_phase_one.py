#!/usr/bin/env python3
from pathlib import Path
import textwrap

ROOT=Path('simulations/group-aware-boarding')
JS=ROOT/'src/js'


def read(path):
    return path.read_text(encoding='utf-8')


def write(path,text):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(text,encoding='utf-8')


def replace_once(path,old,new):
    text=read(path)
    count=text.count(old)
    if count!=1:
        raise RuntimeError(f'{path}: expected one occurrence, found {count}: {old[:80]!r}')
    write(path,text.replace(old,new,1))


write(JS/'characters.js',textwrap.dedent('''\
import { clamp, mulberry32 } from "./random.js";

function seedMix(seed,salt){
  let x=(seed ^ salt)>>>0;
  x=Math.imul(x^(x>>>16),0x7feb352d);
  x=Math.imul(x^(x>>>15),0x846ca68b);
  return (x^(x>>>16))>>>0;
}

export function applyCharacterScenario(manifest,seed,cfg){
  manifest.characterScenario=cfg.characterScenario||"none";
  manifest.characters=[];
  if(manifest.characterScenario!=="barbara") return manifest;

  const rng=mulberry32(seedMix(seed,0xBA4BA4A));
  const preferred=manifest.passengers.filter(passenger=>
    passenger.groupType==="single" && !passenger.isChild && !passenger.isReduced && passenger.row>=10
  );
  const fallback=manifest.passengers.filter(passenger=>!passenger.isChild && !passenger.isReduced && passenger.row>=6);
  const candidates=preferred.length?preferred:fallback;
  if(!candidates.length) throw new Error("Barbara Mode requires an eligible adult passenger");

  const passenger=candidates[Math.floor(rng()*candidates.length)];
  const baselineBagBase=passenger.bagBase;
  passenger.displayName="Barbara";
  passenger.characterId="barbara";
  passenger.characterRole="late-arriving passenger";
  passenger.characterStatus="running late";
  passenger.eventState="trying to join the boarding line";
  passenger.characterColor="#ffcf66";
  passenger.baselineBagBase=baselineBagBase;
  passenger.baselineHasBag=passenger.hasBag;
  passenger.hasBag=true;
  passenger.bagBase=18+rng()*6;
  passenger.heavyBagExtra=Math.max(0,passenger.bagBase-baselineBagBase);
  passenger.lateQueueFraction=.62+rng()*.18;
  passenger.restroomPauseRow=clamp(
    Math.round(passenger.row*(.35+rng()*.24)),
    3,
    Math.max(3,passenger.row-2)
  );
  passenger.restroomPauseDuration=4.5+rng()*3.5;
  passenger.eventDelaySeconds=0;
  passenger.bubbleText=null;
  passenger.bubbleUntil=0;

  manifest.characters.push({
    id:"barbara",
    passengerId:passenger.id,
    seatKey:passenger.seatKey,
    heavyBagExtra:passenger.heavyBagExtra,
    lateQueueFraction:passenger.lateQueueFraction,
    restroomPauseRow:passenger.restroomPauseRow,
    restroomPauseDuration:passenger.restroomPauseDuration
  });
  return manifest;
}

export function repositionCharacterPassengers(queue){
  const characters=queue.filter(passenger=>passenger.characterId);
  for(const passenger of characters){
    const originalIndex=queue.indexOf(passenger);
    if(originalIndex<0) continue;
    queue.splice(originalIndex,1);
    const requested=Math.round(queue.length*clamp(passenger.lateQueueFraction??.7,0,1));
    const targetIndex=clamp(requested,0,queue.length);
    passenger.originalQueueIndex=originalIndex;
    passenger.lateQueueIndex=targetIndex;
    passenger.queueDisplacement=targetIndex-originalIndex;
    queue.splice(targetIndex,0,passenger);
  }
  return queue;
}
'''))

# Scenario state and URL support.
scenarios=JS/'scenarios.js'
replace_once(scenarios,'  trials:40\n};','  trials:40,\n  characterScenario:"none"\n};')
replace_once(scenarios,textwrap.dedent('''\
  {
    id:"barbara",
    included:true,
    name:"Barbara Mode",
    emoji:"🍷",
    description:"She is late. Her bag is heavy. She has made several decisions.",
    disabled:true
  }
'''),textwrap.dedent('''\
  {
    id:"barbara",
    included:true,
    name:"Barbara Mode",
    emoji:"🍷",
    description:"She is late. Her bag is heavy. She has made several decisions.",
    settings:{loadFactor:100,familyShare:30,partyWeights:[22,36,28,14],assistedParties:3,bagRate:82,sequenceCompliance:88,priorityPolicy:"assist",speed:16,seed:8675309,trials:40,characterScenario:"barbara"}
  }
'''))
replace_once(scenarios,'const SPEEDS = new Set([4,16,64,256]);','const SPEEDS = new Set([4,16,64,256]);\nconst CHARACTER_SCENARIOS = new Set(["none","barbara"]);')
replace_once(scenarios,'    seed:bounded(input.seed,1,2147483646,fallback.seed,true),\n    trials:bounded(input.trials,5,200,fallback.trials,true)','    seed:bounded(input.seed,1,2147483646,fallback.seed,true),\n    trials:bounded(input.trials,5,200,fallback.trials,true),\n    characterScenario:CHARACTER_SCENARIOS.has(input.characterScenario)?input.characterScenario:fallback.characterScenario')
replace_once(scenarios,'    && a.seed===b.seed\n    && a.trials===b.trials;','    && a.seed===b.seed\n    && a.trials===b.trials\n    && a.characterScenario===b.characterScenario;')
replace_once(scenarios,'    seed:get("sd",defaults.seed),\n    trials:get("tr",defaults.trials)','    seed:get("sd",defaults.seed),\n    trials:get("tr",defaults.trials),\n    characterScenario:get("ch",defaults.characterScenario)')
replace_once(scenarios,'  params.set("tr",String(value.trials));\n  return params.toString();','  params.set("tr",String(value.trials));\n  params.set("ch",value.characterScenario);\n  return params.toString();')

# Apply character definitions after ordinary manifest generation so non-character scenarios retain their draws.
manifest=JS/'manifest.js'
replace_once(manifest,'import { mulberry32, shuffle, clamp } from "./random.js";','import { mulberry32, shuffle, clamp } from "./random.js";\nimport { applyCharacterScenario } from "./characters.js";')
replace_once(manifest,'  return {passengers,units,targetPassengers};','  const manifest={passengers,units,targetPassengers};\n  return applyCharacterScenario(manifest,seed,cfg);')

# Reinsert named late arrivals after each method constructs its normal queue.
methods=JS/'methods.js'
replace_once(methods,'import { ROWS } from "./constants.js";','import { ROWS } from "./constants.js";\nimport { repositionCharacterPassengers } from "./characters.js";')
replace_once(methods,'  queue.forEach((p,index)=>p.queueIndex=index);','  repositionCharacterPassengers(queue);\n  queue.forEach((p,index)=>p.queueIndex=index);')

# Character-aware simulation states. Ordinary passenger behavior remains byte-for-byte equivalent in its branches.
write(JS/'simulation.js',textwrap.dedent('''\
import { SPACING } from "./constants.js";
import { makeQueue } from "./methods.js";

export class BoardingSim{
  constructor(manifest,method,cfg){
    this.method=method;
    this.cfg=cfg;
    this.queue=makeQueue(manifest,method,cfg.priorityPolicy,cfg.sequenceCompliance);
    this.assignedSeats=new Set(this.queue.map(p=>p.seatKey));
    this.active=[];
    this.pending=0;
    this.time=0;
    this.completed=0;
    this.occupancy=new Map();
    this.binLoad=new Map();
    this.stowedBags=[];
    this.seatConflicts=0;
    this.conflictSeconds=0;
    this.blockedSeconds=0;
    this.movementDelay=0;
    this.done=false;
    this.doorDelayStarted=false;
  }
  setCharacterMoment(p,status,eventState,bubble=null,duration=0){
    if(!p.characterId) return;
    p.characterStatus=status;
    p.eventState=eventState;
    if(bubble){
      p.bubbleText=bubble;
      p.bubbleUntil=this.time+duration;
    }
  }
  nearestToDoor(){
    let nearest=Infinity;
    for(const p of this.active) if(p.state!=="seated") nearest=Math.min(nearest,p.pos);
    return nearest;
  }
  computeStow(p){
    const key=`${p.row}${p.side}`;
    const load=this.binLoad.get(key)||0;
    if(p.hasBag) this.binLoad.set(key,load+1);
    const congestion=p.hasBag?Math.max(0,load-2)*1.45:0;
    return p.bagBase+congestion;
  }
  computeSeat(p){
    let blockers=0;
    let penalty=0;
    for(const [seatKey,occ] of this.occupancy){
      if(occ.row===p.row && occ.side===p.side && occ.depth<p.depth){
        blockers++;
        penalty += occ.unitId===p.unitId ? 2.2 : 5.4;
      }
    }
    if(blockers){
      this.seatConflicts+=blockers;
      this.conflictSeconds+=penalty;
    }
    return p.seatBase+penalty;
  }
  beginStowing(p){
    p.state="stowing";
    p.stowDuration=this.computeStow(p);
    p.remaining=p.stowDuration;
    if(p.characterId){
      if(!p.heavyBagDelayCounted){
        p.eventDelaySeconds=(p.eventDelaySeconds||0)+(p.heavyBagExtra||0);
        p.heavyBagDelayCounted=true;
      }
      this.setCharacterMoment(
        p,
        "wrestling with the carry-on",
        "struggling with a very heavy bag",
        "This bag was lighter at home.",
        Math.min(7,p.stowDuration)
      );
    }
  }
  beginSeating(p){
    p.state="seating";
    p.seatingDuration=this.computeSeat(p);
    p.remaining=p.seatingDuration;
    this.setCharacterMoment(p,"almost there",`entering row ${p.row} toward ${p.seatKey}`);
  }
  release(dt){
    if(this.pending>=this.queue.length) return;
    if(this.nearestToDoor()<SPACING) return;
    const p=this.queue[this.pending];
    if(!p.delayRemainingInitialized){
      p.delayRemaining=p.entryDelay;
      p.delayRemainingInitialized=true;
    }
    if(p.delayRemaining>0){
      p.delayRemaining=Math.max(0,p.delayRemaining-dt);
      return;
    }
    p.state="walking";
    p.pos=0;
    p.remaining=0;
    p.eventDelaySeconds=p.eventDelaySeconds||0;
    this.active.push(p);
    this.pending++;
    this.setCharacterMoment(p,"finally aboard","heading down the aisle","Made it!",3.5);
  }
  step(dt){
    if(this.done) return;
    this.time+=dt;

    let anyBlocking=false;
    for(const p of this.active){
      if(p.state==="character-pause"){
        anyBlocking=true;
        p.remaining-=dt;
        p.eventDelaySeconds=(p.eventDelaySeconds||0)+dt;
        if(p.remaining<=0){
          p.state="walking";
          p.remaining=0;
          this.setCharacterMoment(p,"committed now","continuing to her seat","Too late now.",2.4);
        }
      }else if(p.state==="stowing"){
        anyBlocking=true;
        p.remaining-=dt;
        if(p.remaining<=0){
          if(p.hasBag && !p.bagStowed){
            p.bagStowed=true;
            this.stowedBags.push({
              passengerId:p.id,
              row:p.row,
              side:p.side,
              groupType:p.groupType,
              color:p.partyColor||p.characterColor||null
            });
          }
          this.beginSeating(p);
        }
      }else if(p.state==="seating"){
        anyBlocking=true;
        p.remaining-=dt;
        if(p.remaining<=0){
          p.state="seated";
          this.occupancy.set(p.seatKey,p);
          this.completed++;
          this.setCharacterMoment(p,"settled, for now","seated");
        }
      }
    }
    if(anyBlocking) this.blockedSeconds+=dt;
    if(this.active.some(p=>p.state==="seated")){
      this.active=this.active.filter(p=>p.state!=="seated");
    }

    let leadPos=Infinity;
    for(const p of this.active){
      if(p.state==="walking"){
        let allowed=p.row;
        if(leadPos<Infinity) allowed=Math.min(allowed,leadPos-SPACING);
        const available=Math.max(0,allowed-p.pos);
        const freeMove=p.walkSpeed*dt;
        const move=Math.min(available,freeMove);
        p.pos+=move;
        if(available+1e-7<freeMove && p.pos<p.row-.001) this.movementDelay+=dt;

        if(
          p.characterId==="barbara"
          && !p.restroomPauseComplete
          && p.row>p.restroomPauseRow+.001
          && p.pos+1e-7>=p.restroomPauseRow
        ){
          p.pos=p.restroomPauseRow;
          p.state="character-pause";
          p.remaining=p.restroomPauseDuration;
          p.restroomPauseComplete=true;
          this.setCharacterMoment(
            p,
            "regretting several decisions",
            "paused in the aisle thinking about the restroom",
            "I should have used the restroom.",
            p.restroomPauseDuration
          );
        }else if(p.row-p.pos<=.001){
          p.pos=p.row;
          this.beginStowing(p);
        }
      }
      leadPos=p.pos;
    }

    this.release(dt);
    if(this.completed===this.queue.length){
      this.done=true;
    }
    if(this.time>7200){
      this.done=true;
      console.warn("Simulation safety stop",this.method);
    }
  }
  runToEnd(dt=.2){
    while(!this.done) this.step(dt);
    return this.time;
  }
}
'''))

# Rich hover text for the named character and the new bounded pause state.
write(JS/'interaction.js',textwrap.dedent('''\
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
  if(passenger.state==="character-pause") return `paused in the aisle · ${Math.max(0,passenger.remaining||0).toFixed(1)}s left`;
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

export function tooltipHtml(hit,sim){
  if(hit.kind==="passenger") return passengerDetails(hit.passenger,sim);
  const passenger=hit.occupant||hit.assigned;
  if(!hit.isAssigned){
    return `<div class="sim-tooltip-title">Seat ${escapeHtml(hit.seatKey)}</div><div class="sim-tooltip-subtitle">Unassigned on this flight</div>${row("Status","empty")}`;
  }
  const status=hit.occupant?"occupied":passenger?.state==="seating"?"passenger entering row":"assigned · passenger not seated yet";
  return `<div class="sim-tooltip-title">Seat ${escapeHtml(hit.seatKey)}</div><div class="sim-tooltip-subtitle">${escapeHtml(status)}</div>${passenger?passengerDetails(passenger,sim):""}`;
}
'''))

# Canvas bubbles, a pulsing marker, and Barbara's distinct color.
render=JS/'render.js'
replace_once(render,'function bagColor(item){\n  if(item.groupType==="family") return item.color||palette.family;\n  return palette[item.groupType]||palette.single;\n}\n',textwrap.dedent('''\
function bagColor(item){
  if(item.groupType==="family") return item.color||palette.family;
  return item.color||palette[item.groupType]||palette.single;
}

function wrapBubbleText(ctx,text,maxWidth){
  const words=String(text).split(/\\s+/);
  const lines=[];
  let line="";
  for(const word of words){
    const next=line?`${line} ${word}`:word;
    if(line && ctx.measureText(next).width>maxWidth){
      lines.push(line);
      line=word;
    }else line=next;
  }
  if(line) lines.push(line);
  if(lines.length>3){
    lines.length=3;
    lines[2]=`${lines[2].replace(/[.…]*$/u,"")}…`;
  }
  return lines;
}

function drawCharacterBubble(ctx,text,x,y,w,h){
  ctx.save();
  ctx.font="700 9px system-ui";
  const lines=wrapBubbleText(ctx,text,112);
  const bubbleW=Math.min(132,Math.max(72,...lines.map(line=>ctx.measureText(line).width+14)));
  const bubbleH=10+lines.length*11;
  let bubbleX=clamp(x+12,4,w-bubbleW-4);
  let bubbleY=y-bubbleH-15;
  let below=false;
  if(bubbleY<4){
    bubbleY=y+14;
    below=true;
  }
  bubbleY=clamp(bubbleY,4,h-bubbleH-4);
  roundedRect(ctx,bubbleX,bubbleY,bubbleW,bubbleH,7);
  ctx.fillStyle="rgba(255,249,218,.96)";
  ctx.fill();
  ctx.strokeStyle="#d8ae45";
  ctx.lineWidth=1.2;
  ctx.stroke();
  ctx.beginPath();
  const tailY=below?bubbleY:bubbleY+bubbleH;
  ctx.moveTo(clamp(x,bubbleX+8,bubbleX+bubbleW-8),tailY);
  ctx.lineTo(x,below?y+7:y-7);
  ctx.lineTo(clamp(x+8,bubbleX+8,bubbleX+bubbleW-8),tailY);
  ctx.fillStyle="rgba(255,249,218,.96)";
  ctx.fill();
  ctx.strokeStyle="#d8ae45";
  ctx.stroke();
  ctx.fillStyle="#34270d";
  ctx.textAlign="left";
  ctx.textBaseline="top";
  lines.forEach((line,index)=>ctx.fillText(line,bubbleX+7,bubbleY+6+index*11));
  ctx.restore();
}
'''))
replace_once(render,'    const color=p.groupType==="family"?(p.partyColor||palette.family):palette[p.groupType];','    const color=p.characterColor||(p.groupType==="family"?(p.partyColor||palette.family):palette[p.groupType]);')
replace_once(render,textwrap.dedent('''\
    if(p.characterId){
      ctx.beginPath();
      ctx.arc(x,y,radius+3.5,0,Math.PI*2);
      ctx.strokeStyle="#fff0a8";
      ctx.lineWidth=1.7;
      ctx.stroke();
    }
'''),textwrap.dedent('''\
    if(p.characterId){
      const pulse=3.5+Math.sin(sim.time*5)*.7;
      ctx.beginPath();
      ctx.arc(x,y,radius+pulse,0,Math.PI*2);
      ctx.strokeStyle="#fff0a8";
      ctx.lineWidth=1.7;
      ctx.stroke();
    }
'''))
replace_once(render,'    }else if(p.isReduced){\n      ctx.strokeStyle="#f6e7ff";\n      ctx.lineWidth=1.7;\n      ctx.stroke();\n    }\n  }\n\n  for(const members of activeFamilies.values()){','    }else if(p.isReduced){\n      ctx.strokeStyle="#f6e7ff";\n      ctx.lineWidth=1.7;\n      ctx.stroke();\n    }\n    if(p.characterId){\n      ctx.fillStyle="#2b2108";\n      ctx.font="900 7px system-ui";\n      ctx.textAlign="center";\n      ctx.textBaseline="middle";\n      ctx.fillText("B",x,y+.3);\n    }\n  }\n\n  for(const {p,x,y} of points){\n    if(p.characterId && p.bubbleText && (p.bubbleUntil||0)>=sim.time){\n      drawCharacterBubble(ctx,p.bubbleText,x,y,w,h);\n    }\n  }\n\n  for(const members of activeFamilies.values()){')

# App state carries the character scenario even when ordinary sliders are edited.
app=JS/'app.js'
replace_once(app,'let raceLayout = "standard";','let raceLayout = "standard";\nlet characterScenario = "none";')
replace_once(app,'    seed:controls.seed.value,\n    trials:controls.trials.value','    seed:controls.seed.value,\n    trials:controls.trials.value,\n    characterScenario')
replace_once(app,'  controls.trials.value=String(value.trials);\n  updateControlDisplays();','  controls.trials.value=String(value.trials);\n  characterScenario=value.characterScenario;\n  updateControlDisplays();')
replace_once(app,'    priorityPolicy:controls.priorityPolicy.value,\n    seed:clamp(Math.floor(+controls.seed.value||1),1,2147483646)','    priorityPolicy:controls.priorityPolicy.value,\n    seed:clamp(Math.floor(+controls.seed.value||1),1,2147483646),\n    characterScenario')
replace_once(app,textwrap.dedent('''\
function scenarioPreview(settings){
  return [
    `${settings.loadFactor}% full`,
    `${settings.familyShare}% families`,
    `${settings.bagRate}% bags`,
    `${settings.sequenceCompliance}% compliance`
  ];
}
'''),textwrap.dedent('''\
function scenarioPreview(settings){
  const preview=[
    `${settings.loadFactor}% full`,
    `${settings.familyShare}% families`,
    `${settings.bagRate}% bags`,
    `${settings.sequenceCompliance}% compliance`
  ];
  if(settings.characterScenario==="barbara") preview.push("Barbara aboard");
  return preview;
}
'''))
replace_once(app,'  const fallbackNote=cfg.partyWeightsFallback?" Party weights were all zero, so an equal split was used.":"";','  const fallbackNote=cfg.partyWeightsFallback?" Party weights were all zero, so an equal split was used.":"";\n  const characterNote=manifest.characters?.length?` ${manifest.characters.map(character=>character.id==="barbara"?"Barbara":"A named passenger").join(", ")} is aboard.`:"";')
replace_once(app,'${manifest.units.filter(u=>u.groupType==="assisted").length} assisted parties.${fallbackNote}`;','${manifest.units.filter(u=>u.groupType==="assisted").length} assisted parties.${fallbackNote}${characterNote}`;')

# Benchmarks must distinguish character scenarios.
format_file=JS/'format.js'
replace_once(format_file,'    priorityPolicy:cfg.priorityPolicy,\n    seed:cfg.seed,','    priorityPolicy:cfg.priorityPolicy,\n    characterScenario:cfg.characterScenario||"none",\n    seed:cfg.seed,')

# Build and source documentation.
builder=ROOT/'tools/build_simulator.py'
replace_once(builder,'    "scenarios.js",\n    "manifest.js",','    "scenarios.js",\n    "characters.js",\n    "manifest.js",')
src_readme=ROOT/'src/README.md'
replace_once(src_readme,'- `js/manifest.js` creates passengers, parties, seats, and traits.','- `js/characters.js` defines deterministic named-character scenarios and queue insertion.\n- `js/manifest.js` creates passengers, parties, seats, and traits.')
write(JS/'version.js','export const APP_VERSION = "3.4.0";\n')

# Canonical model guide.
model=ROOT/'MODEL.md'
replace_once(model,textwrap.dedent('''\
Passenger records also expose optional display-name, character-role, character-status, and event-state fields. Ordinary passengers leave these fields empty. They are presentation hooks for deterministic named characters such as Barbara and do not introduce event behavior on their own.

### Live race HUD and race graph
'''),textwrap.dedent('''\
Passenger records also expose optional display-name, character-role, character-status, and event-state fields. Ordinary passengers leave these fields empty. They are presentation hooks for deterministic named characters such as Barbara.

### Barbara Mode and the character-event foundation

Barbara Mode activates one deterministic named-passenger script. A character-specific pseudorandom stream selects an eligible adult individual after the ordinary manifest has been generated, so enabling or disabling Barbara does not disturb the ordinary seat, family, speed, or timing draws. Her seat and intrinsic character values are shared by all six methods.

Each method first constructs its normal queue. Barbara is then removed exactly once and reinserted at the same seed-derived late-arrival fraction of that queue. Her hover tooltip shows both the resulting boarding position and the position she would have occupied under that method before arriving late. Queue construction tests require every passenger ID to remain present exactly once.

Barbara always has a heavy carry-on. Its seeded base stow time replaces her ordinary bag time, and the difference is tracked as direct character-event delay. While walking, she also makes one bounded restroom-realization pause at a seeded row before her destination. The pause blocks the aisle like another visible stationary passenger, adds its elapsed time to direct character-event delay, and then returns her to ordinary forward walking. She does not reverse direction or visit a restroom in this phase.

A pulsing marker, short passenger-anchored speech or thought bubbles, and live hover status make each action visible where it occurs. These presentation elements do not pause the race. No event ticker or post-race recap is generated.

### Live race HUD and race graph
'''))

# Task status and next phase.
write(ROOT/'tasks/TASK-003-event-and-character-framework-barbara.md',textwrap.dedent('''\
# TASK-003: Event and Character Framework — Barbara

**Status:** Phase 1 done in candidate

## Goal

Create a deterministic framework for memorable passenger incidents, then prove it with a visible Barbara scenario.

## Phase 1 — implemented

Barbara Mode now provides:

- one seed-derived Barbara definition shared by every boarding method
- deterministic selection of an eligible adult individual without disturbing ordinary manifest draws
- a distinctive pulsing marker, name-aware hover details, and live character status
- late queue insertion after each method builds its normal queue
- explicit original and late boarding positions in Barbara's hover tooltip
- a seeded heavy carry-on with visible stowing and tracked direct delay
- one bounded restroom-realization pause in the aisle
- short speech or thought bubbles anchored to Barbara
- tests proving that no passenger is duplicated or lost
- no Race Moments ticker and no post-race recap

The restroom event is intentionally a pause only. Barbara does not move backward, visit a restroom, or pass another traveler in Phase 1.

## Fairness

Barbara's seat, intrinsic bag difficulty, late-arrival fraction, pause row, pause duration, and dialogue script are shared across all methods. Her original method position and the surrounding congestion can differ because each method constructs a different queue.

## Measurements

Each method retains Barbara's:

- original method position
- late inserted position
- queue displacement
- heavy-bag delay above her ordinary generated bag time
- elapsed restroom-pause delay
- combined direct character-event delay

These measurements support testing and hover explainability. They do not require a recap screen.

## Phase 2 — assistance

The next character slice should add:

- a visible failed-lift beat during the heavy-bag stow
- deterministic selection of a nearby helper or crew member
- helper movement or reach animation
- an explicit assistance duration
- Barbara and helper hover states that explain the interaction
- identical intrinsic assistance rules across methods

## Phase 3 — true restroom movement

Only after reverse aisle movement is independently designed:

- bidirectional aisle travel
- yielding and passing rules
- front or rear restroom configuration
- return trip to the assigned seat

Faking reverse movement invisibly would make the animation dishonest.

## Acceptance criteria

- Character script is deterministic by seed
- No passenger is duplicated or lost during insertion
- Every mechanical effect is visible in the cabin, an anchored bubble, or Barbara's hover status
- The same Barbara definition is used in every method
- Character behavior can be disabled completely
- Ordinary scenarios preserve their previous deterministic results
- No separate event ticker or post-race recap is introduced
'''))
