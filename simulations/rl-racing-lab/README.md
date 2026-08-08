# POV RL Racing Lab

A browser-based reinforcement-learning racing laboratory. Four cars share one actor-critic policy, perceive the world through their own rendered POV camera, and learn steering plus throttle/brake behavior from reward using clipped PPO-style backpropagation.

Current release: **v0.4.0**

- [Open the released simulator](https://bortlip.github.io/SharedInfo/simulations/rl-racing-lab/)
- [Open the modular source preview](https://bortlip.github.io/SharedInfo/simulations/rl-racing-lab/src/)
- [Related lab: Perception Rover](https://bortlip.github.io/SharedInfo/simulations/perception-rover/)
- [Related lab: Neural Playground](https://bortlip.github.io/SharedInfo/simulations/neural-playground/)

## v0.4 historical learning control

v0.4 is intentionally not a feature release. It is a diagnostic control designed to answer one question: **can the modular simulator reproduce the learning behavior of the earlier v0.2 prototype that visibly improved at track following?**

The learning-critical pieces are restored from that observed-good prototype:

- 32×20 grayscale POV frame plus normalized speed and damage.
- 642 → 48 tanh → 15 joint steering/throttle actions plus one value head.
- Four cars sharing one policy.
- 512 combined experiences per PPO update.
- Three PPO-style backpropagation passes at learning rate 0.00055.
- Exploration temperature starts at 1.35 and decays toward 0.72.
- Simple heading-based arcade dynamics.
- The original Balanced Loop sampled at 300 points.
- Original center-dash cadence: every 10 track samples.
- Original roadside-tree cadence: every 18 samples, 2.2 units beyond the road edge.
- Original reward scale: forward progress ×0.075, backward progress ×0.16, off-road −0.16/sec, failure −5, lap +15.
- Original symmetric collision penalty.
- **A full four-car grid reset after every PPO update.**

The full-grid reset is the most important restored behavior. Every new batch again begins with four cars correctly aligned, on pavement, moving at the same starting speed, and seeing clean road-following states.

## Why the track is locked

Balanced Loop is deliberately the only active track in v0.4. Multiple tracks, transfer tests, procedural curricula, richer reward shaping, slip physics, temporal vision, and racecraft incentives are all useful ideas, but they are confounding variables while the basic learner is under diagnosis.

The simulator still retains the modern evaluation-race and checkpoint infrastructure, but loading a checkpoint always places the brain onto the historical Balanced Loop. Use **Reset learning** before judging the control experiment so the run begins with a fresh random network.

## What remains modern

Operational improvements that do not change the intended learning problem are retained:

- modular JavaScript files
- historical 1×/2×/4× scheduler; later Fast Training / 8× / 20× / 50× modes are deliberately disabled for the control
- achieved-speed telemetry
- deterministic evaluation races
- checkpoint save/load
- per-update learning metrics and reward history
- immediate POV previews and runtime error reporting
- cache-safe versioned asset loading

## How to test the control

1. Open v0.4.0 and click **Reset learning**.
2. Leave the track on the locked Balanced Loop.
3. Start learning.
4. Watch reward/experience, forward meters/experience, off-road percentage, failure distance, resets, laps, and action mix.
5. After roughly 50–100 updates, look for a consistent behavioral trend rather than a single noisy update.

If the control learns again, later features should be reintroduced one at a time. If the control still does not learn, the next step should be instrumentation of the PPO/observation pipeline rather than more reward tuning.

## Learning versus evaluation

Learning mode samples actions stochastically and updates the shared network every 512 experiences. Evaluation race mode resets the grid, freezes the network, uses deterministic highest-probability actions, and performs no backpropagation.

## Folder structure

```text
index.html           Stable redirect to the released simulator.
simulator.html       Released application shell.
src/index.html       Direct source preview.
src/styles.css       UI and simulator styling.
src/js/version.js    Visible release version.
src/js/app.js        Cache-safe bootstrap and runtime error boundary.
src/js/state.js      Constants and shared simulator/training state.
src/js/scene.js      Three.js renderer, cameras, lights, and ground.
src/js/tracks.js     Track definition and generated road geometry.
src/js/cars.js       Car meshes, state, grid placement, and respawning.
src/js/model.js      Actor-critic neural network.
src/js/perception.js Per-car rendered POV observations.
src/js/simulation.js Policy decisions and experience collection.
src/js/physics.js    Historical-control dynamics, rewards, and collisions.
src/js/training.js   PPO batch construction and backpropagation.
src/js/race.js       Evaluation races and checkpoints.
src/js/ui.js         Spectator camera, telemetry, and dashboard rendering.
src/js/runtime.js    Animation loop and controls.
DESIGN.md            Control rationale and validation strategy.
```

Three.js is loaded as a browser ESM dependency from jsDelivr. Neural-network training and learned state remain local to the browser.
