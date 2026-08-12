# POV RL Racing Lab — Work Plan

This is the single living checklist for the lab. Keep it short, move finished work to **Done**, and update it with each release so the repository—not old chat history—is the source of truth.

## Next — Experiment Lab

- [ ] Add a small CNN vision brain so higher-resolution/color input can be compared with dense MLPs efficiently.
- [ ] Add ghost comparison against an older checkpoint/brain.
- [ ] Add tournament mode across saved brains and unseen tracks.
- [ ] Add curriculum training: advance through selected tracks when performance thresholds are met.

## Later experiments / fun

- [ ] Distribution-shift tests: wet track, dusk/night, fog, changed scenery/markings.
- [ ] Controlled comparison: O6 Driver POV versus Overhead look-ahead under matched T3/D3/R5/A3 seeds; later compare recurrent memory.
- [ ] D4 vehicle dynamics: split front/rear axle slip angles and tire forces, add nonlinear breakaway/drop-off and axle yaw moments, then simple load-transfer/friction sharing so genuine oversteer, drift recovery, and spinouts are possible without a full Pacejka model.
- [ ] Generalization score across tracks the brain did not train on.
- [ ] Add generated/procedural circuits and unseen-track suites beyond the expanded hand-authored T3 catalog.
- [ ] Better race presentation: start lights, lap board, podium/results history, optional replay/ghost traces.
- [ ] More interpretability views where useful: CNN feature maps, weight-change summaries, and richer historical plots for the diagnostics now recorded by the trainer.
- [ ] After fresh O6/R5/A3 evidence, compare GAE lambda / entropy bonus / value-loss weight / Adam+minibatching / KL stopping / global gradient clipping under matched seeds and camera modes rather than changing them by intuition.
- [ ] Run matched collision-curriculum experiments with the new ghost/physical traffic control, then consider automatic performance-threshold traffic enablement.
- [ ] Revisit multi-brain arenas later: different saved policies for racing and independent co-training in one physical world.

## Done

### v1.2.6 Grip-scaled steering authority

- [x] Advance D2→D3 by mapping full steering to approximately 95% of dry-road grip-limited curvature at the current speed while preserving the low-speed mechanical lock.
- [x] Restore meaningful separation between half and full steering at racing speed without changing the five steering actions, braking, transmission, surface friction, R5 reward, O6 observations, or A3 PPO/GAE.
- [x] Guard low-speed lock, 18 m-radius hairpin capability, descending steering authority with speed, and high-speed half/full grip demand in the executable dynamics probe.
- [x] Document the current single-lateral-force limitation: recoverable sideslip is real, but sustained rear breakaway/spinout is not yet a faithful physical mode.

### v1.2.5 Selectable neural camera

- [x] Advance O5→O6 without changing the 662-input tensor: retain all O5 vehicle/track context and let the rendered image switch between Driver POV and Overhead look-ahead.
- [x] Add a heading-aligned high-oblique overhead camera that keeps the learner's own car and substantially more upcoming track geometry visible.
- [x] Persist neural-camera mode with training state, stamp it into PPO metrics/segments/races, and include it in matched-environment comparison.
- [x] Treat camera changes as safe environment boundaries: discard unfinished PPO experience, clean-start active learners, preserve weights, and use the same selected view in evaluation.
- [x] Extend source and Playwright gates so overhead mode must initialize and collect real learning experience without browser errors.

### v1.2.4 Explicit memorized-track context

- [x] Advance O4→O5 with an eight-way one-hot circuit ID, normal/mirrored variant flag, and circular sine/cosine absolute lap position.
- [x] Expand the auxiliary observation tail from 11 to 22 values, making the baseline 40×16 grayscale network 662→48→15 + value.
- [x] Use absolute projected track arc so staggered spawns share the same corner location code, while retaining no exact tangent, centerline offset, future-turn geometry, or world X/Z input.
- [x] Migrate supported 642/650/651-input brains to 662 by preserving every existing first-layer weight and zero-initializing only newly introduced values; keep old history provenance and use O5 for new segments/reset runs.
- [x] Expose all 22 non-image inputs in the Brain Inspector, show track-position percentage on driver cards, and guard O5 encoding/migration/wiring in the executable source checks.

### v1.2.3 Immediate off-track incentive

- [x] Advance to R5 without changing D2/O4/A3, braking, steering, transmission, lap/terminal values, collision penalties, or episode termination timing.
- [x] Remove all positive forward-progress reward from shoulder and grass so leaving asphalt cannot remain profitable merely by continuing around the centerline.
- [x] Strengthen continuous shoulder penalty from -0.07/sec to -0.20/sec and grass from -0.18/sec to -0.50/sec so the bad outcome reaches credit assignment immediately.
- [x] Extend the executable learning-contract probe to enforce the new R5 surface values while retaining +10 lap and -15 one-time terminal checks.

### v1.2.1 Reward outcome shaping

- [x] Advance to R4 while preserving R3 continuous progress, surface, backward, and collision terms unchanged.
- [x] Increase one-time terminal failure penalty from -5 to -15 so failure erases about 200 m of clean road progress rather than ~67 m.
- [x] Add +10 reward for a legitimate lap only after one full track length of signed net progress, retaining the anti-finish-line-rocking rule.
- [x] Record lap-completion reward as its own batch/history/live diagnostic and keep lap time itself diagnostic-only.
- [x] Keep D2/O4/A3 unchanged so the reward revision is a controlled experiment, with continued R3 brains segmented from fresh R4 metrics by provenance.

### v1.2.0 Cleaner learning environment + curriculum controls

- [x] Correct nonterminal PPO rollout bootstrapping to evaluate the actual post-transition state value at update boundaries.
- [x] Replace sample-index progress reward with continuous projected centerline arc progress and fix total-forward telemetry.
- [x] Make learning population configurable from 1–10 shared-policy drivers while keeping evaluation at four physical cars.
- [x] Add staggered training placement and optional physical car/car interaction so clean ghost training and traffic training are separate treatments.
- [x] Make Failures only the fresh-session baseline while preserving adaptive/fixed synchronized clean-start experiments.
- [x] Add deterministic left/right track mirroring plus Endurance Ring and Long Run Circuit under T3 geometry provenance.
- [x] Add opt-in deterministic track rotation at safe PPO boundaries after experience intervals, with per-brain persistence/history.
- [x] Extend experiment comparison and diagnostics to include population, collisions, placement, reset strategy, mirror variant, and track rotation.
- [x] Add diagnostic full-track lap timing per learner, PPO average/best lap metrics, driver clocks, a lower-is-better history chart, and matched-comparison pace columns without changing R3 reward.
- [x] Add persistent rear-tire skid marks with per-tire pavement checks, real-slip rather than lateral-load triggering, speed/slide-dependent darkness, batched long-run rendering, track-scoped persistence, and neural-POV exclusion without changing D2 friction.

### v1.1.0 Learning-contract correctness

- [x] Make laps require a full track length of signed net progress and remove the exploitable/redundant +15 finish-line reward.
- [x] Apply terminal failure penalty exactly once, freeze pending-terminal cars, and detect stagnation from useful along-track velocity rather than raw speed.
- [x] Introduce R2 surface-aware progress reward: full road value, 45% shoulder value, zero positive grass progress, with backward/surface/collision penalties retained.
- [x] Add actual steering angle as O4's eleventh local sense, normalize scalar speed across the current 40 m/s range, and migrate O3 650-input networks to 651 without changing old weights.
- [x] Introduce A2 experience-based exploration and 2,048/4,096/8,192/16,384-experience clean-start budgets so PPO batch size no longer changes those schedules.
- [x] Correct PPO's policy-gradient temperature derivative and record entropy, KL, clip fraction, value diagnostics, reward components, surface progress, backtracking, stagnation, and collision rate.
- [x] Extend experiment provenance/comparison to T/D/O/R/A and execute learning-contract, observation, migration, track, dynamics, determinism, and load-order checks in the local Node gate.

### v1.0.1 Wide neural POV

- [x] Reshape every neural vision preset to 2.5:1 at the same visual-value count: 40×16 low-res and 80×32 high-res for grayscale/RGB.
- [x] Use a 52° vertical (~101° horizontal) neural FOV and lower road-biased aim so less observation bandwidth is spent on sky and more covers lateral racing context.
- [x] Preserve saved vision preset ids and dense tensor dimensions while advancing observation provenance to O3 because pixel geometry changed.
- [x] Guard wide preset dimensions/value counts, camera constants/wiring, O3 provenance, vehicle dynamics, and legacy network migration in the executable Node source gate.

### v1.0.0 Sim-cade vehicle dynamics

- [x] Replace scalar-speed motion with persistent world `vx/vz`, chassis yaw rate, steering angle, local forward/lateral velocity, and recoverable slip angle.
- [x] Add speed/grip-limited yaw response plus a shared lateral/longitudinal friction budget so braking, acceleration, and cornering compete for tire force.
- [x] Make road, shoulder, and grass change actual friction, cornering/yaw response, and rolling resistance rather than only scaling controls.
- [x] Add a five-speed automatic transmission, wheel-speed-derived RPM, simple torque curve, shift interruption, damage power loss, and RPM/tire-scrub audio.
- [x] Expand policy proprioception to ten normalized local senses while keeping track/world geometry hidden.
- [x] Migrate old dense first layers from image+2 to image+10 without changing visual weights; map old speed/damage weights and zero the eight new sensor weights.
- [x] Version track/dynamics/observation environment provenance as T/D/O so old history and v1.0 continuation are not falsely treated as replay-equivalent.
- [x] Apply car/tree impacts to world velocity/yaw and validate acceleration, braking, shifting, surface grip, slide recovery, observation bounds, long-run stability, and legacy migration in the local Node gate.

### v0.9.1 Larger validated circuit system

- [x] Replace distorted parametric-ellipse tracks with intentional waypoint circuits using true straights and rounded tangent-continuous corners.
- [x] Resample every centerline at roughly 1.5 m physical spacing and use cumulative arc distance for reward/progress and race position.
- [x] Enforce minimum 18 m centerline turn radius, 15 m non-adjacent same-level clearance, and uniform spacing in the executable Node source gate.
- [x] Expand circuits substantially: ~490 m Balanced/Counterflow, ~585 m Technical, ~680 m Sweepers, ~525 m Figure Eight, ~980 m Grand Prix.
- [x] Make grid/camera/scenery spacing distance-based and make Whole Track frame the active circuit without changing neural POV fog.
- [x] Stamp track-layout revision into experiment history so v0.9.0 geometry and v0.9.1 geometry are not treated as the same reproducible environment.

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
