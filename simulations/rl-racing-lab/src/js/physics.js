// Proven arcade dynamics with layered surface grip, signed progress reward, and stronger collision contact.
function simulateCar(car,dt){
  car.collisionCooldown=Math.max(0,car.collisionCooldown-dt);
  const before=car.trackIndex,nearBefore=nearestIndexFor(car),surfaceBefore=surfaceZone(nearBefore.distance),onRoadBefore=surfaceBefore==='road',maxSpeed=22*(1-clamp(car.damage/100,0,.55));
  const accelGrip=surfaceBefore==='road'?1:surfaceBefore==='shoulder'?.82:.58,brakeGrip=surfaceBefore==='road'?1:surfaceBefore==='shoulder'?.9:.7,steerGrip=surfaceBefore==='road'?1:surfaceBefore==='shoulder'?.8:.56;
  let accel=car.actionThrottle>0?10.5*accelGrip:car.actionThrottle<0?-15*brakeGrip:-1.3;accel-=car.speed*.045;car.speed=clamp(car.speed+accel*dt,0,maxSpeed);
  if(surfaceBefore==='shoulder')car.speed*=Math.pow(.993,dt*60);else if(surfaceBefore==='grass')car.speed*=Math.pow(.972,dt*60);
  car.gear=Math.min(5,1+Math.floor(car.speed/4.4));const steerRate=1.75*(.28+.72*(car.speed/22))*steerGrip;car.heading-=car.actionSteer*steerRate*dt;
  car.x+=Math.cos(car.heading)*car.speed*dt;car.z+=Math.sin(car.heading)*car.speed*dt;
  const near=nearestIndexFor(car),progress=progressDelta(before,near.index),surface=surfaceZone(near.distance),onRoad=surface==='road';car.surface=surface;car.directionAlignment=headingAlignment(car,near.index);
  car.lastTrackIndex=before;car.episodeNetProgress+=progress;car.episodePeakProgress=Math.max(car.episodePeakProgress,car.episodeNetProgress);sim.batchDriverSeconds+=dt;if(!onRoad)sim.batchOffRoadSeconds+=dt;
  if(progress>=0){const r=progress*.075;car.pendingReward+=r;car.episodeProgress+=progress;car.totalProgress+=progress;if(onRoad)sim.batchForwardMeters+=progress}else car.pendingReward+=progress*.16;
  if(surface==='grass'){car.offTime+=dt;car.pendingReward-=.18*dt}else if(surface==='shoulder'){car.offTime+=dt*.55;car.pendingReward-=.07*dt}else car.offTime=Math.max(0,car.offTime-dt*1.5);
  if(car.speed<.8)car.stuckTime+=dt;else car.stuckTime=Math.max(0,car.stuckTime-dt*2);
  if(before>TRACK_N*.82&&near.index<TRACK_N*.18&&progress>0){car.lap++;if(sim.mode==='learn'){sim.batchLaps++;car.pendingReward+=15;log(`Driver ${car.id+1} completed lap ${car.lap}.`)}else if(car.lap>=sim.raceLaps)markRaceFinished(car)}
  if(car.offTime>3||car.stuckTime>4.5||car.damage>=100){car.pendingReward-=5;car.pendingDone=true}
  syncCarMesh(car);
}
function carFootprintOverlap(a,b){
  const halfL=1.62,halfW=.88,af={x:Math.cos(a.heading),z:Math.sin(a.heading)},ar={x:-af.z,z:af.x},bf={x:Math.cos(b.heading),z:Math.sin(b.heading)},br={x:-bf.z,z:bf.x},dx=b.x-a.x,dz=b.z-a.z,axes=[af,ar,bf,br];let minOverlap=Infinity,best=null;
  for(const axis of axes){const center=dx*axis.x+dz*axis.z,ra=halfL*Math.abs(af.x*axis.x+af.z*axis.z)+halfW*Math.abs(ar.x*axis.x+ar.z*axis.z),rb=halfL*Math.abs(bf.x*axis.x+bf.z*axis.z)+halfW*Math.abs(br.x*axis.x+br.z*axis.z),overlap=ra+rb-Math.abs(center);if(overlap<=0)return null;if(overlap<minOverlap){minOverlap=overlap;const sign=center>=0?1:-1;best={nx:axis.x*sign,nz:axis.z*sign,overlap}}}
  return best;
}
function collideCars(){
  for(let i=0;i<DRIVER_COUNT;i++)for(let j=i+1;j<DRIVER_COUNT;j++){
    const a=drivers[i],b=drivers[j];if(sim.mode==='race'&&(a.raceStatus!=='racing'||b.raceStatus!=='racing'))continue;const ay=surfaceHeightForCar(a),by=surfaceHeightForCar(b);if(Math.abs(ay-by)>1.8)continue;const hit=carFootprintOverlap(a,b);if(!hit)continue;
    const separate=hit.overlap*.52+.025;a.x-=hit.nx*separate;a.z-=hit.nz*separate;b.x+=hit.nx*separate;b.z+=hit.nz*separate;if(a.collisionCooldown>0||b.collisionCooldown>0)continue;
    const vax=Math.cos(a.heading)*a.speed,vaz=Math.sin(a.heading)*a.speed,vbx=Math.cos(b.heading)*b.speed,vbz=Math.sin(b.heading)*b.speed,closing=Math.max(0,(vax-vbx)*hit.nx+(vaz-vbz)*hit.nz),severity=clamp(.8+closing*.5+Math.abs(a.speed-b.speed)*.12,1,10);
    a.damage=clamp(a.damage+severity*2.15,0,100);b.damage=clamp(b.damage+severity*2.15,0,100);if(sim.mode==='learn'){a.pendingReward-=severity*.9;b.pendingReward-=severity*.9}a.speed*=.60;b.speed*=.60;a.collisions++;b.collisions++;sim.collisions++;a.collisionCooldown=b.collisionCooldown=.36;if(typeof playCollisionSound==='function')playCollisionSound(severity);
  }
}
function raceProgressScore(car){return car.lap*trackLength+mod(car.trackIndex-finishIndex,TRACK_N)/TRACK_N*trackLength}
function updatePositionTelemetry(){const order=[...drivers].sort((a,b)=>raceProgressScore(b)-raceProgressScore(a));order.forEach((car,index)=>{const rank=index+1;if(car.lastRank!=null&&rank<car.lastRank&&car.offTime<.25&&car.speed>2)car.overtakes+=car.lastRank-rank;car.lastRank=rank})}
function physicsStep(dt){sim.simClock+=dt;if(sim.mode==='race')sim.raceTime+=dt;drivers.forEach(c=>{if(sim.mode!=='race'||c.raceStatus==='racing')simulateCar(c,dt)});collideCars()}
