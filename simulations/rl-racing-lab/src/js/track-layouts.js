// Pure track-layout definitions and geometry generation. No renderer/browser state is required here.
const TRACK_LAYOUT_VERSION=3;
const HALF_WIDTH=5.4,SHOULDER_WIDTH=1.25;
const TRACK_SAMPLE_SPACING=1.5,TRACK_DENSE_STEP=.45,TRACK_MIN_RADIUS=18,TRACK_MIN_CLEARANCE=15,TRACK_NONLOCAL_ARC_SKIP=40,TRACK_ELEVATION_CLEARANCE=2.5;
const trackWaypoint=(x,z,round=28,y=0)=>({x,y,z,round});
const TRACK_DEFS={
  mixed:{name:'Balanced Loop',startHint:[0,-42],waypoints:[trackWaypoint(-85,-42,28),trackWaypoint(70,-42,30),trackWaypoint(92,-18,28),trackWaypoint(88,35,30),trackWaypoint(55,58,30),trackWaypoint(-55,58,30),trackWaypoint(-92,28,30)]},
  reverse:{name:'Counterflow',source:'mixed',reverse:true},
  technical:{name:'Technical Circuit',startHint:[-20,-55],waypoints:[trackWaypoint(-105,-55,30),trackWaypoint(10,-55,26),trackWaypoint(75,-48,28),trackWaypoint(112,-15,26),trackWaypoint(105,32,24),trackWaypoint(70,55,22),trackWaypoint(30,48,20),trackWaypoint(2,72,20),trackWaypoint(-45,72,25),trackWaypoint(-92,45,28),trackWaypoint(-118,5,28)]},
  sweepers:{name:'Fast Sweepers',startHint:[0,-55],waypoints:[trackWaypoint(-125,-55,35),trackWaypoint(90,-55,40),trackWaypoint(135,-15,42),trackWaypoint(126,48,40),trackWaypoint(70,78,45),trackWaypoint(-80,78,45),trackWaypoint(-135,35,42)]},
  figure8:{name:'Figure Eight Overpass',startHint:[-62,-48],waypoints:[trackWaypoint(0,0,24,0),trackWaypoint(-62,-48,30,0),trackWaypoint(-108,0,34,0),trackWaypoint(-62,48,30,0),trackWaypoint(0,0,24,6),trackWaypoint(62,-48,30,6),trackWaypoint(108,0,34,6),trackWaypoint(62,48,30,6)]},
  grandprix:{name:'Grand Prix',startHint:[0,-70],waypoints:[trackWaypoint(-170,-70,38),trackWaypoint(95,-70,45),trackWaypoint(155,-55,38),trackWaypoint(192,-20,36),trackWaypoint(195,30,36),trackWaypoint(168,68,36),trackWaypoint(118,90,36),trackWaypoint(62,96,30),trackWaypoint(22,80,24),trackWaypoint(-8,62,24),trackWaypoint(-42,82,24),trackWaypoint(-92,94,32),trackWaypoint(-148,76,38),trackWaypoint(-190,40,40),trackWaypoint(-208,-8,38),trackWaypoint(-198,-45,34)]},
  endurance:{name:'Endurance Ring',startHint:[0,-110],waypoints:[trackWaypoint(-260,-110,52),trackWaypoint(160,-110,58),trackWaypoint(265,-72,54),trackWaypoint(318,18,52),trackWaypoint(305,132,58),trackWaypoint(222,208,60),trackWaypoint(72,238,62),trackWaypoint(-112,232,58),trackWaypoint(-238,178,58),trackWaypoint(-310,82,56),trackWaypoint(-322,-22,52)]},
  longrun:{name:'Long Run Circuit',startHint:[0,-145],waypoints:[trackWaypoint(-340,-145,68),trackWaypoint(185,-145,72),trackWaypoint(335,-96,68),trackWaypoint(395,18,64),trackWaypoint(382,164,72),trackWaypoint(272,274,74),trackWaypoint(82,320,78),trackWaypoint(-124,304,74),trackWaypoint(-282,224,70),trackWaypoint(-392,102,68),trackWaypoint(-425,-32,64)]}
};
function trackPointDistance(a,b){return Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)}
function trackPointDistanceXZ(a,b){return Math.hypot(b.x-a.x,b.z-a.z)}
function trackLerp(a,b,t){return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t}}
function trackQuadratic(a,c,b,t){const u=1-t;return{x:u*u*a.x+2*u*t*c.x+t*t*b.x,y:u*u*a.y+2*u*t*c.y+t*t*b.y,z:u*u*a.z+2*u*t*c.z+t*t*b.z}}
function resolvedTrackDefinition(id){const requested=TRACK_DEFS[id]||TRACK_DEFS.mixed,source=requested.source?TRACK_DEFS[requested.source]:requested;if(!source?.waypoints?.length)throw new Error(`Track ${id} has no waypoint definition.`);return{...source,...requested,waypoints:source.waypoints.map(p=>({...p})),startHint:requested.startHint||source.startHint}}
function roundedTrackDensePoints(waypoints){
  if(!Array.isArray(waypoints)||waypoints.length<4)throw new Error('A closed racing circuit needs at least four waypoints.');
  const corners=waypoints.map((current,i)=>{const previous=waypoints[modTrackIndex(i-1,waypoints.length)],next=waypoints[(i+1)%waypoints.length],prevLength=trackPointDistance(previous,current),nextLength=trackPointDistance(current,next);if(prevLength<1||nextLength<1)throw new Error(`Track waypoint ${i} is too close to a neighbor.`);const cut=Math.min(Math.max(2,Number(current.round)||28),prevLength*.42,nextLength*.42),entry=trackLerp(current,previous,cut/prevLength),exit=trackLerp(current,next,cut/nextLength);return{entry,control:current,exit}}),dense=[];
  for(let i=0;i<corners.length;i++){
    const previous=corners[modTrackIndex(i-1,corners.length)],corner=corners[i],lineLength=trackPointDistance(previous.exit,corner.entry),lineSteps=Math.max(1,Math.ceil(lineLength/TRACK_DENSE_STEP));
    for(let step=0;step<lineSteps;step++)dense.push(trackLerp(previous.exit,corner.entry,step/lineSteps));
    const curveLength=trackPointDistance(corner.entry,corner.control)+trackPointDistance(corner.control,corner.exit),curveSteps=Math.max(4,Math.ceil(curveLength/TRACK_DENSE_STEP));
    for(let step=0;step<curveSteps;step++)dense.push(trackQuadratic(corner.entry,corner.control,corner.exit,step/curveSteps));
  }
  return dense;
}
function modTrackIndex(n,m){return((n%m)+m)%m}
function resampleClosedTrack(dense,spacing=TRACK_SAMPLE_SPACING){
  const lengths=new Array(dense.length),cumulative=new Array(dense.length+1).fill(0);let total=0;
  for(let i=0;i<dense.length;i++){const length=trackPointDistance(dense[i],dense[(i+1)%dense.length]);lengths[i]=length;total+=length;cumulative[i+1]=total}
  const count=Math.max(120,Math.round(total/spacing)),samples=[];let segment=0;
  for(let i=0;i<count;i++){const target=i*total/count;while(segment<lengths.length-1&&cumulative[segment+1]<=target)segment++;const length=lengths[segment]||1,t=(target-cumulative[segment])/length;samples.push(trackLerp(dense[segment],dense[(segment+1)%dense.length],t))}
  return samples;
}
function rotateTrackSamples(samples,hint){if(!hint)return samples;let best=0,bestDistance=Infinity;for(let i=0;i<samples.length;i++){const d=Math.hypot(samples[i].x-hint[0],samples[i].z-hint[1]);if(d<bestDistance){best=i;bestDistance=d}}return samples.slice(best).concat(samples.slice(0,best))}
function mirrorTrackSamples(samples){return samples.map(p=>({...p,x:-p.x}))}
function buildTrackSamples(id,mirror=false){const def=resolvedTrackDefinition(id),dense=roundedTrackDensePoints(def.waypoints);let samples=rotateTrackSamples(resampleClosedTrack(dense),def.startHint);if(def.reverse&&samples.length>1)samples=[samples[0],...samples.slice(1).reverse()];if(mirror)samples=mirrorTrackSamples(samples);return samples}
function localTrackRadius(a,b,c){const ab=trackPointDistanceXZ(a,b),bc=trackPointDistanceXZ(b,c),ca=trackPointDistanceXZ(c,a),cross=Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x));return cross<1e-8?Infinity:ab*bc*ca/(2*cross)}
function trackGeometryStats(samples){
  const n=samples.length,segments=new Array(n),distances=new Array(n+1).fill(0);let length=0,minSegment=Infinity,maxSegment=0,maxGrade=0;
  for(let i=0;i<n;i++){const a=samples[i],b=samples[(i+1)%n],segment=trackPointDistance(a,b),horizontal=Math.max(1e-6,trackPointDistanceXZ(a,b));segments[i]=segment;length+=segment;distances[i+1]=length;minSegment=Math.min(minSegment,segment);maxSegment=Math.max(maxSegment,segment);maxGrade=Math.max(maxGrade,Math.abs(b.y-a.y)/horizontal)}
  let minRadius=Infinity;const radiusStep=3;for(let i=0;i<n;i++)minRadius=Math.min(minRadius,localTrackRadius(samples[modTrackIndex(i-radiusStep,n)],samples[i],samples[(i+radiusStep)%n]));
  let minClearance=Infinity;const average=length/n;for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const indexDelta=j-i,arcSeparation=Math.min(indexDelta,n-indexDelta)*average;if(arcSeparation<TRACK_NONLOCAL_ARC_SKIP||Math.abs(samples[i].y-samples[j].y)>TRACK_ELEVATION_CLEARANCE)continue;minClearance=Math.min(minClearance,trackPointDistanceXZ(samples[i],samples[j]))}
  return{length,count:n,averageSegment:average,minSegment,maxSegment,minRadius,minClearance,maxGrade};
}
function validateTrackDefinition(id,samples=buildTrackSamples(id)){
  const stats=trackGeometryStats(samples);
  if(stats.minRadius<TRACK_MIN_RADIUS)throw new Error(`${TRACK_DEFS[id]?.name||id} has a ${stats.minRadius.toFixed(1)}m centerline radius; minimum is ${TRACK_MIN_RADIUS}m.`);
  if(stats.minClearance<TRACK_MIN_CLEARANCE)throw new Error(`${TRACK_DEFS[id]?.name||id} has non-adjacent centerline clearance ${stats.minClearance.toFixed(1)}m; minimum is ${TRACK_MIN_CLEARANCE}m.`);
  if(stats.maxSegment>stats.averageSegment*1.08||stats.minSegment<stats.averageSegment*.92)throw new Error(`${TRACK_DEFS[id]?.name||id} centerline sampling is not sufficiently uniform.`);
  return stats;
}
const TRACK_LAYOUT_STATS={};for(const id of Object.keys(TRACK_DEFS))TRACK_LAYOUT_STATS[id]=validateTrackDefinition(id);
