// Per-car configurable grayscale/RGB POV cameras and vehicle-local speed/damage telemetry.
function configurePOVCamera(car,camera){const f=new THREE.Vector3(Math.cos(car.heading),0,Math.sin(car.heading)),roadY=surfaceHeightForCar(car);camera.position.set(car.x+f.x*.7,roadY+1.48,car.z+f.z*.7);camera.lookAt(car.x+f.x*15,roadY+.38,car.z+f.z*15)}
function captureObservation(car){
  const camera=observerCameras[car.id],rt=renderTargets[car.id];configurePOVCamera(car,camera);const wasVisible=car.mesh.visible;car.mesh.visible=false;renderer.setRenderTarget(rt);renderer.render(scene,camera);renderer.readRenderTargetPixels(rt,0,0,RENDER_W,RENDER_H,pixelBuffer);renderer.setRenderTarget(null);car.mesh.visible=wasVisible;
  const obs=new Float32Array(INPUTS),needed=OBS_W*OBS_H*4;if(!car.latestRGBA||car.latestRGBA.length!==needed)car.latestRGBA=new Uint8ClampedArray(needed);const rgba=car.latestRGBA,area=OBS_SCALE*OBS_SCALE;
  for(let y=0;y<OBS_H;y++)for(let x=0;x<OBS_W;x++){
    let r=0,g=0,b=0;for(let oy=0;oy<OBS_SCALE;oy++)for(let ox=0;ox<OBS_SCALE;ox++){const renderY=RENDER_H-1-(y*OBS_SCALE+oy),renderX=x*OBS_SCALE+ox,src=(renderY*RENDER_W+renderX)*4;r+=pixelBuffer[src];g+=pixelBuffer[src+1];b+=pixelBuffer[src+2]}r/=255*area;g/=255*area;b/=255*area;const pixel=y*OBS_W+x,dst=pixel*4;
    if(CHANNELS===1){const gray=.299*r+.587*g+.114*b,gv=Math.round(gray*255);obs[pixel]=gray*2-1;rgba[dst]=gv;rgba[dst+1]=gv;rgba[dst+2]=gv}else{const base=pixel*3;obs[base]=r*2-1;obs[base+1]=g*2-1;obs[base+2]=b*2-1;rgba[dst]=Math.round(r*255);rgba[dst+1]=Math.round(g*255);rgba[dst+2]=Math.round(b*255)}rgba[dst+3]=255;
  }
  obs[VISUAL_INPUTS]=clamp(car.speed/22,0,1)*2-1;obs[VISUAL_INPUTS+1]=clamp(car.damage/100,0,1)*2-1;return obs;
}
function primeObservations(){for(const car of drivers)captureObservation(car)}
function drawPreview(canvas,rgba){if(!canvas||!rgba)return;canvas.width=OBS_W;canvas.height=OBS_H;const ctx=canvas.getContext('2d'),image=ctx.createImageData(OBS_W,OBS_H);image.data.set(rgba);ctx.putImageData(image,0,0)}
