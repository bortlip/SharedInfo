# POV RL Racing Lab — Work Plan

This is the single living checklist for the lab. Keep it short, move finished work to **Done**, and update it with each release so the repository—not old chat history—is the source of truth.

## Next — v0.9 Experiment Lab

- [ ] Add multi-brain arenas where cars can use different saved policies, both for frozen garage races and for independent co-training in the same physical world. Start with a common vision preset, then generalize heterogeneous observation shapes.
- [ ] Add a small CNN vision brain so higher-resolution/color input can be compared with dense MLPs efficiently.
- [ ] Add ghost comparison against an older checkpoint/brain.
- [ ] Add tournament mode across saved brains and unseen tracks.
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
- [ ] Add advanced learning controls/diagnostics after the current experiment foundation: gamma, GAE lambda, exploration/temperature schedule, entropy bonus, value-loss weight, gradient-norm clipping, PPO KL/clip diagnostics.

## Done

### v0.9.0 Reproducible experiment lab

- [x] Add visible per-brain experiment seeds with independent deterministic initialization, policy-sampling, and PPO-shuffle streams.
- [x] Persist/restore RNG continuation state, make Reset replay a v0.9 brain from its original seed, and mark older brains as deterministic-continuation-only rather than falsely replayable.
- [x] Add side-by-side experiment comparison from canonical saved brain histories at a matched experience budget or each brain's latest completed PPO update.
- [x] Show seed/config/performance/PPO-cost provenance and flag when compared brains do not share matched seeded-from-start conditions.
- [x] Reject direct `Math.random()` in training-affecting modules with the local source checker.

### v0.8.8 Direction cue + scenery impacts

- [x] Replace asphalt arrows/red-white curb blocks with repeating three-luminance edge strips whose order reverses when viewed backward.
- [x] Give tree trunks lightweight physical colliders with strong speed loss, damage, reward penalty, and impact sound.
- [x] Add bounded car/tree impact particles (sparks, body debris, smoke, wood, leaves, dust) that are hidden from neural POV observations and suppressed in headless learning.

### v0.8.7 Inspector + cameras + PPO experiment controls

- [x] Show sampled real network connections with learned weight strength and live signed contribution alongside node activations.
- [x] Add Chase, Driver POV, High chase, Helicopter, Trackside, Overhead follow, and Whole track spectator cameras without changing neural POV inputs.
- [x] Keep both progress charts and summary metrics live during headless training while suppressing expensive spectator/driver-card/inspector repainting.
- [x] Add per-brain PPO batch size, backprop pass count, learning rate, and clip-range experiment controls with historical defaults preserved.
- [x] Persist/restore PPO settings with each brain and record the active settings in update history/session events.

### v0.8.6 UI stability

- [x] Keep driver telemetry rows at a stable height when direction labels change.
- [x] Remove the internal scrollbar from the 15-action policy list and show all actions inline.

### v0.8.5 Syntax + loader hardening

- [x] Fix the invalid recent-chart callback that caused `ui.js` to fail parsing.
- [x] Expand the affected chart code into readable block-form JavaScript rather than compressed expression chaining.
- [x] Stop classic-script startup immediately when a script reports an evaluation error, avoiding misleading follow-on initialization failures.
- [x] Actually execute Node syntax parsing against the repaired `ui.js` source before publishing this fix.

### v0.8.4 Startup hardening

- [x] Move shared display-format helpers into the early `state.js` layer so Brain Inspector initialization cannot depend on later `ui.js` declarations.
- [x] Enforce shared-helper placement in the local source checker.
- [x] Preserve multiple on-page error reports instead of overwriting the first failure with a later initialization error.

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
- [x] Add a local source/browser test harness: Node syntax checks, HTML-id/classic-global collision detection, and Playwright Chromium startup/learning smoke tests.

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
- [x] Asphalt/shoulder/grass presentation, surface handling, three-tone visual direction strips, and human-facing wrong-way telemetry.
- [x] Oriented car collision footprints with stronger impact handling.
