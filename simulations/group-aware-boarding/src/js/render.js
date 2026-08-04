import { ROWS, COLS, palette } from "./constants.js";
import { clamp } from "./random.js";
import { formatTime } from "./format.js";

export function drawSim(sim,canvas){
  const ctx=canvas.getContext("2d");
  const w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);

  const top=34,bottom=h-18;
  const rowH=(bottom-top)/ROWS;
  const seatW=Math.min(38,(w-110)/6);
  const gap=3;
  const aisleW=Math.max(42,w*.13);
  const blockW=3*seatW+2*gap;
  const totalW=blockW*2+aisleW;
  const left=(w-totalW)/2;
  const aisleX=left+blockW;
  const rightX=aisleX+aisleW;

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
    for(let ci=0;ci<6;ci++){
      const col=COLS[ci];
      const x=ci<3 ? left+ci*(seatW+gap) : rightX+(ci-3)*(seatW+gap);
      const key=`${r}${col}`;
      const occ=sim.occupancy.get(key);
      const assigned=sim.assignedSeats.has(key);
      ctx.fillStyle=occ
        ? (occ.groupType==="family"? (occ.partySeatedColor||"#c38a38") : occ.groupType==="assisted" ? "#9a61b9" : palette.seated)
        : assigned ? palette.empty : palette.unassigned;
      ctx.fillRect(x,y+1,seatW,rowH-2);
      ctx.strokeStyle=occ?"rgba(255,255,255,.22)":palette.grid;
      ctx.strokeRect(x+.5,y+1.5,seatW-1,rowH-3);
      if(rowH>17){
        ctx.fillStyle=occ?"rgba(255,255,255,.78)":"rgba(220,235,255,.45)";
        ctx.font="9px system-ui";
        ctx.fillText(col,x+seatW/2,y+rowH/2);
      }
    }
  }

  ctx.fillStyle="#0b1726";
  ctx.fillRect(aisleX,top-29,aisleW,22);
  ctx.strokeStyle=palette.grid;
  ctx.strokeRect(aisleX+.5,top-28.5,aisleW-1,21);
  ctx.fillStyle=palette.text;
  ctx.font="10px system-ui";
  ctx.fillText(`door · ${sim.queue.length-sim.pending} waiting`,aisleX+aisleW/2,top-18);

  const activePoint=p=>({
    p,
    y:top+(clamp(p.pos,0,ROWS)-.5)*rowH,
    x:aisleX+aisleW/2 + ((p.id%3)-1)*Math.min(4,aisleW*.08)
  });
  const points=sim.active.map(activePoint);
  const activeFamilies=new Map();
  for(const point of points){
    if(point.p.groupType!=="family") continue;
    if(!activeFamilies.has(point.p.unitId)) activeFamilies.set(point.p.unitId,[]);
    activeFamilies.get(point.p.unitId).push(point);
  }

  // Subtle connectors make contiguous members of the same family read as one party.
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

  for(const {p,x,y} of points){
    const radius=p.isChild?4.3:5.6;
    ctx.beginPath();
    ctx.arc(x,y,radius,0,Math.PI*2);
    ctx.fillStyle=p.groupType==="family"?(p.partyColor||palette.family):palette[p.groupType];
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

  // Keep one label visible per active family. As the leader sits, the next member inherits it.
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
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(labelX,labelY,boxW,boxH,4);
    else ctx.rect(labelX,labelY,boxW,boxH);
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
    ctx.fillStyle="rgba(6,15,27,.72)";
    ctx.fillRect(0,0,w,h);
    ctx.fillStyle="#e9f8ff";
    ctx.font="800 25px system-ui";
    ctx.fillText(formatTime(sim.time),w/2,h/2-8);
    ctx.fillStyle="#9eb0c9";
    ctx.font="12px system-ui";
    ctx.fillText("boarding complete",w/2,h/2+18);
  }
}
