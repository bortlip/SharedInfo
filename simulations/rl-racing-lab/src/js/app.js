const bootError=document.getElementById('bootError'),lab=document.getElementById('lab');
let THREE;
try{THREE=await import('https://cdn.jsdelivr.net/npm/three@0.170.0/+esm')}
catch(error){bootError.style.display='block';bootError.innerHTML='<strong>Three.js could not be loaded.</strong><p>This lab needs network access to load Three.js from jsDelivr. Reload while online.</p>';lab.style.display='none';throw error}

const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mod=(n,m)=>((n%m)+m)%m;
const randn=()=>{let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
const OBS_W=32,OBS_H=20,OBS_SCALE=2,RENDER_W=OBS_W*OBS_SCALE,RENDER_H=OBS_H*OBS_SCALE,PIXELS=OBS_W*OBS_H,INPUTS=PIXELS+2,HIDDEN=48,ACTIONS=15,DRIVER_COUNT=4,BATCH_TARGET=512;
const DECISION_DT=.10,GAMMA=.985,GAE_LAMBDA=.92,PPO_CLIP=.18,STEERS=[-1,-.5,0,.5,1],LONGITUDINAL=[-1,0,1];
const actionTable=[];for(const throttle of LONGITUDINAL)for(const steer of STEERS)actionTable.push({steer,throttle});
const sim={running:false,learning:false,mode:'learn',fastMode:false,speed:1,update:0,experience:0,totalExperience:0,selected:0,cameraMode:'chase',batchReward:0,collisions:0,lastLoss:0,physicsAcc:0,decisionAcc:0,lastTime:performance.now(),temperature:1.35,raceLaps:3,raceTime:0,racePlaces:0,raceFinished:false,trackMode:'mixed',trackRotationEvery:4,simClock:0,measureReal:performance.now(),measureSim:0,achievedSpeed:0};

const scene=new THREE.Scene();scene.background=new THREE.Color(0x9ec3d1);scene.fog=new THREE.Fog(0x9ec3d1,45,115);
const container=$('scene'),renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;container.appendChild(renderer.domElement);
const mainCamera=new THREE.PerspectiveCamera(58,1,.1,180),observerCameras=[],renderTargets=[];
for(let i=0;i<DRIVER_COUNT;i++){observerCameras.push(new THREE.PerspectiveCamera(66,OBS_W/OBS_H,.08,90));const rt=new THREE.WebGLRenderTarget(RENDER_W,RENDER_H,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true});rt.texture.colorSpace=THREE.SRGBColorSpace;renderTargets.push(rt)}
const pixelBuffer=new Uint8Array(RENDER_W*RENDER_H*4),povCtx=$('pov').getContext('2d'),povImage=povCtx.createImageData(OBS_W,OBS_H);

scene.add(new THREE.HemisphereLight(0xdff5ff,0x56603f,2));
const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(25,45,18);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-70;sun.shadow.camera.right=70;sun.shadow.camera.top=70;sun.shadow.camera.bottom=-70;scene.add(sun);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshStandardMaterial({color:0x466f42,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.035;ground.receiveShadow=true;scene.add(ground);

const HALF_WIDTH=5.4;
const TRACK_DEFS={
  mixed:{name:'Balanced Loop',n:320,make:(a)=>new THREE.Vector3(Math.cos(a)*(35+4.2*Math.sin(2*a)+2*Math.cos(3*a)),0,Math.sin(a)*(24+3.2*Math.cos(3*a)-1.5*Math.sin(2*a)))},
  reverse:{name:'Counterflow',n:320,reverse:true,make:(a)=>new THREE.Vector3(Math.cos(a)*(35+4.2*Math.sin(2*a)+2*Math.cos(3*a)),0,Math.sin(a)*(24+3.2*Math.cos(3*a)-1.5*Math.sin(2*a)))},
  technical:{name:'Technical Circuit',n:360,make:(a)=>new THREE.Vector3(Math.cos(a)*(30+6*Math.sin(3*a)+3*Math.cos(5*a)),.55+.45*Math.sin(3*a),Math.sin(a)*(21+5*Math.cos(4*a)+2*Math.sin(6*a)))},
  sweepers:{name:'Fast Sweepers',n:360,make:(a)=>new THREE.Vector3(Math.cos(a)*(44+5*Math.cos(2*a)),.4+.3*Math.sin(2*a),Math.sin(a)*(29+4*Math.sin(2*a)))},
  figure8:{name:'Figure Eight Overpass',n:420,make:(a)=>new THREE.Vector3(35*Math.sin(a),3.2+2.8*Math.cos(a),21*Math.sin(2*a))},
  grandprix:{name:'Grand Prix',n:520,make:(a)=>new THREE.Vector3(60*Math.cos(a)+12*Math.cos(2*a)+5*Math.sin(5*a),1.7+1.1*Math.sin(2*a)+.45*Math.cos(5*a),38*Math.sin(a)+8*Math.sin(3*a)+5*Math.cos(4*a))}
};
const TRAINING_TRACKS=['mixed','reverse','technical','sweepers','figure8','grandprix'];
let track=[],tangents=[],normals=[],segLen=[],trackLength=0,avgSeg=1,TRACK_N=0,finishIndex=2,activeTrackId='mixed',trackGroup=null;

function makeTrackPoints(id){
  const def=TRACK_DEFS[id]||TRACK_DEFS.mixed,pts=[];
  for(let i=0;i<def.n;i++)pts.push(def.make(i/def.n*Math.PI*2));
  if(def.reverse)pts.reverse();
  return pts;
}
function buildTrack(id){
  activeTrackId=id in TRACK_DEFS?id:'mixed';
  track=makeTrackPoints(activeTrackId);TRACK_N=track.length;tangents=[];normals=[];segLen=[];trackLength=0;
  for(let i=0;i<TRACK_N;i++){
    const prev=track[mod(i-1,TRACK_N)],next=track[mod(i+1,TRACK_N)],t=next.clone().sub(prev).normalize();
    tangents.push(t);const horiz=new THREE.Vector3(t.x,0,t.z).normalize();normals.push(new THREE.Vector3(-horiz.z,0,horiz.x));
    const len=track[i].distanceTo(track[mod(i+1,TRACK_N)]);segLen.push(len);trackLength+=len;
  }
  avgSeg=trackLength/TRACK_N;finishIndex=2;
  if(trackGroup){scene.remove(trackGroup);trackGroup.traverse(o=>{o.geometry?.dispose?.();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose?.());else o.material.dispose?.()}})}
  trackGroup=new THREE.Group();scene.add(trackGroup);
  const pos=[],idx=[];
  for(let i=0;i<TRACK_N;i++){
    const j=mod(i+1,TRACK_N),l0=track[i].clone().addScaledVector(normals[i],HALF_WIDTH),r0=track[i].clone().addScaledVector(normals[i],-HALF_WIDTH),l1=track[j].clone().addScaledVector(normals[j],HALF_WIDTH),r1=track[j].clone().addScaledVector(normals[j],-HALF_WIDTH),base=pos.length/3;
    for(const q of[l0,r0,l1,r1])pos.push(q.x,q.y+.02,q.z);idx.push(base,base+1,base+2,base+1,base+3,base+2);
  }
  const roadGeo=new THREE.BufferGeometry();roadGeo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));roadGeo.setIndex(idx);roadGeo.computeVertexNormals();
  const road=new THREE.Mesh(roadGeo,new THREE.MeshStandardMaterial({color:0x303840,roughness:.9,metalness:.05}));road.receiveShadow=true;trackGroup.add(road);
  function edgeLine(sign,color){const pts=track.map((q,i)=>q.clone().addScaledVector(normals[i],sign*HALF_WIDTH).add(new THREE.Vector3(0,.07,0)));pts.push(pts[0].clone());trackGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color,transparent:true,opacity:.92})))}
  edgeLine(1,0xf2f4ef);edgeLine(-1,0xf2f4ef);
  for(let i=0;i<TRACK_N;i+=12){const q=track[i],t=tangents[i],dash=new THREE.Mesh(new THREE.BoxGeometry(.16,.025,1.55),new THREE.MeshBasicMaterial({color:0xffd96c}));dash.position.set(q.x,q.y+.08,q.z);dash.rotation.y=-Math.atan2(t.z,t.x)+Math.PI/2;trackGroup.add(dash)}
  const treeEvery=activeTrackId==='grandprix'?28:22;
  for(let i=0;i<TRACK_N;i+=treeEvery)for(const side of[-1,1]){
    const q=track[i].clone().addScaledVector(normals[i],side*(HALF_WIDTH+3.2));if(Math.abs(q.y)>1.7)continue;
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.24,1.5,7),new THREE.MeshStandardMaterial({color:0x5a412f}));trunk.position.set(q.x,q.y+.75,q.z);trunk.castShadow=true;trackGroup.add(trunk);
    const crown=new THREE.Mesh(new THREE.ConeGeometry(1,2.4,8),new THREE.MeshStandardMaterial({color:0x2e6a3c}));crown.position.set(q.x,q.y+2.35,q.z);crown.castShadow=true;trackGroup.add(crown);
  }
  const q=track[finishIndex],t=tangents[finishIndex],line=new THREE.Mesh(new THREE.BoxGeometry(HALF_WIDTH*2,.035,.45),new THREE.MeshBasicMaterial({color:0xffffff}));
  line.position.set(q.x,q.y+.09,q.z);line.rotation.y=-Math.atan2(t.z,t.x)+Math.PI/2;trackGroup.add(line);
}
buildTrack('mixed');

const colors=[0x55dbea,0xff7d88,0xffd166,0xc8a5ff];
function createCarMesh(color){const g=new THREE.Group(),body=new THREE.Mesh(new THREE.BoxGeometry(1.55,.45,3),new THREE.MeshStandardMaterial({color,roughness:.55,metalness:.12}));body.position.y=.48;body.castShadow=true;g.add(body);const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.18,.42,1.35),new THREE.MeshStandardMaterial({color:0x202b34,roughness:.25}));cabin.position.set(0,.86,.12);cabin.castShadow=true;g.add(cabin);const nose=new THREE.Mesh(new THREE.BoxGeometry(1.25,.18,.55),new THREE.MeshStandardMaterial({color:0xf0f4f6}));nose.position.set(0,.58,-1.35);g.add(nose);for(const sx of[-.72,.72])for(const sz of[-.92,.92]){const wheel=new THREE.Mesh(new THREE.BoxGeometry(.18,.38,.62),new THREE.MeshStandardMaterial({color:0x101214}));wheel.position.set(sx,.28,sz);g.add(wheel)}return g}
function trackHeading(i){const t=tangents[mod(i,TRACK_N)];return Math.atan2(t.z,t.x)}
function nearestIndexFor(car){let best=car.trackIndex,bestD=Infinity;for(let off=-16;off<=16;off++){const i=mod(car.trackIndex+off,TRACK_N),q=track[i],dx=car.x-q.x,dz=car.z-q.z,d=dx*dx+dz*dz;if(d<bestD){bestD=d;best=i}}car.trackIndex=best;return{index:best,distance:Math.sqrt(bestD)}}
function progressDelta(oldI,newI){let d=newI-oldI;if(d>TRACK_N/2)d-=TRACK_N;if(d<-TRACK_N/2)d+=TRACK_N;return d*avgSeg}

const drivers=[];
for(let i=0;i<DRIVER_COUNT;i++){const mesh=createCarMesh(colors[i]);scene.add(mesh);drivers.push({id:i,mesh,x:0,z:0,vx:0,vz:0,heading:0,speed:0,slip:0,gear:1,damage:0,trackIndex:0,lastTrackIndex:0,actionSteer:0,actionThrottle:0,pendingReward:0,pendingDone:false,offTime:0,stuckTime:0,lap:0,episodeProgress:0,totalProgress:0,episodeReward:0,totalReward:0,collisions:0,collisionCooldown:0,rollout:[],lastObs:null,lastAction:0,lastValue:0,lastLogp:0,lastProb:0,latestRGBA:null,raceStatus:'racing',finishTime:null,finishPlace:null,lastRank:null,overtakes:0})}
function syncCarMesh(car){const roadY=track[car.trackIndex]?.y||0;car.mesh.position.set(car.x,roadY,car.z);car.mesh.rotation.y=-car.heading-Math.PI/2}
function spawnPose(slot,extraRow=0){
  const column=slot%2,row=Math.floor(slot/2)+extraRow;
  const base=mod(finishIndex+24-row*10,TRACK_N),q=track[base],n=normals[base];
  const lane=(column===0?-1:1)*1.8;
  return{base,x:q.x+n.x*lane,z:q.z+n.z*lane,heading:trackHeading(base)};
}
function resetDriver(car,slot=0,avoidTraffic=true){
  let pose=spawnPose(slot,0);
  if(avoidTraffic){
    for(let attempt=0;attempt<9;attempt++){
      const candidate=spawnPose(slot,attempt);
      const blocked=drivers.some(other=>other!==car&&Math.hypot(other.x-candidate.x,other.z-candidate.z)<4.2);
      pose=candidate;
      if(!blocked)break;
    }
  }
  car.x=pose.x;car.z=pose.z;car.heading=pose.heading;car.speed=3.5;car.vx=Math.cos(car.heading)*car.speed;car.vz=Math.sin(car.heading)*car.speed;car.slip=0;car.gear=1;car.damage=0;car.trackIndex=pose.base;car.lastTrackIndex=pose.base;
  car.actionSteer=0;car.actionThrottle=0;car.pendingReward=0;car.pendingDone=false;car.offTime=0;car.stuckTime=0;
  car.episodeProgress=0;car.episodeReward=0;car.collisionCooldown=0;car.lastObs=null;car.lastRank=null;car.raceStatus='racing';car.finishTime=null;car.finishPlace=null;car.mesh.visible=true;syncCarMesh(car);
}
function resetGrid(){drivers.forEach((c,i)=>resetDriver(c,i,false))}

function createNetwork(){const s1=Math.sqrt(1/INPUTS),s2=Math.sqrt(1/HIDDEN);return{w1:Float32Array.from({length:HIDDEN*INPUTS},()=>randn()*s1),b1:new Float32Array(HIDDEN),wp:Float32Array.from({length:ACTIONS*HIDDEN},()=>randn()*s2),bp:new Float32Array(ACTIONS),wv:Float32Array.from({length:HIDDEN},()=>randn()*s2),bv:0}}
let net=createNetwork();
function forward(obs,temperature=sim.temperature){const h=new Float32Array(HIDDEN);for(let j=0;j<HIDDEN;j++){let s=net.b1[j],o=j*INPUTS;for(let i=0;i<INPUTS;i++)s+=net.w1[o+i]*obs[i];h[j]=Math.tanh(s)}const logits=new Float32Array(ACTIONS);let mx=-Infinity;for(let a=0;a<ACTIONS;a++){let s=net.bp[a],o=a*HIDDEN;for(let j=0;j<HIDDEN;j++)s+=net.wp[o+j]*h[j];logits[a]=s/temperature;if(logits[a]>mx)mx=logits[a]}const probs=new Float32Array(ACTIONS);let sum=0;for(let a=0;a<ACTIONS;a++){probs[a]=Math.exp(logits[a]-mx);sum+=probs[a]}for(let a=0;a<ACTIONS;a++)probs[a]/=sum;let value=net.bv;for(let j=0;j<HIDDEN;j++)value+=net.wv[j]*h[j];return{h,probs,value}}
function argmax(probs){let best=0;for(let i=1;i<probs.length;i++)if(probs[i]>probs[best])best=i;return best}
function sampleAction(probs){let r=Math.random(),s=0;for(let a=0;a<ACTIONS;a++){s+=probs[a];if(r<=s)return a}return ACTIONS-1}

function configurePOVCamera(car,camera){
  const f=new THREE.Vector3(Math.cos(car.heading),0,Math.sin(car.heading));
  const roadY=track[car.trackIndex]?.y||0;
  camera.position.set(car.x+f.x*.7,roadY+1.48,car.z+f.z*.7);
  camera.lookAt(car.x+f.x*15,roadY+.38,car.z+f.z*15);
}
function captureObservation(car,show=false){
  const camera=observerCameras[car.id],rt=renderTargets[car.id];
  configurePOVCamera(car,camera);
  const wasVisible=car.mesh.visible;car.mesh.visible=false;
  renderer.setRenderTarget(rt);renderer.render(scene,camera);
  renderer.readRenderTargetPixels(rt,0,0,RENDER_W,RENDER_H,pixelBuffer);
  renderer.setRenderTarget(null);car.mesh.visible=wasVisible;

  const obs=new Float32Array(INPUTS);
  if(!car.latestRGBA)car.latestRGBA=new Uint8ClampedArray(OBS_W*OBS_H*4);
  const rgba=car.latestRGBA;
  for(let y=0;y<OBS_H;y++){
    for(let x=0;x<OBS_W;x++){
      let total=0;
      for(let oy=0;oy<OBS_SCALE;oy++)for(let ox=0;ox<OBS_SCALE;ox++){
        const renderY=RENDER_H-1-(y*OBS_SCALE+oy),renderX=x*OBS_SCALE+ox,src=(renderY*RENDER_W+renderX)*4;
        total+=.299*pixelBuffer[src]+.587*pixelBuffer[src+1]+.114*pixelBuffer[src+2];
      }
      const gray=total/(255*OBS_SCALE*OBS_SCALE),i=y*OBS_W+x,dst=i*4,g=Math.round(gray*255);
      obs[i]=gray*2-1;rgba[dst]=g;rgba[dst+1]=g;rgba[dst+2]=g;rgba[dst+3]=255;
    }
  }
  obs[PIXELS]=clamp(car.speed/22,0,1)*2-1;obs[PIXELS+1]=clamp(car.damage/100,0,1)*2-1;
  return obs;
}
function drawPreview(canvas,rgba){
  if(!canvas||!rgba)return;
  const ctx=canvas.getContext('2d'),image=ctx.createImageData(OBS_W,OBS_H);image.data.set(rgba);ctx.putImageData(image,0,0);
}
function updatePOV(){const car=drivers[sim.selected];if(!car.latestRGBA)return;povImage.data.set(car.latestRGBA);povCtx.putImageData(povImage,0,0)}

function finishTransition(car,done=false){
  if(!car.lastObs)return;
  car.rollout.push({obs:car.lastObs,action:car.lastAction,reward:car.pendingReward,value:car.lastValue,logp:car.lastLogp,done});
  sim.experience++;sim.totalExperience++;sim.batchReward+=car.pendingReward;
  car.episodeReward+=car.pendingReward;car.totalReward+=car.pendingReward;car.pendingReward=0;
}
function chooseAction(car){
  const obs=captureObservation(car,car.id===sim.selected),out=forward(obs),action=sim.mode==='race'?argmax(out.probs):sampleAction(out.probs),p=Math.max(1e-7,out.probs[action]),act=actionTable[action];
  car.lastObs=obs;car.lastAction=action;car.lastValue=out.value;car.lastLogp=Math.log(p);car.lastProb=p;car.actionSteer=act.steer;car.actionThrottle=act.throttle;
}
function decisionStep(){
  if(sim.learning)return;
  if(sim.mode==='race'){
    for(const car of drivers){
      if(car.raceStatus!=='racing')continue;
      if(car.pendingDone){markRaceDNF(car);continue}
      chooseAction(car);
    }
    checkRaceComplete();
    return;
  }
  applyPositionRewards();
  for(const car of drivers){
    if(car.pendingDone){
      finishTransition(car,true);
      resetDriver(car,car.id);
      chooseAction(car);
      car.pendingDone=false;
    }else{
      finishTransition(car,false);
      chooseAction(car);
    }
  }
  if(sim.experience>=BATCH_TARGET&&!sim.learning)performLearningUpdate();
}
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

function buildTrainingBatch(){
  const batch=[];
  for(const car of drivers){
    let nextValue=car.lastValue,gae=0;
    for(let i=car.rollout.length-1;i>=0;i--){
      const e=car.rollout[i],mask=e.done?0:1,delta=e.reward+GAMMA*nextValue*mask-e.value;
      gae=delta+GAMMA*GAE_LAMBDA*mask*gae;e.adv=gae;e.ret=e.value+gae;nextValue=e.value;
    }
    batch.push(...car.rollout);
  }
  let mean=0;for(const e of batch)mean+=e.adv;mean/=Math.max(1,batch.length);
  let variance=0;for(const e of batch){const d=e.adv-mean;variance+=d*d}variance/=Math.max(1,batch.length);
  const sd=Math.sqrt(variance)+1e-6;for(const e of batch)e.adv=(e.adv-mean)/sd;
  return batch;
}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[a[i],a[j]]=[a[j],a[i]]}}
function trainSample(e,lr){
  const {h,probs,value}=forward(e.obs),newLog=Math.log(Math.max(1e-7,probs[e.action])),ratio=Math.exp(clamp(newLog-e.logp,-10,10));
  const clipped=(e.adv>=0&&ratio>1+PPO_CLIP)||(e.adv<0&&ratio<1-PPO_CLIP),dLogP=clipped?0:-e.adv*ratio,dLogits=new Float32Array(ACTIONS);
  for(let a=0;a<ACTIONS;a++)dLogits[a]=clamp(dLogP*((a===e.action?1:0)-probs[a]),-3,3);
  const dValue=clamp(.35*(value-e.ret),-3,3),dh=new Float32Array(HIDDEN);
  for(let j=0;j<HIDDEN;j++){let g=net.wv[j]*dValue;for(let a=0;a<ACTIONS;a++)g+=net.wp[a*HIDDEN+j]*dLogits[a];dh[j]=clamp(g*(1-h[j]*h[j]),-3,3)}
  for(let a=0;a<ACTIONS;a++){const base=a*HIDDEN,g=dLogits[a];for(let j=0;j<HIDDEN;j++)net.wp[base+j]-=lr*g*h[j];net.bp[a]-=lr*g}
  for(let j=0;j<HIDDEN;j++)net.wv[j]-=lr*dValue*h[j];net.bv-=lr*dValue;
  for(let j=0;j<HIDDEN;j++){const base=j*INPUTS,g=dh[j];for(let i=0;i<INPUTS;i++)net.w1[base+i]-=lr*g*e.obs[i];net.b1[j]-=lr*g}
  const policyLoss=-Math.min(ratio*e.adv,clamp(ratio,1-PPO_CLIP,1+PPO_CLIP)*e.adv),valueLoss=.5*(value-e.ret)*(value-e.ret);
  return policyLoss+.35*valueLoss;
}
async function performLearningUpdate(){
  sim.learning=true;sim.running=false;$('learningOverlay').classList.add('show');$('phaseText').textContent='BACKPROP';$('learningText').textContent=`Training on ${sim.experience} experiences…`;updateUI();
  await new Promise(r=>setTimeout(r,90));
  const batch=buildTrainingBatch();let loss=0,count=0;
  for(let epoch=0;epoch<3;epoch++){
    shuffle(batch);
    for(const e of batch){loss+=trainSample(e,.00055);count++}
    $('learningText').textContent=`Backprop pass ${epoch+1}/3 · ${batch.length} samples`;await new Promise(r=>setTimeout(r,0));
  }
  sim.lastLoss=loss/Math.max(1,count);sim.update++;sim.temperature=Math.max(.72,1.35-sim.update*.005);
  const avgReward=sim.batchReward/Math.max(1,sim.experience);
  log(`Update ${sim.update}: ${batch.length} exp · reward/step ${avgReward.toFixed(3)} · loss ${sim.lastLoss.toFixed(3)} · temp ${sim.temperature.toFixed(2)}`);
  drivers.forEach(c=>{c.rollout=[];c.lastObs=null;c.pendingReward=0});
  sim.experience=0;sim.batchReward=0;sim.collisions=0;maybeRotateTrainingTrack();drivers.forEach(chooseAction);
  sim.learning=false;sim.running=true;$('learningOverlay').classList.remove('show');
}


function discardPartialRollout(reason=''){
  drivers.forEach(c=>{c.rollout=[];c.lastObs=null;c.pendingReward=0;c.pendingDone=false});
  sim.experience=0;sim.batchReward=0;sim.collisions=0;
  if(reason)log(reason);
}
function raceResultsText(){
  const placed=drivers.filter(c=>c.finishPlace!=null).sort((a,b)=>a.finishPlace-b.finishPlace);
  const dnfs=drivers.filter(c=>c.raceStatus==='dnf');
  if(!placed.length&&!dnfs.length)return `Race in progress · ${sim.raceLaps} laps · ${sim.raceTime.toFixed(1)} s`;
  const parts=placed.map(c=>`P${c.finishPlace} Driver ${c.id+1} ${c.finishTime.toFixed(1)}s`);
  dnfs.forEach(c=>parts.push(`Driver ${c.id+1} DNF`));
  return parts.join(' · ');
}
function chooseSpectatorRacer(){
  const current=drivers[sim.selected];
  if(current&&current.raceStatus==='racing')return;
  const next=drivers.find(c=>c.raceStatus==='racing');
  if(next)sim.selected=next.id;
}
function markRaceFinished(car){
  if(car.raceStatus!=='racing')return;
  car.raceStatus='finished';car.finishTime=sim.raceTime;car.finishPlace=++sim.racePlaces;car.speed=0;car.actionThrottle=0;car.actionSteer=0;
  const q=track[finishIndex],n=normals[finishIndex],t=tangents[finishIndex];
  car.x=q.x+n.x*(HALF_WIDTH+3.0)+t.x*((car.finishPlace-1)*2.1);
  car.z=q.z+n.z*(HALF_WIDTH+3.0)+t.z*((car.finishPlace-1)*2.1);
  car.heading=trackHeading(finishIndex);syncCarMesh(car);
  log(`Race: Driver ${car.id+1} finished P${car.finishPlace} in ${car.finishTime.toFixed(1)} s.`);
  chooseSpectatorRacer();checkRaceComplete();
}
function markRaceDNF(car){
  if(car.raceStatus!=='racing')return;
  car.raceStatus='dnf';car.speed=0;car.mesh.visible=false;
  log(`Race: Driver ${car.id+1} DNF.`);
  chooseSpectatorRacer();checkRaceComplete();
}
function checkRaceComplete(){
  if(sim.mode!=='race'||sim.raceFinished)return;
  if(drivers.some(c=>c.raceStatus==='racing'))return;
  sim.raceFinished=true;sim.running=false;
  $('raceResult').innerHTML=`<strong>Race complete.</strong> ${raceResultsText()}`;
  log(`Evaluation race complete: ${raceResultsText()}`);
}
function startEvaluationRace(){
  if(sim.learning)return;
  sim.mode='race';sim.raceLaps=Number($('raceLaps').value);sim.raceTime=0;sim.racePlaces=0;sim.raceFinished=false;
  discardPartialRollout('Evaluation race started; unfinished learning batch discarded.');
  resetGrid();
  drivers.forEach(c=>{c.lap=0;c.raceStatus='racing';c.finishTime=null;c.finishPlace=null;c.mesh.visible=true});
  drivers.forEach(chooseAction);
  sim.running=true;
  $('raceResult').innerHTML=`<strong>Official evaluation race:</strong> ${sim.raceLaps} laps. Policy frozen; deterministic actions; no backprop.`;
  log(`Started ${sim.raceLaps}-lap evaluation race with policy from update ${sim.update}.`);
  updateUI();
}
function enterLearningMode(){
  if(sim.learning)return;
  sim.mode='learn';sim.raceFinished=false;
  discardPartialRollout('Learning mode resumed with the current saved brain.');
  resetGrid();drivers.forEach(c=>{c.lap=0;c.mesh.visible=true});
  drivers.forEach(chooseAction);
  sim.running=true;
  $('raceResult').textContent='Learning mode active. Experience is accumulating again; the next 512-sample batch will trigger backprop.';
  updateUI();
}
function chooseRandomTrainingTrack(){
  const choices=TRAINING_TRACKS.filter(id=>id!==activeTrackId);
  return choices[(Math.random()*choices.length)|0]||'mixed';
}
function changeTrackMode(value){
  if(sim.learning)return;
  sim.running=false;sim.mode='learn';sim.trackMode=value;
  discardPartialRollout();
  const id=value==='random'?chooseRandomTrainingTrack():value;
  buildTrack(id);resetGrid();
  drivers.forEach(c=>{c.lap=0;c.totalProgress=0;c.lastRank=null;c.mesh.visible=true});
  $('raceResult').innerHTML=`<strong>Track changed:</strong> ${TRACK_DEFS[activeTrackId].name}. ${value==='random'?'Training will rotate to another circuit every '+sim.trackRotationEvery+' updates.':'Ready to learn or run an evaluation race.'}`;
  log(`Loaded track: ${TRACK_DEFS[activeTrackId].name}.`);
  updateUI();
}
function maybeRotateTrainingTrack(){
  if(sim.trackMode!=='random'||sim.update===0||sim.update%sim.trackRotationEvery!==0)return false;
  const id=chooseRandomTrainingTrack();buildTrack(id);resetGrid();
  drivers.forEach(c=>{c.lap=0;c.lastRank=null;c.mesh.visible=true});
  log(`Multi-track training rotated to ${TRACK_DEFS[id].name}.`);
  return true;
}

function checkpointObject(){
  return{
    format:'pov-rl-racing-lab-checkpoint',version:1,savedAt:new Date().toISOString(),
    architecture:{obsW:OBS_W,obsH:OBS_H,inputs:INPUTS,hidden:HIDDEN,actions:ACTIONS},
    training:{update:sim.update,totalExperience:sim.totalExperience,temperature:sim.temperature,trackMode:sim.trackMode,activeTrackId},
    net:{w1:Array.from(net.w1),b1:Array.from(net.b1),wp:Array.from(net.wp),bp:Array.from(net.bp),wv:Array.from(net.wv),bv:net.bv}
  };
}
function saveCheckpoint(){
  const data=JSON.stringify(checkpointObject());
  const blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`pov-racer-update-${sim.update}.json`;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  log(`Saved brain checkpoint at update ${sim.update}.`);
}
function loadCheckpointData(data){
  if(data?.format!=='pov-rl-racing-lab-checkpoint')throw new Error('Not a POV RL Racing Lab checkpoint.');
  const a=data.architecture||{},n=data.net||{};
  if(a.inputs!==INPUTS||a.hidden!==HIDDEN||a.actions!==ACTIONS)throw new Error('Checkpoint network architecture does not match this prototype.');
  if(n.w1?.length!==HIDDEN*INPUTS||n.b1?.length!==HIDDEN||n.wp?.length!==ACTIONS*HIDDEN||n.bp?.length!==ACTIONS||n.wv?.length!==HIDDEN)throw new Error('Checkpoint weight arrays are incomplete.');
  net={w1:Float32Array.from(n.w1),b1:Float32Array.from(n.b1),wp:Float32Array.from(n.wp),bp:Float32Array.from(n.bp),wv:Float32Array.from(n.wv),bv:Number(n.bv)||0};
  sim.update=Number(data.training?.update)||0;sim.totalExperience=Number(data.training?.totalExperience)||0;sim.temperature=Number(data.training?.temperature)||1.0;sim.trackMode=data.training?.trackMode||'mixed';
  sim.running=false;sim.mode='learn';sim.raceFinished=false;discardPartialRollout();
  buildTrack(data.training?.activeTrackId in TRACK_DEFS?data.training.activeTrackId:(sim.trackMode in TRACK_DEFS?sim.trackMode:'mixed'));$('trackSelect').value=sim.trackMode;
  resetGrid();drivers.forEach(c=>{c.lap=0;c.totalReward=0;c.totalProgress=0;c.collisions=0;c.mesh.visible=true});
  $('raceResult').innerHTML=`<strong>Checkpoint loaded.</strong> Brain restored from update ${sim.update}. Start learning or run an evaluation race.`;
  log(`Loaded checkpoint from update ${sim.update}.`);
  updateUI();
}

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
let uiAcc=0;
function animate(now){
  requestAnimationFrame(animate);
  const realDt=Math.min(.05,(now-sim.lastTime)/1000);sim.lastTime=now;
  if(sim.running&&!sim.learning){
    sim.physicsAcc+=realDt*sim.speed;sim.decisionAcc+=realDt*sim.speed;
    const FIXED=1/60,maxPhysics=sim.fastMode&&sim.mode==='learn'?180:80,maxDecisions=sim.fastMode&&sim.mode==='learn'?28:16;
    let guard=0;
    while(sim.physicsAcc>=FIXED&&guard++<maxPhysics){physicsStep(FIXED);sim.physicsAcc-=FIXED}
    guard=0;
    while(sim.decisionAcc>=DECISION_DT&&guard++<maxDecisions&&!sim.learning){decisionStep();sim.decisionAcc-=DECISION_DT}
    sim.physicsAcc=Math.min(sim.physicsAcc,.75);sim.decisionAcc=Math.min(sim.decisionAcc,.75);
  }
  const fastHeadless=sim.fastMode&&sim.mode==='learn'&&sim.running;
  container.classList.toggle('fast-paused',fastHeadless);
  if(!fastHeadless){
    updateMainCamera();renderer.setRenderTarget(null);
    const selectedMesh=drivers[sim.selected].mesh,hideOwnCar=sim.cameraMode==='pov',wasVisible=selectedMesh.visible;
    if(hideOwnCar)selectedMesh.visible=false;
    renderer.render(scene,mainCamera);
    if(hideOwnCar)selectedMesh.visible=wasVisible;
  }
  if(now-sim.measureReal>=1000){
    const realSeconds=(now-sim.measureReal)/1000;sim.achievedSpeed=(sim.simClock-sim.measureSim)/Math.max(.001,realSeconds);
    sim.measureReal=now;sim.measureSim=sim.simClock;
  }
  uiAcc+=realDt;const uiPeriod=fastHeadless?.5:.16;
  if(uiAcc>uiPeriod){uiAcc=0;updateUI()}
}
$('runBtn').addEventListener('click',()=>{
  if(sim.learning)return;
  sim.running=!sim.running;
  if(sim.running&&drivers.every(c=>c.lastObs===null)&&sim.mode==='learn')drivers.forEach(chooseAction);
  updateUI();
});
document.querySelectorAll('.speed-btn').forEach(b=>b.addEventListener('click',()=>{
  sim.speed=Number(b.dataset.speed);document.querySelectorAll('.speed-btn').forEach(x=>x.classList.toggle('active',x===b));
}));
$('cameraBtn').addEventListener('click',()=>{
  sim.cameraMode=sim.cameraMode==='chase'?'pov':'chase';$('cameraBtn').textContent=sim.cameraMode==='chase'?'Chase camera':'POV camera';
});
$('learnBtn').addEventListener('click',enterLearningMode);
$('fastBtn').addEventListener('click',()=>{sim.fastMode=!sim.fastMode;container.classList.toggle('fast-paused',sim.fastMode&&sim.mode==='learn');log(sim.fastMode?'Fast training enabled: spectator rendering paused while learning.':'Visual training restored.');updateUI()});
$('trackSelect').addEventListener('change',event=>changeTrackMode(event.target.value));
$('raceBtn').addEventListener('click',startEvaluationRace);
$('raceLaps').addEventListener('change',()=>sim.raceLaps=Number($('raceLaps').value));
$('saveBtn').addEventListener('click',saveCheckpoint);
$('loadBtn').addEventListener('click',()=>$('loadInput').click());
$('loadInput').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{loadCheckpointData(JSON.parse(await file.text()))}
  catch(error){log(`Load failed: ${error.message}`);$('raceResult').innerHTML=`<strong>Load failed.</strong> ${error.message}`}
  event.target.value='';
});
$('resetBtn').addEventListener('click',()=>{
  if(sim.learning)return;
  sim.running=false;sim.mode='learn';sim.update=0;sim.experience=0;sim.totalExperience=0;sim.batchReward=0;sim.collisions=0;sim.temperature=1.35;sim.lastLoss=0;sim.raceFinished=false;
  net=createNetwork();
  drivers.forEach(c=>{c.rollout=[];c.totalReward=0;c.totalProgress=0;c.lap=0;c.collisions=0;c.lastObs=null;c.latestRGBA=null;c.mesh.visible=true});
  resetGrid();$('log').innerHTML='';$('raceResult').textContent='Learning reset. Fresh random brain; evaluation race is idle.';
  log('Learning reset. Fresh random shared policy.');updateUI();
});
resetGrid();mainCamera.position.set(0,12,45);drivers.forEach(c=>syncCarMesh(c));
log('Ready. Start learning: four cars gather 512 experiences, freeze for backprop, then continue driving with the updated shared policy.');
updateUI();animate(performance.now());
