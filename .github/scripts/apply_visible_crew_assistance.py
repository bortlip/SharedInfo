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
        raise RuntimeError(f'{path}: expected one occurrence, found {count}: {old[:120]!r}')
    write(path,text.replace(old,new,1))


write(JS/'characters.js',textwrap.dedent('''\
import { clamp, mulberry32 } from "./random.js";

const AMBIENT_LINES=[
  "Did you pack the charger?",
  "I think we're in row 24.",
  "This is definitely the right flight.",
  "Window seat. Nice.",
  "I should've bought water.",
  "Almost there.",
  "The app said boarding was delayed.",
  "Do you smell cinnamon rolls?"
];
const CHATTY_LINES=[
  "So anyway, that's when the HOA called...",
  "Have you tried that new place by the airport?",
  "I have the funniest story about my neighbor.",
  "Long flight, huh?"
];
const TIPSY_LINES=[
  "This aisle is moving.",
  "We're moving already?",
  "I am walking perfectly straight.",
  "Just getting my bearings."
];
const HELP_LINES=[
  "Could I get a little help with this?",
  "This bag is heavier than it looked.",
  "I can't quite lift this overhead.",
  "Excuse me—could someone help?"
];

function seedMix(seed,salt){
  let x=(seed ^ salt)>>>0;
  x=Math.imul(x^(x>>>16),0x7feb352d);
  x=Math.imul(x^(x>>>15),0x846ca68b);
  return (x^(x>>>16))>>>0;
}

function takeRandom(rng,candidates){
  if(!candidates.length) return null;
  return candidates.splice(Math.floor(rng()*candidates.length),1)[0];
}

function eligibleAdults(manifest,reserved){
  const preferred=manifest.passengers.filter(p=>
    !reserved.has(p.id) && p.groupType==="single" && !p.isChild && !p.isReduced && p.row>=6
  );
  if(preferred.length) return preferred;
  return manifest.passengers.filter(p=>!reserved.has(p.id) && !p.isChild && !p.isReduced && p.row>=4);
}

function assignCrew(manifest,seed){
  const rng=mulberry32(seedMix(seed,0xC0FFEE));
  manifest.crewDefinition={
    id:"crew-1",
    displayName:"Maya",
    role:"cabin crew",
    homePos:.12,
    speed:1.08+rng()*.16,
    squeezeSelfDuration:.55+rng()*.35,
    squeezeOtherDuration:.7+rng()*.45,
    color:"#56e0b5"
  };
}

function applyCrewHelpProfile(passenger,rng){
  passenger.requiresCrewHelp=true;
  passenger.crewFailDuration=1.6+rng()*1.8;
  passenger.crewAssistDuration=5.2+rng()*3.4;
  passenger.crewRequestLine=HELP_LINES[Math.floor(rng()*HELP_LINES.length)];
  passenger.crewAssistLine="I've got it—hold the handle.";
  passenger.crewAssistanceComplete=false;
  passenger.crewEventDelay=0;
}

function assignBarbara(manifest,seed,reserved){
  const rng=mulberry32(seedMix(seed,0xBA4BA4A));
  const candidates=eligibleAdults(manifest,reserved);
  const passenger=takeRandom(rng,candidates);
  if(!passenger) throw new Error("Barbara Mode requires an eligible adult passenger");
  reserved.add(passenger.id);

  const baselineBagBase=passenger.bagBase;
  passenger.displayName="Barbara";
  passenger.characterId="barbara";
  passenger.characterLabel="B";
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
  passenger.restroomTurnRow=clamp(Math.round(passenger.row*(.35+rng()*.24)),4,Math.max(4,passenger.row-2));
  passenger.restroomDuration=6+rng()*4;
  passenger.restroomWalkSpeed=.62+rng()*.14;
  passenger.restroomTarget=.15;
  passenger.squeezeOtherDuration=1.45+rng()*.65;
  passenger.squeezeSelfDuration=.75+rng()*.45;
  passenger.restroomTripElapsed=0;
  passenger.restroomExtraDelay=0;
  passenger.squeezePasses=0;
  passenger.eventDelaySeconds=0;
  passenger.bubbleText=null;
  passenger.bubbleUntil=0;
  applyCrewHelpProfile(passenger,rng);

  manifest.characters.push({id:"barbara",passengerId:passenger.id,seatKey:passenger.seatKey,type:"barbara"});
}

function assignChatty(passenger,rng,index){
  passenger.displayName=`Chatty passenger ${index+1}`;
  passenger.characterId=`chatty-${passenger.id}`;
  passenger.characterLabel="C";
  passenger.characterRole="very chatty passenger";
  passenger.characterStatus="looking for someone to talk to";
  passenger.eventState="waiting to board";
  passenger.characterColor="#6fd8ff";
  passenger.incidentType="chatty";
  const first=clamp(Math.round(passenger.row*(.25+rng()*.18)),2,Math.max(2,passenger.row-3));
  const second=clamp(Math.round(passenger.row*(.57+rng()*.18)),first+1,Math.max(first+1,passenger.row-1));
  passenger.incidentStops=[
    {row:first,duration:3.8+rng()*3.2,line:CHATTY_LINES[Math.floor(rng()*CHATTY_LINES.length)]},
    {row:second,duration:3.2+rng()*3.2,line:CHATTY_LINES[Math.floor(rng()*CHATTY_LINES.length)]}
  ];
  passenger.eventDelaySeconds=0;
}

function assignTipsy(passenger,rng,index){
  passenger.displayName=`Tipsy passenger ${index+1}`;
  passenger.characterId=`tipsy-${passenger.id}`;
  passenger.characterLabel="T";
  passenger.characterRole="tipsy passenger";
  passenger.characterStatus="moving very carefully";
  passenger.eventState="waiting to board";
  passenger.characterColor="#ff8fc8";
  passenger.incidentType="tipsy";
  passenger.baselineWalkSpeed=passenger.walkSpeed;
  passenger.incidentWalkFactor=.55+rng()*.16;
  passenger.walkSpeed*=passenger.incidentWalkFactor;
  passenger.incidentStops=[{
    row:clamp(Math.round(passenger.row*(.38+rng()*.32)),2,Math.max(2,passenger.row-1)),
    duration:2.8+rng()*3,
    line:TIPSY_LINES[Math.floor(rng()*TIPSY_LINES.length)]
  }];
  passenger.eventDelaySeconds=0;
}

function assignNeedsHelp(passenger,rng,index){
  const baselineBagBase=passenger.bagBase;
  passenger.displayName=`Passenger needing help ${index+1}`;
  passenger.characterId=`help-${passenger.id}`;
  passenger.characterLabel="H";
  passenger.characterRole="passenger needing overhead-bin assistance";
  passenger.characterStatus="hoping the bag cooperates";
  passenger.eventState="waiting to board";
  passenger.characterColor="#b79cff";
  passenger.incidentType="needs-help";
  passenger.baselineHasBag=passenger.hasBag;
  passenger.baselineBagBase=baselineBagBase;
  passenger.hasBag=true;
  passenger.bagBase=Math.max(passenger.bagBase,13+rng()*4);
  passenger.heavyBagExtra=Math.max(0,passenger.bagBase-baselineBagBase);
  passenger.eventDelaySeconds=0;
  applyCrewHelpProfile(passenger,rng);
}

function assignDisruptions(manifest,seed,cfg,reserved){
  const count=clamp(Math.floor(Number(cfg.disruptivePassengers)||0),0,3);
  if(!count) return;
  const rng=mulberry32(seedMix(seed,0xD15A7E));
  const candidates=eligibleAdults(manifest,reserved);
  for(let index=0;index<count;index++){
    const passenger=takeRandom(rng,candidates);
    if(!passenger) break;
    reserved.add(passenger.id);
    if(index%3===0) assignChatty(passenger,rng,index);
    else if(index%3===1) assignTipsy(passenger,rng,index);
    else assignNeedsHelp(passenger,rng,index);
    manifest.characters.push({id:passenger.characterId,passengerId:passenger.id,seatKey:passenger.seatKey,type:passenger.incidentType});
  }
}

function assignAmbientChatter(manifest,seed,cfg,reserved){
  const level=["off","light","lively"].includes(cfg.chatter)?cfg.chatter:"off";
  manifest.chatter=level;
  const target=level==="lively"?12:level==="light"?5:0;
  if(!target) return;
  const rng=mulberry32(seedMix(seed,0xC4A77E));
  const candidates=manifest.passengers.filter(p=>!reserved.has(p.id));
  for(let index=0;index<Math.min(target,candidates.length);index++){
    const passenger=takeRandom(rng,candidates);
    passenger.ambientLine=AMBIENT_LINES[Math.floor(rng()*AMBIENT_LINES.length)];
    passenger.ambientTriggerRow=clamp(Math.round(passenger.row*(.2+rng()*.62)),1,Math.max(1,passenger.row-1));
    passenger.ambientBubbleDuration=2.2+rng()*.8;
  }
}

export function applyCharacterScenario(manifest,seed,cfg){
  manifest.characterScenario=cfg.characterScenario||"none";
  manifest.disruptivePassengers=clamp(Math.floor(Number(cfg.disruptivePassengers)||0),0,3);
  manifest.characters=[];
  assignCrew(manifest,seed);
  const reserved=new Set();
  if(manifest.characterScenario==="barbara") assignBarbara(manifest,seed,reserved);
  assignDisruptions(manifest,seed,cfg,reserved);
  assignAmbientChatter(manifest,seed,cfg,reserved);
  return manifest;
}

export function repositionCharacterPassengers(queue){
  const lateArrivals=queue.filter(passenger=>Number.isFinite(passenger.lateQueueFraction));
  for(const passenger of lateArrivals){
    const originalIndex=queue.indexOf(passenger);
    if(originalIndex<0) continue;
    queue.splice(originalIndex,1);
    const requested=Math.round(queue.length*clamp(passenger.lateQueueFraction,0,1));
    const targetIndex=clamp(requested,0,queue.length);
    passenger.originalQueueIndex=originalIndex;
    passenger.lateQueueIndex=targetIndex;
    passenger.queueDisplacement=targetIndex-originalIndex;
    queue.splice(targetIndex,0,passenger);
  }
  return queue;
}
'''))

write(JS/'simulation.js',textwrap.dedent('''\
import { SPACING } from "./constants.js";
import { makeQueue } from "./methods.js";

const RESTROOM_TRAVEL_STATES=new Set(["walking-to-restroom","restroom","walking-from-restroom"]);
const CREW_BLOCKING_STATES=new Set(["failed-lift","awaiting-crew","crew-assist"]);

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
    const definition=manifest.crewDefinition||{
      id:"crew-1",displayName:"Maya",role:"cabin crew",homePos:.12,speed:1.15,
      squeezeSelfDuration:.7,squeezeOtherDuration:.9,color:"#56e0b5"
    };
    this.crew={
      ...definition,
      pos:definition.homePos,
      state:"idle",
      status:"watching the cabin",
      eventState:"available near the front door",
      targetPassengerId:null,
      remaining:0,
      bubbleText:null,
      bubbleUntil:0,
      passedIds:new Set(),
      assistsCompleted:0,
      travelDistance:0,
      squeezePasses:0,
      squeezeDelayRemaining:0
    };
    this.crewRequests=[];
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
  setCrewMoment(status,eventState,bubble=null,duration=0){
    this.crew.status=status;
    this.crew.eventState=eventState;
    if(bubble){
      this.crew.bubbleText=bubble;
      this.crew.bubbleUntil=this.time+duration;
    }
  }
  passengerById(id){
    return this.queue.find(p=>p.id===id)||null;
  }
  nearestToDoor(){
    let nearest=Infinity;
    for(const p of this.active) if(p.state!=="seated") nearest=Math.min(nearest,p.pos);
    if(this.crew.state!=="idle") nearest=Math.min(nearest,this.crew.pos);
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
    for(const [,occ] of this.occupancy){
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
  countHeavyBagDelay(p){
    if(p.heavyBagDelayCounted) return;
    p.eventDelaySeconds=(p.eventDelaySeconds||0)+(p.heavyBagExtra||0);
    p.heavyBagDelayCounted=true;
  }
  beginStowing(p){
    if(p.requiresCrewHelp && !p.crewAssistanceComplete){
      this.countHeavyBagDelay(p);
      if(!p.crewAttemptStarted){
        p.crewAttemptStarted=true;
        p.crewAttemptStartTime=this.time;
        p.state="failed-lift";
        p.remaining=p.crewFailDuration||2;
        this.setCharacterMoment(
          p,
          "trying to lift the carry-on",
          "the first overhead-bin attempt is not going well",
          "I can get this... I think.",
          Math.min(3,p.remaining)
        );
      }
      return;
    }
    p.state="stowing";
    p.stowDuration=this.computeStow(p);
    p.remaining=p.stowDuration;
    if(p.characterId){
      this.countHeavyBagDelay(p);
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
    this.setCharacterMoment(p,"finally aboard","heading down the aisle",p.characterId==="barbara"?"Made it!":null,3.5);
  }
  beginRestroomTrip(p){
    p.state="walking-to-restroom";
    p.restroomTripElapsed=0;
    p.restroomBaselineRemaining=Math.max(0,(p.row-p.pos)/Math.max(.001,p.walkSpeed));
    p.restroomPassedIds={outbound:new Set(),return:new Set()};
    p.squeezePasses=0;
    this.setCharacterMoment(p,"doubling back","walking toward the front lavatory","Nope. Restroom first.",4.2);
  }
  registerSqueeze(p,other,phase){
    const passed=p.restroomPassedIds?.[phase];
    if(!passed || passed.has(other.id)) return;
    passed.add(other.id);
    p.squeezePasses=(p.squeezePasses||0)+1;
    p.squeezeDelayRemaining=Math.max(p.squeezeDelayRemaining||0,p.squeezeSelfDuration||.9);
    const otherDelay=p.squeezeOtherDuration||1.8;
    if(other.state==="walking"){
      other.squeezeDelayRemaining=Math.max(other.squeezeDelayRemaining||0,otherDelay);
    }else if(other.state==="stowing" || other.state==="seating" || CREW_BLOCKING_STATES.has(other.state)){
      other.remaining=(other.remaining||0)+otherDelay;
      other.disruptionDelaySeconds=(other.disruptionDelaySeconds||0)+otherDelay;
    }
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
    const speed=(p.restroomWalkSpeed||.68)*(slowed ? .42 : 1);
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
    p.eventDelaySeconds=(p.eventDelaySeconds||0)+p.restroomExtraDelay;
    this.setCharacterMoment(
      p,
      "back at her row",
      `restroom trip complete · squeezed past ${p.squeezePasses||0} passengers`,
      "Much better.",
      3
    );
    this.beginStowing(p);
  }
  maybeBeginIncident(p){
    if(!p.incidentStops || p.state!=="walking") return false;
    const index=p.incidentStopIndex||0;
    const stop=p.incidentStops[index];
    if(!stop || p.pos+1e-7<stop.row) return false;
    p.pos=stop.row;
    p.state="incident-pause";
    p.remaining=stop.duration;
    p.incidentStopIndex=index;
    this.setCharacterMoment(
      p,
      p.incidentType==="tipsy"?"getting her bearings":"finishing a story",
      `${p.incidentType} aisle pause ${index+1} of ${p.incidentStops.length}`,
      stop.line,
      stop.duration
    );
    return true;
  }
  maybeShowAmbientLine(p){
    if(!p.ambientLine || p.ambientSpoken || p.state!=="walking") return;
    if(p.pos+1e-7<p.ambientTriggerRow) return;
    p.ambientSpoken=true;
    p.bubbleText=p.ambientLine;
    p.bubbleUntil=this.time+(p.ambientBubbleDuration||2.5);
  }
  queueCrewHelp(p){
    if(p.crewRequestQueued || p.crewAssistanceComplete) return;
    p.crewRequestQueued=true;
    p.crewRequestTime=this.time;
    p.state="awaiting-crew";
    p.remaining=0;
    this.crewRequests.push(p.id);
    this.setCharacterMoment(
      p,
      "waiting for cabin crew",
      "carry-on lift failed; help requested",
      p.crewRequestLine||"Could I get some help with this?",
      4.2
    );
  }
  beginNextCrewRequest(){
    while(this.crewRequests.length){
      const passenger=this.passengerById(this.crewRequests.shift());
      if(!passenger || passenger.crewAssistanceComplete || passenger.state!=="awaiting-crew") continue;
      this.crew.state="walking-to-passenger";
      this.crew.targetPassengerId=passenger.id;
      this.crew.passedIds=new Set();
      this.setCrewMoment("responding to a passenger",`walking to row ${passenger.row}`,"On my way.",2.4);
      passenger.crewResponseStarted=this.time;
      return;
    }
    this.crew.state="idle";
    this.crew.targetPassengerId=null;
    this.crew.pos=this.crew.homePos;
    this.setCrewMoment("watching the cabin","available near the front door");
  }
  registerCrewSqueeze(other){
    if(!other || other.state==="seated" || this.crew.passedIds.has(other.id)) return;
    this.crew.passedIds.add(other.id);
    this.crew.squeezePasses++;
    this.crew.squeezeDelayRemaining=Math.max(this.crew.squeezeDelayRemaining||0,this.crew.squeezeSelfDuration||.7);
    const delay=this.crew.squeezeOtherDuration||.9;
    if(other.state==="walking"){
      other.crewYieldRemaining=Math.max(other.crewYieldRemaining||0,delay);
    }else if(other.state==="stowing" || other.state==="seating" || CREW_BLOCKING_STATES.has(other.state)){
      other.remaining=(other.remaining||0)+delay;
      other.crewYieldSeconds=(other.crewYieldSeconds||0)+delay;
    }
    other.crewYieldedTo=this.crew.displayName;
    other.crewYieldCount=(other.crewYieldCount||0)+1;
  }
  startCrewAssistance(passenger){
    this.crew.state="assisting";
    this.crew.pos=passenger.row;
    this.crew.remaining=passenger.crewAssistDuration||6;
    passenger.state="crew-assist";
    passenger.remaining=this.crew.remaining;
    passenger.crewAssistTotal=this.crew.remaining;
    passenger.crewAssistanceStarted=this.time;
    this.setCrewMoment("helping with a carry-on",`lifting a bag at row ${passenger.row}`,"I've got it.",3);
    this.setCharacterMoment(
      passenger,
      "getting cabin-crew help",
      `${this.crew.displayName} is lifting the carry-on`,
      passenger.crewAssistLine||"Thank you!",
      3.2
    );
  }
  finishCrewAssistance(passenger){
    passenger.crewAssistanceComplete=true;
    passenger.crewAssistanceFinished=this.time;
    passenger.crewEventDelay=Math.max(0,this.time-(passenger.crewAttemptStartTime||this.time));
    if(passenger.hasBag && !passenger.bagStowed){
      passenger.bagStowed=true;
      const key=`${passenger.row}${passenger.side}`;
      const load=this.binLoad.get(key)||0;
      this.binLoad.set(key,load+1);
      this.stowedBags.push({
        passengerId:passenger.id,
        row:passenger.row,
        side:passenger.side,
        groupType:passenger.groupType,
        color:passenger.partyColor||passenger.characterColor||null
      });
    }
    this.crew.assistsCompleted++;
    this.setCharacterMoment(
      passenger,
      "bag safely overhead",
      `assisted by ${this.crew.displayName} after ${(passenger.crewEventDelay||0).toFixed(1)}s`,
      "Thank you!",
      2.8
    );
    this.beginSeating(passenger);
    this.crew.state="returning-front";
    this.crew.targetPassengerId=null;
    this.crew.passedIds=new Set();
    this.setCrewMoment("returning to the front","walking back toward the door","All set.",2.4);
  }
  stepCrewTravel(dt,target,arrive){
    const oldPos=this.crew.pos;
    const direction=target>=oldPos?1:-1;
    const slowed=(this.crew.squeezeDelayRemaining||0)>0;
    if(slowed) this.crew.squeezeDelayRemaining=Math.max(0,this.crew.squeezeDelayRemaining-dt);
    const speed=this.crew.speed*(slowed?.52:1);
    const move=Math.min(Math.abs(target-oldPos),speed*dt);
    this.crew.pos=oldPos+direction*move;
    this.crew.travelDistance+=move;

    const low=Math.min(oldPos,this.crew.pos)-.015;
    const high=Math.max(oldPos,this.crew.pos)+.015;
    for(const other of this.active){
      if(other.id===this.crew.targetPassengerId || other.state==="seated" || RESTROOM_TRAVEL_STATES.has(other.state)) continue;
      if(other.pos+1e-7>=low && other.pos-1e-7<=high) this.registerCrewSqueeze(other);
    }
    if(Math.abs(this.crew.pos-target)<=.001){
      this.crew.pos=target;
      arrive();
    }
  }
  stepCrew(dt){
    if(this.crew.state==="idle"){
      if(this.crewRequests.length) this.beginNextCrewRequest();
      return;
    }
    if(this.crew.state==="walking-to-passenger"){
      const passenger=this.passengerById(this.crew.targetPassengerId);
      if(!passenger || passenger.state!=="awaiting-crew"){
        this.crew.state="returning-front";
        this.crew.targetPassengerId=null;
        this.crew.passedIds=new Set();
        return;
      }
      this.stepCrewTravel(dt,passenger.row,()=>this.startCrewAssistance(passenger));
      return;
    }
    if(this.crew.state==="assisting"){
      const passenger=this.passengerById(this.crew.targetPassengerId);
      if(!passenger){
        this.crew.state="returning-front";
        this.crew.targetPassengerId=null;
        return;
      }
      this.crew.remaining=Math.max(0,this.crew.remaining-dt);
      passenger.remaining=this.crew.remaining;
      passenger.eventDelaySeconds=(passenger.eventDelaySeconds||0)+dt;
      if(this.crew.remaining<=0) this.finishCrewAssistance(passenger);
      return;
    }
    if(this.crew.state==="returning-front"){
      this.stepCrewTravel(dt,this.crew.homePos,()=>this.beginNextCrewRequest());
    }
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
      }else if(p.state==="incident-pause"){
        anyBlocking=true;
        p.remaining-=dt;
        p.eventDelaySeconds=(p.eventDelaySeconds||0)+dt;
        if(p.remaining<=0){
          p.incidentStopIndex=(p.incidentStopIndex||0)+1;
          p.state="walking";
          p.remaining=0;
          this.setCharacterMoment(p,"moving again",`${p.incidentType} pause complete`);
        }
      }else if(p.state==="failed-lift"){
        anyBlocking=true;
        p.remaining-=dt;
        p.eventDelaySeconds=(p.eventDelaySeconds||0)+dt;
        if(p.remaining<=0) this.queueCrewHelp(p);
      }else if(p.state==="awaiting-crew"){
        anyBlocking=true;
        p.eventDelaySeconds=(p.eventDelaySeconds||0)+dt;
      }else if(p.state==="crew-assist"){
        anyBlocking=true;
      }else if(p.state==="stowing"){
        anyBlocking=true;
        p.remaining-=dt;
        if(p.remaining<=0){
          if(p.hasBag && !p.bagStowed){
            p.bagStowed=true;
            this.stowedBags.push({
              passengerId:p.id,row:p.row,side:p.side,groupType:p.groupType,
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

    this.stepCrew(dt);
    if(this.crew.state==="assisting") anyBlocking=true;

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
        const yielding=(p.crewYieldRemaining||0)>0;
        if(squeezed){
          p.squeezeDelayRemaining=Math.max(0,p.squeezeDelayRemaining-dt);
          p.disruptionDelaySeconds=(p.disruptionDelaySeconds||0)+dt;
        }
        if(yielding){
          p.crewYieldRemaining=Math.max(0,p.crewYieldRemaining-dt);
          p.crewYieldSeconds=(p.crewYieldSeconds||0)+dt;
        }
        const factor=squeezed?.28:yielding?.38:1;
        const freeMove=p.walkSpeed*factor*dt;
        const move=Math.min(available,freeMove);
        p.pos+=move;
        if(available+1e-7<freeMove && p.pos<p.row-.001) this.movementDelay+=dt;
        this.maybeShowAmbientLine(p);

        if(
          p.characterId==="barbara"
          && !p.restroomTripStarted
          && p.row>p.restroomTurnRow+.001
          && p.pos+1e-7>=p.restroomTurnRow
        ){
          p.pos=p.restroomTurnRow;
          p.restroomTripStarted=true;
          this.beginRestroomTrip(p);
        }else if(this.maybeBeginIncident(p)){
          // Incident state set above.
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

# Fix JavaScript conditional operators that cannot use optional-chaining syntax.
simulation=JS/'simulation.js'
text=read(simulation).replace('slowed?.52:1','slowed ? .52 : 1').replace('squeezed?.28:yielding?.38:1','squeezed ? .28 : yielding ? .38 : 1')
write(simulation,text)

interaction=JS/'interaction.js'
replace_once(interaction,textwrap.dedent('''\
  if(passenger.state==="incident-pause") return `${passenger.incidentType||"incident"} delay in aisle · ${Math.max(0,passenger.remaining||0).toFixed(1)}s left`;
  if(passenger.state==="walking-from-restroom") return `returning toward row ${passenger.row} · near row ${Math.max(1,Math.ceil(passenger.pos||0))}`;
  if(passenger.state==="stowing") return `stowing carry-on · ${Math.max(0,passenger.remaining||0).toFixed(1)}s left`;
'''),textwrap.dedent('''\
  if(passenger.state==="incident-pause") return `${passenger.incidentType||"incident"} delay in aisle · ${Math.max(0,passenger.remaining||0).toFixed(1)}s left`;
  if(passenger.state==="walking-from-restroom") return `returning toward row ${passenger.row} · near row ${Math.max(1,Math.ceil(passenger.pos||0))}`;
  if(passenger.state==="failed-lift") return `failed overhead-bin lift · ${Math.max(0,passenger.remaining||0).toFixed(1)}s left`;
  if(passenger.state==="awaiting-crew") return "blocking the aisle while waiting for cabin crew";
  if(passenger.state==="crew-assist") return `crew lifting carry-on · ${Math.max(0,passenger.remaining||0).toFixed(1)}s left`;
  if(passenger.state==="stowing") return `stowing carry-on · ${Math.max(0,passenger.remaining||0).toFixed(1)}s left`;
'''))
replace_once(interaction,'if(passenger.disruptionDelaySeconds) character.push(row("Passenger disruption",`${passenger.disruptionDelaySeconds.toFixed(1)}s slowed by ${passenger.disruptedByCharacter||"another traveler"}`));\nif(passenger.characterId) character.push(row("Direct event delay",`${(passenger.eventDelaySeconds||0).toFixed(1)}s`));',textwrap.dedent('''\
if(passenger.disruptionDelaySeconds) character.push(row("Passenger disruption",`${passenger.disruptionDelaySeconds.toFixed(1)}s slowed by ${passenger.disruptedByCharacter||"another traveler"}`));
if(passenger.crewYieldSeconds) character.push(row("Yielded to crew",`${passenger.crewYieldSeconds.toFixed(1)}s across ${passenger.crewYieldCount||1} crossing${passenger.crewYieldCount===1?"":"s"}`));
if(passenger.requiresCrewHelp){
  const help=passenger.crewAssistanceComplete
    ? `${passenger.crewEventDelay.toFixed(1)}s · completed by Maya`
    : passenger.crewRequestQueued?"requested · crew responding":"required at the overhead bin";
  character.push(row("Crew help",help));
}
if(passenger.characterId) character.push(row("Direct event delay",`${(passenger.eventDelaySeconds||0).toFixed(1)}s`));
''').rstrip())
replace_once(interaction,textwrap.dedent('''\
export function tooltipHtml(hit,sim){
  if(hit.kind==="passenger") return passengerDetails(hit.passenger,sim);
  const passenger=hit.occupant||hit.assigned;
'''),textwrap.dedent('''\
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
'''))

render=JS/'render.js'
replace_once(render,textwrap.dedent('''\
export function passengerPoint(passenger,geometry){
  const aisleCenter=geometry.aisleX+geometry.aisleW/2;
'''),textwrap.dedent('''\
export function crewPoint(crew,geometry){
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
'''))
replace_once(render,'  }else if((passenger.squeezeDelayRemaining||0)>0){\n    x=baseX+geometry.aisleW*.18;','  }else if((passenger.squeezeDelayRemaining||0)>0 || (passenger.crewYieldRemaining||0)>0){\n    x=baseX+geometry.aisleW*.18;')
replace_once(render,textwrap.dedent('''\
  const active=(sim.active||[]).map(passenger=>passengerPoint(passenger,geometry));
  for(let index=active.length-1;index>=0;index--){
'''),textwrap.dedent('''\
  const crew=crewPoint(sim.crew,geometry);
  if(Math.hypot(x-crew.x,y-crew.y)<=12){
    return {kind:"crew",crew:sim.crew,point:crew};
  }

  const active=(sim.active||[]).map(passenger=>passengerPoint(passenger,geometry));
  for(let index=active.length-1;index>=0;index--){
'''))
replace_once(render,'.filter(p=>p.state==="stowing" && p.hasBag)','.filter(p=>(p.state==="stowing" || p.state==="crew-assist") && p.hasBag)')
replace_once(render,textwrap.dedent('''\
      if(p.state==="stowing"){
        const targetX=p.side==="L"?leftBinX+binW/2:rightBinX+binW/2;
        const duration=Math.max(.001,p.stowDuration||p.remaining||1);
        const progress=clamp(1-p.remaining/duration,0,1);
'''),textwrap.dedent('''\
      if(p.state==="stowing" || p.state==="crew-assist"){
        const targetX=p.side==="L"?leftBinX+binW/2:rightBinX+binW/2;
        const duration=Math.max(.001,p.state==="crew-assist"?(p.crewAssistTotal||p.remaining||1):(p.stowDuration||p.remaining||1));
        const progress=clamp(1-p.remaining/duration,0,1);
'''))
replace_once(render,textwrap.dedent('''\
  for(const {p,x,y} of points){
    if(p.characterId && p.bubbleText && (p.bubbleUntil||0)>=sim.time){
      drawCharacterBubble(ctx,p.bubbleText,x,y,w,h);
    }
  }

  for(const members of activeFamilies.values()){
'''),textwrap.dedent('''\
  const crewVisual=crewPoint(sim.crew,geometry);
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
'''))

model=ROOT/'MODEL.md'
text=read(model)
anchor='Crew assistance is not yet simulated. The incident framework can carry named roles, statuses, pauses, dialogue, and deterministic timing, but a later slice must add a visible crew member and interaction rather than teleporting help into the aisle.\n'
replacement=textwrap.dedent('''\
### Visible cabin-crew assistance

Every manifest includes one deterministic front-cabin crew definition named Maya. The crew actor is visible near the front door even when idle, but an idle crew member has no mechanical effect.

Barbara and the `Needs help` disruptive archetype perform a visible failed-lift attempt when they reach the overhead bin. The passenger then remains in the aisle and submits a first-come crew request. Maya walks from her current position to the passenger rather than teleporting, performs a seeded assistance interval, visibly raises the bag into the correct overhead compartment, and then walks back toward the front before accepting the next waiting request.

Crew travel uses the same one-dimensional squeeze abstraction as Barbara's restroom trip. When Maya crosses an active passenger, both shift laterally in the renderer; Maya slows briefly and the crossed passenger yields for a deterministic interval. The passenger's hover details retain the number and duration of crew yields. A crew hover tooltip shows Maya's current task, position, target, completed assists, traveled aisle distance, and passenger crossings.

The assisted passenger blocks the aisle during the failed lift, crew wait, and lift itself. These intervals are mechanically real and contribute to boarding time. Barbara's and the help-needing passenger's identity, failed-lift duration, assistance duration, and crew definition are shared across methods, while waiting time and actual crossings may differ because each method creates different congestion.

The crew actor is not included in the passenger count, does not occupy a seat, and never changes an ordinary zero-disruption flight while idle.
''')
if anchor not in text:
    raise RuntimeError('MODEL.md crew placeholder not found')
write(model,text.replace(anchor,replacement,1))

task=ROOT/'tasks/TASK-003-event-and-character-framework-barbara.md'
text=read(task)
text=text.replace('**Status:** Barbara trip and configurable cabin personality implemented in candidate','**Status:** Barbara, cabin incidents, and visible crew assistance implemented in candidate')
old=textwrap.dedent('''\
## Next slice — visible crew assistance

- add a deterministic cabin-crew actor near the front door
- support a passenger requesting help with a bag or finding a seat
- animate crew travel or reach rather than teleporting assistance
- pause or yield correctly while the interaction occurs
- expose both passenger and crew status on hover
- reuse the same framework for Barbara's failed-lift beat
''')
new=textwrap.dedent('''\
## Visible crew assistance — implemented

- deterministic cabin-crew actor Maya starts near the front door
- Barbara and the third disruptive archetype perform a failed overhead-bin lift
- requests are served first-come without teleporting the crew actor
- crew travel, passenger yields, assistance time, and return travel are animated
- assisted bags visibly move into their correct overhead compartment
- passenger and crew hover details explain the live interaction and accumulated delay
- intrinsic crew and assistance values are shared across methods

## Next slice — broader crew interactions

- optional seat-finding and family-coordination requests
- a second crew member for high-chaos scenarios
- bounded crew-request controls separate from disruptive-passenger count
- clearer visual signaling when multiple requests are queued
''')
if old not in text:
    raise RuntimeError('TASK crew section not found')
write(task,text.replace(old,new,1))

version=JS/'version.js'
replace_once(version,'export const APP_VERSION = "3.6.0";','export const APP_VERSION = "3.7.0";')
