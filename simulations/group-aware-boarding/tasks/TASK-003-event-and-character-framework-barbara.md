# TASK-003: Event and Character Framework — Barbara

**Status:** Barbara restroom trip implemented in candidate

## Goal

Create a deterministic framework for memorable passenger incidents, then prove it with a visible Barbara scenario.

## Implemented character foundation

Barbara Mode now provides:

- one seed-derived Barbara definition shared by every boarding method
- deterministic selection of an eligible adult individual without disturbing ordinary manifest draws
- a distinctive pulsing marker, name-aware hover details, and live character status
- late queue insertion after each method builds its normal queue
- explicit original and late boarding positions in Barbara's hover tooltip
- a seeded heavy carry-on with visible stowing and tracked direct delay
- short speech or thought bubbles anchored to Barbara
- tests proving that no passenger is duplicated or lost
- no Race Moments ticker and no post-race recap

## True restroom trip — implemented

Barbara now:

- turns around at a seeded row before reaching her seat
- walks toward a visible front lavatory
- blocks new passenger release while occupying the doorway/lavatory area
- pauses inside for a seeded duration
- walks back to her assigned row
- squeezes past active passengers in either direction
- temporarily slows both herself and each crossed passenger
- shifts laterally in the renderer so the squeeze is visible
- reports crossings, trip time, estimated extra delay, and disrupted-passenger delay in hover details

The cabin remains a one-dimensional aisle model. A crossing is an explicit squeeze abstraction, not an invisible second lane: travelers may pass only through a recorded timed penalty. The same passenger can be crossed once outbound and once on the return, never repeatedly from adjacent simulation steps.

## Fairness

Barbara's seat, intrinsic bag difficulty, late-arrival fraction, restroom turn row, restroom speed, lavatory duration, squeeze penalties, and dialogue script are shared across all methods. Her original method position and surrounding congestion can differ because each method constructs a different queue. The number of people she crosses can therefore differ legitimately.

## Measurements

Each method retains Barbara's:

- original method position
- late inserted position
- queue displacement
- heavy-bag delay above her ordinary generated bag time
- restroom-trip elapsed time
- estimated extra delay above the abandoned direct walk to her row
- outbound and return squeeze crossings
- combined direct character-event delay

Crossed passengers accumulate their own visible disruption seconds.

## Next slice — configurable cabin incidents

Add general settings rather than tying every incident to Barbara:

- disruptive-passenger count or intensity
- ambient speech frequency
- deterministic incident archetypes such as chatty, tipsy/slow, and crew-assistance-needed
- strict bubble rate limits so the cabin feels alive without becoming unreadable
- shared intrinsic incident definitions across methods

## Later slice — assistance

- a visible failed-lift beat during a heavy-bag stow
- deterministic selection of a nearby helper or crew member
- helper movement or reach animation
- an explicit assistance duration
- both passengers' hover states explaining the interaction

## Acceptance criteria

- Character and incident scripts are deterministic by seed
- No passenger is duplicated or lost during insertion or travel
- Every mechanical effect is visible in the cabin, an anchored bubble, or hover status
- The same intrinsic Barbara definition is used in every method
- Character behavior can be disabled completely
- Ordinary scenarios preserve their previous deterministic results
- No separate event ticker or post-race recap is introduced
