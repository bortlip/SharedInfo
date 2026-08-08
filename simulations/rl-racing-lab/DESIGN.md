# POV RL Racing Lab — Design

## Core experiment

Four drivers share one policy network. Each driver observes a forward 32×20 grayscale rendered camera frame plus its own speed and damage. The network chooses one of fifteen joint steering/longitudinal actions. Track progress, failures, and collisions produce reward. Experiences from all four drivers are combined into a 512-sample PPO-style actor-critic update.

The important causal chain is intentionally visible:

**POV pixels → network → steering/throttle action → vehicle moves → reward → PPO/backprop → updated shared network**

## Why v0.3 restores the old learner

The earlier local prototype visibly improved at track following. Later development introduced several dimensions of difficulty simultaneously:

- independent velocity direction and tire-slip-like dynamics
- temporal/frame-difference perception
- separate steering and throttle policy heads
- changed reward density and terminal penalties
- automatic multi-track training
- additional race-position shaping

When learning degraded, those changes made diagnosis ambiguous. v0.3 therefore restores the learning-critical pieces of the successful baseline while retaining operational improvements such as modular files, fast training, multiple selectable tracks, evaluation races, checkpoints, better spawning, cache-safe loading, and useful telemetry.

The baseline is not claimed to be the final racing model. It is the control condition from which future complexity can be tested.

## Baseline observation and network

Observation:

- 32×20 grayscale POV = 640 values
- normalized speed
- normalized damage

Total: **642 inputs**.

Network:

**642 → 48 tanh → 15-action policy + 1 value estimate**

The 15 policy actions are the Cartesian product of:

- steering: hard left, left, straight, right, hard right
- longitudinal: brake, coast, throttle

The policy is stochastic in learning mode and deterministic in evaluation races.

## Baseline vehicle model

The car has position, heading, scalar speed, damage, and current controls. Velocity always follows the heading. This deliberately removes a hidden lateral-motion state that a one-frame feed-forward policy cannot observe directly.

Throttle accelerates, brake decelerates, coast produces mild drag, steering changes heading as a function of speed, and grass slows the car. Damage reduces maximum speed.

The model is simple enough for the visual policy to learn while still supporting meaningful throttle and steering decisions.

## Reward

Primary positive signal:

- forward progress along the ordered track

Additional positive signal:

- lap completion

Negative signals:

- backward progress
- time off track
- becoming stuck or badly off track long enough to reset
- collisions, apportioned by approximate responsibility

Position changes are counted but do not currently create per-frame reward. This avoids reintroducing the earlier pass-swapping reward exploit before basic driving is stable.

### v0.3.1 track-discipline shaping

This is a controlled reward-only experiment: architecture, observation, action space, PPO settings, and vehicle dynamics remain unchanged.

- Forward progress on pavement is amplified relative to the original baseline.
- The progress multiplier is highest near the road center and declines toward the edge.
- A small fourth-power edge penalty begins while the car is still on pavement, creating a warning signal before failure.
- Forward progress on grass receives almost no positive credit.
- Continuous off-road penalty is stronger.
- Off-road episodes terminate after 1.75 seconds instead of 3 seconds, reducing the amount of low-value grass-driving experience in each PPO batch.
- There is no positive survival/time reward for merely staying on pavement, because that could make stopping an attractive policy.

The expected signature is lower off-road percentage, greater distance before reset, and eventually higher forward meters per experience. If those do not improve, reward magnitude alone is unlikely to be the main problem.

## Learning cycle

At every 0.1 simulated seconds, each active driver produces an action and later contributes a transition containing observation, action, immediate reward, value estimate, old log probability, and terminal status.

After 512 combined experiences:

1. freeze simulation
2. compute discounted returns and generalized advantage estimates
3. normalize advantages
4. run three clipped PPO-style backpropagation passes
5. update the shared actor-critic network
6. continue driving with the new policy

Failed cars can independently respawn. A policy update does not reset the whole field.

## Tracks and generalization

The simulator still includes multiple circuits, but track changes are explicit user-controlled experiments rather than automatic curriculum.

Recommended validation sequence:

1. Start a fresh brain on Balanced Loop.
2. Verify reward/experience trends upward and off-road/reset rates fall.
3. Run a deterministic evaluation race.
4. Save the checkpoint.
5. Switch to Counterflow without resetting the brain and observe zero-shot transfer.
6. Resume learning there if desired.
7. Repeat with progressively different circuits only after the baseline behavior is established.

This distinguishes “can learn to drive” from “can generalize to a new road.”

## Future reintroduction plan

Once the baseline reliably learns, add complexity one controlled experiment at a time. A sensible order is:

1. denser continuous progress reward, while keeping baseline physics
2. modest race-finish/position incentives
3. a single previous-frame or motion feature
4. independent steering/throttle heads
5. lateral velocity / grip and slip dynamics
6. multi-track curriculum or procedural tracks
7. more realistic racing behavior and braking/line optimization

Each change should be compared against the baseline using the same track, fresh seeds/checkpoints, and evaluation race metrics. If performance collapses, the responsible change is then identifiable.

## Fast training

Fast mode suppresses the large spectator render and reduces UI updates. The four small POV renders remain mandatory because they are the policy input. Requested simulation speed can exceed achieved speed, so the UI reports both.

## Checkpoint philosophy

A checkpoint stores learned network weights and training metadata, not exact physical world state or an unfinished PPO rollout. Loading starts from a clean grid.

v0.3 returns to the same basic network shape as the original v1 checkpoint, so v1 weights can be loaded directly. v2 temporal/split-head checkpoints are approximately collapsed back into the baseline network for continuity, but should not be treated as identical policies after migration.
