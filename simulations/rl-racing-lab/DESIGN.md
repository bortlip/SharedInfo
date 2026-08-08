# POV RL Racing Lab — v0.7 Design

## Design goal

v0.7 keeps the recovered PPO/network architecture while making the application easier to operate and the racing environment easier to read. Learning and Evaluation Race are explicit modes; short-horizon and full-history progress are both visible; track surfaces and collision geometry are more believable without adding hidden motion state to the policy.

The learning causal chain remains:

**POV pixels → network → steering/throttle action → vehicle movement → reward → PPO/backprop → updated shared network**

Anything added in v0.7 should either preserve that causal chain or be clearly separated as human-facing telemetry/presentation.

## Preserved learning control

Each driver receives:

- 32×20 grayscale POV = 640 values
- normalized speed
- normalized damage

Network:

**642 → 48 tanh → 15-action policy + 1 value estimate**

There is therefore one learned intermediate/hidden layer containing 48 tanh units. v0.7 intentionally does not widen or deepen it; network-capacity experiments remain separate so UI/surface/collision changes can be evaluated without simultaneously changing the learner.
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
- PPO updates remain every 512 experiences; synchronized full-grid resets use the separately selected clean-start cadence

## Training environments

Balanced Loop remains the known-good baseline geometry:

- 300 centerline samples
- half-width 5.4
- finish index = 2

v0.7 intentionally enriches the rendered observation distribution on every circuit: dark asphalt, amber road-edge warnings, alternating red/white curb markers, a 1.25-unit shoulder, grass outside, center dashes, painted forward-direction arrows, and roadside trees. Because the policy consumes pixels, this is a real environment change rather than presentation-only styling.

Training remains manually selectable across Balanced Loop, Counterflow, Technical Circuit, Fast Sweepers, Figure Eight Overpass, and Grand Prix. Track changes are explicit rather than random: the brain is retained, the unfinished PPO batch is discarded, the grid is reset, recent-driving telemetry restarts, and Adaptive clean-start progression restarts at one update for the new circuit.

## Clean-start cadence

PPO optimization remains fixed at 512 experiences per update. Full-grid clean starts are now an independent schedule. Adaptive mode begins at every PPO update, advances to every 2 updates once average run distance reaches roughly 0.45 track lengths or multiple lap completions are recorded across the four drivers, then to 4 and 8 updates as multi-lap competence grows. Fixed 1/2/4/8-update schedules and a failures-only mode are available. Individual terminal failures always respawn immediately.

## Reward and surface handling

The main learning reward remains signed track progress:

- forward track progress: `progress × 0.075`
- backward track progress: `progress × 0.16` (negative progress therefore produces a larger-magnitude penalty)
- shoulder time: `−0.07 per second`, with off-road timeout accumulating at 55% rate
- grass time: `−0.18 per second`
- lap: `+15`
- terminal failure after 3 accumulated off-road seconds, 4.5 seconds stuck, or 100 damage: `−5`
- collisions: both cars receive the same `severity × 0.9` learning penalty

Surface handling is also physical. Shoulder grip scales acceleration, braking, and steering down moderately and adds speed scrub. Grass reduces all three much more strongly and scrubs speed aggressively. This creates visible traction loss/understeer while retaining the baseline scalar-speed model. There is still no separate lateral velocity or slip angle.

No centerline bonus, position reward, explicit track-direction input, or responsibility-weighted collision reward is active during training.

## Chronological speed-invariant scheduler

All requested speeds use one fixed-step simulation function. Neither requested speed nor headless state selects an alternate physics/decision loop.

For every simulated interval:

1. add requested simulated time to the common accumulator
2. advance one 1/60-second physics tick
3. add that tick to the decision accumulator
4. whenever the decision accumulator reaches 0.10 seconds, execute exactly one policy decision
5. continue with the next physics tick

Thus 1×, 10×, and 50× produce the same chronological sequence of simulation operations; higher multipliers merely ask the browser to process more of those operations per real second. Spectator repaint cadence is reduced at 10× and 50× independently of the simulation loop.

When a PPO batch reaches its update boundary, fixed-step and decision accumulators are cleared before backpropagation. This prevents leftover wall-clock budget from a high-speed animation frame from carrying into the next batch, regardless of whether a synchronized clean start occurs.

The simulator still caps work per browser frame. If hardware cannot sustain the requested multiplier, the **Actual** speed indicator reports the lower achieved value rather than altering model timing.

## Headless display invariant

Headless mode is presentation-only. It suppresses the main spectator scene and skips expensive driver-card/progress-chart redraws, but the simulation scheduler does not read `sim.headless`.

The four neural POV render targets remain mandatory because they are the model input. Physics, observations, policy decisions, rewards, PPO samples, backpropagation, and grid resets are identical with headless on or off.

## Progress metrics

Two progress views are maintained. The **Recent driving** chart samples each driver's peak net run distance every 0.5 simulated seconds and retains the last 60 simulated seconds. The **Complete training timeline** retains every completed PPO update for the lifetime of the run/checkpoint, marks training-track changes, may downsample only for rendering efficiency, and adds the current partial batch as a live endpoint.

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

Returning to learning rebuilds the selected training circuit before collecting new experience, so an evaluation track cannot accidentally become part of training.

Figure Eight collision detection ignores X/Z overlaps when the cars are on vertically separated branches.

## Collision geometry and direction telemetry

Cars use oriented rectangular footprints based on their rendered width, length, and heading. The separating-axis test detects front/rear and side contact before substantial mesh overlap, resolves penetration even during collision cooldown, and computes damage from relative closing speed. This replaces the old center-distance threshold that allowed visible rear-end overlap.

Each car also exposes the dot product between its forward heading and the local track tangent as human-facing direction telemetry. Values below −0.2 are shown as **WRONG WAY** and low positive alignment as **ACROSS**. This exact value is deliberately not part of the 642-input observation; instead, painted road arrows provide a visible direction cue inside the POV image while the agent still receives only pixels, normalized speed, and normalized damage.

## Checkpoint compatibility

The network shape is unchanged, so the checkpoint architecture remains version 3. v0.6 extends training metadata with:

- selected training track
- clean-start mode and adaptive interval
- run-distance history
- wall training seconds
- simulated training seconds
- best run distance

Older histories may lack these fields. The UI treats them as legacy entries rather than failing; the distance chart starts with the first update that contains the new metrics.

## Next experimental step

Once the preserved learner is reliably improving with the safe scheduler, a sensible next controlled experiment is adding vehicle proprioception—such as slip angle and yaw rate—at the same time realistic lateral/slip physics is reintroduced. That should be tested as a separate version rather than mixed into this execution/telemetry release.
