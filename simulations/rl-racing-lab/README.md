# POV RL Racing Lab

A browser-based reinforcement-learning racing laboratory. Four cars share one actor-critic policy, perceive the world through their own rendered 32×20 grayscale camera image, and learn steering plus throttle/brake behavior from reward using PPO-style backpropagation.

Current release: **v0.1.0**

- [Open the released simulator](https://bortlip.github.io/SharedInfo/simulations/rl-racing-lab/)
- [Open the modular source preview](https://bortlip.github.io/SharedInfo/simulations/rl-racing-lab/src/)
- [Related lab: Perception Rover](https://bortlip.github.io/SharedInfo/simulations/perception-rover/)
- [Related lab: Neural Playground](https://bortlip.github.io/SharedInfo/simulations/neural-playground/)

## What it demonstrates

- Four simultaneous drivers using one shared neural policy but gathering different experience.
- Real per-car Three.js POV renders, supersampled at 64×40 and averaged into the 32×20 grayscale neural input.
- A 642 → 48 shared representation with a 15-action policy head and value head.
- Actor-critic / clipped PPO-style updates using discounted returns and generalized advantage estimates.
- Continuous learning: backpropagation updates no longer force a full-grid reset.
- 1×, 2×, 4×, 8×, 20×, and 50× requested simulation speeds with measured achieved speed.
- Fast-training mode that stops the expensive spectator render while preserving the four neural camera renders.
- Multiple circuits: Balanced Loop, Counterflow, Technical Circuit, Fast Sweepers, Figure Eight Overpass, and a long Grand Prix course.
- Random multi-track training that periodically rotates circuits to encourage visual generalization.
- Separate deterministic 1-, 3-, or 5-lap evaluation races with learning frozen.
- Checkpoint save/load for learned weights and training metadata.
- Velocity-based vehicle physics with finite lateral grip, visible slip angle, grass grip loss, damage-limited performance, and automatic gears.
- Collision damage for both cars but reward punishment apportioned by approximate collision responsibility.
- Small position/overtake learning incentives while forward track progress and lap completion remain the main reward.

## Learning versus evaluation

**Learning mode** samples actions stochastically, accumulates 512 combined experiences, pauses briefly for backpropagation, and continues driving with the updated policy. Individual badly damaged, off-track, or stuck cars respawn.

**Evaluation race** resets to a clean grid and freezes the current network for the entire event. Actions are deterministic, no PPO experience is gathered, and drivers can finish P1–P4 or DNF. This makes race results a clean benchmark of one fixed policy version.

## Tracks and distribution shift

`Counterflow` runs the same general course in the opposite direction, making it useful for testing whether a policy learned visual road-following or merely memorized a dominant turn direction. Random multi-track mode rotates among all included circuits every few policy updates.

The Figure Eight uses different road elevations at the crossover so the crossing functions as an overpass. The long Grand Prix circuit is intended as the strongest racing/evaluation environment.

## Reward philosophy

The dominant positive signal is forward progress. Lap completion adds a bonus. Backward movement, grass, becoming stuck, and causing collisions reduce reward.

Collision **damage** is physical and applies to both cars. The collision **learning penalty** is different: it is divided using the cars' velocity components into the contact, so a car that is rear-ended can be damaged without being taught that merely being hit was its behavioral mistake.

Position gains receive only a small bonus. This is deliberate: racecraft should emerge on top of competent driving rather than replacing it with reward hacking.

## Folder structure

```text
index.html          Stable redirect to the released simulator.
simulator.html      Released application shell.
src/index.html      Direct source preview.
src/styles.css      UI and simulator styling.
src/js/version.js   Visible release version.
src/js/app.js       Three.js world, tracks, cameras, physics, RL, race modes, checkpoints, and UI.
DESIGN.md           Design rationale and learning loop.
```

Three.js is loaded as an exact-version browser ESM dependency from jsDelivr. Neural-network training and all learned state otherwise remain local to the browser.
