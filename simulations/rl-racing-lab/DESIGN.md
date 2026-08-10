# POV RL Racing Lab — v1.2.3 Design

## Goal

v1.2 keeps the configurable dense-brain experiment platform and D2 sim-cade vehicle model, then removes avoidable learning noise: correct next-state PPO bootstrapping, continuous signed progress, a clean one-car baseline, configurable ghost/physical traffic and staggered population, mirrored/larger circuits, and deterministic periodic track rotation.

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

The comparison UI derives rows from the brains already stored in the current session. **Matched experience budget** chooses the smallest latest completed experience count among trained brains and, for each brain, displays the closest completed PPO metric to that common target. **Latest completed update each** instead shows every brain at its own latest checkpoint. The displayed actual experience count remains visible, so differing PPO batch/population group sizes are not falsely represented as an exact sample match.

Comparison rows include architecture, seed/provenance, update/experience, track/mirror variant, learning setup, average/best run, reward/experience, off-road percentage, measured PPO time, and PPO configuration. A run is called fully matched only when seed, track/mirror variant, track-layout revision, vehicle-dynamics revision, vehicle-observation revision, reward-contract revision, trainer revision, **population/collision/stagger/reset/track-rotation setup**, and replayable-from-start provenance all agree.
## Vision presets

Every POV render target is recreated when the active brain changes configuration. v1.0.1 uses a 2.5:1 neural view for every preset: the low-resolution geometry is 40×16 and the high-resolution geometry is 80×32. This preserves the previous visual-value counts while reallocating pixels from vertical sky coverage to lateral racing context.

| Preset | Image channels | Visual inputs | Vehicle-local inputs | Total inputs |
|---|---:|---:|---:|---:|
| 40×16 grayscale | 1 | 640 | 11 | 651 |
| 80×32 grayscale | 1 | 2,560 | 11 | 2,571 |
| 40×16 RGB | 3 | 1,920 | 11 | 1,931 |
| 80×32 RGB | 3 | 7,680 | 11 | 7,691 |

The offscreen render is twice the configured observation size in each dimension and is averaged down 2×2. The observer camera uses a 52° vertical FOV, which is about 101° horizontally at the 2.5:1 aspect ratio, and aims slightly downward toward the road. Grayscale uses luminance; RGB keeps normalized R/G/B channels. O4 uses eleven normalized local values: scalar speed over the full 40 m/s physical range, signed forward speed, lateral speed, yaw rate, slip angle, previous steering command, previous throttle/brake command, damage, RPM, gear, and actual rate-limited steering angle.

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

**651 → 48 tanh → 15-action policy + value**

The hidden shapes and 15-action encoding remain unchanged. v1.1 changes only the local observation tail plus the reward/trainer contracts; the vision geometry and D2 physical environment remain stable.

Example parameter counts:

| Vision | Baseline 48 | Wide 128 | Deep 96→48 | Deep+Wide 128→64 |
|---|---:|---:|---:|---:|
| 40×16 gray | 32,080 | 85,520 | 68,032 | 92,752 |
| 80×32 gray | 124,240 | 331,280 | 252,352 | 338,512 |
| 40×16 RGB | 93,520 | 249,360 | 190,912 | 256,592 |
| 80×32 RGB | 370,000 | 986,640 | 743,872 | 993,872 |

The large dense combinations are intentionally exposed as experiments, not claimed to be efficient designs. Their cost is a useful demonstration of why spatial architectures such as CNNs matter. A small CNN is tracked for the next architecture stage.

## Generic PPO backprop

Training uses:

- 1–10 configurable active drivers sharing one policy (fresh baseline: 1);
- decisions every 0.10 simulated seconds;
- γ = 0.985;
- GAE λ = 0.92;
- exploration temperature starting at 1.35, decaying from total collected experience on the historical 512-experience scale, and flooring at 0.72.

Four PPO update parameters are controlled per brain with discrete experiment-safe options. The historical baseline remains **512 experiences / 3 passes / learning rate 0.00055 / clip 0.18**. Available options are batch 256/512/1024, passes 1/3/5, learning rate 0.00025/0.00055/0.001, and clip 0.10/0.18/0.25. Changing one discards only the unfinished experience batch so a single optimizer update never mixes configurations.

A2's experience-based exploration remains in A3: temperature is derived from total experience for each real action, stored with its transition, replayed at the same temperature, and differentiated with the required `1 / temperature` policy-gradient factor. PPO boundaries still begin optimization before any unused next actions are sampled, avoiding policy-RNG draws for actions that never execute.

A3 fixes the rollout-end value bootstrap. After the final real transition in a nonterminal rollout, PPO captures the car's **actual post-transition observation** and evaluates its scalar value without sampling an action. GAE therefore begins with `V(s[t+1])` rather than incorrectly reusing the previous action state's `V(s[t])`. Terminal rollouts bootstrap with zero as usual.

Each completed update records collection-time policy entropy, approximate KL, clip fraction, value RMSE/explained variance, reward components, per-surface progress, backtracking, stagnation, collision rate, **average/best completed lap time**, and the complete learning-environment setup. Lap timing uses simulated seconds from spawn/prior lap until one full track length of net progress is accumulated; failures discard the unfinished attempt. These are diagnostics/provenance, not additional reward terms.

Forward propagation stores every hidden activation. Backpropagation computes the policy/value gradient into the final hidden layer, then walks the configured tanh layers backward. Hidden deltas are computed before weights are updated, preserving the normal feed-forward backprop dependency.

The optimizer remains intentionally small and educational rather than a production PPO implementation: it still uses shuffled sample-wise SGD-style updates and component clamps rather than Adam/minibatches/global gradient-norm clipping. Those are now explicit controlled follow-up experiments rather than hidden implementation assumptions.

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

The neural observation tail contains eleven normalized vehicle-local values: scalar speed, signed forward speed, lateral speed, yaw rate, slip angle, previous steering command, previous throttle/brake command, damage, RPM, gear, and actual steering angle. The last value matters because physical steering is rate-limited, so the requested command is not sufficient to reconstruct wheel angle in a memoryless MLP. Local senses make hidden vehicle motion state observable without revealing track geometry or world coordinates.

Saved pre-v1.0 image+2 dense networks still migrate by preserving visual weights, mapping historical speed/damage into their matching slots, and zeroing every newly introduced sense. O3 image+10 networks migrate 650→651 by copying their entire existing first-layer row and zeroing only the appended steering-angle weight. Historical provenance is not rewritten by tensor migration; Reset establishes a clean current O4/R5/A3 seeded run.

`VEHICLE_DYNAMICS_VERSION = 2` remains the physical model and current `VEHICLE_OBSERVATION_VERSION = 4` denotes the wide neural camera plus eleven vehicle-local values. Current fresh metrics additionally stamp `TRACK_LAYOUT_VERSION = 3`, `REWARD_CONTRACT_VERSION = 5`, and `TRAINER_VERSION = 3`. Comparison is fully matched only when seed, track/mirror variant, T/D/O/R/A revisions, complete learning-environment setup, and seeded-from-start provenance all agree.

The local executable source gate is designed to validate R5 reward/reset math—including zero positive shoulder/grass progress, -0.20/sec shoulder, -0.50/sec grass, +10 legitimate lap completion, and -15 terminal failure—A3 bootstrap/temperature guardrails, O4 observation bounds and 642/650→651 migrations, acceleration/automatic shifting, braking, surface-dependent steering, deliberate-slide recovery, long-run finite integration, all T3 track geometries and mirroring, deterministic RNG streams, and classic-script load order. Presentation-only skid marks, impact effects, and tire/engine audio remain outside the deterministic learning path.

## Track layout v3: larger/mirrored circuits and continuous arc distance

T3 retains the rounded waypoint system introduced in v0.9.1: explicit straight/corner geometry is densely built and then resampled at approximately 1.5 m physical spacing. The renderer-independent `track-layouts.js` validates minimum centerline radius, same-elevation non-adjacent clearance, and uniform sample spacing before a circuit is accepted.

The circuit catalog now includes the original six layouts plus **Endurance Ring** and **Long Run Circuit**, giving experiments substantially longer horizons. Any generated circuit can also be mirrored left/right as a deterministic geometry transform; this is a separate track variant in history/comparison rather than silently being treated as the same exposure.

`trackDistance[]` still stores cumulative distance at samples for geometry and placement. R5 retains R3/R4's continuous progress mechanism: runtime projects each car onto the nearby centerline segment and interpolates a continuous arc coordinate inside that segment rather than quantizing reward to ~1.5 m samples. Grid rows, trackside-camera lead, center dashes, and tree spacing remain meter-based.

The Whole Track spectator camera derives its target/height from current track bounds. Fog is temporarily removed only while rendering this human-facing overview; neural observer cameras keep the existing fog and observation path.

Current v1.2.3 fresh training records **T3/D2/O4/R5/A3**. Older missing revision fields retain their historical defaults rather than being silently relabeled; continuing an older brain preserves its earlier revision-stamped history while new metrics/segments use the current contract, and Reset establishes a fresh current-contract seeded run.

## Training environment, tracks, and clean starts

Learning population is configurable from **1–10 active copies of the shared policy**. Ten meshes/cameras are preallocated, but only the first selected N participate in observation capture, physics, experience collection, PPO metrics, and learning UI. Evaluation ignores this setting and always activates four cars.

Fresh sessions use the deliberately simple baseline: **1 learner · staggered starts ON · physical training-car collisions OFF · Failures only resets · normal track · automatic rotation OFF**. Staggering distributes parallel learners around the circuit; disabling physical car/car interaction leaves the other learners visible in POV but removes collision impulses/damage/reward noise. Trees and surface physics remain physical. Enabling collisions turns the same population into genuine traffic training.

Training is manually selectable across Balanced Loop, Counterflow, Technical Circuit, Fast Sweepers, Figure Eight Overpass, Grand Prix, Endurance Ring, and Long Run Circuit. **Mirror track** deterministically negates the circuit's world-X geometry after generation while preserving sample order and driving direction, creating a left/right variant without a new random stream.

Optional **Auto-switch tracks** accumulates training experience and, at the first complete PPO boundary after each 8,192-experience interval, advances deterministically to the next circuit. The current PPO batch is therefore always collected on one track variant. Manual environment changes similarly discard any unfinished batch before rebuilding/resetting the active learners. Track/mirror exposure and the full learning setup are persisted with the brain and shown in experiment comparison.

PPO update batch size remains selected per brain (256/512/1024, baseline 512). Synchronized clean starts remain independently configurable at 2,048/4,096/8,192/16,384 experiences or adaptive progression through those budgets, but **Failures only** is now the fresh-session baseline. Individual failures always respawn immediately. With arbitrary 1–10 populations, combined experience advances in groups of active drivers, so a batch/reset/rotation threshold may be crossed by a few samples and is applied at the next safe decision/PPO boundary rather than splitting a parallel transition group.

## Reward, surfaces, and direction

Reward contract R5 keeps R4's dense continuous progress, lap/terminal outcome shaping, backward rate, collision rates, and episode termination timing, but removes the immediate incentive to keep advancing after leaving asphalt. Each physics step still projects the car onto the nearest nearby centerline segment and computes its continuous wrapped arc coordinate:

- forward road progress earns 0.075 reward per meter;
- shoulder earns no positive forward-progress reward and costs -0.20/sec while occupied;
- grass earns no positive forward-progress reward and costs -0.50/sec while occupied;
- backward progress costs 0.16 reward per meter regardless of surface;
- a lap is one full track length of accumulated signed net progress from the spawn/prior lap and earns a +10 completion reward;
- prolonged off-road state, insufficient useful velocity along the local track tangent, or 100 damage terminates an episode on the same timing rules as R4;
- the terminal -15 applies once, the car is frozen until the next policy boundary records the terminal transition, and collisions retain severity-based penalties when physical interaction is enabled.

Exact track-direction alignment shown in the UI is human-facing telemetry only. The narrow edge strips repeat three distinct luminance tones in track-forward order. A forward view therefore sees one cyclic ordering of the three tones while a reversed view sees the opposite ordering, giving the vision policy a directional cue inside the rendered camera observation without an explicit track-direction input.

The v1.0 world-velocity/yaw/slip state remains the authoritative motion model. Slip/yaw telemetry is not itself rewarded; the learner succeeds by making signed continuous track progress while remaining on usable surfaces.

## Collision and audio

Cars use oriented rectangular footprints and a separating-axis overlap test. Overlap is resolved even during damage cooldown; hard impacts use relative `vx/vz` closing velocity to apply separating impulses, yaw damping, damage, and reward penalties.

Track construction records lightweight tree trunk colliders separately from their Three.js meshes. Tree hits separate the footprint, redirect and strongly damp the car's world velocity/yaw state, then apply damage/reward consequences. This keeps scenery physics independent of rendering objects.

Persistent skid marks are presentation-only. The D2 motion equations and surface friction coefficients are unchanged; only the derived `tireScrub` display/audio signal is refined so roughly the first 2.6° of sideslip is treated as normal tire compliance rather than a skid, with stronger real slip, grip stress, and speed increasing scrub intensity. Rendering begins only once that slip-based signal is meaningful.

Each rear tire is independently projected onto nearby track segments before drawing. A tire over grass breaks its trail immediately; road/shoulder contact uses the projected surface height. Chunked `LineSegments` carry per-vertex grayscale colors so mild slides leave faint rubber and harder/faster slides leave darker rubber. Existing marks survive vehicle respawns, PPO updates, and clean starts; they are cleared with a track rebuild, capped at 240,000 line segments per circuit instance, and skipped during Headless learning. Neural observation capture hides the entire skid group, so previous driving history cannot leak into the policy image.

Impact particles are presentation-only and hidden from neural POV capture/headless learning. Web Audio derives engine pitch from RPM and tire skid noise from the same slip-based scrub signal, plus collision transients; none of those presentation layers write learning state.

## Evaluation race

Evaluation freezes the active brain, switches to deterministic argmax actions, and records no learning experiences. The same brain is copied across four drivers for the current v0.8 race mode. Results are attached to the active brain's session history.

Brain-vs-brain garage races, ghost comparisons, and tournaments are deliberately left for the Experiment Lab stage in [`TASKS.md`](TASKS.md).

## Next controlled work

v1.2 deliberately stops after cleaning the environment/reward/bootstrap contract. Architecture and optimizer changes remain separate experiments so their effect is measurable:

- **Experiment Lab:** small CNN vision brain, ghost/checkpoint comparison, tournament evaluation, and performance-threshold curriculum on top of the new manual/periodic environment controls.
- **Trainer experiments:** compare GAE λ, entropy regularization, value-loss weight, Adam/minibatching, KL stopping, and global gradient clipping under matched T3/D2/O4/R5/A3 seeds rather than changing several at once.
- **Later controlled tests:** vision-only vs vehicle senses, wet/low-grip distribution shift, and other physics variants should use explicit environment revisions rather than silently changing an existing run.
