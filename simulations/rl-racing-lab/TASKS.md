# POV RL Racing Lab — Work Plan

This is the single living checklist for the lab. Keep it short, move finished work to **Done**, and update it with each release so the repository—not old chat history—is the source of truth.

## Next — v0.9 Experiment Lab

- [ ] Add a small CNN vision brain so higher-resolution/color input can be compared with dense MLPs efficiently.
- [ ] Add side-by-side experiment comparison across saved brains and training runs.
- [ ] Add brain-vs-brain / garage races where the four cars can use different saved policies.
- [ ] Add ghost comparison against an older checkpoint/brain.
- [ ] Add tournament mode across saved brains and unseen tracks.
- [ ] Add explicit experiment seeds/reproducible RNG so architecture comparisons can use matched random conditions.
- [ ] Add curriculum training: advance through selected tracks when performance thresholds are met.

## Later — v1.0 Vehicle Dynamics

- [ ] Restore true world velocity and lateral momentum rather than scalar-speed-only motion.
- [ ] Add tire grip, slip angle, yaw rate, understeer/oversteer, recoverable slides, and meaningful grass/wet-surface grip.
- [ ] Give the policy fair vehicle-local proprioception when those dynamics exist: speed, slip angle/lateral velocity, yaw rate, previous steering, previous throttle/brake, damage, possibly lateral acceleration.
- [ ] Add tire scrub/skid audio and richer engine/gear behavior tied to the new dynamics.
- [ ] Compare vision-only against vision + vehicle senses.

## Later experiments / fun

- [ ] Distribution-shift tests: wet track, dusk/night, fog, changed scenery/markings.
- [ ] Generalization score across tracks the brain did not train on.
- [ ] More track layouts and generated circuits.
- [ ] Better race presentation: start lights, lap board, podium/results history, optional replay/ghost traces.
- [ ] More interpretability views where useful: CNN feature maps, weight-change summaries, PPO entropy/KL/clip diagnostics.

## Done

### v0.8.1 Persistence + brain library cleanup

- [x] Normalize IndexedDB into separate `sessions` metadata and `brains` stores, with `sessionId` index.
- [x] Automatically migrate existing v0.8 embedded-brain session records during the IndexedDB v1→v2 upgrade.
- [x] Autosave the active brain plus small session metadata rather than rewriting every brain on each update.
- [x] Show architecture cost per brain: parameter count, approximate Float32 tensor size, and forward-pass MAC count.
- [x] Measure and persist actual last/average PPO optimizer time for each brain on the current machine.
- [x] Show origin storage usage/quota and best-effort vs persistent-storage status; allow requesting persistent storage when supported.
- [x] Add per-brain Export/Delete actions, guarded current-session deletion, and guarded Clear All Local Data.
- [x] Keep complete-session Export/Import portable and independent of the internal IndexedDB schema.
- [x] Remove the browser named-property collision between the training-log DOM id and the global `log()` helper that could abort startup with `log is not a function`.
- [x] Route startup/initialization/runtime/promise failures through one detailed on-page diagnostics panel with stack/source/version information and Copy Diagnostics.

### v0.8 Brain Lab + sessions

- [x] Keep **Pause learning** visible during PPO/backprop; a pause requested during PPO takes effect after the safe update boundary.
- [x] Configurable new-brain vision: 32×20 gray, 64×40 gray, 32×20 RGB, 64×40 RGB.
- [x] Configurable dense MLPs: Baseline 48, Wide 128, Deep 96→48, Deep+Wide 128→64.
- [x] Show derived input/layer sizes, trainable parameter count, and browser-workload warning before creation.
- [x] Live selected-driver Brain Inspector: neural image, hidden activations, all action probabilities, chosen action, value, temperature, entropy.
- [x] Mathematical chosen-action input-sensitivity/saliency heat map.
- [x] Named **sessions** containing multiple named brains and experiment history.
- [x] Record brain architecture, update/experience history, track-training segments, best run, and evaluation races.
- [x] IndexedDB autosave plus most-recent-session restore; localStorage only remembers the last session id.
- [x] New Session, New Brain, Duplicate Brain, switch/load brain, and rename brain/session controls.
- [x] Individual brain Export/Import plus **Export All / Import All** complete-session backup.
- [x] Compatible legacy v1/v2/v3 checkpoint import into baseline brains.
- [x] Synthesized engine audio and collision sound with explicit Sound on/off.
- [x] Preserve v0.7 Learning/Race modes, dual progress charts, safe high-speed scheduler, and presentation-only headless semantics.

### Earlier foundation

- [x] Browser-rendered POV observations drive the policy; no track-coordinate oracle is supplied.
- [x] Shared actor-critic/PPO learner with backpropagation.
- [x] Proven baseline learner restored after the earlier regression.
- [x] Chronological 1×/2×/4×/10×/50× scheduling and presentation-only headless mode.
- [x] Complete training timeline plus recent-driving chart.
- [x] Selectable training tracks and adaptive/fixed clean-start cadence.
- [x] Explicit Learning and Evaluation Race modes.
- [x] Asphalt/shoulder/grass presentation, surface handling, direction arrows, and human-facing wrong-way telemetry.
- [x] Oriented car collision footprints with stronger impact handling.
