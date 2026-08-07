# POV RL Racing Lab

A browser-based reinforcement-learning racing laboratory. Four cars share one actor-critic policy, perceive the world through their own rendered POV camera stream, and learn steering plus throttle/brake behavior from reward using PPO-style backpropagation.

Current release: **v0.2.1**

- [Open the released simulator](https://bortlip.github.io/SharedInfo/simulations/rl-racing-lab/)
- [Open the modular source preview](https://bortlip.github.io/SharedInfo/simulations/rl-racing-lab/src/)
- [Related lab: Perception Rover](https://bortlip.github.io/SharedInfo/simulations/perception-rover/)
- [Related lab: Neural Playground](https://bortlip.github.io/SharedInfo/simulations/neural-playground/)

## What it demonstrates

- Four simultaneous drivers using one shared neural policy while gathering different experience.
- Real per-car Three.js POV renders, supersampled at 64×40 and averaged into a 32×20 grayscale frame.
- Temporal visual perception: the network receives the current frame plus a frame-difference motion channel, followed by normalized speed and damage.
- A 1282 → 48 shared representation with independent 5-way steering and 3-way throttle/brake policy heads plus a value head.
- Actor-critic / clipped PPO-style updates using generalized advantage estimates and entropy regularization.
- Continuous learning: policy updates do not force a full-grid reset; only failed cars respawn.
- 1×, 2×, 4×, 8×, 20×, and 50× requested simulation speeds with measured achieved speed.
- Fast-training mode that suppresses the expensive spectator render while preserving the four neural-camera renders.
- Balanced Loop, Counterflow, Technical Circuit, Fast Sweepers, Figure Eight Overpass, Grand Prix, and random multi-track training.
- Separate deterministic 1-, 3-, or 5-lap evaluation races with learning frozen.
- Versioned checkpoint save/load; v0.1/v1 checkpoints can be approximately migrated into the v0.2 temporal/split-policy architecture.
- Velocity-based vehicle physics with finite lateral grip, visible slip angle, grass grip loss, damage-limited performance, and automatic gears.
- Collision damage for both cars while the learning penalty is apportioned by approximate collision responsibility.
- Learning telemetry based on reward per experience, forward meters per experience, off-road percentage, reset rate, lap count, collision count, action mix, and a reward-history chart.

## v0.2.1 runtime fix

- Version-busts the bootstrap, CSS, and every dynamically loaded simulator module so browsers cannot mix incompatible releases from cache.
- Primes all four POV cameras at startup/reset/track changes/checkpoint load, so paused cars still show their actual neural-camera image and establish a frame-difference baseline.
- Surfaces uncaught startup/runtime errors in the page instead of silently leaving blank canvases.

## Why v0.2 changed the learner

The v0.1 physics allowed the vehicle velocity direction to differ from the body heading, but the policy still saw only a single image. Two visually similar frames could therefore require very different actions if one car was stable and another was sliding sideways. v0.2 adds an image-derived motion channel so the policy can infer visual movement without receiving hidden track-relative velocity data.

The old 15-way combined action head also forced the learner to rediscover the usefulness of throttle separately for every steering choice. v0.2 factors the policy into independent steering and longitudinal-control heads while retaining one shared visual representation.

Entropy regularization and a higher exploration floor reduce premature policy collapse.

## Reward philosophy

Dense forward movement aligned with the local track direction is the primary positive signal. Forward motion receives full credit on the road and only tiny credit off-road. Backward movement, grass, becoming stuck, and causing collisions reduce reward. The terminal failure penalty is intentionally modest so useful partial trajectories are not overwhelmed by one large final punishment.

Damage remains a physical consequence for both cars. Collision **learning penalty** is separate and is divided according to how strongly each car's velocity carried it into the contact.

Moment-to-moment position changes are now **telemetry only**. Earlier asymmetric overtake shaping could be farmed by repeatedly swapping positions. A small race-position bonus is instead paid at lap completion, where it represents meaningful race progress and cannot be collected by oscillating passes.

## Tracks and vertical behavior

The normal circuits are flat because the current vehicle simulation is intentionally 2D in its physical state. This avoids rendering off-track cars at an arbitrary elevated road height.

The Figure Eight is the exception: its crossover uses one ground-level branch and one elevated branch so it functions as an overpass. Cars follow that road height only while they remain close to the figure-eight surface; an off-track car renders on the ground.

## Learning versus evaluation

**Learning mode** samples steering and throttle actions stochastically, accumulates 512 combined experiences, pauses briefly for backpropagation, and continues driving with the updated policy. Individual badly damaged, off-track, or stuck cars respawn.

**Evaluation race** resets to a clean grid and freezes the current network for the entire event. Actions are deterministic, no PPO experience is gathered, and drivers can finish P1–P4 or DNF.

## Folder structure

```text
index.html          Stable redirect to the released simulator.
simulator.html      Released application shell.
src/index.html      Direct source preview.
src/styles.css      UI and simulator styling.
src/js/version.js   Visible release version.
src/js/app.js       Three.js loader, sequential module bootstrap, and startup error boundary.
src/js/state.js     Constants, utilities, action spaces, metrics, and mutable simulator state.
src/js/scene.js     Renderer, cameras, lighting, and base environment.
src/js/tracks.js    Circuit definitions, geometry construction, and track switching.
src/js/cars.js      Car meshes, driver state, surface height, starting grid, and respawning.
src/js/model.js     Shared actor-critic network with separate steering/throttle heads.
src/js/perception.js Per-car POV renders and temporal image-to-observation conversion.
src/js/simulation.js Policy decisions and experience transition collection.
src/js/physics.js   Vehicle dynamics, dense rewards, collisions, and race-position telemetry.
src/js/training.js  PPO batch construction, entropy-regularized backprop, and learning metrics.
src/js/race.js      Evaluation races, track modes, and versioned checkpoint save/load/migration.
src/js/ui.js        Spectator camera, learning chart, telemetry, driver cards, and UI rendering.
src/js/runtime.js   Animation loop, controls, event wiring, and application startup.
DESIGN.md            Design rationale and learning loop.
```

Three.js is loaded as an exact-version browser ESM dependency from jsDelivr. Neural-network training and learned state otherwise remain local to the browser.
