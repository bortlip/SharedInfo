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
