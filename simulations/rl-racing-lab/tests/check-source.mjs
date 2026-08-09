import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const jsDir = path.join(root, 'src', 'js');
const jsFiles = (await readdir(jsDir))
  .filter(name => name.endsWith('.js'))
  .sort()
  .map(name => path.join(jsDir, name));

let failed = false;
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failed = true;
    console.error(`\nSyntax check failed: ${path.relative(root, file)}`);
    console.error(result.stderr || result.stdout);
  }
}

// Classic scripts share a browser-global lexical environment, while HTML ids may also
// appear as named window properties. The dangerous case is an earlier script reading a
// name before the later script that declares the intended global has executed.
const classicOrder = [
  'version.js','vehicle-dynamics.js','learning-contract.js','state.js','track-layouts.js','scene.js','tracks.js','cars.js','effects.js','model.js','perception.js',
  'simulation.js','physics.js','session.js','training.js','experiments.js','race.js','brain-viz.js',
  'audio.js','ui.js','runtime.js'
];
const classicSources = new Map();
for (const name of classicOrder) {
  classicSources.set(name, await readFile(path.join(jsDir, name), 'utf8'));
}

// Training-affecting randomness must use the saved experiment streams. Presentation-only effects/audio are intentionally excluded.
for (const name of ['vehicle-dynamics.js','track-layouts.js','tracks.js','cars.js','model.js','simulation.js','physics.js','training.js']) {
  if (!/\bMath\.random\b/.test(classicSources.get(name))) continue;
  failed = true;
  console.error(`\nDeterminism violation: ${name} uses Math.random instead of experimentRandom().`);
}

// Neural camera geometry is part of the observation contract: keep it wide, low-biased, and actually wired into rendering.
const sceneSource = classicSources.get('scene.js'), perceptionSource = classicSources.get('perception.js');
if (!sceneSource.includes('NEURAL_CAMERA_VERTICAL_FOV') || !perceptionSource.includes('NEURAL_CAMERA_HEIGHT') || !perceptionSource.includes('NEURAL_CAMERA_LOOK_AHEAD') || !perceptionSource.includes('NEURAL_CAMERA_LOOK_HEIGHT')) {
  failed = true;
  console.error('\nWide neural-camera configuration is not wired into scene/perception.');
}
const learningContractSource = classicSources.get('learning-contract.js');
const learningContext = vm.createContext({});
try {
  vm.runInContext(`${learningContractSource}\nglobalThis.__learningProbe={rewardVersion:REWARD_CONTRACT_VERSION,trainerVersion:TRAINER_VERSION,road:forwardProgressReward(10,'road'),shoulder:forwardProgressReward(10,'shoulder'),grass:forwardProgressReward(10,'grass'),backward:backwardProgressPenalty(-10),grassTime:surfaceTimePenalty('grass',1),temperature0:explorationTemperatureForExperience(0),temperature512:explorationTemperatureForExperience(512),reset1:cleanResetExperienceInterval(1),reset8:cleanResetExperienceInterval(8)};`,learningContext);
  const p=learningContext.__learningProbe,divisible=[256,512,1024].every(batch=>p.reset1%batch===0&&p.reset8%batch===0);
  if(!p||p.rewardVersion!==2||p.trainerVersion!==2||Math.abs(p.road-.75)>1e-9||Math.abs(p.shoulder-.3375)>1e-9||p.grass!==0||Math.abs(p.backward+1.6)>1e-9||Math.abs(p.grassTime+.18)>1e-9||Math.abs(p.temperature0-1.35)>1e-9||Math.abs(p.temperature512-1.345)>1e-9||p.reset1!==2048||p.reset8!==16384||!divisible){failed=true;console.error('\nLearning-contract execution check failed:',p)}
} catch(error){failed=true;console.error('\nLearning-contract execution check threw:',error)}
const physicsSource=classicSources.get('physics.js'),trainingSource=classicSources.get('training.js'),simulationSource=classicSources.get('simulation.js');
if(physicsSource.includes('pendingReward+=15')||!physicsSource.includes('nextLapProgress')||!physicsSource.includes('if(car.pendingDone)return')||trainingSource.includes('sim.update*.005')||!trainingSource.includes('Number(e.temperature)')||!trainingSource.includes('/temperature')||!simulationSource.includes('temperature:car.lastTemperature')||!simulationSource.includes('performLearningUpdate();return}drivers.forEach(chooseAction)')||[...classicSources.values()].some(source=>source.includes('updatesSinceGridReset'))){failed=true;console.error('\nLearning-contract source invariant failed: lap/terminal/schedule/per-transition-temperature/action-boundary guard drifted.')}
// Execute the pure v1.0 sim-cade vehicle model: acceleration/shifts, braking, grip differences,
// slide recovery, observation bounds, and long-run finite state.
const vehicleDynamicsSource = classicSources.get('vehicle-dynamics.js');
const vehicleContext = vm.createContext({});
try {
  vm.runInContext(`${vehicleDynamicsSource}
function __car(speed=0){const s={x:0,z:0,heading:0,vx:0,vz:0,damage:0,gear:1,shiftTimer:0,actionSteer:0,actionThrottle:0};vehicleResetMotion(s,speed);return s}
const straight=__car();for(let i=0;i<600;i++)stepVehicleDynamics(straight,{steer:0,throttle:1},'road',1/60);
const accelerated={speed:straight.speed,gear:straight.gear,slip:straight.slipAngle,rpm:straight.rpm};
for(let i=0;i<240;i++)stepVehicleDynamics(straight,{steer:0,throttle:-1},'road',1/60);const brakeSpeed=straight.speed;
const road=__car(20),grass=__car(20);for(let i=0;i<120;i++){stepVehicleDynamics(road,{steer:1,throttle:0},'road',1/60);stepVehicleDynamics(grass,{steer:1,throttle:0},'grass',1/60)}
const lowGear=__car(20),highGear=__car(20);lowGear.gear=2;highGear.gear=4;vehicleUpdateDerived(lowGear);vehicleUpdateDerived(highGear);for(let i=0;i<120;i++){stepVehicleDynamics(lowGear,{steer:0,throttle:0},'road',1/60);stepVehicleDynamics(highGear,{steer:0,throttle:0},'road',1/60)}
const slide=__car();slide.vx=18;slide.vz=6;vehicleUpdateDerived(slide);const slipBefore=Math.abs(slide.slipAngle);for(let i=0;i<180;i++)stepVehicleDynamics(slide,{steer:0,throttle:0},'road',1/60);const slipAfter=Math.abs(slide.slipAngle);
const senseCar=__car(40);senseCar.steerAngle=.29;const observation=vehicleObservationValues(senseCar);
const longRun=__car(8);for(let i=0;i<6000;i++){const phase=i%720,steer=phase<180?.65:phase<360?-.65:0,throttle=phase<540?1:0;stepVehicleDynamics(longRun,{steer,throttle},i%1200>980?'shoulder':'road',1/60)}
globalThis.__vehicleProbe={accelerated,brakeSpeed,roadHeading:Math.abs(road.heading),grassHeading:Math.abs(grass.heading),roadSlip:Math.abs(road.slipAngle),grassSlip:Math.abs(grass.slipAngle),lowGearCoast:lowGear.speed,highGearCoast:highGear.speed,slipBefore,slipAfter,observation,longRun:[longRun.x,longRun.z,longRun.vx,longRun.vz,longRun.heading,longRun.speed,longRun.yawRate,longRun.slipAngle]};`, vehicleContext);
  const p = vehicleContext.__vehicleProbe;
  const obs = Array.from(p?.observation || []);
  const finiteLongRun = Array.from(p?.longRun || []).every(Number.isFinite);
  if (!p || p.accelerated.speed < 20 || p.accelerated.gear < 2 || Math.abs(p.accelerated.slip) > .03 || p.brakeSpeed > 1 || p.roadHeading <= p.grassHeading * 1.15 || !(p.lowGearCoast < p.highGearCoast-.25) || p.slipAfter >= p.slipBefore * .4 || obs.length !== 11 || Math.abs(obs[0]-1) > 1e-6 || Math.abs(obs[10]-.5) > 1e-6 || obs.some(v => !Number.isFinite(v) || v < -1.000001 || v > 1.000001) || !finiteLongRun) {
    failed = true;
    console.error('\nVehicle-dynamics execution check failed:', p);
  }
} catch (error) {
  failed = true;
  console.error('\nVehicle-dynamics execution check threw:', error);
}

// Build every pure circuit definition and enforce the road-ribbon safety envelope.
const trackLayoutSource = classicSources.get('track-layouts.js');
const trackLayoutContext = vm.createContext({});
try {
  vm.runInContext(`${trackLayoutSource}\nglobalThis.__trackLayoutProbe={version:TRACK_LAYOUT_VERSION,stats:Object.fromEntries(Object.entries(TRACK_LAYOUT_STATS).map(([id,s])=>[id,{length:s.length,minRadius:s.minRadius,minClearance:s.minClearance,minSegment:s.minSegment,maxSegment:s.maxSegment,averageSegment:s.averageSegment}]))};`, trackLayoutContext);
  const probe = trackLayoutContext.__trackLayoutProbe;
  const expected = ['mixed','reverse','technical','sweepers','figure8','grandprix'];
  const stats = probe?.stats || {};
  const invalid = expected.filter(id => !stats[id] || stats[id].minRadius < 18 || stats[id].minClearance < 15 || stats[id].maxSegment > stats[id].averageSegment * 1.08 || stats[id].minSegment < stats[id].averageSegment * .92);
  if (probe?.version !== 2 || invalid.length || Number(stats.mixed?.length) < 450 || Number(stats.grandprix?.length) < 900 || Number(stats.grandprix?.length) < Number(stats.mixed?.length) * 1.8) {
    failed = true;
    console.error(`\nTrack-layout validation failed${invalid.length ? ` for: ${invalid.join(', ')}` : ''}.`);
  }
} catch (error) {
  failed = true;
  console.error('\nTrack-layout execution check failed:', error);
}

// Shared state and model checks run with the vehicle observation contract loaded first,
// matching browser classic-script order.
const stateSource = classicSources.get('state.js');
const rngContext = vm.createContext({ performance });
try {
  vm.runInContext(`${vehicleDynamicsSource}\n${learningContractSource}\n${stateSource}\nresetExperimentRng(123456789);const a=[experimentRandom('init'),experimentRandom('policy'),experimentRandom('shuffle')];resetExperimentRng(123456789);const b=[experimentRandom('init'),experimentRandom('policy'),experimentRandom('shuffle')];resetExperimentRng(123456789);const policyBefore=experimentRandom('policy');resetExperimentRng(123456789);for(let i=0;i<250;i++)experimentRandom('init');const policyAfter=experimentRandom('policy');globalThis.__rngProbe={a,b,policyBefore,policyAfter,inputs:INPUTS,visualInputs:VISUAL_INPUTS,senses:VEHICLE_SENSE_COUNT,observationVersion:VEHICLE_OBSERVATION_VERSION,vision:[VISION_PRESETS.gray32.w,VISION_PRESETS.gray32.h,VISION_PRESETS.gray64.w,VISION_PRESETS.gray64.h,VISION_PRESETS.rgb32.w,VISION_PRESETS.rgb32.h,VISION_PRESETS.rgb64.w,VISION_PRESETS.rgb64.h],visualCounts:[VISION_PRESETS.gray32.w*VISION_PRESETS.gray32.h*VISION_PRESETS.gray32.channels,VISION_PRESETS.gray64.w*VISION_PRESETS.gray64.h*VISION_PRESETS.gray64.channels,VISION_PRESETS.rgb32.w*VISION_PRESETS.rgb32.h*VISION_PRESETS.rgb32.channels,VISION_PRESETS.rgb64.w*VISION_PRESETS.rgb64.h*VISION_PRESETS.rgb64.channels],camera:[NEURAL_CAMERA_VERTICAL_FOV,NEURAL_CAMERA_HEIGHT,NEURAL_CAMERA_LOOK_AHEAD,NEURAL_CAMERA_LOOK_HEIGHT]};`, rngContext);
  const probe = rngContext.__rngProbe;
  if (!probe || probe.inputs !== 651 || probe.visualInputs !== 640 || probe.senses !== 11 || probe.observationVersion !== 4 || JSON.stringify(probe.vision) !== JSON.stringify([40,16,80,32,40,16,80,32]) || JSON.stringify(probe.visualCounts) !== JSON.stringify([640,2560,1920,7680]) || JSON.stringify(probe.camera) !== JSON.stringify([52,1.38,14,.05]) || probe.a.some((value,index) => value !== probe.b[index]) || probe.policyBefore !== probe.policyAfter) {
    failed = true;
    console.error('\nDeterminism/observation-contract violation:', probe);
  }
} catch (error) {
  failed = true;
  console.error('\nSeeded RNG execution check failed:', error);
}

const modelContext = vm.createContext({ performance });
try {
  vm.runInContext(`${vehicleDynamicsSource}\n${stateSource}\n${classicSources.get('model.js')}
resetExperimentRng(424242);const n1=createNetwork();resetExperimentRng(424242);const n2=createNetwork();resetExperimentRng(424243);const n3=createNetwork();const w1=Array.from(n1.layers[0].w.slice(0,32)),w2=Array.from(n2.layers[0].w.slice(0,32)),w3=Array.from(n3.layers[0].w.slice(0,32));
const visual=640,oldInputs=642,previousInputs=650,outputs=48,oldW=new Float32Array(oldInputs*outputs),oldB=new Float32Array(outputs);for(let j=0;j<outputs;j++){oldW[j*oldInputs+17]=17+j;oldW[j*oldInputs+visual]=100+j;oldW[j*oldInputs+visual+1]=200+j}
const current=networkSnapshot(n1),legacy={kind:'mlp',config:{visionId:'gray32',networkId:'baseline'},layers:[{inputSize:oldInputs,outputSize:outputs,w:oldW,b:oldB}],policy:current.policy,value:current.value},migrated=networkFromSnapshot(legacy),first=migrated.layers[0];let migrationOk=first.inputSize===651;
for(let j=0;j<outputs&&migrationOk;j++){const base=j*651;migrationOk=first.w[base+17]===17+j&&first.w[base+visual+VEHICLE_SENSE_INDEX.speed]===100+j&&first.w[base+visual+VEHICLE_SENSE_INDEX.damage]===200+j;for(let k=0;k<VEHICLE_SENSE_COUNT&&migrationOk;k++)if(k!==VEHICLE_SENSE_INDEX.speed&&k!==VEHICLE_SENSE_INDEX.damage)migrationOk=first.w[base+visual+k]===0}
const previousW=new Float32Array(previousInputs*outputs);for(let j=0;j<outputs;j++)for(let i=0;i<previousInputs;i++)previousW[j*previousInputs+i]=j*1000+i;const previous={kind:'mlp',config:{visionId:'gray32',networkId:'baseline'},layers:[{inputSize:previousInputs,outputSize:outputs,w:previousW,b:oldB}],policy:current.policy,value:current.value},previousMigrated=networkFromSnapshot(previous),previousFirst=previousMigrated.layers[0];let previousMigrationOk=previousFirst.inputSize===651;for(let j=0;j<outputs&&previousMigrationOk;j++){const oldBase=j*previousInputs,newBase=j*651;for(let i=0;i<previousInputs&&previousMigrationOk;i++)previousMigrationOk=previousFirst.w[newBase+i]===previousW[oldBase+i];previousMigrationOk=previousMigrationOk&&previousFirst.w[newBase+650]===0}
globalThis.__networkProbe={same:w1.every((v,i)=>v===w2[i]),different:w1.some((v,i)=>v!==w3[i]),migrationOk,previousMigrationOk};`, modelContext);
  if (!modelContext.__networkProbe?.same || !modelContext.__networkProbe?.different || !modelContext.__networkProbe?.migrationOk || !modelContext.__networkProbe?.previousMigrationOk) {
    failed = true;
    console.error('\nSeeded network / legacy-input migration check failed:', modelContext.__networkProbe);
  }
} catch (error) {
  failed = true;
  console.error('\nSeeded network / migration execution check failed:', error);
}

// Shared display helpers used by several later scripts must live in the first shared state layer.
for (const helper of ['formatDuration','compactNumber','formatBytes','formatMs']) {
  const pattern = new RegExp(`function\\s+${helper}\\s*\\(`);
  if (pattern.test(stateSource)) continue;
  failed = true;
  console.error(`\nShared-helper load-order violation: ${helper} must be declared in state.js.`);
}

const declarations = new Map();
const declaration = /^(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*))/gm;
for (const [index, name] of classicOrder.entries()) {
  for (const match of classicSources.get(name).matchAll(declaration)) {
    const identifier = match[1] || match[2];
    if (!declarations.has(identifier)) declarations.set(identifier, []);
    declarations.get(identifier).push({ index, file: name });
  }
}

const htmlFiles = [path.join(root, 'simulator.html'), path.join(root, 'src', 'index.html')];
for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, 'utf8');
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
  for (const id of ids) {
    const defs = declarations.get(id) || [];
    for (const def of defs) {
      const referencePattern = new RegExp(`\\b${id.replace(/[$]/g, '\\$&')}\\b`);
      const earlier = classicOrder.slice(0, def.index).find(name => referencePattern.test(classicSources.get(name)));
      if (!earlier) continue;
      failed = true;
      console.error(`\nPre-declaration DOM/global hazard: id="${id}" in ${path.relative(root, htmlFile)}`);
      console.error(`  ${earlier} references ${id} before ${def.file} declares the intended global.`);
    }
  }
}

if (failed) process.exit(1);
console.log(`Source checks passed: ${jsFiles.length} JavaScript files parsed; O4 observations/migrations + R2/A2 learning contract validated; vehicle dynamics and all track layouts validated; deterministic learning path guarded; shared helpers are early; no pre-declaration HTML-id/global hazards found.`);
