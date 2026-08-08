// Three.js renderer, cameras, lighting, base environment, and resizeable neural POV render targets.
const scene=new THREE.Scene();scene.background=new THREE.Color(0x9ec3d1);scene.fog=new THREE.Fog(0x9ec3d1,45,115);
const container=$('scene'),renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;container.appendChild(renderer.domElement);
const mainCamera=new THREE.PerspectiveCamera(58,1,.1,300),observerCameras=[],renderTargets=[];let pixelBuffer=new Uint8Array(1);
function rebuildPerceptionResources(){
  while(observerCameras.length<DRIVER_COUNT)observerCameras.push(new THREE.PerspectiveCamera(66,OBS_W/OBS_H,.08,90));
  for(const camera of observerCameras){camera.aspect=OBS_W/OBS_H;camera.updateProjectionMatrix()}
  for(const rt of renderTargets)rt.dispose?.();renderTargets.length=0;
  for(let i=0;i<DRIVER_COUNT;i++){const rt=new THREE.WebGLRenderTarget(RENDER_W,RENDER_H,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true});rt.texture.colorSpace=THREE.SRGBColorSpace;renderTargets.push(rt)}
  pixelBuffer=new Uint8Array(RENDER_W*RENDER_H*4);if(typeof drivers!=='undefined'&&Array.isArray(drivers))drivers.forEach(c=>{c.latestRGBA=null;c.lastObs=null;c.lastForward=null});
}
rebuildPerceptionResources();
scene.add(new THREE.HemisphereLight(0xdff5ff,0x56603f,2));
const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(25,45,18);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-70;sun.shadow.camera.right=70;sun.shadow.camera.top=70;sun.shadow.camera.bottom=-70;scene.add(sun);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshStandardMaterial({color:0x355f36,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.035;ground.receiveShadow=true;scene.add(ground);
