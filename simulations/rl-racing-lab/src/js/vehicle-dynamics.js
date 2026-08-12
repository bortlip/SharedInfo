// Pure sim-cade vehicle dynamics and vehicle-local observation contract. No Three.js/browser state required.
const VEHICLE_DYNAMICS_VERSION=3,VEHICLE_OBSERVATION_VERSION=6;
const VEHICLE_SENSE_KEYS=['speed','forwardSpeed','lateralSpeed','yawRate','slipAngle','steerCommand','throttleCommand','damage','rpm','gear','steerAngle'];
const VEHICLE_SENSE_INDEX=Object.fromEntries(VEHICLE_SENSE_KEYS.map((key,index)=>[key,index])),VEHICLE_SENSE_COUNT=VEHICLE_SENSE_KEYS.length;
const VEHICLE_GRAVITY=9.81,VEHICLE_WHEELBASE=2.55,VEHICLE_WHEEL_RADIUS=.32,VEHICLE_FINAL_DRIVE=4.1,VEHICLE_IDLE_RPM=1050,VEHICLE_REDLINE_RPM=7200,VEHICLE_MAX_SPEED=40,VEHICLE_MAX_STEER=.58,VEHICLE_STEER_GRIP_FRACTION=.95,VEHICLE_ROAD_MU=1.08;
const VEHICLE_GEAR_RATIOS=[3.15,2.20,1.65,1.30,1.05];
const vehicleClamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function vehicleSurfaceProfile(surface){if(surface==='grass')return{mu:.38,cornering:2.45,yawResponse:2.8,rolling:1.25};if(surface==='shoulder')return{mu:.72,cornering:4.35,yawResponse:4.4,rolling:.52};return{mu:VEHICLE_ROAD_MU,cornering:6.4,yawResponse:6.2,rolling:.16}}
function vehicleLocalVelocity(state){const c=Math.cos(state.heading||0),s=Math.sin(state.heading||0),vx=Number(state.vx)||0,vz=Number(state.vz)||0;return{forward:vx*c+vz*s,lateral:-vx*s+vz*c}}
function vehicleSlipAngleFromLocal(forward,lateral){return Math.atan2(lateral,Math.max(2,Math.abs(forward)))}
function vehicleMaxSteerAngle(speed){const v=Math.max(1,Math.abs(Number(speed)||0)),roadGrip=VEHICLE_ROAD_MU*VEHICLE_GRAVITY,gripLimited=Math.atan(VEHICLE_WHEELBASE*roadGrip*VEHICLE_STEER_GRIP_FRACTION/(v*v));return Math.min(VEHICLE_MAX_STEER,gripLimited)}
function vehicleRpmForGear(forwardSpeed,gear){const ratio=VEHICLE_GEAR_RATIOS[vehicleClamp(Math.trunc(gear||1),1,VEHICLE_GEAR_RATIOS.length)-1],wheelRpm=Math.abs(forwardSpeed)/(2*Math.PI*VEHICLE_WHEEL_RADIUS)*60;return vehicleClamp(wheelRpm*ratio*VEHICLE_FINAL_DRIVE,VEHICLE_IDLE_RPM,VEHICLE_REDLINE_RPM)}
function vehicleTorqueFactor(rpm){const normalized=(vehicleClamp(rpm,VEHICLE_IDLE_RPM,VEHICLE_REDLINE_RPM)-4300)/3300;return vehicleClamp(.62+.38*(1-normalized*normalized),.46,1)}
function vehicleUpdateDerived(state){const local=vehicleLocalVelocity(state);state.forwardSpeed=local.forward;state.lateralSpeed=local.lateral;state.speed=Math.hypot(Number(state.vx)||0,Number(state.vz)||0);state.slipAngle=vehicleSlipAngleFromLocal(local.forward,local.lateral);state.gear=vehicleClamp(Math.trunc(state.gear||1),1,VEHICLE_GEAR_RATIOS.length);state.rpm=vehicleRpmForGear(local.forward,state.gear);return state}
function vehicleUpdateTransmission(state,forwardSpeed,throttle,dt){state.gear=vehicleClamp(Math.trunc(state.gear||1),1,VEHICLE_GEAR_RATIOS.length);state.shiftTimer=Math.max(0,(Number(state.shiftTimer)||0)-dt);let rpm=vehicleRpmForGear(forwardSpeed,state.gear);if(state.shiftTimer<=0){let next=state.gear;if(rpm>6500&&state.gear<VEHICLE_GEAR_RATIOS.length)next++;else if(state.gear>1&&(rpm<2200||(throttle>0&&rpm<2900)))next--;if(next!==state.gear){state.gear=next;state.shiftTimer=.16;rpm=vehicleRpmForGear(forwardSpeed,state.gear)}}state.rpm=rpm;return rpm}
function vehicleResetMotion(state,speed=0){const v=Math.max(0,Number(speed)||0),heading=Number(state.heading)||0;state.vx=Math.cos(heading)*v;state.vz=Math.sin(heading)*v;state.yawRate=0;state.steerAngle=0;state.shiftTimer=0;state.gear=1;state.lateralAccel=0;state.longitudinalAccel=0;state.tireScrub=0;state.gripUse=0;return vehicleUpdateDerived(state)}
function vehicleStopMotion(state){state.vx=0;state.vz=0;state.yawRate=0;state.steerAngle=0;state.shiftTimer=0;state.lateralAccel=0;state.longitudinalAccel=0;state.tireScrub=0;state.gripUse=0;return vehicleUpdateDerived(state)}
function vehicleObservationValues(state){vehicleUpdateDerived(state);return[
  vehicleClamp(state.speed/VEHICLE_MAX_SPEED,0,1)*2-1,
  vehicleClamp(state.forwardSpeed/VEHICLE_MAX_SPEED,-1,1),
  vehicleClamp(state.lateralSpeed/12,-1,1),
  vehicleClamp((Number(state.yawRate)||0)/1.6,-1,1),
  vehicleClamp((Number(state.slipAngle)||0)/(Math.PI/3),-1,1),
  vehicleClamp(Number(state.actionSteer)||0,-1,1),
  vehicleClamp(Number(state.actionThrottle)||0,-1,1),
  vehicleClamp((Number(state.damage)||0)/100,0,1)*2-1,
  vehicleClamp(((Number(state.rpm)||VEHICLE_IDLE_RPM)-VEHICLE_IDLE_RPM)/(VEHICLE_REDLINE_RPM-VEHICLE_IDLE_RPM),0,1)*2-1,
  (vehicleClamp(Math.trunc(state.gear||1),1,VEHICLE_GEAR_RATIOS.length)-1)/(VEHICLE_GEAR_RATIOS.length-1)*2-1,
  vehicleClamp((Number(state.steerAngle)||0)/.58,-1,1)
]}
function stepVehicleDynamics(state,controls,surface,dt){
  dt=vehicleClamp(Number(dt)||0,0,.05);if(dt<=0)return vehicleUpdateDerived(state);
  const profile=vehicleSurfaceProfile(surface),throttle=vehicleClamp(Number(controls?.throttle)||0,-1,1),steer=vehicleClamp(Number(controls?.steer)||0,-1,1),damage=vehicleClamp((Number(state.damage)||0)/100,0,1);
  let local=vehicleLocalVelocity(state),forward=local.forward,speed=Math.hypot(Number(state.vx)||0,Number(state.vz)||0);
  const maxSteer=vehicleMaxSteerAngle(speed),targetSteer=-steer*maxSteer,steerStep=3.25*dt;state.steerAngle=(Number(state.steerAngle)||0)+vehicleClamp(targetSteer-(Number(state.steerAngle)||0),-steerStep,steerStep);
  const rpm=vehicleUpdateTransmission(state,forward,throttle,dt),grip=profile.mu*VEHICLE_GRAVITY,maxYaw=grip/Math.max(4,Math.abs(forward)),balance=throttle<0?1.07:throttle>0?.93:1,kinematicYaw=forward/VEHICLE_WHEELBASE*Math.tan(state.steerAngle),targetYaw=vehicleClamp(kinematicYaw,-maxYaw*balance,maxYaw*balance),yawBlend=vehicleClamp(profile.yawResponse*dt,0,1);
  state.yawRate=(Number(state.yawRate)||0)+(targetYaw-(Number(state.yawRate)||0))*yawBlend;if(speed<1)state.yawRate*=Math.max(0,1-dt*4);state.heading=(Number(state.heading)||0)+state.yawRate*dt;
  local=vehicleLocalVelocity(state);forward=local.forward;const lateral=local.lateral,lateralRequest=-lateral*profile.cornering,lateralAccel=vehicleClamp(lateralRequest,-grip*.98,grip*.98),ratio=VEHICLE_GEAR_RATIOS[state.gear-1],gearFactor=Math.pow(ratio/VEHICLE_GEAR_RATIOS[0],.62),engineFactor=vehicleTorqueFactor(rpm),damagePower=1-damage*.58,drag=profile.rolling+.0017*forward*Math.abs(forward),engineBrake=1.45*(rpm/VEHICLE_REDLINE_RPM)*(.45+.55*gearFactor)*(state.shiftTimer>0?.2:1);let longitudinalRequest;
  if(throttle>0){longitudinalRequest=10.2*gearFactor*engineFactor*damagePower*(state.shiftTimer>0?.25:1)-Math.sign(forward||1)*drag}else if(throttle<0){longitudinalRequest=Math.abs(forward)>.08?-Math.sign(forward)*14.5:0}else longitudinalRequest=Math.abs(forward)>.03?-Math.sign(forward)*(drag+engineBrake):0;
  const longitudinalGrip=Math.sqrt(Math.max(0,grip*grip-lateralAccel*lateralAccel)),longitudinalAccel=vehicleClamp(longitudinalRequest,-longitudinalGrip,longitudinalGrip),c=Math.cos(state.heading),s=Math.sin(state.heading),rx=-s,rz=c;
  state.vx=(Number(state.vx)||0)+(c*longitudinalAccel+rx*lateralAccel)*dt;state.vz=(Number(state.vz)||0)+(s*longitudinalAccel+rz*lateralAccel)*dt;
  const maxSpeed=VEHICLE_MAX_SPEED*(1-damage*.42),worldSpeed=Math.hypot(state.vx,state.vz);if(worldSpeed>maxSpeed){const scale=maxSpeed/worldSpeed;state.vx*=scale;state.vz*=scale}if(Math.hypot(state.vx,state.vz)<.05&&throttle<=0){state.vx=0;state.vz=0}
  state.x=(Number(state.x)||0)+state.vx*dt;state.z=(Number(state.z)||0)+state.vz*dt;state.lateralAccel=lateralAccel;state.longitudinalAccel=longitudinalAccel;state.gripUse=vehicleClamp(Math.hypot(lateralAccel,longitudinalAccel)/Math.max(.001,grip),0,1);vehicleUpdateDerived(state);const slipOnset=.045,slipStrength=vehicleClamp((Math.abs(state.slipAngle)-slipOnset)/.16,0,1),gripStress=vehicleClamp((state.gripUse-.72)/.28,0,1),moving=vehicleClamp((state.speed-3)/17,0,1);state.tireScrub=slipStrength*(.72+.28*gripStress)*moving;return state;
}
