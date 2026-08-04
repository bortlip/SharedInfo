import { ROWS, COLS, TOTAL, familyColor } from "./constants.js";
import { mulberry32, shuffle, clamp } from "./random.js";

function weightedSize(rng,weights){
  const total=weights.reduce((a,b)=>a+b,0);
  if(total<=0) return 2;
  let x=rng()*total;
  for(let i=0;i<weights.length;i++){
    x-=weights[i];
    if(x<=0) return i+2;
  }
  return 5;
}
function seatInfo(row,col){
  const idx=COLS.indexOf(col);
  const side=idx<3?"L":"R";
  const depth = idx<3 ? 2-idx : idx-3; // A/F=2, B/E=1, C/D=0
  return {key:`${row}${col}`,row,col,side,depth};
}
function seedMix(seed,salt){
  let x=(seed ^ salt)>>>0;
  x=Math.imul(x^(x>>>16),0x7feb352d);
  x=Math.imul(x^(x>>>15),0x846ca68b);
  return (x^(x>>>16))>>>0;
}

export function makeManifest(seed,cfg){
  const rng=mulberry32(seedMix(seed,0xA320));
  const available=new Map();
  for(let r=1;r<=ROWS;r++) for(const c of COLS){
    const s=seatInfo(r,c); available.set(s.key,s);
  }
  const passengers=[];
  const units=[];
  let pid=0, gid=0, familyOrdinal=0;

  const patternsBySize={
    2:[["A","B"],["B","C"],["C","D"],["D","E"],["E","F"]],
    3:[["A","B","C"],["B","C","D"],["C","D","E"],["D","E","F"]],
    4:[["A","B","C","D"],["B","C","D","E"],["C","D","E","F"]],
    5:[["A","B","C","D","E"],["B","C","D","E","F"]]
  };

  function takeCluster(size){
    const candidates=[];
    for(let r=1;r<=ROWS;r++){
      for(const pat of patternsBySize[size]){
        const seats=pat.map(c=>available.get(`${r}${c}`));
        if(seats.every(Boolean)) candidates.push(seats);
      }
    }
    if(!candidates.length) return null;
    const chosen=candidates[Math.floor(rng()*candidates.length)];
    chosen.forEach(s=>available.delete(s.key));
    return chosen;
  }

  function newPassenger(seat,unit,type,flags={}){
    const isChild=!!flags.isChild;
    const isReduced=!!flags.isReduced;
    let walkSpeed;
    if(isReduced) walkSpeed=.46+rng()*.16;
    else if(isChild) walkSpeed=.82+rng()*.28;
    else walkSpeed=1.17+rng()*.42;

    const bagProb=isChild?cfg.bagRate*.25:isReduced?cfg.bagRate*.55:cfg.bagRate;
    const hasBag=rng()<bagProb;
    const bagBase=hasBag ? 4.2 + rng()*7.5 + rng()*2.5 : .35+rng()*.35;
    const seatBase=isReduced ? 7.5+rng()*5.5 : isChild ? 3.8+rng()*3.8 : 2.1+rng()*2.8;
    const p={
      id:pid++, seatKey:seat.key,row:seat.row,col:seat.col,side:seat.side,depth:seat.depth,
      unitId:unit.id, groupType:type, isChild,isReduced, hasBag, bagBase, seatBase, walkSpeed
    };
    passengers.push(p);
    unit.passengers.push(p);
    return p;
  }

  function finalizeUnit(unit){
    if(unit.groupType!=="single"){
      const slowest=Math.min(...unit.passengers.map(p=>p.walkSpeed));
      unit.passengers.forEach(p=>p.walkSpeed=slowest);
    }
    unit.maxRow=Math.max(...unit.passengers.map(p=>p.row));
    unit.minRow=Math.min(...unit.passengers.map(p=>p.row));
    unit.avgRow=unit.passengers.reduce((s,p)=>s+p.row,0)/unit.passengers.length;
    unit.queueRandom=rng();
    unit.complianceDraw=rng();
    unit.compliancePosition=rng();
    units.push(unit);
  }

  const targetPassengers=clamp(Math.round(TOTAL*cfg.loadFactor),1,TOTAL);
  const assistedTarget=Math.min(cfg.assistedParties,Math.floor(targetPassengers/2));
  const familyTarget=Math.min(
    Math.round(targetPassengers*cfg.familyShare),
    Math.max(0,targetPassengers-assistedTarget*2)
  );
  let familyCount=0;
  while(familyCount+2<=familyTarget){
    let size=weightedSize(rng,cfg.partyWeights);
    size=Math.min(size,familyTarget-familyCount);
    if(size<2) break;
    let seats=takeCluster(size);
    if(!seats){
      let fallback=size-1;
      while(fallback>=2 && !(seats=takeCluster(fallback))) fallback--;
      if(!seats) break;
      size=fallback;
    }
    const familyIndex=familyOrdinal++;
    const unit={
      id:`F${gid++}`,
      groupType:"family",
      passengers:[],
      partyLabel:`F${familyIndex+1}`,
      partyColor:familyColor(familyIndex,false),
      partySeatedColor:familyColor(familyIndex,true)
    };
    seats.sort((a,b)=>b.depth-a.depth || a.col.localeCompare(b.col));
    let adultCount=size===2?1:size===3?(rng()<.46?2:1):2;
    adultCount=Math.min(adultCount,size-1);
    const adultSeatIndices=new Set(
      seats.map((s,i)=>({i,depth:s.depth})).sort((a,b)=>a.depth-b.depth).slice(0,adultCount).map(x=>x.i)
    );
    seats.forEach((seat,i)=>newPassenger(seat,unit,"family",{isChild:!adultSeatIndices.has(i)}));
    unit.childCount=unit.passengers.filter(p=>p.isChild).length;
    unit.entryDelay=1.0+unit.childCount*.65+rng()*1.2;
    finalizeUnit(unit);
    familyCount+=size;
  }

  for(let i=0;i<assistedTarget;i++){
    let seats=takeCluster(2);
    if(!seats) break;
    seats.sort((a,b)=>b.depth-a.depth);
    const unit={id:`A${gid++}`,groupType:"assisted",passengers:[],childCount:0,entryDelay:3.5+rng()*2.5};
    newPassenger(seats[0],unit,"assisted",{isReduced:true});
    newPassenger(seats[1],unit,"assisted",{});
    finalizeUnit(unit);
  }

  const remainingNeeded=Math.max(0,targetPassengers-passengers.length);
  const remaining=shuffle([...available.values()],rng).slice(0,remainingNeeded);
  for(const seat of remaining){
    const unit={id:`S${gid++}`,groupType:"single",passengers:[],childCount:0,entryDelay:rng()*.25};
    newPassenger(seat,unit,"single",{});
    finalizeUnit(unit);
  }

  return {passengers,units,targetPassengers};
}
