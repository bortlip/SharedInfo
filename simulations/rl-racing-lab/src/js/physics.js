// Reward integration, terminal/lap rules, and collision handling over the sim-cade vehicle dynamics.
function markCarTerminal(car){
  if(car.pendingDone)return false;
  car.pendingDone=true;car.actionSteer=0;car.actionThrottle=0;vehicleStopMotion(car);
  if(sim.mode==='learn'){car.pendingReward-=TERMINAL_FAILURE_PENALTY;sim.batchTerminalPenalty-=TERMINAL_FAILURE_PENALTY}
  return true;
}
function recordForwardSurfaceMeters(surface,progress){
  if(progress<=0)return;
  sim.batchForwardMeters+=progress;
  if(surface==='road')sim.batchRoadForwardMeters+=progress;
  else if(surface==='shoulder')sim.batchShoulderForwardMeters+=progress;
  else sim.batchGrassForwardMeters+=progress;
}
function recordCompletedLap(car){const now=sim.simClock,start=Number(car.lapStartedAt),lapTime=Math.max(0,now-(Number.isFinite(start)?start:now));car.lapStartedAt=now;car.lastLapTime=lapTime;if(sim.mode==='learn'){sim.batchLapTimeTotal+=lapTime;sim.batchLapTimeCount++;sim.batchBestLapTime=sim.batchBestLapTime>0?Math.min(sim.batchBestLapTime,lapTime):lapTime}return lapTime}
function simulateCar(car,dt){
  if(car.pendingDone)return;
  car.collisionCooldown=Math.max(0,car.collisionCooldown-dt);
  const nearBefore=nearestTrackPositionFor(car),before=nearBefore.index,beforeArc=nearBefore.arc,surfaceBefore=surfaceZone(nearBefore.distance);
  stepVehicleDynamics(car,{steer:car.actionSteer,throttle:car.actionThrottle},surfaceBefore,dt);
  const near=nearestTrackPositionFor(car),progress=progressArcDelta(beforeArc,near.arc),surface=surfaceZone(near.distance),onRoad=surface==='road';car.trackArc=near.arc;
  car.surface=surface;car.directionAlignment=headingAlignment(car,near.index);car.lastTrackIndex=before;car.episodeNetProgress+=progress;car.episodePeakProgress=Math.max(car.episodePeakProgress,car.episodeNetProgress);sim.batchDriverSeconds+=dt;if(!onRoad)sim.batchOffRoadSeconds+=dt;

  const progressTerm=progress>=0?forwardProgressReward(progress,surface):backwardProgressPenalty(progress),surfaceTerm=surfaceTimePenalty(surface,dt);
  car.pendingReward+=progressTerm+surfaceTerm;sim.batchProgressReward+=progressTerm;sim.batchSurfacePenalty+=surfaceTerm;
  if(progress>=0){car.episodeProgress+=progress;car.totalProgress+=progress;recordForwardSurfaceMeters(surface,progress)}else sim.batchBackwardMeters+=-progress;

  if(surface==='grass')car.offTime+=dt;else if(surface==='shoulder')car.offTime+=dt*.55;else car.offTime=Math.max(0,car.offTime-dt*1.5);
  const tangent=tangents[near.index],usefulSpeed=tangent?car.vx*tangent.x+car.vz*tangent.z:0;if(usefulSpeed>.75)car.stuckTime=Math.max(0,car.stuckTime-dt*2);else{car.stuckTime+=dt;sim.batchNoProgressSeconds+=dt}

  while(car.episodeNetProgress+1e-6>=car.nextLapProgress){const lapTime=recordCompletedLap(car);car.lap++;car.nextLapProgress+=trackLength;if(sim.mode==='learn'){sim.batchLaps++;log(`Driver ${car.id+1} completed lap ${car.lap} in ${lapTime.toFixed(1)} s.`)}else if(car.lap>=sim.raceLaps){markRaceFinished(car);break}}
  if(car.raceStatus==='racing'&&(car.offTime>3||car.stuckTime>4.5||car.damage>=100))markCarTerminal(car);
  syncCarMesh(car);
}
function carFootprintOverlap(a,b){
  const halfL=1.62,halfW=.88,af={x:Math.cos(a.heading),z:Math.sin(a.heading)},ar={x:-af.z,z:af.x},bf={x:Math.cos(b.heading),z:Math.sin(b.heading)},br={x:-bf.z,z:bf.x},dx=b.x-a.x,dz=b.z-a.z,axes=[af,ar,bf,br];let minOverlap=Infinity,best=null;
  for(const axis of axes){const center=dx*axis.x+dz*axis.z,ra=halfL*Math.abs(af.x*axis.x+af.z*axis.z)+halfW*Math.abs(ar.x*axis.x+ar.z*axis.z),rb=halfL*Math.abs(bf.x*axis.x+bf.z*axis.z)+halfW*Math.abs(br.x*axis.x+br.z*axis.z),overlap=ra+rb-Math.abs(center);if(overlap<=0)return null;if(overlap<minOverlap){minOverlap=overlap;const sign=center>=0?1:-1;best={nx:axis.x*sign,nz:axis.z*sign,overlap}}}return best;
}
function collideCars(){
  if(sim.mode==='learn'&&!sim.trainingCarCollisions)return;
  const cars=activeDrivers();for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++){
    const a=cars[i],b=cars[j];if(a.pendingDone||b.pendingDone)continue;if(sim.mode==='race'&&(a.raceStatus!=='racing'||b.raceStatus!=='racing'))continue;
    const ay=surfaceHeightForCar(a),by=surfaceHeightForCar(b);if(Math.abs(ay-by)>1.8)continue;const hit=carFootprintOverlap(a,b);if(!hit)continue;
    const separate=hit.overlap*.52+.025;a.x-=hit.nx*separate;a.z-=hit.nz*separate;b.x+=hit.nx*separate;b.z+=hit.nz*separate;if(a.collisionCooldown>0||b.collisionCooldown>0)continue;
    const relativeX=a.vx-b.vx,relativeZ=a.vz-b.vz,closing=Math.max(0,relativeX*hit.nx+relativeZ*hit.nz),severity=clamp(.8+closing*.5+Math.abs(a.speed-b.speed)*.12,1,10),impulse=closing*.66;
    a.vx=(a.vx-hit.nx*impulse)*.88;a.vz=(a.vz-hit.nz*impulse)*.88;b.vx=(b.vx+hit.nx*impulse)*.88;b.vz=(b.vz+hit.nz*impulse)*.88;a.yawRate*=.72;b.yawRate*=.72;vehicleUpdateDerived(a);vehicleUpdateDerived(b);a.damage=clamp(a.damage+severity*2.15,0,100);b.damage=clamp(b.damage+severity*2.15,0,100);
    if(sim.mode==='learn'){const penalty=severity*.9;a.pendingReward-=penalty;b.pendingReward-=penalty;sim.batchCollisionPenalty-=penalty*2}
    a.collisions++;b.collisions++;sim.collisions++;a.collisionCooldown=b.collisionCooldown=.36;if(a.damage>=100)markCarTerminal(a);if(b.damage>=100)markCarTerminal(b);
    const impactY=(ay+by)*.5+.28;if(typeof spawnImpactEffects==='function')spawnImpactEffects((a.x+b.x)*.5,(a.z+b.z)*.5,impactY,severity,'car');if(typeof playCollisionSound==='function')playCollisionSound(severity);
  }
}
function treeFootprintOverlap(car,tree){
  const halfL=1.62,halfW=.88,fx=Math.cos(car.heading),fz=Math.sin(car.heading),rx=-fz,rz=fx,dx=tree.x-car.x,dz=tree.z-car.z,localF=dx*fx+dz*fz,localR=dx*rx+dz*rz,nearF=clamp(localF,-halfL,halfL),nearR=clamp(localR,-halfW,halfW),cx=car.x+fx*nearF+rx*nearR,cz=car.z+fz*nearF+rz*nearR,vx=tree.x-cx,vz=tree.z-cz,dist=Math.hypot(vx,vz);if(dist>=tree.radius)return null;if(dist>1e-6)return{nx:vx/dist,nz:vz/dist,overlap:tree.radius-dist};const frontGap=halfL-Math.abs(localF),sideGap=halfW-Math.abs(localR);if(frontGap<sideGap){const sign=localF>=0?1:-1;return{nx:fx*sign,nz:fz*sign,overlap:tree.radius+frontGap}}const sign=localR>=0?1:-1;return{nx:rx*sign,nz:rz*sign,overlap:tree.radius+sideGap};
}
function collideTrees(){
  for(const car of activeDrivers()){if(car.pendingDone)continue;if(sim.mode==='race'&&car.raceStatus!=='racing')continue;const carY=surfaceHeightForCar(car);for(const tree of treeColliders){if(Math.abs(carY-tree.y)>1.0)continue;const hit=treeFootprintOverlap(car,tree);if(!hit)continue;car.x-=hit.nx*(hit.overlap+.025);car.z-=hit.nz*(hit.overlap+.025);syncCarMesh(car);if(car.collisionCooldown>0)continue;const closing=Math.max(0,car.vx*hit.nx+car.vz*hit.nz),severity=clamp(1.5+closing*.62,1.5,12);car.vx=(car.vx-hit.nx*closing*1.18)*.48;car.vz=(car.vz-hit.nz*closing*1.18)*.48;car.yawRate*=.42;vehicleUpdateDerived(car);car.damage=clamp(car.damage+severity*2.8,0,100);if(sim.mode==='learn'){const penalty=severity*1.15;car.pendingReward-=penalty;sim.batchCollisionPenalty-=penalty}car.collisions++;sim.collisions++;car.collisionCooldown=.48;if(car.damage>=100)markCarTerminal(car);const contactX=tree.x-hit.nx*tree.radius,contactZ=tree.z-hit.nz*tree.radius;if(typeof spawnImpactEffects==='function')spawnImpactEffects(contactX,contactZ,tree.y+.25,severity,'tree');if(typeof playCollisionSound==='function')playCollisionSound(severity*1.15)}}
}
function raceProgressScore(car){return(Number(car.raceStartOffset)||0)+(Number(car.episodeNetProgress)||0)}
function updatePositionTelemetry(){if(sim.mode==='learn'&&sim.trainingStaggered)return;const order=[...activeDrivers()].sort((a,b)=>raceProgressScore(b)-raceProgressScore(a));order.forEach((car,index)=>{const rank=index+1;if(car.lastRank!=null&&rank<car.lastRank&&car.offTime<.25&&car.speed>2)car.overtakes+=car.lastRank-rank;car.lastRank=rank})}
function physicsStep(dt){sim.simClock+=dt;if(sim.mode==='race')sim.raceTime+=dt;activeDrivers().forEach(c=>{if(sim.mode!=='race'||c.raceStatus==='racing')simulateCar(c,dt)});collideCars();collideTrees();if(typeof updateImpactEffects==='function')updateImpactEffects(dt)}
