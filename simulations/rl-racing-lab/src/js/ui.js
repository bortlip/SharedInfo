// Spectator camera, telemetry, driver cards, and UI rendering.
function updateMainCamera(){
  const car=drivers[sim.selected],f=new THREE.Vector3(Math.cos(car.heading),0,Math.sin(car.heading));
  if(sim.cameraMode==='chase'){
    const roadY=track[car.trackIndex]?.y||0,desired=new THREE.Vector3(car.x-f.x*7,roadY+3.7,car.z-f.z*7);mainCamera.position.lerp(desired,.10);mainCamera.lookAt(car.x+f.x*5,roadY+.65,car.z+f.z*5);
  }else{
    const roadY=track[car.trackIndex]?.y||0;mainCamera.position.set(car.x+f.x*.25,roadY+1.25,car.z+f.z*.25);mainCamera.lookAt(car.x+f.x*14,roadY+.65,car.z+f.z*14);
  }
}
function resize(){const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h,false);mainCamera.aspect=w/h;mainCamera.updateProjectionMatrix()}
window.addEventListener('resize',resize);resize();
function log(text){const el=$('log'),line=document.createElement('div');line.textContent=text;el.prepend(line);while(el.children.length>18)el.lastChild.remove()}
function pctProgress(car){return mod(car.trackIndex-finishIndex,TRACK_N)/TRACK_N}
function updateDriversUI(){
  const wrap=$('drivers');wrap.innerHTML='';
  drivers.forEach((c,i)=>{
    const d=document.createElement('div');d.className='driver'+(i===sim.selected?' active':'');
    const status=sim.mode==='race'?(c.finishPlace!=null?`P${c.finishPlace} · ${c.finishTime.toFixed(1)}s`:c.raceStatus==='dnf'?'DNF':`lap ${Math.min(c.lap+1,sim.raceLaps)}/${sim.raceLaps}`):`${c.lap} lap${c.lap===1?'':'s'}`;
    d.innerHTML=`<div class="driver-head"><strong>Driver ${i+1}</strong><span>${status}</span></div><canvas class="driver-pov" width="32" height="20" aria-label="Driver ${i+1} neural camera input"></canvas><div class="mini"><span>speed <b>${c.speed.toFixed(1)}</b></span><span>reward <b>${c.totalReward.toFixed(1)}</b></span><span>progress <b>${Math.round(pctProgress(c)*100)}%</b></span><span>hits <b>${c.collisions}</b></span><span>passes <b>${c.overtakes}</b></span><span>slip <b>${c.slip.toFixed(0)}°</b></span></div><div class="damage"><div style="width:${c.damage}%"></div></div>`;
    d.addEventListener('click',()=>{sim.selected=i;if(!sim.learning)chooseAction(drivers[i]);updateUI()});wrap.appendChild(d);
    drawPreview(d.querySelector('.driver-pov'),c.latestRGBA);
  });
}
function actionName(car){
  const a=actionTable[car.lastAction]||{steer:0,throttle:0};
  return{steer:a.steer<-.75?'HARD LEFT':a.steer<-.1?'LEFT':a.steer>.75?'HARD RIGHT':a.steer>.1?'RIGHT':'STRAIGHT',throttle:a.throttle>0?'THROTTLE':a.throttle<0?'BRAKE':'COAST'};
}
function updateUI(){
  $('phaseText').textContent=sim.learning?'BACKPROP':sim.running?(sim.mode==='race'?'EVAL RACE':'LEARNING'):'PAUSED';
  $('updateText').textContent=sim.update;$('experienceText').textContent=sim.mode==='race'?'frozen':`${sim.experience} / ${BATCH_TARGET}`;
  $('selectedText').textContent=`Driver ${sim.selected+1}`;$('trackText').textContent=TRACK_DEFS[activeTrackId]?.name||activeTrackId;$('actualSpeed').textContent=`${sim.achievedSpeed.toFixed(1)}×`;
  $('expLabel').textContent=sim.mode==='race'?'frozen':`${sim.experience} / ${BATCH_TARGET}`;
  $('expBar').style.width=sim.mode==='race'?'0%':`${Math.min(100,sim.experience/BATCH_TARGET*100)}%`;
  $('batchReward').textContent=sim.mode==='race'?'—':sim.batchReward.toFixed(1);$('collisionCount').textContent=sim.collisions;
  const avg=drivers.reduce((sum,c)=>sum+pctProgress(c),0)/DRIVER_COUNT;$('avgProgress').textContent=`${Math.round(avg*100)}%`;
  const car=drivers[sim.selected],names=actionName(car);$('steerOut').textContent=names.steer;$('throttleOut').textContent=names.throttle;$('confidenceOut').textContent=car.lastProb?`${Math.round(car.lastProb*100)}%`:'—';
  $('runBtn').textContent=sim.mode==='race'?(sim.running?'Ⅱ Pause race':'▶ Resume race'):(sim.running?'Ⅱ Pause learning':'▶ Start learning');
  $('learnBtn').classList.toggle('primary',sim.mode==='learn');
  $('raceBtn').classList.toggle('primary',sim.mode==='race'&&!sim.raceFinished);$('fastBtn').classList.toggle('primary',sim.fastMode);$('fastBtn').textContent=sim.fastMode?'⚡ Fast training ON':'⚡ Fast training';$('slipOut').textContent=`${car.slip.toFixed(0)}° · G${car.gear}`;
  if(sim.mode==='race'&&!sim.raceFinished)$('raceResult').innerHTML=`<strong>Race:</strong> ${sim.raceLaps} laps · ${sim.raceTime.toFixed(1)} s · ${raceResultsText()}`;
  updateDriversUI();updatePOV();
}
