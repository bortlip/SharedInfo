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
        raise RuntimeError(f'{path}: expected one occurrence, found {count}: {old[:100]!r}')
    write(path,text.replace(old,new,1))


characters=JS/'characters.js'
replace_once(characters,textwrap.dedent('''\
  passenger.restroomPauseRow=clamp(
    Math.round(passenger.row*(.35+rng()*.24)),
    3,
    Math.max(3,passenger.row-2)
  );
  passenger.restroomPauseDuration=4.5+rng()*3.5;
  passenger.eventDelaySeconds=0;
'''),textwrap.dedent('''\
  passenger.restroomTurnRow=clamp(
    Math.round(passenger.row*(.35+rng()*.24)),
    4,
    Math.max(4,passenger.row-2)
  );
  passenger.restroomDuration=6+rng()*4;
  passenger.restroomWalkSpeed=.62+rng()*.14;
  passenger.restroomTarget=.15;
  passenger.squeezeOtherDuration=1.45+rng()*.65;
  passenger.squeezeSelfDuration=.75+rng()*.45;
  passenger.restroomTripElapsed=0;
  passenger.restroomExtraDelay=0;
  passenger.squeezePasses=0;
  passenger.eventDelaySeconds=0;
'''))
replace_once(characters,textwrap.dedent('''\
    lateQueueFraction:passenger.lateQueueFraction,
    restroomPauseRow:passenger.restroomPauseRow,
    restroomPauseDuration:passenger.restroomPauseDuration
'''),textwrap.dedent('''\
    lateQueueFraction:passenger.lateQueueFraction,
    restroomTurnRow:passenger.restroomTurnRow,
    restroomDuration:passenger.restroomDuration,
    restroomWalkSpeed:passenger.restroomWalkSpeed,
    squeezeOtherDuration:passenger.squeezeOtherDuration,
    squeezeSelfDuration:passenger.squeezeSelfDuration
'''))

write(JS/'simulation.js',textwrap.dedent('''\
import { SPACING } from "./constants.js";
import { makeQueue } from "./methods.js";

const RESTROOM_TRAVEL_STATES=new Set(["walking-to-restroom","restroom","walking-from-restroom"]);

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
  beginRestroomTrip(p){
    p.state="walking-to-restroom";
    p.restroomTripElapsed=0;
    p.restroomBaselineRemaining=Math.max(0,(p.row-p.pos)/Math.max(.001,p.walkSpeed));
    p.restroomPassedIds={outbound:new Set(),return:new Set()};
    p.squeezePasses=0;
    this.setCharacterMoment(
      p,
      "doubling back",
      "walking toward the front lavatory",
      "Nope. Restroom first.",
      4.2
    );
  }
  registerSqueeze(p,other,phase){
    const passed=p.restroomPassedIds?.[phase];
    if(!passed || passed.has(other.id)) return;
    passed.add(other.id);
    p.squeezePasses=(p.squeezePasses||0)+1;
    p.squeezeDelayRemaining=Math.max(p.squeezeDelayRemaining||0,p.squeezeSelfDuration||.9);
    other.squeezeDelayRemaining=Math.max(other.squeezeDelayRemaining||0,p.squeezeOtherDuration||1.8);
    other.disruptedByCharacter=p.displayName||"a disruptive passenger";
    other.disruptionCount=(other.disruptionCount||0)+1;
    if(p.squeezePasses===1 || p.squeezePasses%4===0){
      this.setCharacterMoment(
        p,
        "squeezing past passengers",
        `${phase==="outbound"?"backtracking":"returning"} through the aisle · ${p.squeezePasses} crossings`,
        p.squeezePasses===1?"Excuse me—sorry—coming through.":"Sorry. Again.",
        2.8
      );
    }
  }
  stepRestroomTravel(p,dt){
    p.restroomTripElapsed=(p.restroomTripElapsed||0)+dt;
    const outbound=p.state==="walking-to-restroom";
    const target=outbound?(p.restroomTarget??.15):p.row;
    const direction=outbound?-1:1;
    const phase=outbound?"outbound":"return";
    const slowed=(p.squeezeDelayRemaining||0)>0;
    if(slowed) p.squeezeDelayRemaining=Math.max(0,p.squeezeDelayRemaining-dt);
    const speed=(p.restroomWalkSpeed||.68)*(slowed?.42:1);
    const oldPos=p.pos;
    const distance=Math.abs(target-oldPos);
    const move=Math.min(distance,speed*dt);
    p.pos=oldPos+direction*move;

    const low=Math.min(oldPos,p.pos)-.015;
    const high=Math.max(oldPos,p.pos)+.015;
    for(const other of this.active){
      if(other===p || other.state==="seated" || RESTROOM_TRAVEL_STATES.has(other.state)) continue;
      if(other.pos+1e-7>=low && other.pos-1e-7<=high) this.registerSqueeze(p,other,phase);
    }

    if(Math.abs(p.pos-target)>.001) return;
    p.pos=target;
    if(outbound){
      p.state="restroom";
      p.remaining=p.restroomDuration;
      this.setCharacterMoment(p,"in the lavatory","using the front lavatory","Finally.",2.4);
      return;
    }

    p.restroomTripComplete=true;
    p.restroomExtraDelay=Math.max(0,(p.restroomTripElapsed||0)-(p.restroomBaselineRemaining||0));
    p.eventDelaySeconds=(p.heavyBagDelayCounted?p.heavyBagExtra||0:0)+p.restroomExtraDelay;
    this.setCharacterMoment(
      p,
      "back at her row",
      `restroom trip complete · squeezed past ${p.squeezePasses||0} passengers`,
      "Much better.",
      3
    );
    this.beginStowing(p);
  }
  step(dt){
    if(this.done) return;
    this.time+=dt;

    let anyBlocking=false;
    for(const p of this.active){
      if(p.state==="restroom"){
        anyBlocking=true;
        p.remaining-=dt;
        p.restroomTripElapsed=(p.restroomTripElapsed||0)+dt;
        if(p.remaining<=0){
          p.state="walking-from-restroom";
          p.remaining=0;
          this.setCharacterMoment(p,"heading back","returning from the front lavatory","Coming back through.",3.2);
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

    for(const p of this.active){
      if(p.state==="walking-to-restroom" || p.state==="walking-from-restroom"){
        anyBlocking=true;
        this.stepRestroomTravel(p,dt);
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
        const squeezed=(p.squeezeDelayRemaining||0)>0;
        if(squeezed){
          p.squeezeDelayRemaining=Math.max(0,p.squeezeDelayRemaining-dt);
          p.disruptionDelaySeconds=(p.disruptionDelaySeconds||0)+dt;
        }
        const freeMove=p.walkSpeed*(squeezed?.28:1)*dt;
        const move=Math.min(available,freeMove);
        p.pos+=move;
        if(available+1e-7<freeMove && p.pos<p.row-.001) this.movementDelay+=dt;

        if(
          p.characterId==="barbara"
          && !p.restroomTripStarted
          && p.row>p.restroomTurnRow+.001
          && p.pos+1e-7>=p.restroomTurnRow
        ){
          p.pos=p.restroomTurnRow;
          p.restroomTripStarted=true;
          this.beginRestroomTrip(p);
        }else if(p.row-p.pos<=.001){
          p.pos=p.row;
          this.beginStowing(p);
        }
      }
      if(!RESTROOM_TRAVEL_STATES.has(p.state)) leadPos=p.pos;
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

interaction=JS/'interaction.js'
replace_once(interaction,textwrap.dedent('''\
function stateText(passenger,sim){
  if(passenger.state==="walking") return `walking the aisle · near row ${Math.max(1,Math.ceil(passenger.pos||0))}`;
  if(passenger.state==="character-pause") return `paused in the aisle · ${Math.max(0,passenger.remaining||0).toFixed(1)}s left`;
  if(passenger.state==="stowing") return `stowing carry-on · ${Math.max(0,passenger.remaining||0).toFixed(1)}s left`;
'''),textwrap.dedent('''\
function stateText(passenger,sim){
  if(passenger.state==="walking") return `walking the aisle · near row ${Math.max(1,Math.ceil(passenger.pos||0))}`;
  if(passenger.state==="walking-to-restroom") return `backtracking toward front lavatory · near row ${Math.max(1,Math.ceil(passenger.pos||0))}`;
  if(passenger.state==="restroom") return `inside front lavatory · ${Math.max(0,passenger.remaining||0).toFixed(1)}s left`;
  if(passenger.state==="walking-from-restroom") return `returning toward row ${passenger.row} · near row ${Math.max(1,Math.ceil(passenger.pos||0))}`;
  if(passenger.state==="stowing") return `stowing carry-on · ${Math.max(0,passenger.remaining||0).toFixed(1)}s left`;
'''))
replace_once(interaction,'  if(passenger.characterId) character.push(row("Direct event delay",`${(passenger.eventDelaySeconds||0).toFixed(1)}s`));',textwrap.dedent('''\
  if(passenger.restroomTripStarted){
    character.push(row("Aisle crossings",`${passenger.squeezePasses||0} passenger squeezes`));
    character.push(row("Restroom trip",passenger.restroomTripComplete
      ? `${(passenger.restroomTripElapsed||0).toFixed(1)}s elapsed · ${(passenger.restroomExtraDelay||0).toFixed(1)}s extra`
      : `${(passenger.restroomTripElapsed||0).toFixed(1)}s elapsed`));
  }
  if(passenger.disruptionDelaySeconds) character.push(row("Passenger disruption",`${passenger.disruptionDelaySeconds.toFixed(1)}s slowed by ${passenger.disruptedByCharacter||"another traveler"}`));
  if(passenger.characterId) character.push(row("Direct event delay",`${(passenger.eventDelaySeconds||0).toFixed(1)}s`));
''').rstrip())

render=JS/'render.js'
replace_once(render,textwrap.dedent('''\
  const baseX=aisleCenter+((passenger.id%3)-1)*Math.min(4,geometry.aisleW*.08);
  let x=baseX;
  let y=geometry.top+(clamp(passenger.pos,0,ROWS)-.5)*geometry.rowH;
  let seatingProgress=0;
'''),textwrap.dedent('''\
  const baseX=aisleCenter+((passenger.id%3)-1)*Math.min(4,geometry.aisleW*.08);
  let x=baseX;
  let y=geometry.top+(clamp(passenger.pos,0,ROWS)-.5)*geometry.rowH;
  let seatingProgress=0;
  if(passenger.state==="walking-to-restroom") x=aisleCenter-geometry.aisleW*.22;
  else if(passenger.state==="walking-from-restroom") x=aisleCenter+geometry.aisleW*.22;
  else if(passenger.state==="restroom"){
    x=aisleCenter+geometry.aisleW*.32;
    y=geometry.top-18;
  }else if((passenger.squeezeDelayRemaining||0)>0){
    x=baseX+geometry.aisleW*.18;
  }
'''))
replace_once(render,textwrap.dedent('''\
  ctx.fillText(`door · ${sim.queue.length-sim.pending} waiting`,aisleX+aisleW/2,top-18);

  const points=sim.active.map(passenger=>passengerPoint(passenger,geometry));
'''),textwrap.dedent('''\
  ctx.fillText(`door · ${sim.queue.length-sim.pending} waiting`,aisleX+aisleW/2,top-18);

  const lavW=Math.min(36,Math.max(28,seatW*1.25));
  const lavH=22;
  const lavX=Math.min(w-lavW-4,rightX+3*seatW+2*gap-lavW);
  const lavY=top-29;
  roundedRect(ctx,lavX,lavY,lavW,lavH,5);
  ctx.fillStyle="#10283c";
  ctx.fill();
  ctx.strokeStyle="#4c7898";
  ctx.stroke();
  ctx.fillStyle="#b8c9df";
  ctx.font="800 8px system-ui";
  ctx.fillText("LAV",lavX+lavW/2,lavY+lavH/2+.5);

  const points=sim.active.map(passenger=>passengerPoint(passenger,geometry));
'''))
replace_once(render,'    const radius=p.isChild?4.3:5.6;\nif(p.characterId){',textwrap.dedent('''\
    const radius=p.isChild?4.3:5.6;
    if(p.state==="walking-to-restroom" || p.state==="walking-from-restroom"){
      ctx.save();
      ctx.fillStyle="rgba(255,240,168,.9)";
      ctx.font="900 9px system-ui";
      ctx.textAlign="center";
      ctx.textBaseline="middle";
      ctx.fillText(p.state==="walking-to-restroom"?"↑":"↓",x,y-10);
      ctx.restore();
    }
    if((p.squeezeDelayRemaining||0)>0 && !p.characterId){
      ctx.beginPath();
      ctx.arc(x,y,radius+2.6,0,Math.PI*2);
      ctx.strokeStyle="rgba(255,207,102,.75)";
      ctx.lineWidth=1.2;
      ctx.stroke();
    }
if(p.characterId){
'''))

model=ROOT/'MODEL.md'
replace_once(model,textwrap.dedent('''\
Barbara always has a heavy carry-on. Its seeded base stow time replaces her ordinary bag time, and the difference is tracked as direct character-event delay. While walking, she also makes one bounded restroom-realization pause at a seeded row before her destination. The pause blocks the aisle like another visible stationary passenger, adds its elapsed time to direct character-event delay, and then returns her to ordinary forward walking. She does not reverse direction or visit a restroom in this phase.

A pulsing marker, short passenger-anchored speech or thought bubbles, and live hover status make each action visible where it occurs. These presentation elements do not pause the race. No event ticker or post-race recap is generated.
'''),textwrap.dedent('''\
Barbara always has a heavy carry-on. Its seeded base stow time replaces her ordinary bag time, and the difference is tracked as direct character-event delay.

Before reaching her seat, Barbara turns around at a seeded row and walks to the front lavatory. After a seeded lavatory duration she walks back to her assigned row and resumes the ordinary stow-and-seat sequence. Her turn row, travel speed, lavatory duration, and squeeze durations are intrinsic seeded values shared by every method.

The aisle remains a one-dimensional movement model rather than becoming two full lanes. When Barbara's travel path crosses another active passenger, the simulator records one squeeze interaction for that direction. Barbara shifts to one side of the aisle, the other passenger shifts to the other side, and both receive deterministic temporary speed penalties. The crossed passenger's hover details show the accumulated disruption time. Barbara may cross the same passenger once outbound and once on her return, but repeated time steps cannot count the same directional crossing twice.

The front door stops releasing new passengers while Barbara occupies the doorway area or lavatory. Her live hover details report total trip time, estimated extra delay above the forward walk she abandoned, and the number of passenger crossings. The exact number of crossings can differ by boarding method because surrounding congestion differs, while Barbara's intrinsic script remains identical.

A pulsing marker, direction arrows, a visible front-lavatory marker, short passenger-anchored speech or thought bubbles, and live hover status make each action visible where it occurs. These presentation elements do not pause the race. No event ticker or post-race recap is generated.
'''))

write(ROOT/'tasks/TASK-003-event-and-character-framework-barbara.md',textwrap.dedent('''\
# TASK-003: Event and Character Framework — Barbara

**Status:** Barbara restroom trip implemented in candidate

## Goal

Create a deterministic framework for memorable passenger incidents, then prove it with a visible Barbara scenario.

## Implemented character foundation

Barbara Mode now provides:

- one seed-derived Barbara definition shared by every boarding method
- deterministic selection of an eligible adult individual without disturbing ordinary manifest draws
- a distinctive pulsing marker, name-aware hover details, and live character status
- late queue insertion after each method builds its normal queue
- explicit original and late boarding positions in Barbara's hover tooltip
- a seeded heavy carry-on with visible stowing and tracked direct delay
- short speech or thought bubbles anchored to Barbara
- tests proving that no passenger is duplicated or lost
- no Race Moments ticker and no post-race recap

## True restroom trip — implemented

Barbara now:

- turns around at a seeded row before reaching her seat
- walks toward a visible front lavatory
- blocks new passenger release while occupying the doorway/lavatory area
- pauses inside for a seeded duration
- walks back to her assigned row
- squeezes past active passengers in either direction
- temporarily slows both herself and each crossed passenger
- shifts laterally in the renderer so the squeeze is visible
- reports crossings, trip time, estimated extra delay, and disrupted-passenger delay in hover details

The cabin remains a one-dimensional aisle model. A crossing is an explicit squeeze abstraction, not an invisible second lane: travelers may pass only through a recorded timed penalty. The same passenger can be crossed once outbound and once on the return, never repeatedly from adjacent simulation steps.

## Fairness

Barbara's seat, intrinsic bag difficulty, late-arrival fraction, restroom turn row, restroom speed, lavatory duration, squeeze penalties, and dialogue script are shared across all methods. Her original method position and surrounding congestion can differ because each method constructs a different queue. The number of people she crosses can therefore differ legitimately.

## Measurements

Each method retains Barbara's:

- original method position
- late inserted position
- queue displacement
- heavy-bag delay above her ordinary generated bag time
- restroom-trip elapsed time
- estimated extra delay above the abandoned direct walk to her row
- outbound and return squeeze crossings
- combined direct character-event delay

Crossed passengers accumulate their own visible disruption seconds.

## Next slice — configurable cabin incidents

Add general settings rather than tying every incident to Barbara:

- disruptive-passenger count or intensity
- ambient speech frequency
- deterministic incident archetypes such as chatty, tipsy/slow, and crew-assistance-needed
- strict bubble rate limits so the cabin feels alive without becoming unreadable
- shared intrinsic incident definitions across methods

## Later slice — assistance

- a visible failed-lift beat during a heavy-bag stow
- deterministic selection of a nearby helper or crew member
- helper movement or reach animation
- an explicit assistance duration
- both passengers' hover states explaining the interaction

## Acceptance criteria

- Character and incident scripts are deterministic by seed
- No passenger is duplicated or lost during insertion or travel
- Every mechanical effect is visible in the cabin, an anchored bubble, or hover status
- The same intrinsic Barbara definition is used in every method
- Character behavior can be disabled completely
- Ordinary scenarios preserve their previous deterministic results
- No separate event ticker or post-race recap is introduced
'''))

version=JS/'version.js'
replace_once(version,'export const APP_VERSION = "3.4.0";','export const APP_VERSION = "3.5.0";')
