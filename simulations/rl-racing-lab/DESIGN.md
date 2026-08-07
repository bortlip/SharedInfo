# POV Reinforcement-Learning Racing Lab — Design

## Goal

Build a browser-based 3D racing experiment in which four AI drivers learn together from the beginning using their own forward-facing camera image plus minimal internal telemetry.

There are no human steering labels and no evolutionary reproduce/mutate step.

**POV image → shared neural network → steering/throttle action → race outcome/reward → actor-critic backpropagation → improved shared policy**

## Four shared-policy drivers

Four cars race simultaneously. They all use the same neural-network weights, but each samples its own actions, sees a different image, collides with different cars, and therefore gathers different experience.

All four experience streams are combined into one training batch. Experience gathered by one driver can improve the shared policy used by all four after the next update.

## Observation

Each car gets:

- a real rendered **32 × 20 grayscale POV camera image**
- its own normalized speed
- its own normalized damage

Other cars are not supplied as coordinates or special sensors. They must be perceived because they appear in the camera image.

The simulator may know track position, collisions, damage, and lap progress to calculate rewards. Those values are not exposed as perception inputs.

## Actions

The current network uses 15 discrete actions:

- steering: hard left, left, straight, right, hard right
- longitudinal control: brake, coast, throttle

This lets the network learn cornering and speed control together from the start.

## Experience and backprop cycle

Training is triggered by **experience count**, not by reaching a positive or negative score.

At each AI decision step, an experience contains the observation, chosen action, immediate reward, old policy probability, value estimate, and terminal flag.

The four cars collectively gather **512 experiences**. Then the simulator:

1. briefly freezes simulation advancement
2. computes discounted returns and generalized advantage estimates
3. normalizes the advantages
4. runs several clipped actor-critic / PPO-style backpropagation passes
5. updates the shared neural-network weights
6. resumes from the cars' current states using the improved policy

The UI visibly cycles through **RACING → EXPERIENCE FULL → LEARNING/BACKPROP → RACING**. Full-grid resets are reserved for track changes and clean evaluation races; individual failed cars can respawn independently during learning.

## Reward

Reward judges how useful experiences were. It does not decide when training happens.

Positive:
- forward progress around the circuit
- lap completion

Negative:
- backward progress
- leaving the road
- causing collisions, weighted by approximate responsibility
- becoming badly stuck or disabled

Damage is a physical consequence for both cars: it reduces available performance. The learning penalty for a collision is apportioned by how strongly each car's velocity carried it into the contact, so being rear-ended is not treated the same as doing the rear-ending.

## Episodes

A car can independently end an episode when it is severely damaged, far off track too long, or stuck too long. That car resets and continues collecting experience while the others keep racing.

A completed PPO update does not itself reset the cars. They continue from their current states with the newly updated shared policy.

## Network

Current architecture:

- input: 32 × 20 grayscale pixels + speed + damage = **642 values**
- hidden layer: **48 tanh units**
- policy head: **15 action probabilities**
- value head: **1 future-return estimate**

The shared visual representation, policy head, and value head are all trained with backpropagation.

## What success should look like

Early behavior may be terrible. Useful signs of real learning would be:

- less random steering and braking
- discovering that throttle plus staying on road creates reward
- increasing average progress
- surviving more corners
- completing laps
- reducing collisions because cars visible in the POV become predictive of damage
- eventually discovering faster lines, braking behavior, and perhaps overtaking-like behavior

Sophisticated racing is experimental rather than guaranteed.

The first important test is simply:

> **Does average progress / lap completion visibly improve across backprop updates when four drivers learn from rendered POV images?**


## v0.3: Continuous learning, evaluation races, and checkpoints

### Learning mode

- The four cars use the shared policy with stochastic action sampling for exploration.
- Experience accumulates continuously.
- When 512 experiences are collected, the world freezes briefly for actor-critic backpropagation.
- The cars **do not all reset after a learning update**. The new policy takes over from their current positions.
- Only individual cars that become badly damaged, far off track, or stuck are respawned.

### Evaluation race

At any point, the current learned policy can be benchmarked in a 1-, 3-, or 5-lap race.

- All four cars reset to a clean grid.
- Network weights are frozen for the race.
- Action selection is deterministic rather than exploratory.
- No experience is collected and no backpropagation occurs.
- Cars can finish in order or DNF.
- Finishing place and race time are reported.

Switching into an evaluation race discards the unfinished partial PPO rollout, but the learned weights are unchanged.

### Save / Load Brain

A JSON checkpoint can be downloaded and loaded later. It contains:

- all shared neural-network weights and biases
- architecture metadata
- training update count
- total experience count
- current exploration temperature

It intentionally does not preserve exact car positions or an unfinished PPO rollout. Loading restores the learned brain onto a fresh grid.


## v0.1.0 repo expansion

The repo release adds fast/headless-style training, measured achieved speed, six track configurations, random multi-track training, opposite-direction testing, continuous velocity/grip/slip physics, automatic gears, collision responsibility, small overtaking incentives, and the long Grand Prix evaluation circuit.

Fast training is not literally render-free because the policy's observation is a rendered image. The simulator must still render all four tiny neural cameras. It instead removes the expensive spectator render and throttles ordinary UI work; therefore 20× and 50× are requested speeds and the achieved-speed display reports what the machine actually sustains.
