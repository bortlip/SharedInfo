// Vehicle dynamics, collision responsibility, rewards, and physics stepping.
function simulateCar(car,dt){
  car.collisionCooldown=Math.max(0,car.collisionCooldown-dt);
  const before=car.trackIndex,nearBefore=nearestIndexFor(car),onRoadBefore=nearBefore.distance<HALF_WIDTH;
  const roadGrip=onRoadBefore?1:.34;
  const damageFactor=1-clamp(car.damage/100,0,.58);
  const baseMaxSpeed=26, maxSpeed=baseMaxSpeed*damageFactor;
  const fx=Math.cos(car.heading),fz=Math.sin(car.heading),rx=-fz,rz=fx;
  let forwardSpeed=car.vx*fx+car.vz*fz,lateralSpeed=car.vx*rx+car.vz*rz;
  const gear=Math.min(5,1+Math.floor(Math.max(0,forwardSpeed)/5.1));car.gear=gear;
  const gearFactor=[0,1.34,1.18,1.03,.89,.76][gear];
  let longitudinal=car.actionThrottle>0?12.5*gearFactor:car.actionThrottle<0?-18:-.8;
  if(!onRoadBefore)longitudinal-=2.2;
  if(forwardSpeed<.15&&longitudinal<0)longitudinal=0;
  car.vx+=fx*longitudinal*dt;car.vz+=fz*longitudinal*dt;

  const maxLatAccel=(onRoadBefore?9.2:2.6)*damageFactor;
  const lateralAccel=clamp(-lateralSpeed*(onRoadBefore?5.3:1.8),-maxLatAccel,maxLatAccel);
  car.vx+=rx*lateralAccel*dt;car.vz+=rz*lateralAccel*dt;

  const steerAngle=car.actionSteer*.50,turnSpeed=Math.max(0,forwardSpeed);
  const yawRate=clamp((turnSpeed/2.75)*Math.tan(steerAngle)*roadGrip,-2.35,2.35);
  car.heading-=yawRate*dt;

  const drag=(onRoadBefore?.11:.72)+car.speed*.004;
  const dragFactor=Math.max(0,1-drag*dt);car.vx*=dragFactor;car.vz*=dragFactor;
  car.speed=Math.hypot(car.vx,car.vz);
  if(car.speed>maxSpeed){const scale=maxSpeed/car.speed;car.vx*=scale;car.vz*=scale;car.speed=maxSpeed}

  const nfx=Math.cos(car.heading),nfz=Math.sin(car.heading),nrx=-nfz,nrz=nfx;
  const newForward=car.vx*nfx+car.vz*nfz,newLat=car.vx*nrx+car.vz*nrz;
  car.slip=Math.atan2(Math.abs(newLat),Math.abs(newForward)+.2)*180/Math.PI;

  car.x+=car.vx*dt;car.z+=car.vz*dt;
  const near=nearestIndexFor(car),progress=progressDelta(before,near.index),onRoad=near.distance<HALF_WIDTH;
  car.lastTrackIndex=before;
  if(progress>=0){const reward=progress*.075;car.pendingReward+=reward;car.episodeProgress+=progress;car.totalProgress+=progress}
  else car.pendingReward+=progress*.16;
  if(!onRoad){car.offTime+=dt;car.pendingReward-=.18*dt}else car.offTime=Math.max(0,car.offTime-dt*1.5);
  if(car.speed<.8)car.stuckTime+=dt;else car.stuckTime=Math.max(0,car.stuckTime-dt*2);
  if(before>TRACK_N*.82&&near.index<TRACK_N*.18&&progress>0){
    car.lap++;
    if(sim.mode==='learn'){car.pendingReward+=16;log(`Driver ${car.id+1} completed lap ${car.lap} on ${TRACK_DEFS[activeTrackId].name}.`)}
    else if(car.lap>=sim.raceLaps)markRaceFinished(car);
  }
  if(car.offTime>3.2||car.stuckTime>5||car.damage>=100){car.pendingReward-=5;car.pendingDone=true}
  syncCarMesh(car);
}
function collideCars(){
  for(let i=0;i<DRIVER_COUNT;i++)for(let j=i+1;j<DRIVER_COUNT;j++){
    const a=drivers[i],b=drivers[j];
    if(sim.mode==='race'&&(a.raceStatus!=='racing'||b.raceStatus!=='racing'))continue;
    const ay=track[a.trackIndex]?.y||0,by=track[b.trackIndex]?.y||0;if(Math.abs(ay-by)>1.8)continue;
    const dx=b.x-a.x,dz=b.z-a.z,d2=dx*dx+dz*dz;
    if(d2<2.7&&a.collisionCooldown<=0&&b.collisionCooldown<=0){
      const d=Math.max(.15,Math.sqrt(d2)),nx=dx/d,nz=dz/d;
      const relx=a.vx-b.vx,relz=a.vz-b.vz,closing=Math.max(0,relx*nx+relz*nz);
      const severity=clamp(1+closing*.55+(a.speed+b.speed)*.055,1,10);
      const aInto=Math.max(0,a.vx*nx+a.vz*nz),bInto=Math.max(0,-(b.vx*nx+b.vz*nz)),intoTotal=aInto+bInto;
      const aBlame=intoTotal>.25?aInto/intoTotal:.5,bBlame=1-aBlame;
      a.damage=clamp(a.damage+severity*1.25,0,100);b.damage=clamp(b.damage+severity*1.25,0,100);
      if(sim.mode==='learn'){a.pendingReward-=severity*.95*aBlame;b.pendingReward-=severity*.95*bBlame}
      a.vx*=.70;a.vz*=.70;b.vx*=.70;b.vz*=.70;a.speed=Math.hypot(a.vx,a.vz);b.speed=Math.hypot(b.vx,b.vz);
      a.collisions++;b.collisions++;sim.collisions++;a.x-=nx*.48;a.z-=nz*.48;b.x+=nx*.48;b.z+=nz*.48;a.collisionCooldown=b.collisionCooldown=.48;
    }
  }
}
function raceProgressScore(car){return car.lap*trackLength+mod(car.trackIndex-finishIndex,TRACK_N)/TRACK_N*trackLength}
function applyPositionRewards(){
  const order=[...drivers].sort((a,b)=>raceProgressScore(b)-raceProgressScore(a));
  order.forEach((car,index)=>{
    const rank=index+1;
    if(car.lastRank!=null&&rank<car.lastRank&&car.offTime<.25&&car.speed>2){
      const gained=car.lastRank-rank;car.pendingReward+=.32*gained;car.overtakes+=gained;
    }else if(car.lastRank!=null&&rank>car.lastRank)car.pendingReward-=.07*(rank-car.lastRank);
    car.lastRank=rank;
  });
}

function physicsStep(dt){sim.simClock+=dt;if(sim.mode==='race')sim.raceTime+=dt;drivers.forEach(c=>{if(sim.mode!=='race'||c.raceStatus==='racing')simulateCar(c,dt)});collideCars()}

