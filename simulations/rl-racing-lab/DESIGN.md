# POV RL Racing Lab — v0.4 Historical Control Design

## Goal

v0.4 isolates the learning system by recreating the environment and training cycle of the earlier v0.2 prototype that was observed to learn meaningful track following.

The purpose is not realism. The purpose is a clean control condition.

The causal chain remains:

**POV pixels → network → steering/throttle action → vehicle movement → reward → PPO/backprop → updated shared network**

## Observation and network

Each driver receives:

- 32×20 grayscale POV = 640 values
- normalized speed
- normalized damage

Total: **642 inputs**.

Network:

**642 → 48 tanh → 15-action policy + 1 value estimate**

The 15 actions are the Cartesian product of five steering choices and three longitudinal choices: brake, coast, and throttle.

## Historical Balanced Loop

The learning track is locked to the original Balanced Loop geometry used by v0.2:

- 300 sampled centerline points
- road half-width 5.4
- center dashes every 10 samples
- roadside trees every 18 samples
- tree offset = road half-width + 2.2
- finish index = 2

These visual details matter because the policy learns directly from rendered pixels.

## Vehicle model

The car has position, heading, scalar speed, damage, and current controls. Velocity always follows heading. There is no independent lateral velocity or tire-slip state.

Throttle accelerates, brake decelerates, coast adds mild drag, grass slows the car, and damage reduces maximum speed.

## Historical reward

The control restores the original v0.2 reward function:

- forward track progress: `progress × 0.075`
- backward track progress: `progress × 0.16`
- off-road time: `−0.16 per second`
- lap completion: `+15`
- terminal failure after 3 seconds off road, 4.5 seconds stuck, or 100 damage: `−5`
- collisions: both cars receive the same `severity × 0.75` penalty

No centerline bonus, edge penalty, reduced grass progress credit, collision-responsibility split, or position reward is active in the control.

## Historical training cycle

At every 0.1 simulated seconds each active car contributes a transition. Four drivers share one combined experience count.

After 512 experiences:

1. stop the simulation
2. compute GAE/returns
3. normalize advantages
4. perform three clipped PPO-style SGD passes at learning rate 0.00055
5. increment the update count and decay exploration temperature
6. clear the four rollouts
7. **reset all four cars to the clean starting grid**
8. capture new actions from the updated policy
9. resume simulation

The full-grid reset is intentionally restored because it changes the training distribution. Every batch begins from four known-good, correctly aligned road states instead of arbitrary continuation states.

Individual cars can still respawn during a batch after failure, matching the original prototype.

The control also restores the original scheduler limits: at most 20 fixed physics steps and 8 policy-decision catch-up steps per browser frame, with only 1×, 2×, and 4× selectable speeds. Later 8×/20×/50× and Fast Training modes are disabled because the catch-up loop can otherwise execute many policy decisions at the same post-physics state, changing the experience distribution.

## Control boundaries

The following later ideas are intentionally excluded from learning mode while this control is active:

- automatic or manual multi-track learning
- temporal/frame-difference observations
- separate steering and throttle policy heads
- lateral velocity and slip physics
- edge/centerline reward shaping
- race-position reward
- collision-responsibility reward splitting

Evaluation races and checkpoint save/load remain available because they do not update the policy. Checkpoint loading forces the world back to Balanced Loop. A clean control run should begin with **Reset learning**, not a previously trained checkpoint.

## Metrics

The modern dashboard remains because it helps diagnose the historical learner without changing its inputs or update math:

- reward per experience
- forward meters per experience
- off-road percentage
- average failure distance
- resets per batch
- laps and collisions
- steering/throttle action mix
- reward history

## Decision rule

If v0.4 learns, later changes should be reintroduced one at a time against this control.

If v0.4 still fails to learn after a meaningful run, stop changing reward/environment parameters. The next investigation should instrument the learning mechanism itself: policy entropy, chosen-action probability before/after training, KL divergence, PPO clipping fraction, gradient/weight-change magnitude, value error, advantage distribution, and observation variance.
