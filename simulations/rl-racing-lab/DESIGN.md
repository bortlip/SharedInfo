# POV RL Racing Lab — v0.5 Design

## Design goal

v0.5 preserves the historical learning setup that began showing improvement again while restoring fast execution, progress measurement, and frozen-policy racing around it.

The learning causal chain remains:

**POV pixels → network → steering/throttle action → vehicle movement → reward → PPO/backprop → updated shared network**

Anything added in v0.5 should either leave that chain unchanged or operate outside training.

## Preserved learning control

Each driver receives:

- 32×20 grayscale POV = 640 values
- normalized speed
- normalized damage

Network:

**642 → 48 tanh → 15-action policy + 1 value estimate**

Training preserves the historical setup:

- decision interval: 0.10 simulated seconds
- four drivers share one policy and one combined batch
- PPO update at 512 experiences
- GAE γ = 0.985, λ = 0.92
- PPO clip = 0.18
- three SGD-style passes at learning rate 0.00055
- exploration temperature 1.35 decaying toward 0.72
- simple heading + scalar-speed vehicle dynamics
- historical reward and symmetric collision penalty
- full four-car grid reset after every PPO update

## Historical training environment

Learning is always rebuilt on the historical Balanced Loop:

- 300 centerline samples
- half-width 5.4
- center dash every 10 samples
- roadside trees every 18 samples
- tree offset = half-width + 2.2
- finish index = 2

These details are part of the observation distribution because the policy consumes rendered pixels.

Other circuits exist only for evaluation in v0.5.

## Historical reward

The learning reward remains:

- forward track progress: `progress × 0.075`
- backward track progress: `progress × 0.16`
- off-road time: `−0.16 per second`
- lap: `+15`
- terminal failure after 3 seconds off road, 4.5 seconds stuck, or 100 damage: `−5`
- collisions: both cars receive the same `severity × 0.75` learning penalty

No centerline bonus, edge shaping, position reward, or responsibility-weighted collision reward is active during training.

## Chronological fast scheduler

The previous fast scheduler used separate catch-up loops for physics and decisions. At high requested speed it could process many physics steps and then several decisions with little or no vehicle motion between those decisions.

v0.5 uses one chronological fixed-step loop:

1. add requested simulated time to an accumulator
2. advance one 1/60-second physics tick
3. add that tick to the decision accumulator
4. whenever the decision accumulator reaches 0.10 seconds, execute exactly one policy decision
5. continue with the next physics tick

Thus 10× and 50× increase throughput without changing the simulated ordering of observation, action, and movement.

The simulator intentionally caps work per browser frame. If hardware cannot sustain the requested multiplier, the **Actual** speed indicator reports the lower achieved value rather than altering the model.

## Headless training

Headless mode skips the main spectator scene render and avoids rebuilding driver cards, POV previews, and the progress chart on each UI refresh.

The four neural POV render targets remain mandatory. They are not cosmetic rendering; they are the model input.

Headless mode therefore means **spectator-headless**, not vision-free simulation.

## Progress metrics

Each completed PPO update records a progress snapshot.

### Average run distance

Each spawn begins with net progress at zero. Signed track progress is accumulated as the car moves; backward movement therefore reduces net progress. The run's metric is the **highest net forward progress reached since that spawn**, not the sum of every positive movement.

For the just-completed batch, average the peak net progress of:

- every episode that failed and reset during the batch
- each of the four active run segments at the batch boundary

This produces average run distance in meters while preventing forward/backward oscillation from artificially increasing the metric.

### Best run distance

Take the largest peak net progress among those same run segments and retain the all-time maximum.

Average run distance is the primary trend measure because it should increase as failures happen later. Best distance is useful as an upper-bound signal but is naturally noisier.

The history also stores reward/experience, off-road percentage, resets, collisions, total experiences, training wall time, simulated training time, and action counts.

## Training-time clocks

Two clocks are shown:

- **Wall training** — real elapsed time while learning is running or backpropagating
- **Sim training** — simulated vehicle time processed in learning mode

At high requested speed, simulated training time should advance faster than wall time. Total experiences and update number provide model-work counters independent of either clock.

## Evaluation races

Evaluation is deliberately separated from training.

When a race starts:

1. discard any unfinished learning rollout
2. choose the requested evaluation track
3. reset the four-car grid
4. freeze network weights
5. select deterministic argmax actions
6. run for 1, 3, or 5 laps
7. record finish order/time or DNF
8. perform no PPO update

Available evaluation tracks are Balanced Loop, Counterflow, Technical Circuit, Fast Sweepers, Figure Eight Overpass, and Grand Prix.

Returning to learning always rebuilds the historical Balanced Loop before collecting new experience. Evaluation therefore cannot accidentally turn another track into part of the training curriculum.

Figure Eight collision detection ignores X/Z overlaps when the cars are on vertically separated branches.

## Checkpoint compatibility

The network shape is unchanged, so the checkpoint architecture remains version 3. v0.5 extends training metadata with:

- run-distance history
- wall training seconds
- simulated training seconds
- best run distance

Older histories may lack these fields. The UI treats them as legacy entries rather than failing; the distance chart starts with the first update that contains the new metrics.

## Next experimental step

Once the preserved learner is reliably improving with the safe scheduler, a sensible next controlled experiment is adding vehicle proprioception—such as slip angle and yaw rate—at the same time realistic lateral/slip physics is reintroduced. That should be tested as a separate version rather than mixed into this execution/telemetry release.
