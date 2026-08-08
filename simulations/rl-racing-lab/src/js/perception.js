// Per-car POV cameras and the proven single-frame visual observation.
function configurePOVCamera(car,camera){
  const f=new THREE.Vector3(Math.cos(car.heading),0,Math.sin(car.heading)),roadY=surfaceHeightForCar(car);
  camera.position.set(car.x+f.x*.7,roadY+1.48,car.z+f.z*.7);camera.lookAt(car.x+f.x*15,roadY+.38,car.z+f.z*15);
}
function captureObservation(car){
  const camera=observerCameras[car.id],rt=renderTargets[car.id];configurePOVCamera(car,camera);
  const wasVisible=car.mesh.visible;car.mesh.visible=false;renderer.setRenderTarget(rt);renderer.render(scene,camera);renderer.readRenderTargetPixels(rt,0,0,RENDER_W,RENDER_H,pixelBuffer);renderer.setRenderTarget(null);car.mesh.visible=wasVisible;
  const obs=new Float32Array(INPUTS);if(!car.latestRGBA)car.latestRGBA=new Uint8ClampedArray(OBS_W*OBS_H*4);const rgba=car.latestRGBA;
  for(let y=0;y<OBS_H;y++)for(let x=0;x<OBS_W;x++){
    let total=0;for(let oy=0;oy<OBS_SCALE;oy++)for(let ox=0;ox<OBS_SCALE;ox++){const renderY=RENDER_H-1-(y*OBS_SCALE+oy),renderX=x*OBS_SCALE+ox,src=(renderY*RENDER_W+renderX)*4;total+=.299*pixelBuffer[src]+.587*pixelBuffer[src+1]+.114*pixelBuffer[src+2]}
    const gray=total/(255*OBS_SCALE*OBS_SCALE),i=y*OBS_W+x,dst=i*4,g=Math.round(gray*255);obs[i]=gray*2-1;rgba[dst]=g;rgba[dst+1]=g;rgba[dst+2]=g;rgba[dst+3]=255;
  }
  obs[PIXELS]=clamp(car.speed/22,0,1)*2-1;obs[PIXELS+1]=clamp(car.damage/100,0,1)*2-1;return obs;
}
function primeObservations(){for(const car of drivers)captureObservation(car)}
function drawPreview(canvas,rgba){if(!canvas||!rgba)return;const ctx=canvas.getContext('2d'),image=ctx.createImageData(OBS_W,OBS_H);image.data.set(rgba);ctx.putImageData(image,0,0)}
