// Web Audio engine voices, tire noise, sound controls, and impact audio.
'use strict';

async function ensureAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    setAudioStatus('Web Audio unavailable', true);
    return false;
  }
  if (!sim.audio.ctx) {
    const ac = new AudioContextClass();
    const master = ac.createGain();
    master.gain.value = 0;
    const compressor = ac.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.knee.value = 16;
    compressor.ratio.value = 6;
    master.connect(compressor).connect(ac.destination);
    sim.audio.ctx = ac;
    sim.audio.master = master;
    sim.audio.compressor = compressor;
    createTireNoise();
    rebuildEngineVoices();
  }
  try {
    await sim.audio.ctx.resume();
    sim.audio.enabled = true;
    const now = sim.audio.ctx.currentTime;
    sim.audio.master.gain.cancelScheduledValues(now);
    sim.audio.master.gain.setTargetAtTime(sim.audio.volume, now, .06);
    setAudioStatus('Audio running');
    $('soundBtn').textContent = '🔇 Mute';
    return true;
  } catch (error) {
    setAudioStatus('Audio blocked — click Test rev', true);
    return false;
  }
}

function setAudioStatus(text, error = false) {
  sim.audio.status = text;
  const el = $('audioStatus');
  if (el) {
    el.textContent = text;
    el.classList.toggle('audio-error', error);
  }
}

function createTireNoise() {
  const ac = sim.audio.ctx;
  if (!ac || sim.audio.tireSource) return;
  const length = ac.sampleRate * 2;
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const source = ac.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass'; filter.frequency.value = 1600; filter.Q.value = .7;
  const gain = ac.createGain(); gain.gain.value = 0;
  source.connect(filter).connect(gain).connect(sim.audio.master);
  source.start();
  sim.audio.tireSource = source;
  sim.audio.tireGain = gain;
}

function clearEngineVoices() {
  for (const voice of sim.audio.voices.values()) {
    try { voice.osc.stop(); } catch (_) { /* already stopped */ }
    try { voice.osc2.stop(); } catch (_) { /* already stopped */ }
    voice.osc.disconnect(); voice.osc2.disconnect(); voice.gain.disconnect();
  }
  sim.audio.voices.clear();
}

function rebuildEngineVoices() {
  const ac = sim.audio.ctx;
  if (!ac) return;
  clearEngineVoices();
  for (const car of sim.cars) {
    const osc = ac.createOscillator();
    const osc2 = ac.createOscillator();
    const filter = ac.createBiquadFilter();
    const gain = ac.createGain();
    const panner = ac.createStereoPanner();
    osc.type = 'sawtooth';
    osc2.type = 'square';
    osc.frequency.value = 60 + car.id * .6;
    osc2.frequency.value = 120 + car.id;
    filter.type = 'lowpass'; filter.frequency.value = 900; filter.Q.value = 1.1;
    gain.gain.value = 0;
    osc.connect(filter); osc2.connect(filter); filter.connect(gain).connect(panner).connect(sim.audio.master);
    osc.start(); osc2.start();
    sim.audio.voices.set(car.id, { osc, osc2, filter, gain, panner });
  }
}

function updateAudio() {
  const ac = sim.audio.ctx;
  if (!ac || !sim.audio.enabled) return;
  const now = ac.currentTime;
  let totalSlip = 0;
  for (const car of sim.cars) {
    const voice = sim.audio.voices.get(car.id);
    if (!voice) continue;
    const active = !car.removed && !car.parked;
    const rpm = 58 + car.speed * 1.15 + car.throttle * 42 + car.id * .9;
    const selectedBoost = car.id === sim.selectedId ? 1.8 : 1;
    const runningGain = active ? (0.0045 + car.throttle * .0085 + car.speed / 240 * .004) * selectedBoost : 0;
    const damageRattle = car.damage > 55 ? Math.sin(performance.now() * .035 + car.id) * 7 : 0;
    voice.osc.frequency.setTargetAtTime(Math.max(36, rpm + damageRattle), now, .035);
    voice.osc2.frequency.setTargetAtTime(Math.max(72, rpm * 1.96), now, .035);
    voice.filter.frequency.setTargetAtTime(500 + car.speed * 4.2 + car.throttle * 550, now, .05);
    voice.gain.gain.setTargetAtTime(sim.running ? runningGain : runningGain * .24, now, .05);
    voice.panner.pan.setTargetAtTime(clamp((car.x / WORLD_W) * 2 - 1, -1, 1), now, .08);
    totalSlip += Math.max(0, Math.abs(car.lateralSpeed) - 4) + (car.brake > .65 ? car.speed * .04 : 0);
  }
  if (sim.audio.tireGain) sim.audio.tireGain.gain.setTargetAtTime(clamp(totalSlip / 750, 0, .075), now, .035);
}

async function toggleSound() {
  if (!sim.audio.enabled) {
    await ensureAudio();
  } else {
    sim.audio.enabled = false;
    if (sim.audio.ctx && sim.audio.master) sim.audio.master.gain.setTargetAtTime(0, sim.audio.ctx.currentTime, .05);
    $('soundBtn').textContent = '🔊 Enable sound';
    setAudioStatus('Sound muted');
  }
}

async function testRev() {
  const ok = await ensureAudio();
  if (!ok) return;
  const ac = sim.audio.ctx;
  const osc = ac.createOscillator();
  const osc2 = ac.createOscillator();
  const filter = ac.createBiquadFilter();
  const gain = ac.createGain();
  osc.type = 'sawtooth'; osc2.type = 'square';
  filter.type = 'lowpass'; filter.Q.value = 1.2;
  const now = ac.currentTime;
  osc.frequency.setValueAtTime(72, now);
  osc2.frequency.exponentialRampToValueAtTime(250, now + .55);
  osc.frequency.exponentialRampToValueAtTime(95, now + 1.05);
  osc2.frequency.setValueAtTime(144, now);
  osc2.frequency.exponentialRampToValueAtTime(500, now + .55);
  osc2.frequency.exponentialRampToValueAtTime(190, now + 1.05);
  filter.frequency.setValueAtTime(650, now);
  filter.frequency.exponentialRampToValueAtTime(2100, now + .55);
  filter.frequency.exponentialRampToValueAtTime(850, now + 1.05);
  gain.gain.setValueAtTime(.0001, now);
  gain.gain.exponentialRampToValueAtTime(.22, now + .08);
  gain.gain.exponentialRampToValueAtTime(.0001, now + 1.12);
  osc.connect(filter); osc2.connect(filter); filter.connect(gain).connect(sim.audio.master);
  osc.start(now); osc2.start(now); osc.stop(now + 1.15); osc2.stop(now + 1.15);
  setAudioStatus('Test rev played');
}

function playImpactSound(strength) {
  const ac = sim.audio.ctx;
  if (!ac || !sim.audio.enabled) return;
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const filter = ac.createBiquadFilter();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(120 + clamp(strength, 0, 100), now);
  osc.frequency.exponentialRampToValueAtTime(38, now + .22);
  filter.type = 'lowpass'; filter.frequency.value = 720;
  gain.gain.setValueAtTime(clamp(strength / 260, .03, .28), now);
  gain.gain.exponentialRampToValueAtTime(.0001, now + .28);
  osc.connect(filter).connect(gain).connect(sim.audio.master);
  osc.start(now); osc.stop(now + .3);
}
