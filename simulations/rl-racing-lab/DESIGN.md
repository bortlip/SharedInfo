# POV Reinforcement-Learning Racing Lab — Design

## Goal

Four AI drivers learn racing behavior together from their own forward-facing visual stream. There are no human steering labels and no evolutionary reproduce/mutate step.

**POV frames → shared actor-critic network → steering + throttle/brake → world/reward → PPO backpropagation → improved shared policy**

## Observation

Each car receives:

- the current **32 × 20 grayscale POV frame**
- a **32 × 20 frame-difference motion channel** computed from the current and previous visual frame
- normalized speed
- normalized damage

That is **1282 input values**. Other cars must be perceived because they appear in the image. Track position, lateral velocity, collision geometry, and lap progress are not supplied as policy inputs; the simulator may use them only to calculate physics and reward.

The motion channel exists because the richer grip/slip model made the problem partially observable from one frame. A car that is stable and a car that is sliding sideways can have nearly identical instantaneous images but require different actions.

## Policy

The shared network uses:

- 1282 inputs
- 48 tanh hidden units
- a 5-way steering policy head: hard left, left, straight, right, hard right
- a 3-way longitudinal head: brake, coast, throttle
- one value estimate

The two policy heads are sampled independently during learning and use argmax actions during evaluation. Their joint log-probability is used by the PPO ratio.

Separate heads are more data-efficient than the old 15-way Cartesian-product action head: learning that throttle is useful can generalize across steering choices instead of being rediscovered five times.

## Experience and PPO update cycle

The four cars collectively gather **512 experiences**. Each experience stores the temporal observation, selected steering action, selected throttle action, immediate reward, old joint log-probability, value estimate, and terminal flag.

When the batch fills:

1. simulation advancement pauses briefly
2. discounted returns and generalized advantage estimates are computed
3. advantages are normalized
4. three clipped PPO-style backpropagation passes update the shared representation, both policy heads, and value head
5. entropy regularization keeps exploration from collapsing too early
6. the cars continue from their current states using the new policy

A completed PPO update does not reset the grid. Individual failed cars can respawn independently.

## Reward

The dominant reward is **dense forward motion along the local track direction**. Unlike the earlier sample-index-only signal, this provides useful feedback every physics step.

- forward on-road motion: full positive credit
- forward off-road motion: tiny positive credit only
- backward motion: negative reward
- time off road: continuous penalty
- collision: penalty apportioned by approximate responsibility
- failed/stuck episode: modest terminal penalty
- lap completion: strong bonus
- lap position: small additional race-position bonus

The terminal failure penalty was reduced so partial useful behavior is not erased by one large final negative event.

### Overtake reward exploit

The earlier implementation rewarded moving up a position more strongly than it punished moving back down. Two cars could therefore gain net reward by repeatedly swapping places. v0.2 removes reward from moment-to-moment rank changes. Passes remain telemetry; race-position reward is paid only when a lap is completed.

## Collision responsibility

Both cars can physically take damage because physics does not care who was at fault. The learning penalty is different: velocity into the collision normal estimates how much each car caused the impact, and the penalty is apportioned by that responsibility.

## Tracks and surface height

The vehicle state is still fundamentally 2D (`x`, `z`, heading, velocity). Normal tracks are therefore flat. Earlier decorative elevation caused off-track cars to inherit nearby road height and visibly hover over the grass.

The Figure Eight deliberately retains vertical separation at its crossover. One crossing branch reaches ground level while the other is elevated. A car follows figure-eight road height only while it is within the road corridor; once off track it renders at ground height.

## Learning telemetry

Lifetime cumulative reward is not a useful learning indicator because it can become increasingly negative even while recent behavior improves. The dashboard therefore emphasizes per-update measurements:

- reward per experience
- forward meters per experience
- off-road percentage
- average distance before failure/reset
- resets per update
- laps and collisions per update
- steering and throttle action distribution
- reward-per-experience history over recent updates

The learning log records the same normalized metrics after every PPO update.

## Checkpoints

Checkpoint format **v2** stores the temporal/split-policy architecture, network weights, training metadata, track mode, and recent learning history.

Legacy v1 checkpoints are migratable because the hidden layer remains 48 units. Migration:

- copies the old image weights into the new current-frame channel
- initializes the new motion-channel weights to zero
- moves speed/damage weights to their new input slots
- factorizes the old 15-way policy weights into averaged steering and throttle heads
- preserves the value head and training/update metadata

The factorization is approximate, so a migrated policy should be allowed to resume learning before being judged in an evaluation race.

## Success criteria

The useful signals are trends rather than one dramatic score:

- reward per experience rises
- forward meters per experience rises
- off-road percentage falls
- reset frequency falls
- lap completions become common
- collision rate declines
- evaluation races become longer, faster, and more competitive
- performance transfers across Counterflow and the random multi-track set

Sophisticated overtaking and racecraft remain emergent goals rather than scripted guarantees.
