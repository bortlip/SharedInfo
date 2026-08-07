// Circuit definitions, track geometry, and dynamic track construction.
const HALF_WIDTH=5.4;
const TRACK_DEFS={
  mixed:{name:'Balanced Loop',n:320,make:(a)=>new THREE.Vector3(Math.cos(a)*(35+4.2*Math.sin(2*a)+2*Math.cos(3*a)),0,Math.sin(a)*(24+3.2*Math.cos(3*a)-1.5*Math.sin(2*a)))},
  reverse:{name:'Counterflow',n:320,reverse:true,make:(a)=>new THREE.Vector3(Math.cos(a)*(35+4.2*Math.sin(2*a)+2*Math.cos(3*a)),0,Math.sin(a)*(24+3.2*Math.cos(3*a)-1.5*Math.sin(2*a)))},
  technical:{name:'Technical Circuit',n:360,make:(a)=>new THREE.Vector3(Math.cos(a)*(30+6*Math.sin(3*a)+3*Math.cos(5*a)),0,Math.sin(a)*(21+5*Math.cos(4*a)+2*Math.sin(6*a)))},
  sweepers:{name:'Fast Sweepers',n:360,make:(a)=>new THREE.Vector3(Math.cos(a)*(44+5*Math.cos(2*a)),0,Math.sin(a)*(29+4*Math.sin(2*a)))},
  figure8:{name:'Figure Eight Overpass',n:420,make:(a)=>new THREE.Vector3(35*Math.sin(a),2.75*(1+Math.cos(a)),21*Math.sin(2*a))},
  grandprix:{name:'Grand Prix',n:520,make:(a)=>new THREE.Vector3(60*Math.cos(a)+12*Math.cos(2*a)+5*Math.sin(5*a),0,38*Math.sin(a)+8*Math.sin(3*a)+5*Math.cos(4*a))}
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
    const q=track[i].clone().addScaledVector(normals[i],side*(HALF_WIDTH+3.2));if(activeTrackId==='figure8'&&q.y>1.4)continue;
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.24,1.5,7),new THREE.MeshStandardMaterial({color:0x5a412f}));trunk.position.set(q.x,q.y+.75,q.z);trunk.castShadow=true;trackGroup.add(trunk);
    const crown=new THREE.Mesh(new THREE.ConeGeometry(1,2.4,8),new THREE.MeshStandardMaterial({color:0x2e6a3c}));crown.position.set(q.x,q.y+2.35,q.z);crown.castShadow=true;trackGroup.add(crown);
  }
  const q=track[finishIndex],t=tangents[finishIndex],line=new THREE.Mesh(new THREE.BoxGeometry(HALF_WIDTH*2,.035,.45),new THREE.MeshBasicMaterial({color:0xffffff}));
  line.position.set(q.x,q.y+.09,q.z);line.rotation.y=-Math.atan2(t.z,t.x)+Math.PI/2;trackGroup.add(line);
}
buildTrack('mixed');
