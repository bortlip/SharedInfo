// Circuit definitions, layered track surfaces, and evaluation-track construction.
const HALF_WIDTH=5.4,SHOULDER_WIDTH=1.25;
const TRACK_DEFS={
  mixed:{name:'Balanced Loop',n:300,make:(a)=>new THREE.Vector3(Math.cos(a)*(35+4.2*Math.sin(2*a)+2*Math.cos(3*a)),0,Math.sin(a)*(24+3.2*Math.cos(3*a)-1.5*Math.sin(2*a)))},
  reverse:{name:'Counterflow',n:320,reverse:true,make:(a)=>new THREE.Vector3(Math.cos(a)*(35+4.2*Math.sin(2*a)+2*Math.cos(3*a)),0,Math.sin(a)*(24+3.2*Math.cos(3*a)-1.5*Math.sin(2*a)))},
  technical:{name:'Technical Circuit',n:360,make:(a)=>new THREE.Vector3(Math.cos(a)*(30+6*Math.sin(3*a)+3*Math.cos(5*a)),0,Math.sin(a)*(21+5*Math.cos(4*a)+2*Math.sin(6*a)))},
  sweepers:{name:'Fast Sweepers',n:360,make:(a)=>new THREE.Vector3(Math.cos(a)*(44+5*Math.cos(2*a)),0,Math.sin(a)*(29+4*Math.sin(2*a)))},
  figure8:{name:'Figure Eight Overpass',n:420,make:(a)=>new THREE.Vector3(35*Math.sin(a),2.75*(1+Math.cos(a)),21*Math.sin(2*a))},
  grandprix:{name:'Grand Prix',n:520,make:(a)=>new THREE.Vector3(60*Math.cos(a)+12*Math.cos(2*a)+5*Math.sin(5*a),0,38*Math.sin(a)+8*Math.sin(3*a)+5*Math.cos(4*a))}
};
let track=[],tangents=[],normals=[],segLen=[],trackLength=0,avgSeg=1,TRACK_N=0,finishIndex=2,activeTrackId='mixed',trackGroup=null;
function makeTrackPoints(id){const def=TRACK_DEFS[id]||TRACK_DEFS.mixed,pts=[];for(let i=0;i<def.n;i++)pts.push(def.make(i/def.n*Math.PI*2));if(def.reverse)pts.reverse();return pts}
function surfaceZone(distance){return distance<HALF_WIDTH?'road':distance<HALF_WIDTH+SHOULDER_WIDTH?'shoulder':'grass'}
function ribbonGeometry(inner,outer,yOffset){
  const pos=[],idx=[];
  for(let i=0;i<TRACK_N;i++){
    const j=mod(i+1,TRACK_N),a0=track[i].clone().addScaledVector(normals[i],inner),b0=track[i].clone().addScaledVector(normals[i],outer),a1=track[j].clone().addScaledVector(normals[j],inner),b1=track[j].clone().addScaledVector(normals[j],outer),base=pos.length/3;
    for(const q of[a0,b0,a1,b1])pos.push(q.x,q.y+yOffset,q.z);idx.push(base,base+1,base+2,base+1,base+3,base+2);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();return geo;
}
function buildTrack(id='mixed'){
  activeTrackId=id in TRACK_DEFS?id:'mixed';track=makeTrackPoints(activeTrackId);TRACK_N=track.length;tangents=[];normals=[];segLen=[];trackLength=0;
  for(let i=0;i<TRACK_N;i++){const prev=track[mod(i-1,TRACK_N)],next=track[mod(i+1,TRACK_N)],t=next.clone().sub(prev).normalize();tangents.push(t);const horiz=new THREE.Vector3(t.x,0,t.z).normalize();normals.push(new THREE.Vector3(-horiz.z,0,horiz.x));const len=track[i].distanceTo(track[mod(i+1,TRACK_N)]);segLen.push(len);trackLength+=len}
  avgSeg=trackLength/TRACK_N;finishIndex=2;
  if(trackGroup){scene.remove(trackGroup);trackGroup.traverse(o=>{o.geometry?.dispose?.();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose?.());else o.material.dispose?.()}})}
  trackGroup=new THREE.Group();scene.add(trackGroup);
  const shoulderMat=new THREE.MeshStandardMaterial({color:0x716a5e,roughness:1,metalness:0,side:THREE.DoubleSide}),roadMat=new THREE.MeshStandardMaterial({color:0x252b30,roughness:.96,metalness:.02,side:THREE.DoubleSide});
  for(const side of[-1,1]){const shoulder=new THREE.Mesh(ribbonGeometry(side*HALF_WIDTH,side*(HALF_WIDTH+SHOULDER_WIDTH),.008),shoulderMat);shoulder.receiveShadow=true;trackGroup.add(shoulder)}
  const road=new THREE.Mesh(ribbonGeometry(-HALF_WIDTH,HALF_WIDTH,.025),roadMat);road.receiveShadow=true;trackGroup.add(road);
  function edgeLine(sign,color,width=HALF_WIDTH){const pts=track.map((q,i)=>q.clone().addScaledVector(normals[i],sign*width).add(new THREE.Vector3(0,.065,0)));pts.push(pts[0].clone());trackGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color,transparent:true,opacity:.96})))}
  edgeLine(1,0xffc04d);edgeLine(-1,0xffc04d);edgeLine(1,0xe8e2d5,HALF_WIDTH+SHOULDER_WIDTH);edgeLine(-1,0xe8e2d5,HALF_WIDTH+SHOULDER_WIDTH);
  const historical=activeTrackId==='mixed',dashEvery=historical?10:12,treeEvery=historical?18:(activeTrackId==='grandprix'?28:22),treeOffset=historical?2.2:3.2;
  for(let i=0;i<TRACK_N;i+=dashEvery){const q=track[i],t=tangents[i],dash=new THREE.Mesh(new THREE.BoxGeometry(.15,.026,1.55),new THREE.MeshBasicMaterial({color:0xf6d36a}));dash.position.set(q.x,q.y+.075,q.z);dash.rotation.y=-Math.atan2(t.z,t.x)+Math.PI/2;trackGroup.add(dash)}
  for(let i=12;i<TRACK_N;i+=24){const q=track[i],t=tangents[i],n=normals[i],base=-Math.atan2(t.z,t.x)+Math.PI/2,mat=new THREE.MeshBasicMaterial({color:0xe8f5f7});const shaft=new THREE.Mesh(new THREE.BoxGeometry(.18,.026,1.05),mat);shaft.position.set(q.x,q.y+.078,q.z);shaft.rotation.y=base;trackGroup.add(shaft);for(const side of[-1,1]){const head=new THREE.Mesh(new THREE.BoxGeometry(.17,.027,.78),mat);head.position.set(q.x+t.x*.63+n.x*side*.2,q.y+.079,q.z+t.z*.63+n.z*side*.2);head.rotation.y=base+side*.52;trackGroup.add(head)}}
  for(let i=0;i<TRACK_N;i+=8)for(const side of[-1,1]){const q=track[i].clone().addScaledVector(normals[i],side*(HALF_WIDTH+.18)),t=tangents[i],curb=new THREE.Mesh(new THREE.BoxGeometry(.34,.045,1.15),new THREE.MeshBasicMaterial({color:(Math.floor(i/8)%2)?0xf2f2ee:0xc84f4f}));curb.position.set(q.x,q.y+.065,q.z);curb.rotation.y=-Math.atan2(t.z,t.x)+Math.PI/2;trackGroup.add(curb)}
  for(let i=0;i<TRACK_N;i+=treeEvery)for(const side of[-1,1]){const q=track[i].clone().addScaledVector(normals[i],side*(HALF_WIDTH+SHOULDER_WIDTH+treeOffset));if(activeTrackId==='figure8'&&q.y>1.4)continue;const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.24,1.5,7),new THREE.MeshStandardMaterial({color:0x5a412f}));trunk.position.set(q.x,q.y+.75,q.z);trunk.castShadow=true;trackGroup.add(trunk);const crown=new THREE.Mesh(new THREE.ConeGeometry(1,2.4,8),new THREE.MeshStandardMaterial({color:0x2e6a3c}));crown.position.set(q.x,q.y+2.35,q.z);crown.castShadow=true;trackGroup.add(crown)}
  const q=track[finishIndex],t=tangents[finishIndex],line=new THREE.Mesh(new THREE.BoxGeometry(HALF_WIDTH*2,.035,.45),new THREE.MeshBasicMaterial({color:0xffffff}));line.position.set(q.x,q.y+.09,q.z);line.rotation.y=-Math.atan2(t.z,t.x)+Math.PI/2;trackGroup.add(line);
}
buildTrack('mixed');
