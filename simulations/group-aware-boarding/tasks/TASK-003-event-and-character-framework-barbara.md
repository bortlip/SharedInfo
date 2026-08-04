# TASK-003: Event and Character Framework — Barbara

**Status:** Idea  
**Depends on:** TASK-002 recommended

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

The humor should come from a recognizable cascade of events, while the mechanics remain explicit and fair across methods.

## Phased delivery

### Phase 1: Framework and safe prototype

- event definitions generated from the scenario seed
- event ticker and speech bubbles
- late queue insertion
- heavy-bag stow delay
- bounded restroom-realization pause
- final recap showing Barbara's contribution to delay

### Phase 2: Assistance

- failed lift animation
- selected helper or crew intervention
- explicit assistance duration

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

## Acceptance criteria

- Event script is deterministic by seed
- No passenger is duplicated or lost during insertion
- Every mechanical effect is visible in the log or inspector
- The same Barbara definition is used in every method
- Event can be disabled completely
