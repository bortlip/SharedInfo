# POV RL Racing Lab

A browser-based reinforcement-learning racing laboratory. Four cars share an actor-critic policy, see the world through rendered POV cameras, and learn steering plus throttle/brake behavior from reward using clipped PPO-style backpropagation.

Current release: **v0.8.3**

- [Open the released simulator](https://bortlip.github.io/SharedInfo/simulations/rl-racing-lab/)
- [Open the modular source preview](https://bortlip.github.io/SharedInfo/simulations/rl-racing-lab/src/)
- [See the living work plan](TASKS.md)
- [Related lab: Perception Rover](https://bortlip.github.io/SharedInfo/simulations/perception-rover/)
- [Related lab: Neural Playground](https://bortlip.github.io/SharedInfo/simulations/neural-playground/)

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

The baseline remains available unchanged in shape:

**32×20 grayscale + speed + damage → 48 tanh → 15-action policy + value**

Creating a different architecture creates a **new brain** rather than silently reshaping the one you already trained. Existing brains stay in the session and can be switched back in later.

### Vision presets

| Vision | Visual values | Total inputs including speed + damage |
|---|---:|---:|
| 32×20 grayscale | 640 | 642 |
| 64×40 grayscale | 2,560 | 2,562 |
| 32×20 RGB | 1,920 | 1,922 |
| 64×40 RGB | 7,680 | 7,682 |

RGB stores normalized red, green, and blue values per pixel. Grayscale keeps the historical luminance conversion. Speed and damage remain the only non-image inputs.

### Dense-network presets

- **Baseline:** one 48-neuron tanh layer
- **Wide:** one 128-neuron tanh layer
- **Deep:** 96 → 48 tanh layers
- **Deep + wide:** 128 → 64 tanh layers

The UI shows the resulting layer sizes, parameter count, approximate Float32 tensor size, and forward-pass MAC count before a new brain is created. The Brain Library keeps those same architecture-cost stats beside measured PPO timing for trained brains. The generic PPO implementation backpropagates through any of these dense-layer presets.

Large dense image networks are deliberately allowed for experimentation, but they can be expensive in pure browser JavaScript. For example, **64×40 RGB + Wide is about 985,000 trainable parameters** and **64×40 RGB + Deep + wide is about 993,000**. Each PPO update still uses 512 experiences and three passes, so those combinations may spend substantial wall time in backpropagation. A small convolutional vision brain is therefore the next architecture item in [TASKS.md](TASKS.md).

## Live Brain Inspector

The selected driver now has a live network view showing:

- the exact grayscale or RGB image entering the policy;
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

- four drivers share the active brain;
- the selected track supplies observations and reward;
- PPO updates every 512 combined experiences;
- Adaptive clean starts begin at every PPO update and can relax to every 2, 4, and 8 updates as performance improves;
- fixed 1/2/4/8-update clean starts or failures-only running remain available.

In **Evaluation Race** mode:

- the active brain is frozen;
- actions use the deterministic highest-probability choice;
- no experiences or backpropagation are recorded;
- the four copies race for 1, 3, or 5 laps on any available circuit;
- completed results are stored with the active brain.

The Learning button also stays logically consistent through PPO. While backpropagation is running it continues to display **Pause learning** rather than flickering to Start. If Pause is clicked during backprop, the current optimizer update finishes safely and learning remains paused afterward.

## Progress views

Two charts answer different questions:

- **Recent driving:** the last 60 simulated seconds, one line per driver, useful for seeing what the cars are doing right now.
- **Complete training timeline:** average and best net run distance by PPO update from update 0, including training-track change markers.

Run distance is peak **net** forward progress from a spawn. Driving backward first reduces net progress, so rocking forward and backward cannot inflate the metric by repeatedly counting the same meters.

The dashboard also shows best-ever run, off-road percentage, reward/experience, failure resets, total experiences, real training time, simulated training time, action mix, clean-start cadence, and achieved simulation speed.

## World, direction, collisions, and sound

Tracks use dark asphalt, warning-edge paint, red/white curb markers, shoulder, grass, center markings, roadside scenery, and painted forward-direction arrows. Shoulder and grass reduce effective steering/acceleration/braking authority and scrub speed, with grass substantially worse.

The policy still receives no hidden track-center or track-tangent oracle. Signed track progress rewards forward travel and penalizes backward travel; painted arrows put a direction clue in the actual camera image. Exact FORWARD / ACROSS / WRONG WAY alignment shown in the dashboard is human-facing telemetry only.

Cars use oriented rectangular collision footprints rather than a simple center-distance threshold, allowing close side-by-side running while detecting rear-end contact before substantial visual overlap. Hard impacts cause more damage and speed loss.

Optional Web Audio synthesizes engine tone from speed/gear/throttle and plays a short impact sound for collisions. Audio is presentation-only and never feeds the policy or simulation state.

The current vehicle dynamics still use heading + scalar speed. Shoulder/grass handling approximates traction loss, but there is **not yet true lateral velocity, slip angle, or recoverable oversteer**. Those are tracked as a later vehicle-dynamics stage and will be paired with fair vehicle-local proprioception rather than reintroducing partial observability.

## Safe speed and headless invariants

All 1×/2×/4×/10×/50× settings use the same chronological scheduler:

**fixed 1/60-second physics ticks → policy decision every 0.10 simulated seconds**

Higher requested speeds ask the browser to process more identical simulated work per wall-clock second; they do not switch physics or policy timing. At high speed the spectator/dashboard are simply repainted less often.

Headless is a **presentation flag, not a learning mode**. It suppresses spectator and expensive dashboard/inspector painting, but physics, neural POV rendering, observations, actions, reward, experience collection, PPO, and reset logic use the same path.

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
src/js/state.js       Configurable vision/network presets, constants, mutable state.
src/js/scene.js       Three.js renderer, cameras, dynamic POV render targets.
src/js/tracks.js      Track geometry, surfaces, markings, scenery.
src/js/cars.js        Car meshes, state, grid placement, direction telemetry.
src/js/model.js       Configurable dense actor-critic networks and input gradients.
src/js/perception.js  Configurable grayscale/RGB POV observations.
src/js/simulation.js  Policy decisions and experience collection.
src/js/physics.js     Vehicle dynamics, rewards, surfaces, collisions.
src/js/session.js     Multiple brains, IndexedDB autosave, import/export, history.
src/js/training.js    Generic dense PPO backprop and progress metrics.
src/js/race.js        Frozen-policy evaluation races and mode transitions.
src/js/brain-viz.js   Hidden activations, policy display, saliency/sensitivity.
src/js/audio.js       Presentation-only engine and collision audio.
src/js/ui.js          Driver cards, charts, Brain Inspector, Session Manager.
src/js/runtime.js     Chronological scheduler and control wiring.
```

Three.js is loaded as an exact-version browser ESM dependency from jsDelivr. Neural-network training, sessions, and learned state remain local to the browser unless explicitly exported.
