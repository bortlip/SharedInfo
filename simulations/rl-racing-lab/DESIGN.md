# POV RL Racing Lab — v0.8.1 Design

## Goal

v0.8 turns the recovered racing learner into a configurable experimental platform without discarding the invariants that made the baseline learn again.

The causal chain remains:

**rendered POV + vehicle-local speed/damage → policy → action → vehicle movement → reward → PPO/backprop → updated policy**

Configuration, visualization, persistence, and sound are built around that chain. Hidden track knowledge is still not supplied as a model input.

The current roadmap is kept in one living file: [`TASKS.md`](TASKS.md).

## Brain identity and configuration

A **brain** is now a persistent experiment object. Its vision preset and network preset are part of its identity. The active brain also owns its weights, training timeline, track exposure, and evaluation-race history.

Architecture-sensitive controls do not mutate an already-trained network. Choosing a different vision/network setup and pressing **Create new brain** first snapshots the current brain into the session, then creates a fresh network with the requested shape.

A brain may also be duplicated, which creates a child experiment beginning from the same current weights/history. This is useful for branching an already-learned policy into different future training regimes.

## Vision presets

Every POV render target is recreated when the active brain changes configuration.

| Preset | Image channels | Visual inputs | + speed/damage | Total inputs |
|---|---:|---:|---:|---:|
| 32×20 grayscale | 1 | 640 | 2 | 642 |
| 64×40 grayscale | 1 | 2,560 | 2 | 2,562 |
| 32×20 RGB | 3 | 1,920 | 2 | 1,922 |
| 64×40 RGB | 3 | 7,680 | 2 | 7,682 |

The offscreen render is twice the configured observation size in each dimension and is averaged down 2×2. Grayscale uses luminance; RGB keeps separate normalized R/G/B channels. Image values are normalized to approximately `[-1, +1]`. Normalized speed and damage occupy the last two input positions.

The AI still does **not** receive lateral track position, centerline distance, track tangent, next-turn geometry, opponent coordinates, or other world-oracle features.

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

**642 → 48 tanh → 15-action policy + value**

Its shape, action encoding, reward, and PPO hyperparameters are unchanged from the recovered baseline.

Example parameter counts:

| Vision | Baseline 48 | Wide 128 | Deep 96→48 | Deep+Wide 128→64 |
|---|---:|---:|---:|---:|
| 32×20 gray | 31,648 | 84,368 | 67,168 | 91,600 |
| 64×40 gray | 123,808 | 330,128 | 251,488 | 337,360 |
| 32×20 RGB | 93,088 | 248,208 | 190,048 | 255,440 |
| 64×40 RGB | 369,568 | 985,488 | 743,008 | 992,720 |

The large dense combinations are intentionally exposed as experiments, not claimed to be efficient designs. Their cost is a useful demonstration of why spatial architectures such as CNNs matter. A small CNN is tracked for the next architecture stage.

## Generic PPO backprop

Training still uses:

- four drivers sharing the active policy;
- decisions every 0.10 simulated seconds;
- 512 combined experiences per PPO update;
- γ = 0.985;
- GAE λ = 0.92;
- PPO clip = 0.18;
- three SGD-style passes;
- learning rate = 0.00055;
- exploration temperature 1.35 decaying toward 0.72.

Forward propagation stores every hidden activation. Backpropagation computes the policy/value gradient into the final hidden layer, then walks the configured tanh layers backward. Hidden deltas are computed before weights are updated, preserving the normal feed-forward backprop dependency.

The optimizer remains intentionally small and educational rather than a production PPO implementation.

Each PPO update measures optimizer wall time beginning after the deliberate 90 ms BACKPROP-display pause and ending after the three training passes. `lastPpoMs`, cumulative PPO time, and PPO count are stored in the brain training snapshot, allowing the UI to report both the latest and mean optimizer time for that architecture on the current machine.

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

Inspector work is presentation-only. It is throttled and skipped in headless display mode so it cannot become part of the agent-environment timing contract.

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

Headless remains presentation-only. It may suppress spectator, cards, charts, and Brain Inspector painting, but it does not select another physics, observation, reward, experience, PPO, or reset path. Neural POV render targets still run because they are the observation.

## Training tracks and clean starts

Training remains manually selectable across Balanced Loop, Counterflow, Technical Circuit, Fast Sweepers, Figure Eight Overpass, and Grand Prix.

Changing track preserves the active brain but discards an unfinished PPO batch, creates a clean grid, and resets recent-driving telemetry. Track exposure is recorded in the active brain/session.

PPO updates remain every 512 experiences. Full-grid clean starts are controlled independently with Adaptive, fixed 1/2/4/8-update intervals, or failures-only running. Individual failures still respawn immediately.

## Reward, surfaces, and direction

The v0.7 signed-progress reward/surface model remains in place:

- forward progress earns reward;
- backward progress produces a larger-magnitude per-meter penalty;
- shoulder and grass add penalties and reduce effective control/grip;
- grass is substantially worse than shoulder;
- laps earn a bonus;
- prolonged off-road/stuck state or 100 damage terminates an episode;
- collisions penalize both participants.

Exact track-direction alignment shown in the UI is human-facing telemetry only. Painted arrows put a direction clue into the rendered camera observation.

The current physics is still heading + scalar speed. There is no separate lateral velocity, yaw rate, or true slip angle yet.

## Collision and audio

Cars use oriented rectangular footprints and a separating-axis overlap test. Overlap is resolved even while collision damage is cooling down; new hard impacts compute severity from relative closing speed and remove substantial speed/damage.

Web Audio adds synthesized engine tone and collision transients. It reads speed, gear, throttle, surface, selected driver, and collision severity but does not write simulation state. Audio is therefore purely presentation.

## Evaluation race

Evaluation freezes the active brain, switches to deterministic argmax actions, and records no learning experiences. The same brain is copied across four drivers for the current v0.8 race mode. Results are attached to the active brain's session history.

Brain-vs-brain garage races, ghost comparisons, and tournaments are deliberately left for the Experiment Lab stage in [`TASKS.md`](TASKS.md).

## Next controlled architecture/dynamics work

The living roadmap deliberately separates future changes:

- **Experiment Lab:** CNN vision, matched-seed comparisons, brain-vs-brain races, tournaments, curriculum.
- **Vehicle Dynamics:** true velocity/slip/yaw plus fair vehicle-local proprioception.

That separation matters. It lets us answer whether a changed architecture helped before simultaneously changing the physical state the architecture is being asked to infer.
