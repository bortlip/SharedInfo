import { ROWS, COLS, palette } from "./constants.js";
import { clamp } from "./random.js";
import { formatTime } from "./format.js";

function roundedRect(ctx,x,y,w,h,r){
  ctx.beginPath();
  if(ctx.roundRect) ctx.roundRect(x,y,w,h,r);
  else ctx.rect(x,y,w,h);
}

function drawBag(ctx,x,y,w,h,color,alpha=1){
  ctx.save();
  ctx.globalAlpha=alpha;
  roundedRect(ctx,x,y,w,h,Math.min(2,w*.25,h*.25));
  ctx.fillStyle=color;
  ctx.fill();
  ctx.strokeStyle="rgba(255,255,255,.72)";
  ctx.lineWidth=Math.max(.7,w*.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x+w*.34,y);
  ctx.lineTo(x+w*.34,y-h*.18);
  ctx.lineTo(x+w*.66,y-h*.18);
  ctx.lineTo(x+w*.66,y);
  ctx.strokeStyle="rgba(235,247,255,.8)";
  ctx.lineWidth=Math.max(.6,w*.08);
  ctx.stroke();
  ctx.restore();
}

function bagColor(item){
  if(item.groupType==="family") return item.color||palette.family;
  return palette[item.groupType]||palette.single;
}

export function cabinGeometry(w,h){
  const top=34,bottom=h-18;
  const rowH=(bottom-top)/ROWS;
  const seatW=Math.min(38,(w-130)/6);
  const gap=3;
  const aisleW=Math.max(42,w*.13);
  const binW=Math.max(9,Math.min(11,w*.026));
  const blockW=3*seatW+2*gap;
  const totalW=blockW*2+aisleW+binW*2;
  const left=(w-totalW)/2;
  const leftBinX=left+blockW;
  const aisleX=leftBinX+binW;
  const rightBinX=aisleX+aisleW;
  const rightX=rightBinX+binW;
  return {w,h,top,bottom,rowH,seatW,gap,aisleW,binW,blockW,totalW,left,leftBinX,aisleX,rightBinX,rightX};
}

export function seatRect(geometry,row,col){
  const ci=COLS.indexOf(col);
  if(ci<0 || row<1 || row>ROWS) return null;
  const x=ci<3
    ? geometry.left+ci*(geometry.seatW+geometry.gap)
    : geometry.rightX+(ci-3)*(geometry.seatW+geometry.gap);
  const y=geometry.top+(row-1)*geometry.rowH+1;
  return {x,y,w:geometry.seatW,h:geometry.rowH-2,cx:x+geometry.seatW/2,cy:y+(geometry.rowH-2)/2};
}

export function passengerPoint(passenger,geometry){
  const aisleCenter=geometry.aisleX+geometry.aisleW/2;
  const baseX=aisleCenter+((passenger.id%3)-1)*Math.min(4,geometry.aisleW*.08);
  let x=baseX;
  let y=geometry.top+(clamp(passenger.pos,0,ROWS)-.5)*geometry.rowH;
  let seatingProgress=0;
  if(passenger.state==="seating"){
    const target=seatRect(geometry,passenger.row,passenger.col);
    const duration=Math.max(.001,passenger.seatingDuration||passenger.remaining||1);
    seatingProgress=clamp(1-passenger.remaining/duration,0,1);
    const eased=seatingProgress<.5
      ? 2*seatingProgress*seatingProgress
      : 1-Math.pow(-2*seatingProgress+2,2)/2;
    x=baseX+(target.cx-baseX)*eased;
    y=target.cy-Math.sin(seatingProgress*Math.PI)*Math.min(4,geometry.rowH*.18);
  }
  return {p:passenger,x,y,seatingProgress};
}

export function hitTestSim(sim,canvas,clientX,clientY){
  const rect=canvas.getBoundingClientRect();
  if(!rect.width || !rect.height) return null;
  const x=(clientX-rect.left)*canvas.width/rect.width;
  const y=(clientY-rect.top)*canvas.height/rect.height;
  const geometry=cabinGeometry(canvas.width,canvas.height);

  const active=(sim.active||[]).map(passenger=>passengerPoint(passenger,geometry));
  for(let index=active.length-1;index>=0;index--){
    const point=active[index];
    const radius=(point.p.isChild?4.3:5.6)+5;
    if(Math.hypot(x-point.x,y-point.y)<=radius){
      return {kind:"passenger",passenger:point.p,point};
    }
  }

  for(let row=1;row<=ROWS;row++){
    for(const col of COLS){
      const seat=seatRect(geometry,row,col);
      if(x<seat.x || x>seat.x+seat.w || y<seat.y || y>seat.y+seat.h) continue;
      const seatKey=`${row}${col}`;
      const occupant=sim.occupancy.get(seatKey)||null;
      const assigned=occupant||sim.queue.find(passenger=>passenger.seatKey===seatKey)||null;
      return {
        kind:"seat",
        row,
        col,
        seatKey,
        occupant,
        assigned,
        isAssigned:sim.assignedSeats.has(seatKey),
        rect:seat
      };
    }
  }
  return null;
}

export function drawSim(sim,canvas){
  const ctx=canvas.getContext("2d");
  const w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);

  const geometry=cabinGeometry(w,h);
  const {top,bottom,rowH,seatW,gap,aisleW,binW,left,leftBinX,aisleX,rightBinX,rightX}=geometry;

  const bagsByBin=new Map();
  for(const bag of sim.stowedBags||[]){
    const key=`${bag.row}${bag.side}`;
    if(!bagsByBin.has(key)) bagsByBin.set(key,[]);
    bagsByBin.get(key).push(bag);
  }
  const activeStows=new Set(
    sim.active
      .filter(p=>p.state==="stowing" && p.hasBag)
      .map(p=>`${p.row}${p.side}`)
  );

  ctx.fillStyle=palette.aisle;
  ctx.fillRect(aisleX-5,top-8,aisleW+10,bottom-top+16);
  ctx.strokeStyle=palette.grid;
  ctx.lineWidth=1;
  ctx.strokeRect(aisleX-5,top-8,aisleW+10,bottom-top+16);

  ctx.font="11px system-ui";
  ctx.textAlign="center";
  ctx.textBaseline="middle";

  for(let r=1;r<=ROWS;r++){
    const y=top+(r-1)*rowH;
    if(r%5===0 || r===1 || r===31){
      ctx.fillStyle=palette.text;
      ctx.textAlign="right";
      ctx.fillText(String(r),left-7,y+rowH/2);
      ctx.textAlign="center";
    }

    for(const [side,bx] of [["L",leftBinX],["R",rightBinX]]){
      const key=`${r}${side}`;
      ctx.fillStyle=activeStows.has(key)?"#244d67":"#10283c";
      ctx.fillRect(bx,y+1,binW,rowH-2);
      ctx.strokeStyle=activeStows.has(key)?"#70d9ff":palette.grid;
      ctx.strokeRect(bx+.5,y+1.5,binW-1,rowH-3);
    }

    for(let ci=0;ci<6;ci++){
      const col=COLS[ci];
      const seat=seatRect(geometry,r,col);
      const key=`${r}${col}`;
      const occ=sim.occupancy.get(key);
      const assigned=sim.assignedSeats.has(key);
      ctx.fillStyle=occ
        ? (occ.groupType==="family"? (occ.partySeatedColor||"#c38a38") : occ.groupType==="assisted" ? "#9a61b9" : palette.seated)
        : assigned ? palette.empty : palette.unassigned;
      ctx.fillRect(seat.x,seat.y,seat.w,seat.h);
      ctx.strokeStyle=occ?"rgba(255,255,255,.22)":palette.grid;
      ctx.strokeRect(seat.x+.5,seat.y+.5,seat.w-1,seat.h-1);
      if(rowH>17){
        ctx.fillStyle=occ?"rgba(255,255,255,.78)":"rgba(220,235,255,.45)";
        ctx.font="9px system-ui";
        ctx.fillText(col,seat.cx,seat.cy);
      }
    }

    for(const [side,bx] of [["L",leftBinX],["R",rightBinX]]){
      const bags=bagsByBin.get(`${r}${side}`)||[];
      if(!bags.length) continue;
      const bagH=Math.min(4.5,(rowH-4-(bags.length-1))/bags.length);
      const totalH=bags.length*bagH+(bags.length-1);
      const startY=y+(rowH-totalH)/2;
      bags.forEach((bag,index)=>{
        drawBag(ctx,bx+2,startY+index*(bagH+1),Math.max(4,binW-4),bagH,bagColor(bag),.95);
      });
    }
  }

  ctx.fillStyle="#0b1726";
  ctx.fillRect(aisleX,top-29,aisleW,22);
  ctx.strokeStyle=palette.grid;
  ctx.strokeRect(aisleX+.5,top-28.5,aisleW-1,21);
  ctx.fillStyle=palette.text;
  ctx.font="10px system-ui";
  ctx.fillText(`door · ${sim.queue.length-sim.pending} waiting`,aisleX+aisleW/2,top-18);

  const points=sim.active.map(passenger=>passengerPoint(passenger,geometry));
  const activeFamilies=new Map();
  for(const point of points){
    if(point.p.groupType!=="family") continue;
    if(!activeFamilies.has(point.p.unitId)) activeFamilies.set(point.p.unitId,[]);
    activeFamilies.get(point.p.unitId).push(point);
  }

  for(const members of activeFamilies.values()){
    if(members.length<2) continue;
    members.sort((a,b)=>a.p.queueIndex-b.p.queueIndex);
    ctx.save();
    ctx.globalAlpha=.48;
    ctx.strokeStyle=members[0].p.partyColor||palette.family;
    ctx.lineWidth=2.2;
    ctx.beginPath();
    ctx.moveTo(members[0].x,members[0].y);
    for(let i=1;i<members.length;i++) ctx.lineTo(members[i].x,members[i].y);
    ctx.stroke();
    ctx.restore();
  }

  for(const {p,x,y,seatingProgress} of points){
    const color=p.groupType==="family"?(p.partyColor||palette.family):palette[p.groupType];
    if(p.state==="seating"){
      const target=seatRect(geometry,p.row,p.col);
      ctx.save();
      ctx.setLineDash([3,3]);
      ctx.strokeStyle=`rgba(134,220,255,${.24+.34*(1-seatingProgress)})`;
      ctx.lineWidth=1.2;
      ctx.beginPath();
      ctx.moveTo(aisleX+aisleW/2,target.cy);
      ctx.lineTo(target.cx,target.cy);
      ctx.stroke();
      ctx.restore();
    }

    if(p.hasBag && !p.bagStowed){
      let bagX=x+(p.side==="L"?-10:4);
      let bagY=y-2;
      if(p.state==="stowing"){
        const targetX=p.side==="L"?leftBinX+binW/2:rightBinX+binW/2;
        const duration=Math.max(.001,p.stowDuration||p.remaining||1);
        const progress=clamp(1-p.remaining/duration,0,1);
        const eased=1-Math.pow(1-progress,2);
        bagX=(x-3.5)+(targetX-x)*eased;
        bagY=y-4-Math.sin(progress*Math.PI)*5;
        ctx.save();
        ctx.setLineDash([2,3]);
        ctx.strokeStyle="rgba(153,226,255,.42)";
        ctx.beginPath();
        ctx.moveTo(x,y);
        ctx.lineTo(targetX,y);
        ctx.stroke();
        ctx.restore();
      }
      drawBag(ctx,bagX,bagY,7,8,color,.98);
    }

    const radius=p.isChild?4.3:5.6;
    if(p.characterId){
      ctx.beginPath();
      ctx.arc(x,y,radius+3.5,0,Math.PI*2);
      ctx.strokeStyle="#fff0a8";
      ctx.lineWidth=1.7;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x,y,radius,0,Math.PI*2);
    ctx.fillStyle=color;
    ctx.fill();
    if(p.isChild){
      ctx.strokeStyle=palette.child;
      ctx.lineWidth=1.5;
      ctx.stroke();
    }else if(p.isReduced){
      ctx.strokeStyle="#f6e7ff";
      ctx.lineWidth=1.7;
      ctx.stroke();
    }
  }

  for(const members of activeFamilies.values()){
    const carrier=members.reduce((best,item)=>item.p.queueIndex<best.p.queueIndex?item:best);
    const label=`${carrier.p.partyLabel}·${carrier.p.partySize}`;
    ctx.save();
    ctx.font="700 8px system-ui";
    ctx.textAlign="left";
    ctx.textBaseline="middle";
    const padX=3;
    const boxW=ctx.measureText(label).width+padX*2;
    const boxH=13;
    let labelX=carrier.x+8;
    if(labelX+boxW>w-3) labelX=carrier.x-8-boxW;
    const labelY=clamp(carrier.y-boxH/2-7,2,h-boxH-2);
    roundedRect(ctx,labelX,labelY,boxW,boxH,4);
    ctx.fillStyle="rgba(5,14,25,.90)";
    ctx.fill();
    ctx.strokeStyle=carrier.p.partyColor||palette.family;
    ctx.lineWidth=1;
    ctx.stroke();
    ctx.fillStyle="#f8fbff";
    ctx.fillText(label,labelX+padX,labelY+boxH/2+.25);
    ctx.restore();
  }

  if(sim.done){
    const plaqueW=Math.min(190,w-24);
    const plaqueH=62;
    const plaqueX=(w-plaqueW)/2;
    const plaqueY=h/2-plaqueH/2;
    roundedRect(ctx,plaqueX,plaqueY,plaqueW,plaqueH,12);
    ctx.fillStyle="rgba(6,15,27,.92)";
    ctx.fill();
    ctx.strokeStyle="#4c7898";
    ctx.lineWidth=1.2;
    ctx.stroke();
    ctx.fillStyle="#e9f8ff";
    ctx.font="800 25px system-ui";
    ctx.fillText(formatTime(sim.time),w/2,plaqueY+23);
    ctx.fillStyle="#9eb0c9";
    ctx.font="12px system-ui";
    ctx.fillText("boarding complete",w/2,plaqueY+45);
  }
}
