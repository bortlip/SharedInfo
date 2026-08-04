# TASK-003: Event and Character Framework — Barbara

**Status:** Ready after TASK-002 hover slice  
**Depends on:** TASK-002 hover foundation

## Goal

Create a deterministic framework for memorable passenger incidents, then prove it with a visible "Barbara" scenario.

## Foundation now available

The passenger/seat hover slice provides reusable character presentation hooks before Barbara changes behavior:

- optional passenger display name, role, status, and current-event fields
- a tooltip renderer that automatically displays those fields
- lateral row-entry motion that future character actions can reuse
- canvas hit testing for following a named passenger while the race continues

Barbara is not active yet; these fields are inert for ordinary passengers and no event timing has been introduced.

## Barbara concept

Barbara arrives late, rejoins the queue at an inconvenient point, struggles with a heavy carry-on, requires assistance, and realizes she needs the restroom during boarding.

The humor should come from a recognizable cascade of visible actions, while the mechanics remain explicit and fair across methods.

## Presentation direction

Barbara's story should be shown where it happens rather than in a separate event ticker or post-race recap:

- a distinctive but tasteful visual marker around Barbara
- short speech or thought bubbles anchored near her passenger marker
- live character status in her hover tooltip
- visible luggage, pauses, assistance, and movement inside the aircraft
- optional camera emphasis that never pauses or changes the simulation

## Phased delivery

### Phase 1: Deterministic character and event framework

- event definitions generated from the scenario seed
- one shared Barbara definition applied identically to every boarding method
- deterministic passenger selection or insertion without duplication
- named-character metadata and current-event state
- short anchored speech/thought bubbles
- late queue insertion
- heavy-bag stow delay
- bounded restroom-realization pause
- event timing and direct-delay measurements available to the model, without adding a post-race recap

### Phase 2: Assistance

- failed lift animation
- selected helper or crew intervention
- explicit assistance duration
- visible helper-to-Barbara interaction

### Phase 3: True restroom movement

- bidirectional aisle travel
- yielding and passing rules
- front or rear restroom configuration
- return trip to the assigned seat

Phase 3 should not begin until reverse movement is designed independently; faking it invisibly would make the animation dishonest.

## Fairness

Barbara's intrinsic event script, timing draws, bag difficulty, and decisions are shared across all methods. Consequences may differ because she encounters different aisle and queue states.

## Metrics

- delay directly caused by event actions
- passengers delayed
- queue positions displaced
- event duration
- whether the event changed the winner

These measurements support testing and future analysis; they do not require a post-race recap UI.

## Acceptance criteria

- Event script is deterministic by seed
- No passenger is duplicated or lost during insertion
- Every mechanical effect is visible in the cabin, an anchored bubble, or Barbara's hover status
- The same Barbara definition is used in every method
- Event behavior can be disabled completely
- No separate Race Moments ticker or post-race recap is introduced
