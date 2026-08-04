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
  passenger.bubbleText=null;
  passenger.bubbleUntil=0;

  manifest.characters.push({
    id:"barbara",
    passengerId:passenger.id,
    seatKey:passenger.seatKey,
    heavyBagExtra:passenger.heavyBagExtra,
    lateQueueFraction:passenger.lateQueueFraction,
    restroomTurnRow:passenger.restroomTurnRow,
    restroomDuration:passenger.restroomDuration,
    restroomWalkSpeed:passenger.restroomWalkSpeed,
    squeezeOtherDuration:passenger.squeezeOtherDuration,
    squeezeSelfDuration:passenger.squeezeSelfDuration
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
