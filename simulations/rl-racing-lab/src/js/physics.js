// Proven baseline arcade dynamics, track-progress reward, and collision responsibility.
function simulateCar(car,dt){
  car.collisionCooldown=Math.max(0,car.collisionCooldown-dt);
  const before=car.trackIndex,nearBefore=nearestIndexFor(car),onRoadBefore=nearBefore.distance<HALF_WIDTH,maxSpeed=22*(1-clamp(car.damage/100,0,.55));
  let accel=car.actionThrottle>0?10.5:car.actionThrottle<0?-15:-1.3;accel-=car.speed*.045;
  car.speed=clamp(car.speed+accel*dt,0,maxSpeed);if(!onRoadBefore)car.speed*=Math.pow(.965,dt*60);
  car.gear=Math.min(5,1+Math.floor(car.speed/4.4));
  const steerRate=1.75*(.28+.72*(car.speed/22));car.heading-=car.actionSteer*steerRate*dt;
  car.x+=Math.cos(car.heading)*car.speed*dt;car.z+=Math.sin(car.heading)*car.speed*dt;
  const near=nearestIndexFor(car),progress=progressDelta(before,near.index),onRoad=near.distance<HALF_WIDTH;
  car.lastTrackIndex=before;car.episodeNetProgress+=progress;car.episodePeakProgress=Math.max(car.episodePeakProgress,car.episodeNetProgress);sim.batchDriverSeconds+=dt;if(!onRoad)sim.batchOffRoadSeconds+=dt;
  if(progress>=0){const r=progress*.075;car.pendingReward+=r;car.episodeProgress+=progress;car.totalProgress+=progress;if(onRoad)sim.batchForwardMeters+=progress}else car.pendingReward+=progress*.16;
  if(!onRoad){car.offTime+=dt;car.pendingReward-=.16*dt}else car.offTime=Math.max(0,car.offTime-dt*1.5);
  if(car.speed<.8)car.stuckTime+=dt;else car.stuckTime=Math.max(0,car.stuckTime-dt*2);
  if(before>TRACK_N*.82&&near.index<TRACK_N*.18&&progress>0){car.lap++;if(sim.mode==='learn'){sim.batchLaps++;car.pendingReward+=15;log(`Driver ${car.id+1} completed lap ${car.lap}.`)}else if(car.lap>=sim.raceLaps)markRaceFinished(car)}
  if(car.offTime>3||car.stuckTime>4.5||car.damage>=100){car.pendingReward-=5;car.pendingDone=true}
  syncCarMesh(car);
}
function collideCars(){
  for(let i=0;i<DRIVER_COUNT;i++)for(let j=i+1;j<DRIVER_COUNT;j++){
    const a=drivers[i],b=drivers[j];if(sim.mode==='race'&&(a.raceStatus!=='racing'||b.raceStatus!=='racing'))continue;const ay=surfaceHeightForCar(a),by=surfaceHeightForCar(b);if(Math.abs(ay-by)>1.8)continue;
    const dx=b.x-a.x,dz=b.z-a.z,d2=dx*dx+dz*dz;
    if(d2<2.7&&a.collisionCooldown<=0&&b.collisionCooldown<=0){
      const d=Math.max(.15,Math.sqrt(d2)),nx=dx/d,nz=dz/d,severity=clamp(1+Math.abs(a.speed-b.speed)*.35+(a.speed+b.speed)*.10,1,9);
      a.damage=clamp(a.damage+severity*1.3,0,100);b.damage=clamp(b.damage+severity*1.3,0,100);
      if(sim.mode==='learn'){a.pendingReward-=severity*.75;b.pendingReward-=severity*.75}
      a.speed*=.72;b.speed*=.72;a.collisions++;b.collisions++;sim.collisions++;a.x-=nx*.45;a.z-=nz*.45;b.x+=nx*.45;b.z+=nz*.45;a.collisionCooldown=b.collisionCooldown=.45;
    }
  }
}
function raceProgressScore(car){return car.lap*trackLength+mod(car.trackIndex-finishIndex,TRACK_N)/TRACK_N*trackLength}
function updatePositionTelemetry(){const order=[...drivers].sort((a,b)=>raceProgressScore(b)-raceProgressScore(a));order.forEach((car,index)=>{const rank=index+1;if(car.lastRank!=null&&rank<car.lastRank&&car.offTime<.25&&car.speed>2)car.overtakes+=car.lastRank-rank;car.lastRank=rank})}
function physicsStep(dt){sim.simClock+=dt;if(sim.mode==='race')sim.raceTime+=dt;drivers.forEach(c=>{if(sim.mode!=='race'||c.raceStatus==='racing')simulateCar(c,dt)});collideCars()}
