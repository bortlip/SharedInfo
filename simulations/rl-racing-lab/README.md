# POV RL Racing Lab

A browser-based reinforcement-learning racing laboratory. Four cars share one actor-critic policy, perceive the world through their own rendered POV camera, and learn steering plus throttle/brake behavior from reward using clipped PPO-style backpropagation.

Current release: **v0.3.1**

- [Open the released simulator](https://bortlip.github.io/SharedInfo/simulations/rl-racing-lab/)
- [Open the modular source preview](https://bortlip.github.io/SharedInfo/simulations/rl-racing-lab/src/)
- [Related lab: Perception Rover](https://bortlip.github.io/SharedInfo/simulations/perception-rover/)
- [Related lab: Neural Playground](https://bortlip.github.io/SharedInfo/simulations/neural-playground/)

## v0.3 baseline restoration

v0.3 deliberately restores the learning-critical design from the earlier prototype that visibly learned track following. The project had added several difficult changes at once—velocity/slip dynamics, a temporal image channel, separate steering/throttle policy heads, dense reward changes, and automatic multi-track rotation—making it impossible to tell which change caused the regression.

The default learner is again intentionally simple:

- 32×20 grayscale POV frame = 640 visual inputs.
- Normalized speed and damage = 2 additional inputs.
- 642 → 48 tanh hidden units.
- One joint 15-action policy head: 5 steering choices × 3 brake/coast/throttle choices.
- One value head.
- Simple heading-based arcade vehicle dynamics with no independent lateral velocity/slip state.
- The earlier progress/off-track/stuck/lap reward scale and PPO learning-rate/exploration schedule.
- Four cars sharing one policy and one 512-experience training batch.

This gives the project a known baseline again. More realistic dynamics or temporal perception should only be reintroduced one feature at a time after the baseline is shown to learn reliably.

## Tracks are experiments, not automatic curriculum

Balanced Loop, Counterflow, Technical Circuit, Fast Sweepers, Figure Eight Overpass, and Grand Prix are still available, but v0.3 removes automatic/random track switching from the normal learning loop.

Train on one selected track first. Changing the track preserves the current brain and resets the cars, which makes the change an explicit transfer/generalization experiment. For example:

1. Train on Balanced Loop until performance improves.
2. Pause and switch to Counterflow without resetting the brain.
3. Observe how well the learned visual policy transfers before doing more training.

This is much easier to interpret than changing the environment underneath a novice learner every few updates.

## Reward and collisions

v0.3.1 strengthens track-discipline shaping without changing the network, PPO algorithm, action space, or vehicle physics. Forward progress on pavement is worth substantially more than progress on grass, and progress near the centerline is worth more than progress near the edge. Cars also receive a small increasing edge penalty before leaving the road, a stronger continuous off-road penalty, and reset after 1.75 seconds off road instead of 3 seconds. There is deliberately no positive reward merely for remaining stationary on pavement, which avoids teaching the policy to stop.

Both cars physically take damage in a collision. The learning penalty is apportioned using approximate collision responsibility based on each car's motion into the contact, so a car that is merely rear-ended is not punished as if it caused the crash.

Passes and race position remain telemetry rather than a per-frame reward source. The current priority is learning reliable driving before adding richer racecraft incentives again.

## Learning telemetry

The dashboard intentionally emphasizes per-update metrics rather than lifetime cumulative reward:

- reward per experience
- forward meters per experience
- off-road percentage
- average distance before a failed episode
- resets per batch
- laps and collisions
- steering/throttle action mix
- reward-per-experience history

These metrics should make it much clearer whether the policy is actually improving.

## Learning versus evaluation

Learning mode samples actions stochastically, gathers 512 experiences, pauses briefly for PPO backpropagation, and then continues from the current world state. Only failed cars respawn.

Evaluation race mode resets the grid, freezes the current network for the entire 1-, 3-, or 5-lap race, and uses deterministic highest-probability actions. No learning occurs during the evaluation race.

## Fast training

Requested speeds are 1×, 2×, 4×, 8×, 20×, and 50×. The UI also reports achieved simulation speed.

Fast Training suppresses the expensive spectator render and reduces ordinary UI work. It cannot remove rendering completely because the neural policy's observation is itself produced by four tiny rendered POV cameras.

## Checkpoints

v0.3 saves the restored single-frame / joint-action network as checkpoint version 3.

- v1 checkpoints are directly compatible with the restored architecture.
- v2 temporal/split-head checkpoints can be approximately migrated by retaining their current-frame visual weights, discarding the motion channel, and combining steering/throttle logits into the 15 joint actions.

A migrated checkpoint should be allowed to learn further before its racing performance is judged.

## Folder structure

```text
index.html          Stable redirect to the released simulator.
simulator.html      Released application shell.
src/index.html      Direct source preview.
src/styles.css      UI and simulator styling.
src/js/version.js   Visible release version.
src/js/app.js       Cache-safe bootstrap and runtime error boundary.
src/js/state.js     Constants and shared simulator/training state.
src/js/scene.js     Three.js renderer, cameras, lights, and ground.
src/js/tracks.js    Track definitions and generated road geometry.
src/js/cars.js      Car meshes, state, grid placement, and respawning.
src/js/model.js     Baseline actor-critic neural network.
src/js/perception.js Per-car rendered POV observations.
src/js/simulation.js Policy decisions and experience collection.
src/js/physics.js   Baseline vehicle dynamics, rewards, and collisions.
src/js/training.js  PPO batch construction and backpropagation.
src/js/race.js      Evaluation races, track changes, and checkpoints.
src/js/ui.js        Spectator camera, telemetry, and dashboard rendering.
src/js/runtime.js   Animation loop and controls.
DESIGN.md           Design rationale and experiment strategy.
```

Three.js is loaded as a browser ESM dependency from jsDelivr. Neural-network training and learned state remain local to the browser.
