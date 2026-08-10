// Presentation-only persistent skid marks plus impact debris, sparks, dust, and smoke.
let impactEffectsGroup=null,impactParticles=[];
const SKID_MARK_SCRUB_THRESHOLD=.48,SKID_MARK_MIN_SPEED=4,SKID_MARK_SAMPLE_DISTANCE=.55,SKID_MARK_MAX_SEGMENTS=240000,SKID_MARK_CHUNK_SEGMENTS=2048;
let skidMarksGroup=null,skidMarkMaterial=null,skidMarkChunks=[],skidMarkSegmentCount=0;
const skidTrailStates=Array.from({length:DRIVER_COUNT},()=>({left:null,right:null}));

function ensureSkidMarksGroup(){if(skidMarksGroup)return skidMarksGroup;skidMarksGroup=new THREE.Group();skidMarksGroup.name='persistent-skid-marks';scene.add(skidMarksGroup);return skidMarksGroup}
function ensureSkidMarkMaterial(){if(!skidMarkMaterial)skidMarkMaterial=new THREE.LineBasicMaterial({color:0x090b0d,transparent:true,opacity:.82,depthWrite:false});return skidMarkMaterial}
function newSkidMarkChunk(){const geometry=new THREE.BufferGeometry(),positions=new Float32Array(SKID_MARK_CHUNK_SEGMENTS*6),attribute=new THREE.BufferAttribute(positions,3);attribute.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('position',attribute);geometry.setDrawRange(0,0);const lines=new THREE.LineSegments(geometry,ensureSkidMarkMaterial());lines.frustumCulled=false;lines.renderOrder=3;ensureSkidMarksGroup().add(lines);const chunk={geometry,attribute,positions,lines,count:0};skidMarkChunks.push(chunk);return chunk}
function appendSkidMarkSegment(a,b){if(skidMarkSegmentCount>=SKID_MARK_MAX_SEGMENTS)return false;let chunk=skidMarkChunks.at(-1);if(!chunk||chunk.count>=SKID_MARK_CHUNK_SEGMENTS)chunk=newSkidMarkChunk();const offset=chunk.count*6;chunk.positions[offset]=a.x;chunk.positions[offset+1]=a.y;chunk.positions[offset+2]=a.z;chunk.positions[offset+3]=b.x;chunk.positions[offset+4]=b.y;chunk.positions[offset+5]=b.z;chunk.count++;skidMarkSegmentCount++;chunk.geometry.setDrawRange(0,chunk.count*2);chunk.attribute.needsUpdate=true;return true}
function skidContactPoints(car){const fx=Math.cos(car.heading),fz=Math.sin(car.heading),rx=-fz,rz=fx,rearX=car.x-fx*1.05,rearZ=car.z-fz*1.05,halfTrack=.72,y=surfaceHeightForCar(car)+.055;return{left:{x:rearX+rx*halfTrack,y,z:rearZ+rz*halfTrack},right:{x:rearX-rx*halfTrack,y,z:rearZ-rz*halfTrack}}}
function resetSkidTrailForCar(car){const state=skidTrailStates[car?.id];if(state){state.left=null;state.right=null}}
function clearSkidMarks(){if(skidMarksGroup){for(const child of[...skidMarksGroup.children]){skidMarksGroup.remove(child);child.geometry?.dispose?.()}}skidMarkChunks=[];skidMarkSegmentCount=0;for(const state of skidTrailStates){state.left=null;state.right=null}}
function setSkidMarksVisible(visible){if(skidMarksGroup)skidMarksGroup.visible=visible}
function updateSkidMarks(car){const state=skidTrailStates[car?.id];if(!state)return;if(sim.headless&&sim.mode==='learn'){state.left=null;state.right=null;return}const marking=(Number(car.tireScrub)||0)>=SKID_MARK_SCRUB_THRESHOLD&&(Number(car.speed)||0)>=SKID_MARK_MIN_SPEED&&(car.surface==='road'||car.surface==='shoulder');if(!marking||skidMarkSegmentCount>=SKID_MARK_MAX_SEGMENTS){state.left=null;state.right=null;return}const current=skidContactPoints(car);if(!state.left||!state.right){state.left=current.left;state.right=current.right;return}const distance=Math.hypot(current.left.x-state.left.x,current.left.z-state.left.z);if(distance<SKID_MARK_SAMPLE_DISTANCE)return;if(distance>2.2){state.left=current.left;state.right=current.right;return}appendSkidMarkSegment(state.left,current.left);appendSkidMarkSegment(state.right,current.right);state.left=current.left;state.right=current.right}

function ensureImpactEffectsGroup(){
  if(impactEffectsGroup)return impactEffectsGroup;
  impactEffectsGroup=new THREE.Group();
  impactEffectsGroup.name='impact-effects';
  scene.add(impactEffectsGroup);
  return impactEffectsGroup;
}

function removeImpactParticle(p){
  if(!p)return;
  p.mesh.parent?.remove(p.mesh);
  p.mesh.geometry?.dispose?.();
  p.mesh.material?.dispose?.();
}

function clearImpactEffects(){
  for(const p of impactParticles)removeImpactParticle(p);
  impactParticles=[];
}

function setImpactEffectsVisible(visible){
  if(impactEffectsGroup)impactEffectsGroup.visible=visible;
}

function makeImpactParticle(x,y,z,type,strength=1){
  const group=ensureImpactEffectsGroup(),r=Math.random,angle=r()*Math.PI*2;
  let size=.08+r()*.12,color=0x2d3338,life=.45+r()*.45,speed=(1.5+r()*4)*strength,vy=1.2+r()*3.5,geometry;
  if(type==='spark'){
    size=.035+r()*.045;color=0xffd166;life=.18+r()*.24;speed=(5+r()*9)*strength;vy=2+r()*5;
    geometry=new THREE.BoxGeometry(size*.45,size*.45,size*3.4);
  }else if(type==='smoke'){
    size=.16+r()*.18;color=0x89939a;life=.55+r()*.7;speed=.4+r()*.9;vy=.8+r()*1.4;
    geometry=new THREE.SphereGeometry(size,6,5);
  }else if(type==='wood'){
    size=.07+r()*.11;color=r()<.5?0x6b482c:0x8a5b34;life=.65+r()*.7;speed=(2+r()*5)*strength;vy=1.5+r()*4.5;
    geometry=new THREE.BoxGeometry(size*.7,size*.45,size*2.2);
  }else if(type==='leaf'){
    size=.06+r()*.10;color=r()<.5?0x315f36:0x4c7b43;life=.55+r()*.65;speed=(1+r()*3.5)*strength;vy=1.3+r()*3;
    geometry=new THREE.BoxGeometry(size,size*.35,size*1.4);
  }else if(type==='dust'){
    size=.13+r()*.18;color=0x9a8b70;life=.45+r()*.55;speed=.5+r()*1.4;vy=.7+r()*1.5;
    geometry=new THREE.SphereGeometry(size,6,5);
  }else{
    geometry=new THREE.BoxGeometry(size*.8,size*.35,size*1.6);
  }
  const softParticle=type==='smoke'||type==='dust',material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:softParticle ? .42 : .95,depthWrite:!softParticle}),mesh=new THREE.Mesh(geometry,material);
  mesh.position.set(x+(r()-.5)*.35,y+.12+r()*.35,z+(r()-.5)*.35);
  mesh.rotation.set(r()*Math.PI,r()*Math.PI,r()*Math.PI);
  group.add(mesh);
  const particle={mesh,type,life,maxLife:life,groundY:y,vx:Math.cos(angle)*speed,vy,vz:Math.sin(angle)*speed,spinX:(r()-.5)*9,spinY:(r()-.5)*9,spinZ:(r()-.5)*9};
  impactParticles.push(particle);
  while(impactParticles.length>140)removeImpactParticle(impactParticles.shift());
}

function spawnImpactEffects(x,z,y=0,severity=1,kind='car'){
  if(sim.headless&&sim.mode==='learn')return;
  const strength=clamp(.55+severity*.09,.6,1.65);
  if(kind==='tree'){
    const wood=Math.min(12,3+Math.round(severity*.6)),leaves=Math.min(10,2+Math.round(severity*.45)),dust=Math.min(5,1+Math.round(severity*.22));
    for(let i=0;i<wood;i++)makeImpactParticle(x,y,z,'wood',strength);
    for(let i=0;i<leaves;i++)makeImpactParticle(x,y,z,'leaf',strength);
    for(let i=0;i<dust;i++)makeImpactParticle(x,y,z,'dust',strength);
  }else{
    const sparks=Math.min(16,4+Math.round(severity*.75)),debris=Math.min(10,2+Math.round(severity*.4)),smoke=Math.min(5,1+Math.round(severity*.18));
    for(let i=0;i<sparks;i++)makeImpactParticle(x,y,z,'spark',strength);
    for(let i=0;i<debris;i++)makeImpactParticle(x,y,z,'debris',strength);
    for(let i=0;i<smoke;i++)makeImpactParticle(x,y,z,'smoke',strength);
  }
}

function updateImpactEffects(dt){
  if(sim.headless&&sim.mode==='learn'){if(impactParticles.length)clearImpactEffects();return}
  for(let i=impactParticles.length-1;i>=0;i--){
    const p=impactParticles[i];p.life-=dt;
    if(p.life<=0){removeImpactParticle(p);impactParticles.splice(i,1);continue}
    const airborne=p.type!=='smoke'&&p.type!=='dust';
    if(airborne)p.vy-=9.8*dt;
    const drag=Math.exp(-dt*(p.type==='smoke'||p.type==='dust'?2.0:1.15));p.vx*=drag;p.vz*=drag;
    p.mesh.position.x+=p.vx*dt;p.mesh.position.y+=p.vy*dt;p.mesh.position.z+=p.vz*dt;
    if(airborne&&p.mesh.position.y<p.groundY+.035){p.mesh.position.y=p.groundY+.035;p.vy=Math.abs(p.vy)*.18;p.vx*=.58;p.vz*=.58}
    p.mesh.rotation.x+=p.spinX*dt;p.mesh.rotation.y+=p.spinY*dt;p.mesh.rotation.z+=p.spinZ*dt;
    const alpha=clamp(p.life/Math.max(.001,p.maxLife),0,1),softParticle=p.type==='smoke'||p.type==='dust';p.mesh.material.opacity=(softParticle ? .42 : .95)*Math.min(1,alpha*2.5);
    if(p.type==='smoke'||p.type==='dust'){const grow=1+(1-alpha)*1.2;p.mesh.scale.setScalar(grow)}
  }
}
