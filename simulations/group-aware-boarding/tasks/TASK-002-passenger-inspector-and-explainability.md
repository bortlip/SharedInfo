# TASK-002: Passenger Inspector and Explainability

**Status:** In progress

## Goal

Turn passengers from anonymous dots into understandable participants while keeping the race moving.

## Hover-first slice — done in candidate

- hovering an active passenger shows live passenger details without pausing
- hovering any seat explains whether it is unassigned, waiting for its passenger, being entered, or occupied
- tooltips report seat, party, boarding order, traveler type, current state, walking speed, carry-on status, and base seating time
- the passenger visibly moves laterally from the aisle toward the assigned seat during the existing seating state
- optional display-name and character-status fields are supported for future named characters
- all values come from simulation state and the visual layer does not change results

## Later explainability

- explicit stop reasons such as door spacing, a passenger ahead, stowing, or party coordination
- touch and keyboard access that does not depend on hover
- richer family-level inspection
- event history and named-character timelines

## Acceptance criteria

- Every visible active passenger and every seat can be explained
- Tooltip values come from simulation state, not duplicated model calculations
- Hover never pauses or changes the simulation
- Row-entry animation completes on the existing seating-state schedule
- Character metadata can appear without special-case UI code
