# POV RL Racing Lab

A browser-based reinforcement-learning racing laboratory. Four cars share one actor-critic policy, see the world through their own rendered POV cameras, and learn steering plus throttle/brake behavior from reward using clipped PPO-style backpropagation.

Current release: **v0.5.0**

- [Open the released simulator](https://bortlip.github.io/SharedInfo/simulations/rl-racing-lab/)
- [Open the modular source preview](https://bortlip.github.io/SharedInfo/simulations/rl-racing-lab/src/)
- [Related lab: Perception Rover](https://bortlip.github.io/SharedInfo/simulations/perception-rover/)
- [Related lab: Neural Playground](https://bortlip.github.io/SharedInfo/simulations/neural-playground/)

## v0.5: keep the learner, restore the lab

v0.4 reproduced the earlier v0.2 learning setup closely enough that track following began improving again. v0.5 keeps that learning problem intact while restoring useful experimentation features around it.

Training still uses:

- 32×20 grayscale POV plus normalized speed and damage
- 642 → 48 tanh → 15 joint steering/throttle actions plus one value head
- four cars sharing one policy
- 512 combined experiences per PPO update
- three PPO-style SGD passes at learning rate 0.00055
- the historical arcade vehicle model and reward scale
- the 300-sample historical Balanced Loop and its original visual landmarks
- **a full four-car grid reset after every PPO update**

The training track remains locked to Balanced Loop so faster execution, telemetry, and races do not silently change the distribution that started learning again.

## Safe 10× / 50× scheduling

v0.5 restores 1×, 2×, 4×, 10×, and 50× requested speeds with a new chronological scheduler.

The earlier high-speed implementation could advance a block of physics and then execute several policy decisions back-to-back at essentially the same vehicle state. That changes the experience stream and can fill a PPO batch with repeated observations.

The new scheduler advances fixed 1/60-second physics ticks in order and triggers exactly one policy decision each time 0.10 simulated seconds has elapsed:

**physics → physics → … → decision → physics → …**

Increasing the requested speed therefore asks the browser to process more correctly ordered simulated time per real second; it does not change the policy-decision cadence. The **Actual** indicator reports achieved speed when the machine cannot sustain the requested rate.

## Headless training

**Headless training** suppresses the large spectator render and throttles dashboard work so more of the frame budget goes to simulation and learning.

It is not completely render-free: the four tiny offscreen POV cameras must still render because those pixels are the neural network's observation. Removing them would change the learning problem.

## Measuring learning progress

The main progress graph plots two values for each completed PPO update:

- **average run distance** — average peak net forward progress reached by failed episodes plus the four active run segments at the batch boundary
- **best run distance** — the greatest peak net forward progress represented in that update

“Net” matters: backing up subtracts progress before a later advance can set a new peak, so repeatedly rocking forward/backward cannot inflate the graph. These measures are more useful than cumulative distance because cumulative distance mostly measures how long the simulator has been running. If driving competence is improving, average and best run distance should generally trend upward.

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

Training remains locked to the historical Balanced Loop, but evaluation races can use:

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

Checkpoint network format remains version 3 because the learning architecture has not changed. v0.5 additionally stores progress history, wall/simulated training time, and best-run distance when available.

Older compatible checkpoints can still be loaded. Old history that predates the new run-distance metrics is accepted; the new progress chart simply begins once v0.5-style metrics exist.

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
