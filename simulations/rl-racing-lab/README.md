# POV RL Racing Lab

A browser-based reinforcement-learning racing laboratory. Four cars share one actor-critic policy, see the world through their own rendered POV cameras, and learn steering plus throttle/brake behavior from reward using clipped PPO-style backpropagation.

Current release: **v0.6.0**

- [Open the released simulator](https://bortlip.github.io/SharedInfo/simulations/rl-racing-lab/)
- [Open the modular source preview](https://bortlip.github.io/SharedInfo/simulations/rl-racing-lab/src/)
- [Related lab: Perception Rover](https://bortlip.github.io/SharedInfo/simulations/perception-rover/)
- [Related lab: Neural Playground](https://bortlip.github.io/SharedInfo/simulations/neural-playground/)

## v0.6: selectable training + adaptive clean starts

The v0.4/v0.5 work recovered a learning setup that visibly improves again. v0.6 keeps that learner intact but restores deliberate training on every circuit and separates **PPO update cadence** from **full-grid reset cadence**.

Training still uses:

- 32×20 grayscale POV plus normalized speed and damage
- 642 → **48-neuron tanh hidden layer** → 15 joint steering/throttle actions plus one value head
- four cars sharing one policy
- **512 combined experiences per PPO update**
- three PPO-style SGD passes at learning rate 0.00055
- the historical arcade vehicle model and reward scale

The training-track selector now offers Balanced Loop, Counterflow, Technical Circuit, Fast Sweepers, Figure Eight Overpass, and Grand Prix. Changing training tracks preserves the brain, discards only the unfinished PPO batch, resets the cars cleanly, and restarts the adaptive clean-start stage for that circuit.

PPO still runs every 512 experiences. Synchronized grid resets are controlled separately: Adaptive starts with a clean grid every update, then relaxes to every 2, 4, and 8 PPO updates as broad average run distance or repeated lap completions improve. Fixed 1/2/4/8-update cadences and **Failures only** are also available. Individual off-road/stuck/damage failures always respawn immediately.

## Safe 10× / 50× scheduling

v0.6 uses the same simulation scheduler at every requested speed. Speed changes only how much identical simulated time the browser is asked to process per real second.

The scheduler advances fixed 1/60-second physics ticks in chronological order and triggers one policy decision every 0.10 simulated seconds:

**physics → physics → … → decision → physics → …**

The scheduler does not branch on 1× versus 50×. At 10× and 50× the spectator and dashboard simply repaint less frequently so rendering consumes less of the real-time budget. If the machine cannot sustain the requested rate, the **Actual** indicator reports the lower achieved rate instead of changing physics or policy cadence.

At every PPO boundary the fixed-step and decision accumulators are cleared before backpropagation. This prevents unused high-speed wall-clock budget from spilling into the next experience batch whether the cars clean-start or continue from their current positions.

## Headless display

Headless is now deliberately a **presentation flag, not a training mode**. The fixed-step simulation scheduler never inspects the headless flag. Physics, POV captures, decisions, rewards, experience collection, PPO math, batch size, and full-grid resets follow exactly the same code path with headless on or off.

Headless only suppresses the large spectator render and expensive driver/chart repainting. The four tiny offscreen POV cameras must still render because those pixels are the neural network's observation.

## Measuring learning progress

The progress graph keeps the **entire run from update 0**, rather than only a recent rolling window. Completed PPO updates remain the historical record, and the current partial batch appears as a live endpoint while training is visible.

It plots:

- **average run distance** — average peak net forward progress reached by failed episodes plus the four active run segments at the batch boundary
- **best run distance** — the greatest peak net forward progress represented in that update

“Net” matters: backing up subtracts progress before a later advance can set a new peak, so repeatedly rocking forward/backward cannot inflate the graph. The display may downsample points when a run becomes very long, but the underlying history and checkpoints retain every recorded update.

The dashboard also shows:

- best run ever
- off-road percentage for the last completed update
- reward per experience
- resets per update
- total experiences
- wall-clock training time
- simulated training time
- steering/throttle action mix
- update count and achieved simulation speed

The chart is intentionally noisy. Look for a trend over many updates rather than requiring every update to beat the previous one.

## Evaluation races are back

Both training and evaluation can use:

- Balanced Loop
- Counterflow
- Technical Circuit
- Fast Sweepers
- Figure Eight Overpass
- Grand Prix

Choose a race track and 1, 3, or 5 laps, then start an evaluation race. The current network is frozen for the race, actions are deterministic highest-probability choices, and no experiences or backpropagation are recorded.

This cleanly separates two questions:

1. Is the policy getting better at the environment it trains on?
2. Does that visual driving skill transfer to a different circuit?

The Figure Eight collision test also respects the overpass height, so cars on vertically separated branches do not collide through the bridge.

## Checkpoints

Checkpoint network format remains version 3 because the learning architecture has not changed. v0.6 additionally stores the selected training track, clean-start mode/adaptive cadence, full progress history, wall/simulated training time, and best-run distance when available.

Older compatible checkpoints can still be loaded. Missing v0.6 training-control fields fall back to Balanced Loop plus Adaptive clean starts.

For a clean comparison of learning behavior, use **Reset learning** and begin from a fresh random network.

## Folder structure

```text
index.html            Stable redirect to the released simulator.
simulator.html        Released application shell.
src/index.html        Direct source preview.
src/styles.css        UI and simulator styling.
src/js/version.js     Visible release version.
src/js/app.js         Cache-safe bootstrap and runtime error boundary.
src/js/state.js       Constants and shared simulator/training state.
src/js/scene.js       Three.js renderer, cameras, lights, and ground.
src/js/tracks.js      Historical training track plus evaluation circuits.
src/js/cars.js        Car meshes, state, grid placement, and respawning.
src/js/model.js       Actor-critic neural network.
src/js/perception.js  Per-car rendered POV observations.
src/js/simulation.js  Policy decisions and experience collection.
src/js/physics.js     Historical training dynamics/rewards and collisions.
src/js/training.js    PPO batch construction, backprop, and progress metrics.
src/js/race.js        Frozen-policy evaluation races and checkpoints.
src/js/ui.js          Spectator camera, telemetry, and progress chart.
src/js/runtime.js     Chronological scheduler and controls.
DESIGN.md             Learning-control and execution design rationale.
```

Three.js is loaded as a browser ESM dependency from jsDelivr. Neural-network training and learned state remain local to the browser.
