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


def indent_block(block,indent):
    prefix=' '*indent
    return '\n'.join(prefix+line if line else line for line in block.split('\n'))


def replace_once(path,old,new):
    text=read(path)
    for indent in range(0,9):
        candidate=indent_block(old,indent)
        count=text.count(candidate)
        if count==1:
            write(path,text.replace(candidate,indent_block(new,indent),1))
            return
        if count>1:
            raise RuntimeError(f'{path}: expected one occurrence, found {count}: {candidate[:100]!r}')
    raise RuntimeError(f'{path}: expected one occurrence with indentation 0-8: {old[:100]!r}')


write(JS/'scenarios.js',textwrap.dedent('''\
export const SCENARIO_SCHEMA_VERSION = 1;

export const DEFAULT_SCENARIO_SETTINGS = {
  loadFactor:100,
  familyShare:30,
  partyWeights:[22,36,28,14],
  assistedParties:3,
  bagRate:70,
  sequenceCompliance:100,
  priorityPolicy:"assist",
  disruptivePassengers:0,
  chatter:"light",
  speed:16,
  seed:12345,
  trials:40,
  characterScenario:"none"
};

// Set `included` to false to remove a scenario from the selector without deleting its definition.
export const SCENARIO_PRESETS = [
  {
    id:"smooth-business",included:true,name:"Smooth Business Route",emoji:"💼",
    description:"Experienced travelers, lots of carry-ons, and almost everyone follows the plan.",
    settings:{loadFactor:85,familyShare:5,partyWeights:[60,25,10,5],assistedParties:1,bagRate:80,sequenceCompliance:95,priorityPolicy:"assist",disruptivePassengers:0,chatter:"off",speed:16,seed:81317,trials:40}
  },
  {
    id:"family-vacation",included:true,name:"Family Vacation",emoji:"🏖️",
    description:"A full flight with plenty of families, children, bags, and respectable queue manners.",
    settings:{...DEFAULT_SCENARIO_SETTINGS}
  },
  {
    id:"holiday-crush",included:true,name:"Holiday Crush",emoji:"🎄",
    description:"The cabin is full, the bags are plentiful, and every third person appears to know someone ahead of them.",
    settings:{loadFactor:100,familyShare:45,partyWeights:[10,28,38,24],assistedParties:4,bagRate:85,sequenceCompliance:75,priorityPolicy:"allgroups",disruptivePassengers:2,chatter:"lively",speed:16,seed:122425,trials:40}
  },
  {
    id:"light-hop",included:true,name:"Lightly Loaded Hop",emoji:"🪽",
    description:"Half the seats are empty, the aisle can breathe, and nobody needs to make this complicated.",
    settings:{loadFactor:55,familyShare:15,partyWeights:[40,35,18,7],assistedParties:1,bagRate:45,sequenceCompliance:95,priorityPolicy:"none",disruptivePassengers:0,chatter:"light",speed:16,seed:5517,trials:40}
  },
  {
    id:"perfect-lab",included:true,name:"Perfect Laboratory Conditions",emoji:"🧪",
    description:"A controlled baseline: perfect compliance and no dramatic improvisation from the passengers.",
    settings:{loadFactor:100,familyShare:30,partyWeights:[22,36,28,14],assistedParties:3,bagRate:70,sequenceCompliance:100,priorityPolicy:"assist",disruptivePassengers:0,chatter:"off",speed:16,seed:24680,trials:40}
  },
  {
    id:"assisted-heavy",included:true,name:"Assisted-Heavy Flight",emoji:"🫶",
    description:"More travelers need extra time and companions, so priority policy matters much more.",
    settings:{loadFactor:90,familyShare:20,partyWeights:[38,34,20,8],assistedParties:10,bagRate:60,sequenceCompliance:95,priorityPolicy:"assist",disruptivePassengers:0,chatter:"light",speed:16,seed:77001,trials:40}
  },
  {
    id:"maximum-carryons",included:true,name:"Maximum Carry-ons",emoji:"🧳",
    description:"Everyone brought a bag. The overhead bins have entered the chat.",
    settings:{loadFactor:100,familyShare:25,partyWeights:[25,35,25,15],assistedParties:3,bagRate:100,sequenceCompliance:90,priorityPolicy:"assist",disruptivePassengers:1,chatter:"light",speed:16,seed:99991,trials:40}
  },
  {
    id:"low-compliance-chaos",included:true,name:"Low-Compliance Chaos",emoji:"🌪️",
    description:"The boarding order is more of a gentle suggestion than an enforceable policy.",
    settings:{loadFactor:100,familyShare:35,partyWeights:[15,30,35,20],assistedParties:5,bagRate:85,sequenceCompliance:35,priorityPolicy:"none",disruptivePassengers:3,chatter:"lively",speed:16,seed:40404,trials:40}
  },
  {
    id:"barbara",included:true,name:"Barbara Mode",emoji:"🍷",
    description:"She is late. Her bag is heavy. She has made several decisions.",
    settings:{loadFactor:100,familyShare:30,partyWeights:[22,36,28,14],assistedParties:3,bagRate:82,sequenceCompliance:88,priorityPolicy:"assist",disruptivePassengers:1,chatter:"lively",speed:16,seed:8675309,trials:40,characterScenario:"barbara"}
  }
];

const PRIORITY_POLICIES = new Set(["assist","allgroups","none"]);
const SPEEDS = new Set([4,16,64,256]);
const CHARACTER_SCENARIOS = new Set(["none","barbara"]);
const CHATTER_LEVELS = new Set(["off","light","lively"]);

function bounded(value,min,max,fallback,integer=false){
  const n=Number(value);
  if(!Number.isFinite(n)) return fallback;
  const result=Math.min(max,Math.max(min,n));
  return integer?Math.floor(result):result;
}

function nonNegativeFinite(value,fallback){
  const n=Number(value);
  return Number.isFinite(n) && n>=0 ? n : fallback;
}

export function normalizeScenarioSettings(input={}){
  const fallback=DEFAULT_SCENARIO_SETTINGS;
  const weights=Array.isArray(input.partyWeights) && input.partyWeights.length===4
    ? input.partyWeights.map((value,index)=>nonNegativeFinite(value,fallback.partyWeights[index]))
    : [...fallback.partyWeights];
  const priority=PRIORITY_POLICIES.has(input.priorityPolicy)?input.priorityPolicy:fallback.priorityPolicy;
  const speedValue=Number(input.speed);
  return {
    loadFactor:bounded(input.loadFactor,50,100,fallback.loadFactor),
    familyShare:bounded(input.familyShare,0,70,fallback.familyShare),
    partyWeights:weights,
    assistedParties:bounded(input.assistedParties,0,12,fallback.assistedParties,true),
    bagRate:bounded(input.bagRate,0,100,fallback.bagRate),
    sequenceCompliance:bounded(input.sequenceCompliance,0,100,fallback.sequenceCompliance),
    priorityPolicy:priority,
    disruptivePassengers:bounded(input.disruptivePassengers,0,3,fallback.disruptivePassengers,true),
    chatter:CHATTER_LEVELS.has(input.chatter)?input.chatter:fallback.chatter,
    speed:SPEEDS.has(speedValue)?speedValue:fallback.speed,
    seed:bounded(input.seed,1,2147483646,fallback.seed,true),
    trials:bounded(input.trials,5,200,fallback.trials,true),
    characterScenario:CHARACTER_SCENARIOS.has(input.characterScenario)?input.characterScenario:fallback.characterScenario
  };
}

export function settingsEqual(left,right){
  const a=normalizeScenarioSettings(left);
  const b=normalizeScenarioSettings(right);
  return a.loadFactor===b.loadFactor
    && a.familyShare===b.familyShare
    && a.partyWeights.every((value,index)=>value===b.partyWeights[index])
    && a.assistedParties===b.assistedParties
    && a.bagRate===b.bagRate
    && a.sequenceCompliance===b.sequenceCompliance
    && a.priorityPolicy===b.priorityPolicy
    && a.disruptivePassengers===b.disruptivePassengers
    && a.chatter===b.chatter
    && a.speed===b.speed
    && a.seed===b.seed
    && a.trials===b.trials
    && a.characterScenario===b.characterScenario;
}

export function matchingPreset(settings){
  return SCENARIO_PRESETS.find(preset=>preset.included!==false && !preset.disabled && settingsEqual(settings,preset.settings))||null;
}

export function parseScenarioSearch(search){
  const params=new URLSearchParams(search||"");
  if(!params.has("v") || Number(params.get("v"))!==SCENARIO_SCHEMA_VERSION) return null;
  const defaults=DEFAULT_SCENARIO_SETTINGS;
  const get=(key,fallback)=>params.has(key)?params.get(key):fallback;
  const weights=params.has("pw")?params.get("pw").split(","):defaults.partyWeights;
  return normalizeScenarioSettings({
    loadFactor:get("lf",defaults.loadFactor),familyShare:get("fs",defaults.familyShare),
    partyWeights:weights.length===4?weights:defaults.partyWeights,
    assistedParties:get("ap",defaults.assistedParties),bagRate:get("br",defaults.bagRate),
    sequenceCompliance:get("sc",defaults.sequenceCompliance),priorityPolicy:get("pp",defaults.priorityPolicy),
    disruptivePassengers:get("dp",defaults.disruptivePassengers),chatter:get("ct",defaults.chatter),
    speed:get("sp",defaults.speed),seed:get("sd",defaults.seed),trials:get("tr",defaults.trials),
    characterScenario:get("ch",defaults.characterScenario)
  });
}

export function serializeScenarioSettings(settings,presetId="custom"){
  const value=normalizeScenarioSettings(settings);
  const params=new URLSearchParams();
  params.set("v",String(SCENARIO_SCHEMA_VERSION));
  params.set("pr",presetId||"custom");
  params.set("lf",String(value.loadFactor));params.set("fs",String(value.familyShare));
  params.set("pw",value.partyWeights.join(","));params.set("ap",String(value.assistedParties));
  params.set("br",String(value.bagRate));params.set("sc",String(value.sequenceCompliance));
  params.set("pp",value.priorityPolicy);params.set("dp",String(value.disruptivePassengers));
  params.set("ct",value.chatter);params.set("sp",String(value.speed));params.set("sd",String(value.seed));
  params.set("tr",String(value.trials));params.set("ch",value.characterScenario);
  return params.toString();
}
'''))

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

function assignDisruptions(manifest,seed,cfg,reserved){
  const count=clamp(Math.floor(Number(cfg.disruptivePassengers)||0),0,3);
  if(!count) return;
  const rng=mulberry32(seedMix(seed,0xD15A7E));
  const candidates=eligibleAdults(manifest,reserved);
  for(let index=0;index<count;index++){
    const passenger=takeRandom(rng,candidates);
    if(!passenger) break;
    reserved.add(passenger.id);
    if(index%2===0) assignChatty(passenger,rng,index);
    else assignTipsy(passenger,rng,index);
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

export class BoardingSim{
  constructor(manifest,method,cfg){
    this.method=method;this.cfg=cfg;
    this.queue=makeQueue(manifest,method,cfg.priorityPolicy,cfg.sequenceCompliance);
    this.assignedSeats=new Set(this.queue.map(p=>p.seatKey));
    this.active=[];this.pending=0;this.time=0;this.completed=0;
    this.occupancy=new Map();this.binLoad=new Map();this.stowedBags=[];
    this.seatConflicts=0;this.conflictSeconds=0;this.blockedSeconds=0;this.movementDelay=0;
    this.done=false;this.doorDelayStarted=false;
  }
  showBubble(p,text,duration=2.6){
    if(!text) return;
    p.bubbleText=text;p.bubbleUntil=this.time+duration;
  }
  setCharacterMoment(p,status,eventState,bubble=null,duration=0){
    if(!p.characterId) return;
    p.characterStatus=status;p.eventState=eventState;
    if(bubble) this.showBubble(p,bubble,duration);
  }
  nearestToDoor(){
    let nearest=Infinity;
    for(const p of this.active) if(p.state!=="seated") nearest=Math.min(nearest,p.pos);
    return nearest;
  }
  computeStow(p){
    const key=`${p.row}${p.side}`;const load=this.binLoad.get(key)||0;
    if(p.hasBag) this.binLoad.set(key,load+1);
    return p.bagBase+(p.hasBag?Math.max(0,load-2)*1.45:0);
  }
  computeSeat(p){
    let blockers=0,penalty=0;
    for(const occ of this.occupancy.values()) if(occ.row===p.row && occ.side===p.side && occ.depth<p.depth){
      blockers++;penalty+=occ.unitId===p.unitId?2.2:5.4;
    }
    if(blockers){this.seatConflicts+=blockers;this.conflictSeconds+=penalty;}
    return p.seatBase+penalty;
  }
  beginStowing(p){
    p.state="stowing";p.stowDuration=this.computeStow(p);p.remaining=p.stowDuration;
    if(p.characterId==="barbara"){
      if(!p.heavyBagDelayCounted){p.eventDelaySeconds=(p.eventDelaySeconds||0)+(p.heavyBagExtra||0);p.heavyBagDelayCounted=true;}
      this.setCharacterMoment(p,"wrestling with the carry-on","struggling with a very heavy bag","This bag was lighter at home.",Math.min(7,p.stowDuration));
    }else if(p.characterId){
      this.setCharacterMoment(p,"handling the carry-on",p.hasBag?"stowing a carry-on":"getting ready to sit");
    }
  }
  beginSeating(p){
    p.state="seating";p.seatingDuration=this.computeSeat(p);p.remaining=p.seatingDuration;
    this.setCharacterMoment(p,"almost there",`entering row ${p.row} toward ${p.seatKey}`);
  }
  release(dt){
    if(this.pending>=this.queue.length || this.nearestToDoor()<SPACING) return;
    const p=this.queue[this.pending];
    if(!p.delayRemainingInitialized){p.delayRemaining=p.entryDelay;p.delayRemainingInitialized=true;}
    if(p.delayRemaining>0){p.delayRemaining=Math.max(0,p.delayRemaining-dt);return;}
    p.state="walking";p.pos=0;p.remaining=0;p.eventDelaySeconds=p.eventDelaySeconds||0;
    this.active.push(p);this.pending++;
    if(p.characterId==="barbara") this.setCharacterMoment(p,"finally aboard","heading down the aisle","Made it!",3.5);
    else if(p.incidentType==="chatty") this.setCharacterMoment(p,"ready to mingle","looking for conversation","Long flight, huh?",3);
    else if(p.incidentType==="tipsy") this.setCharacterMoment(p,"finding the aisle","moving carefully","We're moving already?",3);
  }
  beginIncidentPause(p,stop){
    p.state="incident-pause";p.remaining=stop.duration;
    p.incidentStopIndex=(p.incidentStopIndex||0)+1;
    const status=p.incidentType==="chatty"?"finishing a story":"getting their bearings";
    this.setCharacterMoment(p,status,`${p.incidentType} aisle delay`,stop.line,Math.min(stop.duration,5));
  }
  maybeTriggerAmbient(p){
    if(p.ambientSpoken || !p.ambientLine || p.pos+1e-7<(p.ambientTriggerRow||0)) return;
    p.ambientSpoken=true;
    this.showBubble(p,p.ambientLine,p.ambientBubbleDuration||2.5);
  }
  beginRestroomTrip(p){
    p.state="walking-to-restroom";p.restroomTripElapsed=0;
    p.restroomBaselineRemaining=Math.max(0,(p.row-p.pos)/Math.max(.001,p.walkSpeed));
    p.restroomPassedIds={outbound:new Set(),return:new Set()};p.squeezePasses=0;
    this.setCharacterMoment(p,"doubling back","walking toward the front lavatory","Nope. Restroom first.",4.2);
  }
  registerSqueeze(p,other,phase){
    const passed=p.restroomPassedIds?.[phase];if(!passed || passed.has(other.id)) return;
    passed.add(other.id);p.squeezePasses=(p.squeezePasses||0)+1;
    p.squeezeDelayRemaining=Math.max(p.squeezeDelayRemaining||0,p.squeezeSelfDuration||.9);
    const otherDelay=p.squeezeOtherDuration||1.8;
    if(other.state==="walking") other.squeezeDelayRemaining=Math.max(other.squeezeDelayRemaining||0,otherDelay);
    else if(other.state==="stowing" || other.state==="seating" || other.state==="incident-pause"){
      other.remaining=(other.remaining||0)+otherDelay;other.disruptionDelaySeconds=(other.disruptionDelaySeconds||0)+otherDelay;
    }
    other.disruptedByCharacter=p.displayName||"a disruptive passenger";other.disruptionCount=(other.disruptionCount||0)+1;
    if(p.squeezePasses===1 || p.squeezePasses%4===0) this.setCharacterMoment(
      p,"squeezing past passengers",`${phase==="outbound"?"backtracking":"returning"} through the aisle · ${p.squeezePasses} crossings`,
      p.squeezePasses===1?"Excuse me—sorry—coming through.":"Sorry. Again.",2.8
    );
  }
  stepRestroomTravel(p,dt){
    p.restroomTripElapsed=(p.restroomTripElapsed||0)+dt;
    const outbound=p.state==="walking-to-restroom",target=outbound?(p.restroomTarget??.15):p.row;
    const direction=outbound?-1:1,phase=outbound?"outbound":"return";
    const slowed=(p.squeezeDelayRemaining||0)>0;if(slowed) p.squeezeDelayRemaining=Math.max(0,p.squeezeDelayRemaining-dt);
    const oldPos=p.pos,move=Math.min(Math.abs(target-oldPos),(p.restroomWalkSpeed||.68)*(slowed?.42:1)*dt);
    p.pos=oldPos+direction*move;
    const low=Math.min(oldPos,p.pos)-.015,high=Math.max(oldPos,p.pos)+.015;
    for(const other of this.active) if(other!==p && other.state!=="seated" && !RESTROOM_TRAVEL_STATES.has(other.state) && other.pos+1e-7>=low && other.pos-1e-7<=high) this.registerSqueeze(p,other,phase);
    if(Math.abs(p.pos-target)>.001) return;
    p.pos=target;
    if(outbound){p.state="restroom";p.remaining=p.restroomDuration;this.setCharacterMoment(p,"in the lavatory","using the front lavatory","Finally.",2.4);return;}
    p.restroomTripComplete=true;p.restroomExtraDelay=Math.max(0,(p.restroomTripElapsed||0)-(p.restroomBaselineRemaining||0));
    p.eventDelaySeconds=(p.heavyBagDelayCounted?p.heavyBagExtra||0:0)+p.restroomExtraDelay;
    this.setCharacterMoment(p,"back at her row",`restroom trip complete · squeezed past ${p.squeezePasses||0} passengers`,"Much better.",3);
    this.beginStowing(p);
  }
  step(dt){
    if(this.done) return;this.time+=dt;
    let anyBlocking=false;
    for(const p of this.active){
      if(p.state==="restroom"){
        anyBlocking=true;p.remaining-=dt;p.restroomTripElapsed=(p.restroomTripElapsed||0)+dt;
        if(p.remaining<=0){p.state="walking-from-restroom";p.remaining=0;this.setCharacterMoment(p,"heading back","returning from the front lavatory","Coming back through.",3.2);}
      }else if(p.state==="incident-pause"){
        anyBlocking=true;p.remaining-=dt;p.eventDelaySeconds=(p.eventDelaySeconds||0)+dt;p.incidentDelaySeconds=(p.incidentDelaySeconds||0)+dt;
        if(p.remaining<=0){p.state="walking";p.remaining=0;this.setCharacterMoment(p,"moving again","continuing toward the assigned row");}
      }else if(p.state==="stowing"){
        anyBlocking=true;p.remaining-=dt;
        if(p.remaining<=0){
          if(p.hasBag && !p.bagStowed){p.bagStowed=true;this.stowedBags.push({passengerId:p.id,row:p.row,side:p.side,groupType:p.groupType,color:p.partyColor||p.characterColor||null});}
          this.beginSeating(p);
        }
      }else if(p.state==="seating"){
        anyBlocking=true;p.remaining-=dt;
        if(p.remaining<=0){p.state="seated";this.occupancy.set(p.seatKey,p);this.completed++;this.setCharacterMoment(p,"settled, for now","seated");}
      }
    }
    for(const p of this.active) if(p.state==="walking-to-restroom" || p.state==="walking-from-restroom"){anyBlocking=true;this.stepRestroomTravel(p,dt);}
    if(anyBlocking) this.blockedSeconds+=dt;
    if(this.active.some(p=>p.state==="seated")) this.active=this.active.filter(p=>p.state!=="seated");

    let leadPos=Infinity;
    for(const p of this.active){
      if(p.state==="walking"){
        let allowed=p.row;if(leadPos<Infinity) allowed=Math.min(allowed,leadPos-SPACING);
        const available=Math.max(0,allowed-p.pos),squeezed=(p.squeezeDelayRemaining||0)>0;
        if(squeezed){p.squeezeDelayRemaining=Math.max(0,p.squeezeDelayRemaining-dt);p.disruptionDelaySeconds=(p.disruptionDelaySeconds||0)+dt;}
        const freeMove=p.walkSpeed*(squeezed?.28:1)*dt,move=Math.min(available,freeMove);
        p.pos+=move;if(available+1e-7<freeMove && p.pos<p.row-.001) this.movementDelay+=dt;
        this.maybeTriggerAmbient(p);

        const stop=p.incidentStops?.[p.incidentStopIndex||0];
        if(p.characterId==="barbara" && !p.restroomTripStarted && p.row>p.restroomTurnRow+.001 && p.pos+1e-7>=p.restroomTurnRow){
          p.pos=p.restroomTurnRow;p.restroomTripStarted=true;this.beginRestroomTrip(p);
        }else if(stop && p.pos+1e-7>=stop.row){
          p.pos=Math.min(p.pos,stop.row);this.beginIncidentPause(p,stop);
        }else if(p.row-p.pos<=.001){p.pos=p.row;this.beginStowing(p);}
      }
      if(!RESTROOM_TRAVEL_STATES.has(p.state)) leadPos=p.pos;
    }
    this.release(dt);
    if(this.completed===this.queue.length) this.done=true;
    if(this.time>7200){this.done=true;console.warn("Simulation safety stop",this.method);}
  }
  runToEnd(dt=.2){while(!this.done) this.step(dt);return this.time;}
}
'''))

index=ROOT/'src/index.html'
replace_once(index,'<small>Load, families, luggage, compliance, speed, and seed</small>','<small>Load, families, luggage, compliance, cabin personality, speed, and seed</small>')
replace_once(index,textwrap.dedent('''\
        <label>
          Animation speed
          <select id="speed">
'''),textwrap.dedent('''\
        <label>
          Disruptive passengers
          <select id="disruptivePassengers">
            <option value="0">None</option>
            <option value="1">1 passenger</option>
            <option value="2">2 passengers</option>
            <option value="3">3 passengers</option>
          </select>
        </label>
        <label>
          Cabin chatter
          <select id="chatter">
            <option value="off">Off</option>
            <option value="light" selected>Light</option>
            <option value="lively">Lively</option>
          </select>
        </label>
        <label>
          Animation speed
          <select id="speed">
'''))

app=JS/'app.js'
replace_once(app,textwrap.dedent('''\
  priorityPolicy:$("priorityPolicy"),
  speed:$("speed"),
'''),textwrap.dedent('''\
  priorityPolicy:$("priorityPolicy"),
  disruptivePassengers:$("disruptivePassengers"),
  chatter:$("chatter"),
  speed:$("speed"),
'''))
replace_once(app,textwrap.dedent('''\
    priorityPolicy:controls.priorityPolicy.value,
    speed:controls.speed.value,
'''),textwrap.dedent('''\
    priorityPolicy:controls.priorityPolicy.value,
    disruptivePassengers:controls.disruptivePassengers.value,
    chatter:controls.chatter.value,
    speed:controls.speed.value,
'''))
replace_once(app,textwrap.dedent('''\
  controls.priorityPolicy.value=value.priorityPolicy;
  controls.speed.value=String(value.speed);
'''),textwrap.dedent('''\
  controls.priorityPolicy.value=value.priorityPolicy;
  controls.disruptivePassengers.value=String(value.disruptivePassengers);
  controls.chatter.value=value.chatter;
  controls.speed.value=String(value.speed);
'''))
replace_once(app,textwrap.dedent('''\
    priorityPolicy:controls.priorityPolicy.value,
    seed:clamp(Math.floor(+controls.seed.value||1),1,2147483646),
'''),textwrap.dedent('''\
    priorityPolicy:controls.priorityPolicy.value,
    disruptivePassengers:clamp(Math.floor(+controls.disruptivePassengers.value||0),0,3),
    chatter:controls.chatter.value,
    seed:clamp(Math.floor(+controls.seed.value||1),1,2147483646),
'''))
replace_once(app,textwrap.dedent('''\
  if(settings.characterScenario==="barbara") preview.push("Barbara aboard");
  return preview;
'''),textwrap.dedent('''\
  if(settings.disruptivePassengers) preview.push(`${settings.disruptivePassengers} disruption${settings.disruptivePassengers===1?"":"s"}`);
  if(settings.chatter!=="off") preview.push(`${settings.chatter} chatter`);
  if(settings.characterScenario==="barbara") preview.push("Barbara aboard");
  return preview;
'''))

fmt=JS/'format.js'
replace_once(fmt,textwrap.dedent('''\
    priorityPolicy:cfg.priorityPolicy,
    characterScenario:cfg.characterScenario||"none",
'''),textwrap.dedent('''\
    priorityPolicy:cfg.priorityPolicy,
    disruptivePassengers:cfg.disruptivePassengers||0,
    chatter:cfg.chatter||"off",
    characterScenario:cfg.characterScenario||"none",
'''))

interaction=JS/'interaction.js'
replace_once(interaction,'  if(passenger.state==="restroom") return `inside front lavatory · ${Math.max(0,passenger.remaining||0).toFixed(1)}s left`;','  if(passenger.state==="restroom") return `inside front lavatory · ${Math.max(0,passenger.remaining||0).toFixed(1)}s left`;\n  if(passenger.state==="incident-pause") return `${passenger.incidentType||"incident"} delay in aisle · ${Math.max(0,passenger.remaining||0).toFixed(1)}s left`;')
replace_once(interaction,textwrap.dedent('''\
  if(passenger.disruptionDelaySeconds) character.push(row("Passenger disruption",`${passenger.disruptionDelaySeconds.toFixed(1)}s slowed by ${passenger.disruptedByCharacter||"another traveler"}`));
  if(passenger.characterId) character.push(row("Direct event delay",`${(passenger.eventDelaySeconds||0).toFixed(1)}s`));
'''),textwrap.dedent('''\
  if(passenger.baselineWalkSpeed) character.push(row("Normal walking speed",`${passenger.baselineWalkSpeed.toFixed(2)} rows/sec`));
  if(passenger.incidentStops) character.push(row("Incident stops",`${passenger.incidentStopIndex||0} of ${passenger.incidentStops.length} completed`));
  if(passenger.disruptionDelaySeconds) character.push(row("Passenger disruption",`${passenger.disruptionDelaySeconds.toFixed(1)}s slowed by ${passenger.disruptedByCharacter||"another traveler"}`));
  if(passenger.characterId) character.push(row("Direct event delay",`${(passenger.eventDelaySeconds||0).toFixed(1)}s`));
'''))

render=JS/'render.js'
replace_once(render,textwrap.dedent('''\
  }else if((passenger.squeezeDelayRemaining||0)>0){
    x=baseX+geometry.aisleW*.18;
  }
'''),textwrap.dedent('''\
  }else if((passenger.squeezeDelayRemaining||0)>0){
    x=baseX+geometry.aisleW*.18;
  }else if(passenger.incidentType==="tipsy" && passenger.state==="walking"){
    x=baseX+Math.sin((passenger.pos+passenger.id)*5)*2.4;
  }
'''))
replace_once(render,'      ctx.fillText("B",x,y+.3);','      ctx.fillText(p.characterLabel||"•",x,y+.3);')

model=ROOT/'MODEL.md'
replace_once(model,'### Live race HUD and race graph',textwrap.dedent('''\
### Configurable cabin incidents and chatter

The advanced settings independently control `Disruptive passengers` and `Cabin chatter`.

Disruptive-passenger count is clamped to 0 through 3. A separate seeded incident stream selects eligible adult individual travelers after the ordinary manifest is complete, so incident selection does not consume or shift the random draws used for seats, families, bags, or normal timing. The same selected travelers and intrinsic incident values are shared across all methods.

The current mechanical archetypes are:

- **Chatty:** pauses twice at seeded aisle rows to finish a story. Each pause blocks the aisle, produces a visible bubble, and adds to that passenger's direct event delay.
- **Tipsy/slow:** receives a seeded walking-speed reduction, a visible lateral sway, and one seeded aisle pause to regain their bearings.

The number and timing of downstream delays can differ by method because nearby passengers and congestion differ. These travelers have distinct markers and live hover status. `Disruptive passengers: None` disables both archetypes completely.

Cabin chatter is separate and presentation-only. `Off`, `Light`, and `Lively` deterministically assign zero, five, or twelve ordinary passengers one short line each. A line appears once when its passenger crosses a seeded row. Ambient bubbles do not pause movement, alter queue order, add delay, or affect benchmark results. The small fixed population and one-line limit prevent the display from becoming a continuous wall of speech.

Crew assistance is not yet simulated. The incident framework can carry named roles, statuses, pauses, dialogue, and deterministic timing, but a later slice must add a visible crew member and interaction rather than teleporting help into the aisle.

### Live race HUD and race graph
'''))

write(ROOT/'tasks/TASK-003-event-and-character-framework-barbara.md',textwrap.dedent('''\
# TASK-003: Event and Character Framework — Barbara and Cabin Incidents

**Status:** Barbara trip and configurable cabin personality implemented in candidate

## Implemented

### Barbara

- deterministic late insertion, heavy carry-on, true front-lavatory trip, return travel, and squeeze penalties
- visible marker, direction changes, lavatory, speech bubbles, and detailed hover state
- shared intrinsic definition across all boarding methods

### Configurable disruptive passengers

The advanced controls allow 0 through 3 disruptive passengers. A separate seeded stream selects eligible adult individual travelers without disturbing ordinary manifest draws.

Implemented archetypes:

- **Chatty:** two seeded story pauses that visibly block the aisle
- **Tipsy/slow:** reduced walking speed, visible sway, and one seeded bearings pause

Every selected traveler has a marker, role, live status, incident progress, and direct event delay in hover details. Their identity and intrinsic behavior are shared across methods; congestion-dependent consequences may differ.

### Ambient cabin chatter

- Off: no ambient lines
- Light: five seeded passengers receive one line each
- Lively: twelve seeded passengers receive one line each

Ambient chatter is visual only. It never changes movement or results, and each selected passenger speaks at most once.

## Fairness and safety properties

- passenger IDs remain unique and complete
- named characters and incidents use separate random streams
- all mechanical effects are visible in the cabin, a bubble, or hover state
- character and incident behavior can be disabled
- no Race Moments ticker or post-race recap

## Next slice — visible crew assistance

- add a deterministic cabin-crew actor near the front door
- support a passenger requesting help with a bag or finding a seat
- animate crew travel or reach rather than teleporting assistance
- pause or yield correctly while the interaction occurs
- expose both passenger and crew status on hover
- reuse the same framework for Barbara's failed-lift beat

## Acceptance criteria

- scripts are deterministic by seed
- no passenger is duplicated or lost
- ordinary scenarios with zero disruptions preserve previous mechanical results
- ambient chatter never changes results
- shared links preserve incident and chatter settings
- no separate event ticker or post-race recap is introduced
'''))

version=JS/'version.js'
replace_once(version,'export const APP_VERSION = "3.5.0";','export const APP_VERSION = "3.6.0";')
