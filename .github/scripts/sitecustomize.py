#!/usr/bin/env python3
import atexit
import subprocess
from pathlib import Path


def patch_renderer():
    path=Path('.github/scripts/apply_visible_crew_assistance.py')
    if not path.exists():
        return
    text=path.read_text(encoding='utf-8')
    start=text.index("render=JS/'render.js'")
    end=text.index("model=ROOT/'MODEL.md'",start)
    replacement=r"""render=JS/'render.js'
replace_once(render,'''export function passengerPoint(passenger,geometry){
  const aisleCenter=geometry.aisleX+geometry.aisleW/2;
''','''export function crewPoint(crew,geometry){
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
''')
replace_once(render,'''  }else if((passenger.squeezeDelayRemaining||0)>0){
    x=baseX+geometry.aisleW*.18;
''','''  }else if((passenger.squeezeDelayRemaining||0)>0 || (passenger.crewYieldRemaining||0)>0){
    x=baseX+geometry.aisleW*.18;
''')
replace_once(render,'''  const active=(sim.active||[]).map(passenger=>passengerPoint(passenger,geometry));
  for(let index=active.length-1;index>=0;index--){
''','''  const crew=crewPoint(sim.crew,geometry);
  if(Math.hypot(x-crew.x,y-crew.y)<=12){
    return {kind:"crew",crew:sim.crew,point:crew};
  }

  const active=(sim.active||[]).map(passenger=>passengerPoint(passenger,geometry));
  for(let index=active.length-1;index>=0;index--){
''')
replace_once(render,'.filter(p=>p.state==="stowing" && p.hasBag)','.filter(p=>(p.state==="stowing" || p.state==="crew-assist") && p.hasBag)')
replace_once(render,'''      if(p.state==="stowing"){
        const targetX=p.side==="L"?leftBinX+binW/2:rightBinX+binW/2;
        const duration=Math.max(.001,p.stowDuration||p.remaining||1);
        const progress=clamp(1-p.remaining/duration,0,1);
''','''      if(p.state==="stowing" || p.state==="crew-assist"){
        const targetX=p.side==="L"?leftBinX+binW/2:rightBinX+binW/2;
        const duration=Math.max(.001,p.state==="crew-assist"?(p.crewAssistTotal||p.remaining||1):(p.stowDuration||p.remaining||1));
        const progress=clamp(1-p.remaining/duration,0,1);
''')
replace_once(render,'''  for(const {p,x,y} of points){
    if(p.characterId && p.bubbleText && (p.bubbleUntil||0)>=sim.time){
      drawCharacterBubble(ctx,p.bubbleText,x,y,w,h);
    }
  }

  for(const members of activeFamilies.values()){
''','''  const crewVisual=crewPoint(sim.crew,geometry);
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
''')

"""
    path.write_text(text[:start]+replacement+text[end:],encoding='utf-8')

    self_path=Path(__file__)
    try:
        self_path.unlink()
        subprocess.run(['git','add',str(self_path)],check=True)
    except FileNotFoundError:
        pass


atexit.register(patch_renderer)
