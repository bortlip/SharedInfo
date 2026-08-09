# POV RL Racing Lab — v1.0.0 Design

## Goal

v1.0 keeps the configurable experiment platform and replaces its final major scalar-speed simplification with a bounded sim-cade world-velocity/yaw/slip model.

The causal chain remains:

**rendered POV + vehicle-local dynamics senses → policy → steering/drive action → world velocity/yaw/tire response → reward → PPO/backprop → updated policy**

Configuration, visualization, persistence, and sound are built around that chain. Hidden track knowledge is still not supplied as a model input.

The current roadmap is kept in one living file: [`TASKS.md`](TASKS.md).

## Brain identity and configuration

A **brain** is now a persistent experiment object. Its vision preset and network preset are part of its identity. The active brain also owns its weights, training timeline, track exposure, and evaluation-race history.

Architecture-sensitive controls do not mutate an already-trained network. Choosing a different vision/network setup and pressing **Create new brain** first snapshots the current brain into the session, then creates a fresh network with the requested shape.

A brain may also be duplicated, which creates a child experiment beginning from the same current weights/history. This is useful for branching an already-learned policy into different future training regimes.

## Reproducible experiment identity

A v0.9+ brain is also the canonical training-run record; no parallel experiment entity duplicates its weights/history. A new brain stores a visible unsigned 32-bit experiment seed plus the current continuation state of three independently derived random streams:

- `init` — network weight initialization;
- `policy` — stochastic policy/action sampling;
- `shuffle` — PPO batch shuffling.

Separating the streams matters for architecture experiments: a wider/deeper network consumes more initialization draws, but that must not shift its later action-sampling or PPO-shuffle sequence merely because initialization was larger. The stream states are included in each training snapshot, IndexedDB brain record, and portable export, so switching/reloading a checkpoint resumes the same stochastic continuation. **Reset active brain** intentionally restarts all three streams from the brain's original seed and rebuilds its network, making a v0.9 seeded-from-start run replayable under the same simulator/configuration.

Brains created before v0.9 cannot retroactively become reproducible. On first v0.9 load they receive a persisted continuation seed/RNG state and `seededFromStart = false`; future continuation is deterministic, while comparison UI explicitly marks that their earlier history is not replayable from that assigned seed.

Presentation-only randomness is excluded from the learning contract. Impact-particle and audio-noise randomness may remain nondeterministic because those layers are hidden from neural POV capture and never write simulation state. A static source check rejects direct `Math.random()` usage in training-affecting vehicle/track/car/model/simulation/physics/training modules.

## Experiment comparison

The comparison UI derives rows from the brains already stored in the current session. **Matched experience budget** chooses the smallest latest completed experience count among trained brains and, for each brain, displays the closest completed PPO metric to that common target. **Latest completed update each** instead shows every brain at its own latest checkpoint. The displayed actual experience count remains visible, so differing PPO batch sizes are not falsely represented as an exact match.

Comparison rows include architecture, seed/provenance, update/experience, track, average/best run, reward/experience, off-road percentage, measured PPO time, and PPO configuration. A run is called fully matched only when seed, selected track, track-layout revision, vehicle-dynamics revision, vehicle-observation revision, and replayable-from-start provenance all agree.
## Vision presets

Every POV render target is recreated when the active brain changes configuration.

| Preset | Image channels | Visual inputs | Vehicle-local inputs | Total inputs |
|---|---:|---:|---:|---:|
| 32×20 grayscale | 1 | 640 | 10 | 650 |
| 64×40 grayscale | 1 | 2,560 | 10 | 2,570 |
| 32×20 RGB | 3 | 1,920 | 10 | 1,930 |
| 64×40 RGB | 3 | 7,680 | 10 | 7,690 |

The offscreen render is twice the configured observation size in each dimension and is averaged down 2×2. Grayscale uses luminance; RGB keeps normalized R/G/B channels. The ten normalized local values are legacy-compatible scalar speed, signed forward speed, lateral speed, yaw rate, slip angle, previous steering, previous throttle/brake, damage, RPM, and gear.

The AI still does **not** receive lateral track position, centerline distance, track tangent, next-turn geometry, opponent coordinates, world position, or other world-oracle features.

## Dense actor-critic presets

The fixed v0.7 one-layer implementation was generalized to a list of fully-connected tanh layers.

Presets:

- Baseline: `[48]`
- Wide: `[128]`
- Deep: `[96, 48]`
- Deep + wide: `[128, 64]`

Each brain has:

1. zero or more configured hidden transformations (currently at least one);
2. a 15-action softmax policy head;
3. one scalar value head.

The baseline therefore remains:

**650 → 48 tanh → 15-action policy + value**

The hidden shape, action encoding, reward, and historical PPO preset remain available; v1.0 changes the physical environment and appends fair vehicle-local state needed to make that environment observable.

Example parameter counts:

| Vision | Baseline 48 | Wide 128 | Deep 96→48 | Deep+Wide 128→64 |
|---|---:|---:|---:|---:|
| 32×20 gray | 32,032 | 85,392 | 67,936 | 92,624 |
| 64×40 gray | 124,192 | 331,152 | 252,256 | 338,384 |
| 32×20 RGB | 93,472 | 249,232 | 190,816 | 256,464 |
| 64×40 RGB | 369,952 | 986,512 | 743,776 | 993,744 |

The large dense combinations are intentionally exposed as experiments, not claimed to be efficient designs. Their cost is a useful demonstration of why spatial architectures such as CNNs matter. A small CNN is tracked for the next architecture stage.

## Generic PPO backprop

Training still uses:

- four drivers sharing the active policy;
- decisions every 0.10 simulated seconds;
- γ = 0.985;
- GAE λ = 0.92;
- exploration temperature 1.35 decaying toward 0.72.

Four PPO update parameters are now controlled per brain with discrete experiment-safe options. The historical baseline remains **512 experiences / 3 passes / learning rate 0.00055 / clip 0.18**. Available options are batch 256/512/1024, passes 1/3/5, learning rate 0.00025/0.00055/0.001, and clip 0.10/0.18/0.25. Changing one discards only the unfinished experience batch so a single optimizer update never mixes configurations.

Forward propagation stores every hidden activation. Backpropagation computes the policy/value gradient into the final hidden layer, then walks the configured tanh layers backward. Hidden deltas are computed before weights are updated, preserving the normal feed-forward backprop dependency.

The optimizer remains intentionally small and educational rather than a production PPO implementation.

Each PPO update measures optimizer wall time beginning after the deliberate 90 ms BACKPROP-display pause and ending after the configured training passes. `lastPpoMs`, cumulative PPO time, PPO count, and the PPO parameter snapshot are stored with the brain, allowing architecture/training-cost comparisons on the current machine.

## Brain Inspector

The selected driver's latest forward pass is retained for human-facing inspection.

The inspector shows:

- the exact neural POV image;
- sampled hidden-unit activations for every dense layer;
- the complete 15-action probability distribution;
- chosen action;
- value estimate;
- policy entropy;
- exploration temperature.

### Input sensitivity / saliency

For the selected action, the inspector analytically differentiates that action's pre-softmax logit backward through the dense tanh layers to the observation input.

For grayscale, the absolute input gradient is displayed per pixel. For RGB, absolute R/G/B gradients are averaged into one pixel sensitivity magnitude. The visualization scales values within the current frame so structure is visible.

This answers a limited mathematical question—**where would a small input change most strongly change this action score locally?** It must not be described as consciousness or literal visual attention.

Inspector work is presentation-only. It is throttled and skipped in headless display mode so it cannot become part of the agent-environment timing contract. The network activity view samples a legible subset of real nodes/connections: node intensity/size encodes live activation, connection width encodes absolute learned weight strength, and connection opacity/color encodes the current signed `weight × source activation` contribution.

## Sessions and persistent experiment history

A **Lab Session** contains:

```text
session
  id / name / timestamps
  activeBrainId
  brains[]
    id / name / parentId
    vision + network config
    typed-array network weights
    training snapshot + complete PPO history
    trainingSegments[]
    races[]
  recent events[]
```

Training segments record the tracks a brain has actually trained on, update/experience ranges, best distance, and lap counts. Completed evaluation races retain track, lap count, policy update, and each driver's result.

The UI summarizes all brains in the current session and recent session activity so an experiment is not reduced to whichever brain happens to be loaded right now.

## IndexedDB v2, storage durability, and exports

Full networks are persisted in **IndexedDB**, which supports structured cloning of typed arrays and substantially larger objects than practical `localStorage` strings. `localStorage` stores only the id of the most recently active session.

Database version 2 normalizes persistence into `sessions` and `brains` object stores. `brains` has a non-unique `sessionId` index. The in-memory model still exposes `labSession.brains[]` for simple simulator code, but persistence serializes session metadata separately from brain records.

The v1→v2 `onupgradeneeded` migration walks each old session cursor, writes every embedded brain into the new `brains` store while preserving ids/order, then updates the session row without its embedded `brains[]`. The upgrade transaction is atomic at the IndexedDB version-change level: the new database version does not become available until that migration transaction completes.

Normal autosave now writes only the active brain record plus the small session metadata record. Explicit whole-session creation/import writes all brain records. Brain/session deletion removes the corresponding records rather than leaving orphaned model tensors.

Autosave occurs after meaningful changes and PPO updates, with a short debounce/idle delay. Switching brains/sessions and explicit session operations also force saves.

The Session Manager also reports `navigator.storage.estimate()` usage/quota and `navigator.storage.persisted()` durability. A user gesture may call `navigator.storage.persist()` to ask the browser for persistent storage. This changes eviction semantics, not ownership: the user can still explicitly clear site data.

There are two portable formats:

- **brain export:** one named brain, architecture, weights, training history, exposure, and races;
- **session export:** every brain and the complete session-level history.

JSON export converts typed arrays to ordinary arrays for portability. This is larger than IndexedDB's native representation, especially for near-million-parameter dense networks; that tradeoff is intentional for a self-contained human-movable backup.

Compatible legacy v1/v2/v3 checkpoint files are migrated into 32×20-gray / 48-hidden baseline brain records.

Imported network shapes are validated against their declared vision/network preset before use.

## Learning / backprop UI state

`sim.running` means physics/experience collection is advancing. `sim.learning` means the PPO optimizer is executing. Both are part of the higher-level concept **learning is active**.

The Learning button therefore displays **Pause learning** whenever:

```text
mode == learning AND (running OR backpropagating)
```

If Pause is pressed during PPO, `pauseAfterLearning` is set. The current PPO update completes without interruption, then `sim.running` remains false rather than automatically resuming. This avoids both label flicker and unsafe mid-optimizer cancellation.

## Scheduler / headless invariants

The chronological scheduler from v0.6/v0.7 is preserved:

1. advance one fixed 1/60-second physics tick;
2. accumulate decision time;
3. at 0.10 simulated seconds, execute one policy decision;
4. continue with the next physics tick.

Requested 1×/2×/4×/10×/50× speed changes only how much of this same sequence is attempted per wall-clock frame.

Headless remains presentation-only. It suppresses spectator, driver-card, and Brain Inspector repainting, but summary metrics and both learning-progress charts remain live at the throttled headless dashboard cadence. It does not select another physics, observation, reward, experience, PPO, or reset path. Neural POV render targets still run because they are the observation.

## Vehicle dynamics v2: world velocity, yaw, grip, and drivetrain

`vehicle-dynamics.js` is deliberately renderer-independent. The authoritative planar motion state is `x/z`, world velocity `vx/vz`, chassis `heading`, and `yawRate`; steering angle, gear/shift state, damage, and the previous discrete policy controls complete the persistent vehicle state. Forward/lateral speed and slip angle are derived in the chassis frame each step rather than replacing world velocity.

At each fixed 1/60-second tick, the current road/shoulder/grass surface selects a friction coefficient, cornering response, yaw response, and rolling resistance. Steering is rate-limited toward a speed-sensitive steering angle. A wheelbase-based kinematic yaw request is then capped by available lateral acceleration (`μg`) and approached with a surface-dependent yaw response. This creates speed/grip-limited understeer instead of allowing arbitrary heading rotation.

After chassis yaw advances, lateral tire acceleration opposes chassis-frame lateral velocity but is itself capped by grip. Engine/brake acceleration and lateral acceleration share a circular friction budget: lateral demand reduces the longitudinal acceleration still available in that tick. Because chassis heading and world velocity evolve separately, tire saturation can leave persistent sideslip; when demand drops, lateral force aligns velocity back toward the car and the slide is recoverable.

The drivetrain is a lightweight five-speed automatic. Wheel speed, gear ratio, final drive, and wheel radius produce RPM; shift thresholds select gears; a bounded torque curve changes drive acceleration across the rev range; and a short shift timer cuts drive force during the shift. Damage reduces available power and maximum speed. This is a sim-cade mechanism, not a clutch/differential/turbo or per-wheel driveline model.

The neural observation tail contains ten normalized vehicle-local values: scalar speed (kept for legacy compatibility), signed forward speed, lateral speed, yaw rate, slip angle, previous steering command, previous throttle/brake command, damage, RPM, and gear. Local senses make the new hidden motion state observable without revealing track geometry or world coordinates.

Saved pre-v1.0 dense networks are migrated at load time. Their visual first-layer weights are copied unchanged; the historical speed and damage weights are mapped to those matching slots in the new tail; all eight new sensor weights start at zero. The migrated tensor is then saved in current shape, but its experiment provenance remains D1/O1 until an explicit Reset creates a clean D2/O2 seeded run.

`VEHICLE_DYNAMICS_VERSION = 2` and `VEHICLE_OBSERVATION_VERSION = 2` are stored beside track-layout revision in completed PPO metrics, training segments, evaluation races, and new-brain experiment provenance. A comparison is fully matched only when seed, track, T/D/O revisions, and seeded-from-start status all agree.

The local executable gate runs this pure model for acceleration/automatic shifting, braking, surface-dependent steering, deliberate-slide recovery, bounded local observations, long-run finite integration, and legacy network migration. Presentation-only tire/engine audio is intentionally outside the deterministic learning path.

## Track layout v2: rounded circuits and physical arc distance

v0.9.1 replaces the distorted trigonometric centerlines with pure data-driven waypoint circuits. Each waypoint has an explicit corner-rounding distance. Track construction trims the incoming/outgoing straights around that waypoint and joins the trim points with a quadratic curve whose endpoint tangents align with those straights. The resulting dense closed path is then resampled at approximately 1.5 m of physical arc length.

The layout layer is renderer-independent (`track-layouts.js`) so the local Node source gate can execute every circuit without Three.js. A release fails if any circuit has a sampled centerline radius below 18 m, same-elevation non-adjacent centerline clearance below 15 m, or sample spacing outside an 8% envelope. This prevents the normal-offset asphalt/shoulder ribbons from folding through themselves at pathological corners.

Approximate v2 lap lengths are 490 m Balanced Loop/Counterflow, 585 m Technical Circuit, 680 m Fast Sweepers, 525 m Figure Eight, and 980 m Grand Prix. The Figure Eight remains grade-separated; nonlocal-clearance validation ignores crossings only when their vertical separation exceeds the configured elevation threshold.

`trackDistance[]` stores cumulative centerline arc distance at every sample. Forward/backward reward progress and race-position scoring use wrapped differences in this distance rather than `index delta × average segment`. Grid rows, trackside-camera lead, center dashes, and tree spacing are also expressed in meters and converted to sample counts from the current circuit spacing.

The Whole Track spectator camera derives its target/height from current track bounds. Fog is temporarily removed only while rendering this human-facing overview; neural observer cameras keep the existing fog and observation path.

Because circuit geometry is part of the environment, `TRACK_LAYOUT_VERSION = 2` remains explicit provenance beside the v1.0 D/O revisions. Existing v0.9.0 history defaults to T1/D1/O1 as appropriate; v0.9.1 history is T2/D1/O1; v1.0 training records T2/D2/O2. Comparison tooling only calls conditions fully matched when seed, selected track, all T/D/O revisions, and replayable-from-start provenance agree. Resetting an older brain clears old history and establishes a clean current-environment seeded run.

## Training tracks and clean starts

Training remains manually selectable across Balanced Loop, Counterflow, Technical Circuit, Fast Sweepers, Figure Eight Overpass, and Grand Prix.

Changing track preserves the active brain but discards an unfinished PPO batch, creates a clean grid, and resets recent-driving telemetry. Track exposure is recorded in the active brain/session.

PPO update batch size is selected per brain (256/512/1024, baseline 512). Full-grid clean starts are controlled independently with Adaptive, fixed 1/2/4/8-update intervals, or failures-only running. Individual failures still respawn immediately.

## Reward, surfaces, and direction

The v0.7 signed-progress reward/surface model remains in place:

- forward progress earns reward;
- backward progress produces a larger-magnitude per-meter penalty;
- shoulder and grass add penalties and reduce effective control/grip;
- grass is substantially worse than shoulder;
- laps earn a bonus;
- prolonged off-road/stuck state or 100 damage terminates an episode;
- collisions penalize both participants.

Exact track-direction alignment shown in the UI is human-facing telemetry only. The narrow edge strips repeat three distinct luminance tones in track-forward order. A forward view therefore sees one cyclic ordering of the three tones while a reversed view sees the opposite ordering, giving the vision policy a directional cue inside the rendered camera observation without an explicit track-direction input.

The v1.0 world-velocity/yaw/slip state is the authoritative motion model. Slip/yaw telemetry is not itself rewarded; the learner still succeeds by making signed track progress while remaining on usable surfaces.

## Collision and audio

Cars use oriented rectangular footprints and a separating-axis overlap test. Overlap is resolved even during damage cooldown; hard impacts use relative `vx/vz` closing velocity to apply separating impulses, yaw damping, damage, and reward penalties.

Track construction records lightweight tree trunk colliders separately from their Three.js meshes. Tree hits separate the footprint, redirect and strongly damp the car's world velocity/yaw state, then apply damage/reward consequences. This keeps scenery physics independent of rendering objects.

Impact particles are presentation-only and hidden from neural POV capture/headless learning. Web Audio derives engine pitch from RPM and tire scrub/skid noise from lateral grip use/slip, plus collision transients; none of those presentation layers write simulation state.

## Evaluation race

Evaluation freezes the active brain, switches to deterministic argmax actions, and records no learning experiences. The same brain is copied across four drivers for the current v0.8 race mode. Results are attached to the active brain's session history.

Brain-vs-brain garage races, ghost comparisons, and tournaments are deliberately left for the Experiment Lab stage in [`TASKS.md`](TASKS.md).

## Next controlled work

The major environment/observation change is now versioned and test-gated. The next experiment work remains deliberately separate:

- **Experiment Lab:** CNN vision, ghost/tournament evaluation, curriculum; multi-brain arenas are deferred for now.
- **Later controlled tests:** vision-only vs vehicle senses, wet/low-grip distribution shift, and other physics variants should use explicit environment revisions rather than silently changing an existing run.
