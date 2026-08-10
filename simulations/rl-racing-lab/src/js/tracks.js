// Rendered track surfaces/scenery built from validated, distance-sampled circuit layouts.
let track=[],tangents=[],normals=[],segLen=[],trackDistance=[],trackLength=0,avgSeg=1,TRACK_N=0,finishIndex=2,activeTrackId='mixed',activeTrackMirror=false,trackGroup=null,treeColliders=[];
let trackBounds={minX:-90,maxX:90,minZ:-90,maxZ:90,minY:0,maxY:0,centerX:0,centerZ:0,spanX:180,spanZ:180};
function makeTrackPoints(id,mirror=false){return buildTrackSamples(id,mirror).map(p=>new THREE.Vector3(p.x,p.y,p.z))}
function trackVariantName(id=activeTrackId,mirror=activeTrackMirror){const name=TRACK_DEFS[id]?.name||id;return mirror?`${name} · mirrored`:name}
function surfaceZone(distance){return distance<HALF_WIDTH?'road':distance<HALF_WIDTH+SHOULDER_WIDTH?'shoulder':'grass'}
function trackStepsForDistance(meters){return Math.max(1,Math.round(Math.max(0,meters)/Math.max(.001,avgSeg)))}
function updateTrackBounds(){let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,minY=Infinity,maxY=-Infinity;for(const q of track){minX=Math.min(minX,q.x);maxX=Math.max(maxX,q.x);minZ=Math.min(minZ,q.z);maxZ=Math.max(maxZ,q.z);minY=Math.min(minY,q.y);maxY=Math.max(maxY,q.y)}trackBounds={minX,maxX,minZ,maxZ,minY,maxY,centerX:(minX+maxX)/2,centerZ:(minZ+maxZ)/2,spanX:maxX-minX,spanZ:maxZ-minZ}}
function ribbonGeometry(inner,outer,yOffset){
  const pos=[],idx=[];
  for(let i=0;i<TRACK_N;i++){
    const j=mod(i+1,TRACK_N),a0=track[i].clone().addScaledVector(normals[i],inner),b0=track[i].clone().addScaledVector(normals[i],outer),a1=track[j].clone().addScaledVector(normals[j],inner),b1=track[j].clone().addScaledVector(normals[j],outer),base=pos.length/3;
    for(const q of[a0,b0,a1,b1])pos.push(q.x,q.y+yOffset,q.z);idx.push(base,base+1,base+2,base+1,base+3,base+2);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();return geo;
}
function treeCandidateClear(candidate,ownIndex){const skip=trackStepsForDistance(28),required=HALF_WIDTH+SHOULDER_WIDTH+2.2;for(let j=0;j<TRACK_N;j++){const delta=Math.min(mod(j-ownIndex,TRACK_N),mod(ownIndex-j,TRACK_N));if(delta<=skip)continue;const q=track[j];if(Math.abs(q.y-candidate.y)>TRACK_ELEVATION_CLEARANCE)continue;if(Math.hypot(q.x-candidate.x,q.z-candidate.z)<required)return false}return true}
function buildTrack(id='mixed',mirror=false){
  activeTrackId=id in TRACK_DEFS?id:'mixed';activeTrackMirror=!!mirror;track=makeTrackPoints(activeTrackId,activeTrackMirror);TRACK_N=track.length;tangents=[];normals=[];segLen=[];trackDistance=[];trackLength=0;
  for(let i=0;i<TRACK_N;i++){trackDistance.push(trackLength);const prev=track[mod(i-1,TRACK_N)],next=track[mod(i+1,TRACK_N)],t=next.clone().sub(prev).normalize();tangents.push(t);const horiz=new THREE.Vector3(t.x,0,t.z).normalize();normals.push(new THREE.Vector3(-horiz.z,0,horiz.x));const len=track[i].distanceTo(track[mod(i+1,TRACK_N)]);segLen.push(len);trackLength+=len}
  avgSeg=trackLength/TRACK_N;finishIndex=2;updateTrackBounds();
  if(typeof clearImpactEffects==='function')clearImpactEffects();if(typeof clearSkidMarks==='function')clearSkidMarks();
  if(trackGroup){scene.remove(trackGroup);trackGroup.traverse(o=>{o.geometry?.dispose?.();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose?.());else o.material.dispose?.()}})}
  trackGroup=new THREE.Group();treeColliders=[];scene.add(trackGroup);
  const shoulderMat=new THREE.MeshStandardMaterial({color:0x716a5e,roughness:1,metalness:0,side:THREE.DoubleSide}),roadMat=new THREE.MeshStandardMaterial({color:0x252b30,roughness:.96,metalness:.02,side:THREE.DoubleSide});
  for(const side of[-1,1]){const shoulder=new THREE.Mesh(ribbonGeometry(side*HALF_WIDTH,side*(HALF_WIDTH+SHOULDER_WIDTH),.008),shoulderMat);shoulder.receiveShadow=true;trackGroup.add(shoulder)}
  const road=new THREE.Mesh(ribbonGeometry(-HALF_WIDTH,HALF_WIDTH,.025),roadMat);road.receiveShadow=true;trackGroup.add(road);
  function edgeLine(sign,color,width=HALF_WIDTH){const pts=track.map((q,i)=>q.clone().addScaledVector(normals[i],sign*width).add(new THREE.Vector3(0,.065,0)));pts.push(pts[0].clone());trackGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color,transparent:true,opacity:.96})))}
  edgeLine(1,0xffc04d);edgeLine(-1,0xffc04d);edgeLine(1,0xe8e2d5,HALF_WIDTH+SHOULDER_WIDTH);edgeLine(-1,0xe8e2d5,HALF_WIDTH+SHOULDER_WIDTH);
  const dashEvery=trackStepsForDistance(activeTrackId==='mixed'||activeTrackId==='reverse'?14:16),treeEvery=trackStepsForDistance(['grandprix','endurance','longrun'].includes(activeTrackId)?52:activeTrackId==='sweepers'?44:38),treeOffset=3.2;
  for(let i=0;i<TRACK_N;i+=dashEvery){const q=track[i],t=tangents[i],dash=new THREE.Mesh(new THREE.BoxGeometry(.15,.026,1.7),new THREE.MeshBasicMaterial({color:0xf6d36a}));dash.position.set(q.x,q.y+.075,q.z);dash.rotation.y=-Math.atan2(t.z,t.x)+Math.PI/2;trackGroup.add(dash)}
  const toneBands=Math.max(6,Math.round(trackLength/2.2/3)*3),toneStride=TRACK_N/toneBands,toneLength=Math.max(.9,trackLength/toneBands*.88),toneColors=[0x4a5359,0xa8adb0,0xf2efe8];
  for(let segment=0;segment<toneBands;segment++){const i=Math.round(segment*toneStride)%TRACK_N;for(const side of[-1,1]){const q=track[i].clone().addScaledVector(normals[i],side*(HALF_WIDTH+.28)),t=tangents[i],strip=new THREE.Mesh(new THREE.BoxGeometry(.46,.05,toneLength),new THREE.MeshBasicMaterial({color:toneColors[segment%3]}));strip.position.set(q.x,q.y+.066,q.z);strip.rotation.y=-Math.atan2(t.z,t.x)+Math.PI/2;trackGroup.add(strip)}}
  for(let i=0;i<TRACK_N;i+=treeEvery)for(const side of[-1,1]){const q=track[i].clone().addScaledVector(normals[i],side*(HALF_WIDTH+SHOULDER_WIDTH+treeOffset));if(activeTrackId==='figure8'&&q.y>1.4)continue;if(!treeCandidateClear(q,i))continue;treeColliders.push({x:q.x,y:q.y,z:q.z,radius:.32});const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.24,1.5,7),new THREE.MeshStandardMaterial({color:0x5a412f}));trunk.position.set(q.x,q.y+.75,q.z);trunk.castShadow=true;trackGroup.add(trunk);const crown=new THREE.Mesh(new THREE.ConeGeometry(1,2.4,8),new THREE.MeshStandardMaterial({color:0x2e6a3c}));crown.position.set(q.x,q.y+2.35,q.z);crown.castShadow=true;trackGroup.add(crown)}
  const q=track[finishIndex],t=tangents[finishIndex],line=new THREE.Mesh(new THREE.BoxGeometry(HALF_WIDTH*2,.035,.45),new THREE.MeshBasicMaterial({color:0xffffff}));line.position.set(q.x,q.y+.09,q.z);line.rotation.y=-Math.atan2(t.z,t.x)+Math.PI/2;trackGroup.add(line);
}
buildTrack('mixed');
