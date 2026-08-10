# POV RL Racing Lab

A browser-based reinforcement-learning racing laboratory. Learning can run **1–10 parallel copies of one shared actor-critic policy** from rendered POV cameras and vehicle-local senses; a separate four-car evaluation mode freezes that policy and races it without learning.

Current release: **v1.2.1**

- [Open the released simulator](https://bortlip.github.io/SharedInfo/simulations/rl-racing-lab/)
- [Open the modular source preview](https://bortlip.github.io/SharedInfo/simulations/rl-racing-lab/src/)
- [See the living work plan](TASKS.md)
- [Related lab: Perception Rover](https://bortlip.github.io/SharedInfo/simulations/perception-rover/)
- [Related lab: Neural Playground](https://bortlip.github.io/SharedInfo/simulations/neural-playground/)

## v1.2.1: finish the lap, don't just survive most of it

Reward revision **R4** keeps R3's dense continuous progress and all existing surface/backward/collision rates, but strengthens episode outcome incentives. A legitimate full-net-progress lap now earns **+10**, while terminal failure costs **-15** instead of -5. On the ~490 m Balanced Loop, the failure penalty therefore erases about 200 m of clean road progress rather than only ~67 m, and completing the full lap is materially better than driving aggressively through most of it and crashing near the end.

Lap **time** remains diagnostic rather than directly rewarded: faster safe driving still wins naturally by collecting progress sooner and completing more +10 laps. PPO/GAE, vehicle dynamics, observations, track geometry, and lap-detection rules are unchanged. Reward diagnostics now expose the lap-completion contribution separately from progress, surface, collision, and terminal terms. Fresh/reset runs are stamped **T3/D2/O4/R4/A3**; continued R3 brains retain their historical R3 provenance and begin distinct R4 training segments.

## v1.2.0: cleaner learning environment + curriculum controls

v1.2 separates **learning to drive** from **learning in traffic**. Fresh sessions now start with one learner, staggered placement enabled, physical training-car collisions disabled, and **Failures only** resets. Learning population is configurable from 1–10 copies of the same policy; higher counts can gather more varied experience, while a separate checkbox turns physical car/car interaction back on when traffic is the experiment. Evaluation remains a fixed four-car physical race.

Reward revision **R3** keeps the same R2 reward rates but removes the roughly 1.5 m centerline-sample quantization from credit assignment. Each physics step now projects the car onto the nearby centerline segment and computes wrapped continuous arc-length progress, so even small correct movements can produce proportionate signed-meter reward. The total-forward diagnostic also now includes road, shoulder, and grass progress instead of accidentally counting road meters only.

Trainer revision **A3** fixes nonterminal rollout bootstrapping at PPO boundaries. GAE now evaluates the actual post-transition observation to obtain `V(s[t+1])`; it no longer reuses the previous action state's `V(s[t])` for the last live transition in each driver rollout. This changes return/advantage targets without consuming an extra policy-RNG action draw.

Track revision **T3** adds **Endurance Ring** and **Long Run Circuit**, plus a deterministic **Mirror track** option that flips circuit geometry left/right without reversing travel direction. **Auto-switch tracks** can rotate through circuits at complete PPO boundaries after each 8,192-experience interval, preventing a single optimizer update from mixing environments. Mirrored exposure and the complete learning setup—population, physical/ghost traffic, stagger/grid placement, reset cadence, and rotation—are persisted per brain and included in experiment matching.

Lap time is now a first-class **diagnostic, not a reward**. Each learner times the simulated seconds required to accumulate one full track length of net forward progress from its current spawn, so staggered starts remain comparable on the same circuit. Driver cards show the current lap clock and last completed lap; PPO history records average/best completed lap times; the dashboard adds a lower-is-better lap-time timeline; and matched experiment comparison exposes the same pace metrics. Timeline lines break across different track/mirror variants because raw lap times from unlike circuits are not directly comparable.

Fresh v1.2.0 runs are stamped **T3/D2/O4/R3/A3**. Older histories remain intact but are not silently treated as replay-equivalent to that release's learning contract.

## v1.1.0: learning-contract correctness

This release tightens the full learning contract after reviewing the new tracks, vehicle dynamics, and wide POV together. Lap completion now requires a full track length of accumulated signed net progress from the spawn; crossing the finish seam by itself does nothing, and the old +15 lap reward is removed. That closes the finish-line rocking exploit in both learning and evaluation races while leaving forward meters as the primary objective.

Reward revision **R2** pays 0.075 per forward road meter, 45% of that rate on shoulder, and no positive progress reward on grass; shoulder/grass retain their time penalties, backward progress keeps the stronger 0.16-per-meter penalty, and collisions keep their severity penalties. A failure terminal now applies its -5 penalty exactly once, freezes the vehicle until the 10 Hz transition is recorded, and no-progress detection uses velocity along the local track tangent rather than raw world speed.

Observation revision **O4** appends actual physical steering angle as an eleventh vehicle-local sense and normalizes scalar speed across the current 40 m/s physical range. Baseline input is therefore **651 → 48 → 15 + value**. Existing O3 image+10 networks migrate 650→651 by copying every old first-layer weight and zeroing only the new steering-angle weight; older image+2 networks still migrate with their historical speed/damage mapping.

Trainer revision **A2** makes exploration temperature a function of total experience instead of PPO update number and changes synchronized clean starts to 2,048/4,096/8,192/16,384-experience budgets, all divisible by the supported 256/512/1024 PPO batches. Temperature is evaluated for each real action and stored with that transition; PPO replays the sample at the same temperature and includes the required `1 / temperature` policy-gradient factor. PPO boundaries no longer sample/discard unused actions, eliminating another update-count-dependent RNG draw. Training history also records policy entropy, approximate KL, clip fraction, value RMSE/explained variance, no-progress time, collision rate, per-surface forward meters, backtracking, and reward-component totals.

Current fresh runs are stamped **T2/D2/O4/R2/A2**. Experiment comparison requires all five revisions plus seed/track/replayable provenance to agree before calling conditions matched.

## v1.0.1: wide neural POV at the same input cost

All four vision presets are reshaped from 1.6:1 to **2.5:1** without adding image values: 32×20 becomes 40×16, and 64×40 becomes 80×32, with grayscale/RGB channel counts unchanged. The internal preset ids stay stable, so saved dense networks keep the same tensor dimensions and parameter counts.

The neural camera now uses a 52° vertical field of view (about 101° horizontally at 2.5:1) and aims lower toward the road. That spends fewer pixels on sky while exposing more shoulder, neighboring cars, and lateral context—especially useful now that D2 supports real sideslip. Because the same weight index now corresponds to different camera geometry, this is observation revision **O3** even though tensor shapes remain compatible.

## v1.0.0: sim-cade vehicle dynamics + local proprioception

The car is no longer `heading + scalar speed`. Each driver now carries world-space `vx/vz`, chassis heading, yaw rate, steering angle, lateral/forward local velocity, slip angle, lateral/longitudinal acceleration, RPM, gear, shift state, tire-scrub intensity, and grip usage. Physics still advances on the same fixed 1/60-second scheduler, but the chassis can now rotate independently of its travel vector, so sideslip and recoverable slides are real state rather than a visual effect.

The tire model is intentionally sim-cade rather than a full Pacejka implementation. Steering requests a kinematic yaw rate, available friction limits that yaw response, and lateral tire force tries to align world velocity with the chassis subject to the same surface grip ceiling. Longitudinal drive/braking and lateral cornering share a friction budget, so maximum braking/acceleration cannot coexist with unlimited cornering force. Road, shoulder, and grass have different friction, cornering response, yaw response, and rolling resistance; grass now changes the actual motion state rather than merely multiplying a steering scalar.

A five-speed automatic transmission derives RPM from wheel speed, gear ratio, and final drive, shifts around the useful rev range, and modulates drive force through a simple torque curve plus a short shift interruption. Engine audio now follows actual RPM, while a filtered-noise tire layer follows lateral grip use and slip. Car/car and car/tree impacts act on world velocity vectors and yaw state rather than multiplying a scalar speed.

The policy observation expands from image + 2 values to **image + 10 vehicle-local values**: legacy-compatible scalar speed, signed forward speed, lateral speed, yaw rate, slip angle, previous steering command, previous throttle/brake command, damage, RPM, and gear. These are all quantities available to a driver from the car itself; exact track tangent/center, future turn geometry, opponent coordinates, and world position remain hidden.

Existing saved dense brains migrate automatically. Their image weights are copied unchanged, the old speed weight maps to the legacy-compatible speed slot, the old damage weight maps to damage, and the eight newly introduced input weights begin at zero. Historical provenance remains **D1/O1**; the v1.0.0 physics candidate introduced **D2/O2**. v1.0.1 keeps D2 and advances the neural-camera observation contract to **O3**. Experiment comparison matches seed, track, track-layout revision, vehicle-dynamics revision, and observation revision. Resetting an older brain now creates a clean replayable **T2/D2/O3** run from the same seed.

The local Node gate now executes the pure vehicle model itself. It checks straight-line acceleration and shifting, braking to a stop, road-vs-grass steering response, sideslip recovery, bounded 10-value observations, long-run numerical stability, and the old 642→650 input-weight migration before a release can pass.

## v0.9.1: larger validated circuits + physical-distance progress

The old circuits were parameterized distorted ellipses. Tight high-frequency bends could have a centerline radius smaller than the 5.4 m road half-width, causing the normal-offset road ribbon to fold across itself. v0.9.1 replaces those formulas with intentional closed waypoint layouts: exact straight sections joined by tangent-continuous rounded quadratic corners, then resampled at roughly 1.5 m physical spacing.

Every circuit is generated by the local Node source gate and rejected if its sampled centerline has a turn radius below 18 m, same-elevation non-adjacent clearance below 15 m, or materially uneven spacing. Approximate lap lengths are now Balanced/Counterflow 490 m, Technical 585 m, Fast Sweepers 680 m, Figure Eight 525 m, and Grand Prix 980 m. The Figure Eight keeps grade-separated crossing geometry; the Grand Prix is now about twice the Balanced Loop lap length rather than a dense distorted curve.

Progress/reward and race-position distance now use cumulative centerline arc length instead of `index delta × average segment`. Grid and trackside-camera offsets are specified in meters as well. The Whole Track spectator camera automatically frames the current circuit and temporarily removes fog only for that spectator render; neural POV fog and observation cameras are unchanged.

Track geometry is now environment provenance. New PPO history/races/segments are stamped with track-layout revision v2. Existing v0.9.0 history remains layout v1, and Experiment comparison requires matching seed, track, and layout revision before describing runs as fully matched. Resetting an existing brain clears its history and establishes a fresh replayable v2 run from the same seed.

## v0.9.0: reproducible experiments + matched-budget comparison

New brains now have an explicit 32-bit experiment seed. One visible seed derives three independent deterministic random streams for network initialization, policy/action sampling, and PPO shuffling, so changing network size does not merely shift every later random decision. The seed plus current RNG continuation state are persisted with each brain, included in portable exports, restored after reload/switch, and recorded in PPO history. Resetting a v0.9 brain recreates its original seeded weights and stochastic streams.

Existing pre-v0.9 brains are preserved rather than pretending their earlier history was seeded: the first v0.9 load assigns and persists a deterministic continuation seed, while the UI marks that the historical portion cannot be replayed from that seed. A source-check invariant now rejects `Math.random()` in training-affecting track/car/model/simulation/physics/training code; presentation-only particles remain intentionally outside the deterministic learning path.

The new **Experiment comparison** view treats each saved brain and its existing training history as the canonical run. By default it compares brains at the closest completed PPO update to a common experience budget; an alternate view shows each brain at its latest completed update. Rows include architecture, seed, actual experience/update, track, average/best run, reward per experience, off-road percentage, average PPO time, and PPO setup, with a warning when seeds are not matched.
## v0.8.8: direction strips + physical scenery impacts

The earlier asphalt arrows and red/white curb blocks are replaced by cleaner three-tone edge strips. Three distinct luminance levels have different forward and reverse cyclic orderings, so a single POV image can contain a direction cue without arrow symbols on the racing surface. The pattern closes in complete three-tone cycles on every circuit and works for both grayscale and RGB brains.

Trees now have lightweight trunk colliders rather than being scenery cars can pass through. A tree impact pushes the car out, heavily scrubs speed, adds damage and training penalty, and uses the existing collision sound. Car-car impacts emit sparks/body debris/smoke; tree impacts emit wood fragments/leaves/dust. These particles are presentation-only: they are suppressed in headless learning and hidden during neural POV rendering, so they do not become random policy inputs.

## v0.8.7: live connection graph + spectator cameras + PPO experiments

The Brain Inspector draws a representative sampled subgraph of the real active network. Node size/brightness reflects live activation; connection thickness reflects learned weight strength; connection opacity reflects current absolute contribution (`|weight × source activation|`); cyan/red connections indicate positive/negative contribution. v1.0 always includes all vehicle-local input nodes in the graph while sampling the large image input for legibility.

Spectator viewing now includes Chase, Driver POV, High chase, Helicopter, Trackside, Overhead follow, and Whole track cameras. These are presentation-only and never alter the neural observation cameras.

Four controlled PPO experiment settings are stored with each brain and restored when that brain is loaded: experience batch (256/512/1024), backprop passes (1/3/5), learning rate (0.00025/0.00055/0.001), and PPO clip range (0.10/0.18/0.25). Existing brains without saved PPO settings use the historical baseline of 512 experiences, 3 passes, learning rate 0.00055, and clip 0.18. Changing a PPO setting discards only the unfinished batch so one update never mixes two parameter sets.

Headless training now keeps summary statistics and both learning-progress charts live (at the throttled headless dashboard cadence) while suppressing spectator, driver-card, and Brain Inspector repainting. Neural POV rendering still occurs because those images are the policy inputs.

## v0.8.6: stable driver telemetry + full policy list

Driver telemetry cells now keep their direction/value text on one line in shrink-safe columns, so labels such as `100% FWD`, `ACROSS`, and `WRONG WAY` no longer make the two-column driver grid repeatedly grow and collapse. The 15-action policy list no longer has an internal max-height/scrollbar; the Brain Inspector expands with the page so every action is visible at once.

## v0.8.5: recent-chart syntax fix + fail-fast script loading

The recent-driving chart no longer uses an invalid expression-bodied arrow callback containing a second statement. The chart loop is expanded into readable block-form JavaScript. The classic-script loader now also stops startup when a script reports an error during evaluation, preventing later dependent scripts from producing misleading secondary failures such as `log is not defined`.

## v0.8.4: shared-helper startup fix

Generic formatting helpers used by both the Brain Inspector and the later dashboard now live in `state.js`, the first shared classic-script layer. This removes the `brain-viz.js → ui.js` load-order dependency that could abort initialization with `formatBytes is not defined`. The source checker now enforces that shared-helper placement. The on-page diagnostics reporter also preserves multiple errors instead of replacing an earlier runtime/parse failure with a later initialization error.

## v0.8.3: browser startup test gate

The page no longer uses `id="drivers"`, which could be exposed by the browser as `window.drivers` before `cars.js` created the real driver array. `scene.js` also verifies that `drivers` is actually an array before clearing per-driver perception state. A small Node/Playwright harness now syntax-checks every JavaScript file, rejects HTML-id/classic-global name collisions, launches the real simulator in headless Chromium, fails on browser/page errors, verifies the four POV cards and Brain Lab UI initialize, and confirms learning can begin and produce experience. Run `npm install`, `npx playwright install chromium`, then `npm test` from this folder.

## v0.8.2: startup hardening + full browser diagnostics

The training log DOM id no longer collides with the global `log()` helper. Startup, initialization, runtime, and unhandled-promise failures now flow through one detailed on-page reporter showing the release version, timestamp, page URL, error name/message, source file/line/column when available, and stack trace, with a **Copy diagnostics** button. The original error object is still written to DevTools Console.

## v0.8.1: normalized browser storage + brain cost library

v0.8.1 keeps the v0.8 session model but changes its internal IndexedDB representation. The database is now version 2 with two stores:

```text
sessions   small session metadata + activeBrainId + recent events
brains     one record per brain, indexed by sessionId
```

Existing v0.8 browser data is migrated automatically during the IndexedDB version upgrade: embedded `brains[]` records are copied into the new `brains` store and removed from the session metadata row. After migration, a normal PPO autosave writes the active brain plus the small session metadata record instead of structured-cloning every brain in the session.

The Brain Library now shows each brain's parameter count, approximate Float32 tensor size, forward-pass multiply-accumulate count, and measured last/average PPO optimizer time. The active dashboard also shows last and average PPO time.

The Session Manager exposes origin-level browser storage usage/quota using `navigator.storage.estimate()`, reports best-effort vs persistent durability using `navigator.storage.persisted()`, and can request persistent storage with `navigator.storage.persist()` when supported. Persistent storage protects against automatic storage-pressure eviction; explicit browser/site-data clearing can still remove it, so **Export All remains the real portable backup**.

Brains can now be exported or deleted directly from the library. The current session can be deleted, and **Clear all local data** removes all racing-lab IndexedDB session/brain records plus the last-session pointer before creating one fresh blank session. The app refuses to delete the final brain inside a session because the simulator always needs an active policy.

## v0.8: Brain Lab + persistent sessions

v0.8 turns the simulator from a single fixed brain into an experiment lab. A **Lab Session** can contain multiple named brains with different visual inputs and dense-network shapes. Each brain keeps its own weights, training history, track exposure, and evaluation-race history.

The baseline dense preset remains one 48-neuron hidden layer; v1.0 expands its observation tail from 2 to 10 vehicle-local values:

**40×16 grayscale + 11 local vehicle senses → 48 tanh → 15-action policy + value**

Creating a different architecture creates a **new brain** rather than silently reshaping the one you already trained. Existing brains stay in the session and can be switched back in later.

### Vision presets

| Vision | Visual values | Vehicle-local values | Total inputs |
|---|---:|---:|---:|
| 40×16 grayscale | 640 | 11 | 651 |
| 80×32 grayscale | 2,560 | 11 | 2,571 |
| 40×16 RGB | 1,920 | 11 | 1,931 |
| 80×32 RGB | 7,680 | 11 | 7,691 |

RGB stores normalized red, green, and blue values per pixel. Grayscale keeps the historical luminance conversion. The current O4 tail appends eleven normalized vehicle-local senses—including actual physical steering angle—while still exposing no track geometry or world position.

### Dense-network presets

- **Baseline:** one 48-neuron tanh layer
- **Wide:** one 128-neuron tanh layer
- **Deep:** 96 → 48 tanh layers
- **Deep + wide:** 128 → 64 tanh layers

The UI shows the resulting layer sizes, parameter count, approximate Float32 tensor size, and forward-pass MAC count before a new brain is created. The Brain Library keeps those same architecture-cost stats beside measured PPO timing for trained brains. The generic PPO implementation backpropagates through any of these dense-layer presets.

Large dense image networks are deliberately allowed for experimentation, but they can be expensive in pure browser JavaScript. With the current O4 vehicle-sense tail, **80×32 RGB + Wide has 986,640 trainable parameters** and **80×32 RGB + Deep + wide has 993,872**. The visual-value counts are unchanged from the former 64×40 geometry, so the wide-camera reshaping itself does not increase image cost; O4 adds one local input. A small convolutional vision brain is therefore the next architecture item in [TASKS.md](TASKS.md).

## Live Brain Inspector

The selected driver now has a live network view showing:

- the exact grayscale or RGB image entering the policy;
- a sampled subgraph of real network nodes and connections, with node activation plus learned weight/live-contribution strength;
- hidden-layer activations;
- all 15 action probabilities and the chosen action;
- value estimate, exploration temperature, and policy entropy;
- a chosen-action input-sensitivity map.

The sensitivity view differentiates the selected action logit back to the image inputs. Bright pixels indicate places where a small input change would more strongly change that action score. It is a mathematical gradient visualization, **not** a claim that the network has attention or is consciously looking at those pixels.

## Sessions, local storage, and portable backups

A session contains multiple brains plus a compact experiment history. The Session Manager shows each brain's architecture, update count, total experiences, best run, race count, and the tracks on which it has trained. It also keeps recent session events such as brain creation, switching, track changes, and completed races.

Sessions autosave to **IndexedDB in the browser**. Internally, v0.8.1 stores small session metadata separately from one record per brain, indexed by session id. IndexedDB is used rather than storing full networks in `localStorage` because large typed-array weight sets can be several megabytes. A small localStorage key only remembers which session was most recently active.

Available persistence operations:

- create and rename sessions;
- create, rename, duplicate, and switch among brains;
- **Export brain / Import brain** for one portable brain file;
- **Export all / Import all** for the complete session, all brains, histories, and race records;
- load another session already stored in this browser.

Legacy compatible v1/v2/v3 racing-lab checkpoint files can be imported as baseline brains.

Browser storage is convenient, not a substitute for a backup. **Export all** is the portable copy if you care about retaining a long experiment collection across browsers, profiles, storage cleanup, or machines.

## Learning and evaluation

Learning and Evaluation Race remain explicit modes.

In **Learning** mode:

- 1–10 active drivers can share the active brain; fresh sessions start with one;
- staggered starts can distribute parallel learners around the circuit instead of concentrating them on the race grid;
- training-car collisions can be disabled for ghost traffic or enabled for physical multi-car learning;
- the selected track may be mirrored, and optional automatic rotation moves to the next circuit only after a complete PPO update once the configured experience interval has elapsed;
- PPO updates after the active brain's selected 256/512/1024 combined-experience batch;
- **Failures only** is the fresh-session reset baseline; adaptive or fixed 2,048/4,096/8,192/16,384-experience synchronized clean starts remain available, while individual failures always respawn immediately.

In **Evaluation Race** mode:

- the active brain is frozen;
- actions use the deterministic highest-probability choice;
- no experiences or backpropagation are recorded;
- the four copies race for 1, 3, or 5 laps on any available circuit;
- completed results are stored with the active brain.

The Learning button also stays logically consistent through PPO. While backpropagation is running it continues to display **Pause learning** rather than flickering to Start. If Pause is clicked during backprop, the current optimizer update finishes safely and learning remains paused afterward.

## Progress views

Two charts answer different questions:

- **Recent driving:** the last 60 simulated seconds, one line per active learner, useful for seeing what the selected training population is doing right now.
- **Complete training timeline:** average and best net run distance by PPO update from update 0, including training-track and mirror-variant change markers.

Run distance is peak **net** forward progress from a spawn. Driving backward first reduces net progress, so rocking forward and backward cannot inflate the metric by repeatedly counting the same meters.

The dashboard also shows best-ever run, off-road percentage, reward/experience, failure resets, total experiences, real/simulated training time, action mix, clean-start status, and achieved simulation speed. The diagnostics line records the active learning environment plus forward meters by surface, backtracking, no-progress percentage, collisions per 1,000 experiences, reward-component totals, policy entropy, PPO KL/clip fraction, and value explained variance.

## World, direction, collisions, and sound

Tracks use dark asphalt, warning-edge paint, three-tone directional edge strips, shoulder, grass, center markings, and roadside scenery. Road/shoulder/grass now select different physical friction, cornering/yaw response, and rolling resistance. Grass cannot generate road-level acceleration, braking, or lateral tire force.

The policy still receives no hidden track-center or track-tangent oracle. Under R4, signed **continuous projected centerline progress** still pays the full 0.075-per-meter forward reward on road, 45% on shoulder, zero positive progress reward on grass, and a larger-magnitude 0.16-per-meter penalty for backward travel. A legitimate completed lap—one full track length of accumulated signed net progress from the current spawn/prior lap—adds +10 reward, while terminal episode failure costs -15 once. Crossing the finish seam repeatedly still cannot create reward or fake laps. The edge strips remain a visual direction cue; exact FORWARD / ACROSS / WRONG WAY alignment is human-facing telemetry only.

Cars use oriented rectangular collision footprints and resolve hard car/car contact against relative world velocity, modifying both `vx/vz` vectors and yaw state before applying damage. During learning this entire car/car interaction can be disabled so multiple visible learners act as ghost traffic; evaluation always restores physical four-car interaction. Trees remain physical in both modes.

Persistent spectator skid marks accumulate along the two rear-tire paths only after meaningful physical sideslip develops; ordinary high lateral-grip usage by itself no longer counts as a skid. Each rear tire is independently projected onto the nearby road/shoulder ribbon, so a tire over grass cannot paint rubber. Segment color varies from faint to near-black with slide strength and speed. Marks survive ordinary driver failures, clean starts, laps, and PPO updates, clear only when circuit geometry is rebuilt, stop accumulating during Headless learning, and remain explicitly hidden from every neural POV capture.

Optional Web Audio synthesizes engine tone from actual RPM and adds filtered tire scrub/skid noise from the same slip-based scrub signal, plus collision transients. Audio and skid rendering remain presentation-only and never feed or write learning state; road/shoulder/grass friction coefficients are unchanged by this visual refinement.

The v1.0 model is deliberately **sim-cade**: it has persistent world velocity, chassis yaw, slip angle, a shared friction budget, automatic gears/RPM, and recoverable sideslip, but it is not a four-wheel suspension/tire-temperature/aero simulation. That gives learning agents meaningful braking/corner-entry/traction tradeoffs without making a 50× browser lab prohibitively expensive.

## Safe speed and headless invariants

All 1×/2×/4×/10×/50× settings use the same chronological scheduler:

**fixed 1/60-second physics ticks → policy decision every 0.10 simulated seconds**

Higher requested speeds ask the browser to process more identical simulated work per wall-clock second; they do not switch physics or policy timing. At high speed the spectator/dashboard are simply repainted less often.

Headless is a **presentation flag, not a learning mode**. It suppresses spectator, driver-card, and Brain Inspector repainting while summary metrics and both learning-progress charts remain live at a throttled cadence. Physics, neural POV rendering, observations, actions, reward, experience collection, PPO, and reset logic use the same path.

## Folder structure

```text
index.html            Stable redirect to the released simulator.
simulator.html        Released application shell.
TASKS.md              Living Now / Next / Later / Done work plan.
README.md             Usage and release overview.
DESIGN.md             Technical design and invariants.
src/index.html        Direct modular-source preview.
src/styles.css        UI and simulator styling.
src/js/version.js     Visible/cache-busting release version.
src/js/app.js         Three.js bootstrap, ordered module loading, error boundary.
src/js/vehicle-dynamics.js Pure world-velocity/yaw/slip/transmission model and local sensor normalization.
src/js/learning-contract.js Pure reward, exploration-temperature, and clean-reset contract.
src/js/state.js       Configurable vision/network presets, constants, mutable state.
src/js/track-layouts.js Pure rounded-waypoint circuit definitions, resampling, and geometry validation.
src/js/scene.js       Three.js renderer, cameras, dynamic POV render targets.
src/js/tracks.js      Rendered track surfaces, markings, scenery, and physical-distance metadata.
src/js/cars.js        Car meshes, dynamic state, grid placement, direction telemetry.
src/js/model.js       Configurable dense actor-critic networks, legacy-input migration, gradients.
src/js/perception.js  Configurable grayscale/RGB POV plus vehicle-local observations.
src/js/simulation.js  Policy decisions and experience collection.
src/js/physics.js     Reward/surface integration plus car/tree collision impulses.
src/js/effects.js     Presentation-only persistent skid marks plus sparks, debris, smoke, dust, and tree fragments.
src/js/session.js     Multiple brains, IndexedDB autosave, import/export, history.
src/js/training.js    Generic dense PPO backprop and progress metrics.
src/js/experiments.js Reproducible seed-aware matched-budget brain comparisons.
src/js/race.js        Frozen-policy evaluation races and mode transitions.
src/js/brain-viz.js   Hidden activations, policy display, saliency/sensitivity.
src/js/audio.js       Presentation-only RPM engine, tire scrub/skid, and collision audio.
src/js/ui.js          Driver cards, charts, Brain Inspector, Session Manager.
src/js/runtime.js     Chronological scheduler and control wiring.
```

Three.js is loaded as an exact-version browser ESM dependency from jsDelivr. Neural-network training, sessions, and learned state remain local to the browser unless explicitly exported.
