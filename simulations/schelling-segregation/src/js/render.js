// Grid, overlays, movement trails, selection, and history rendering.
'use strict';

function canvasGeometry(g, config) {
  const pad = 10, cols = config.population.cols, rows = config.population.rows;
  return { pad, cellW:(g.canvas.width-pad*2)/cols, cellH:(g.canvas.height-pad*2)/rows, cols, rows };
}
function cellRect(index, geom) { const p=indexXY(index,geom.cols); return { x:geom.pad+p.x*geom.cellW, y:geom.pad+p.y*geom.cellH, w:geom.cellW, h:geom.cellH }; }
function cellCenter(index, geom) { const r=cellRect(index,geom); return { x:r.x+r.w/2, y:r.y+r.h/2 }; }

function drawMoveEvents(g, world, config, geom) {
  if (!config.visual.animateMoves && !config.visual.showTrails) return;
  g.save(); g.lineCap='round';
  for (const ev of world.moveEvents) {
    const a=cellCenter(ev.from,geom), b=cellCenter(ev.to,geom), life=1-ev.age/MOVE_EVENT_LIFE;
    const agent=world.agents[ev.agentId]; if(!agent) continue;
    g.globalAlpha=Math.max(0,life)*(config.visual.showTrails ? .55 : .28);
    g.strokeStyle=groupColor(agent.group,config.visual.colorScheme); g.lineWidth=config.visual.showTrails?2:1;
    g.beginPath(); g.moveTo(a.x,a.y); g.lineTo(b.x,b.y); g.stroke();
  }
  g.restore();
}

function drawClusterBoundaries(g, world, config, geom) {
  if (!config.visual.clusterOutlines) return;
  g.save(); g.strokeStyle='rgba(255,255,255,.42)'; g.lineWidth=Math.max(1,Math.min(2,geom.cellW*.15));
  for(let i=0;i<world.grid.length;i++){
    const id=world.grid[i]; if(id===EMPTY) continue;
    const group=world.agents[id]?.group, p=indexXY(i,geom.cols), r=cellRect(i,geom);
    if(p.x<geom.cols-1){const n=world.grid[i+1];if(n!==EMPTY&&world.agents[n]?.group!==group){g.beginPath();g.moveTo(r.x+r.w,r.y);g.lineTo(r.x+r.w,r.y+r.h);g.stroke();}}
    if(p.y<geom.rows-1){const n=world.grid[i+geom.cols];if(n!==EMPTY&&world.agents[n]?.group!==group){g.beginPath();g.moveTo(r.x,r.y+r.h);g.lineTo(r.x+r.w,r.y+r.h);g.stroke();}}
  }
  g.restore();
}
function drawStatusMarker(g, r, geom, flagged, config) {
  if(!config.visual.showUnhappy||r.w<=3)return;
  const style=config.visual.markerStyle||'strongOutline';
  if(style==='dimSatisfied'&&!flagged){g.fillStyle='rgba(4,5,10,.38)';g.fillRect(r.x+.15,r.y+.15,Math.max(0,r.w-.3),Math.max(0,r.h-.3));return;}
  if(!flagged)return;
  if(style==='glow'){
    g.fillStyle='rgba(118,15,31,.24)';g.fillRect(r.x+.2,r.y+.2,Math.max(0,r.w-.4),Math.max(0,r.h-.4));
    g.strokeStyle='rgba(225,55,75,.98)';g.lineWidth=Math.max(1.4,Math.min(3.0,geom.cellW*.26));
  }else if(style==='brightOutline'){
    g.strokeStyle='rgba(255,74,92,.98)';g.lineWidth=Math.max(1.0,Math.min(2.2,geom.cellW*.20));
  }else{
    g.strokeStyle='rgba(151,28,47,.98)';g.lineWidth=Math.max(1.6,Math.min(3.4,geom.cellW*.30));
  }
  g.strokeRect(r.x+1,r.y+1,Math.max(0,r.w-2),Math.max(0,r.h-2));
}

function renderWorld(world, g, config, selectedIndex=null) {
  if(!world)return;
  const geom=canvasGeometry(g,config);
  g.clearRect(0,0,g.canvas.width,g.canvas.height); g.fillStyle='#070912'; g.fillRect(0,0,g.canvas.width,g.canvas.height);
  for(let i=0;i<world.grid.length;i++){
    const id=world.grid[i], r=cellRect(i,geom);
    if(id===EMPTY){if(config.visual.showVacancies){g.fillStyle='#181b29';g.fillRect(r.x+.2,r.y+.2,Math.max(0,r.w-.4),Math.max(0,r.h-.4));}continue;}
    const agent=world.agents[id]; if(!agent?.active)continue;
    g.fillStyle=groupColor(agent.group,config.visual.colorScheme); g.fillRect(r.x+.15,r.y+.15,Math.max(0,r.w-.3),Math.max(0,r.h-.3));
    drawStatusMarker(g,r,geom,world.satisfaction?.[id]===0,config);
  }
  if(config.visual.gridLines&&geom.cellW>3){
    g.save();g.strokeStyle='rgba(255,255,255,.08)';g.lineWidth=.5;
    for(let x=0;x<=geom.cols;x++){const px=geom.pad+x*geom.cellW;g.beginPath();g.moveTo(px,geom.pad);g.lineTo(px,g.canvas.height-geom.pad);g.stroke();}
    for(let y=0;y<=geom.rows;y++){const py=geom.pad+y*geom.cellH;g.beginPath();g.moveTo(geom.pad,py);g.lineTo(g.canvas.width-geom.pad,py);g.stroke();}
    g.restore();
  }
  drawClusterBoundaries(g,world,config,geom); drawMoveEvents(g,world,config,geom);
  if(selectedIndex!==null&&selectedIndex>=0&&selectedIndex<world.grid.length){
    if(config.visual.showNeighborhood){g.save();g.fillStyle='rgba(255,255,255,.11)';for(const ni of neighborIndices(selectedIndex,config)){const r=cellRect(ni,geom);g.fillRect(r.x,r.y,r.w,r.h);}g.restore();}
    const r=cellRect(selectedIndex,geom);g.strokeStyle='#fff';g.lineWidth=Math.max(1.5,Math.min(3,geom.cellW*.25));g.strokeRect(r.x+.5,r.y+.5,Math.max(0,r.w-1),Math.max(0,r.h-1));
  }
}

function drawHistory() {
  const g=historyCtx,w=historyCanvas.width,h=historyCanvas.height;
  g.clearRect(0,0,w,h); g.fillStyle='rgba(0,0,0,.10)'; g.fillRect(0,0,w,h);
  g.strokeStyle='rgba(255,255,255,.08)'; g.lineWidth=1;
  for(let i=1;i<4;i++){const y=12+i*(h-30)/4;g.beginPath();g.moveTo(32,y);g.lineTo(w-10,y);g.stroke();}
  if(sim.history.length<2){g.fillStyle='rgba(255,255,255,.42)';g.font='12px system-ui';g.textAlign='center';g.fillText('Run or step the model to build a trace.',w/2,h/2);return;}
  const series=[['a','satisfied','#85e3b2',false],['a','segregation','#9bd7ff',false]];
  if(sim.config.compare.enabled) series.push(['b','satisfied','#ffd166',true],['b','segregation','#c799ff',true]);
  for(const [worldKey,key,color,dashed] of series){
    g.beginPath();let started=false;
    sim.history.forEach((item,i)=>{const obj=item[worldKey];if(!obj)return;const x=32+i/(sim.history.length-1)*(w-44);const v=key==='segregation'?(obj[key]+1)/2:obj[key];const y=h-16-clamp(v,0,1)*(h-30);if(!started){g.moveTo(x,y);started=true;}else g.lineTo(x,y);});
    g.strokeStyle=color;g.lineWidth=2;g.setLineDash(dashed?[6,5]:[]);g.stroke();
  }
  g.setLineDash([]);
}

function renderAll(){
  const selectedA=sim.selectedWorld==='A'?sim.selectedIndex:null;
  const selectedB=sim.selectedWorld==='B'?sim.selectedIndex:null;
  renderWorld(sim.worldA,ctx,sim.config,selectedA);
  if(sim.config.compare.enabled) renderWorld(sim.worldB,compareCtx,comparisonConfig(),selectedB);
  drawHistory();
}

