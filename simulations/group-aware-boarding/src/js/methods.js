import { ROWS } from "./constants.js";
import { repositionCharacterPassengers } from "./characters.js";

function internalOrder(unit){
  const p=unit.passengers.slice();
  if(unit.groupType==="assisted"){
    return p.sort((a,b)=>b.depth-a.depth || (b.isReduced?1:0)-(a.isReduced?1:0));
  }
  return p.sort((a,b)=>b.depth-a.depth || (b.isChild?1:0)-(a.isChild?1:0) || b.row-a.row);
}

function steffenSeatRank(p){
  const seatStage=2-p.depth; // window, middle, aisle
  const sideStage=p.side==="L"?0:1;
  const preferredParity=p.side==="L"?1:0;
  const parityStage=(p.row%2===preferredParity)?0:1;
  return seatStage*100000 + sideStage*20000 + parityStage*5000 + (ROWS-p.row)*100;
}

export function makeQueue(manifest,method,priorityPolicy,sequenceCompliance){
  const decorated=manifest.units.map(unit=>{
    let rank;
    if(method==="random"){
      rank=unit.queueRandom;
    }else if(method==="back"){
      rank=(ROWS-unit.maxRow)*1000+unit.queueRandom*999;
    }else if(method==="front"){
      rank=(unit.minRow-1)*1000+unit.queueRandom*999;
    }else if(method==="zones"){
      const zone=Math.floor((ROWS-unit.maxRow)/6);
      rank=zone*1000+unit.queueRandom*999;
    }else if(method==="wilma"){
      const seatStage=Math.min(...unit.passengers.map(p=>2-p.depth));
      rank=seatStage*1000+unit.queueRandom*999;
    }else{
      rank=Math.min(...unit.passengers.map(steffenSeatRank))+unit.queueRandom*40;
    }

    let priority=0;
    if(priorityPolicy==="assist") priority=unit.groupType==="assisted"?-2:0;
    else if(priorityPolicy==="allgroups") priority=unit.groupType==="assisted"?-3:unit.groupType==="family"?-2:0;
    return {unit,rank,priority};
  });

  const tiers=new Map();
  for(const item of decorated){
    if(!tiers.has(item.priority)) tiers.set(item.priority,[]);
    tiers.get(item.priority).push(item);
  }

  const orderedUnits=[];
  for(const priority of [...tiers.keys()].sort((a,b)=>a-b)){
    const tier=tiers.get(priority).sort((a,b)=>a.rank-b.rank);
    if(method==="random" || sequenceCompliance>=1){
      orderedUnits.push(...tier);
      continue;
    }
    const n=tier.length;
    const repositioned=tier.map((item,index)=>({
      ...item,
      position:item.unit.complianceDraw<sequenceCompliance
        ? index
        : item.unit.compliancePosition*Math.max(1,n)
    }));
    repositioned.sort((a,b)=>a.position-b.position || a.rank-b.rank);
    orderedUnits.push(...repositioned);
  }

  const queue=[];
  for(const {unit} of orderedUnits){
    const ordered=internalOrder(unit);
    ordered.forEach((p,i)=>queue.push({
      ...p,
      firstInUnit:i===0,
      entryDelay:i===0?unit.entryDelay:0,
      partyLabel:unit.partyLabel||unit.id,
      partySize:unit.passengers.length,
      partyColor:unit.partyColor||null,
      partySeatedColor:unit.partySeatedColor||null
    }));
  }
  repositionCharacterPassengers(queue);
  queue.forEach((p,index)=>p.queueIndex=index);
  return queue;
}
