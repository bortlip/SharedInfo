# TASK-003: Event and Character Framework — Barbara

**Status:** Phase 1 done in candidate

## Goal

Create a deterministic framework for memorable passenger incidents, then prove it with a visible Barbara scenario.

## Phase 1 — implemented

Barbara Mode now provides:

- one seed-derived Barbara definition shared by every boarding method
- deterministic selection of an eligible adult individual without disturbing ordinary manifest draws
- a distinctive pulsing marker, name-aware hover details, and live character status
- late queue insertion after each method builds its normal queue
- explicit original and late boarding positions in Barbara's hover tooltip
- a seeded heavy carry-on with visible stowing and tracked direct delay
- one bounded restroom-realization pause in the aisle
- short speech or thought bubbles anchored to Barbara
- tests proving that no passenger is duplicated or lost
- no Race Moments ticker and no post-race recap

The restroom event is intentionally a pause only. Barbara does not move backward, visit a restroom, or pass another traveler in Phase 1.

## Fairness

Barbara's seat, intrinsic bag difficulty, late-arrival fraction, pause row, pause duration, and dialogue script are shared across all methods. Her original method position and the surrounding congestion can differ because each method constructs a different queue.

## Measurements

Each method retains Barbara's:

- original method position
- late inserted position
- queue displacement
- heavy-bag delay above her ordinary generated bag time
- elapsed restroom-pause delay
- combined direct character-event delay

These measurements support testing and hover explainability. They do not require a recap screen.

## Phase 2 — assistance

The next character slice should add:

- a visible failed-lift beat during the heavy-bag stow
- deterministic selection of a nearby helper or crew member
- helper movement or reach animation
- an explicit assistance duration
- Barbara and helper hover states that explain the interaction
- identical intrinsic assistance rules across methods

## Phase 3 — true restroom movement

Only after reverse aisle movement is independently designed:

- bidirectional aisle travel
- yielding and passing rules
- front or rear restroom configuration
- return trip to the assigned seat

Faking reverse movement invisibly would make the animation dishonest.

## Acceptance criteria

- Character script is deterministic by seed
- No passenger is duplicated or lost during insertion
- Every mechanical effect is visible in the cabin, an anchored bubble, or Barbara's hover status
- The same Barbara definition is used in every method
- Character behavior can be disabled completely
- Ordinary scenarios preserve their previous deterministic results
- No separate event ticker or post-race recap is introduced
