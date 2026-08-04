# TASK-002: Passenger Inspector and Explainability

**Status:** Idea

## Goal

Turn passengers from anonymous dots into understandable participants and make simulation mechanics inspectable while the race is running.

## Interaction

Clicking or keyboard-selecting a passenger opens an inspector showing:

- name or generated label
- seat, party, and queue position
- adult, child, reduced-mobility, or future archetype
- walking speed
- bag status and base stow time
- base seating time
- current state and remaining action time
- seat conflicts caused or experienced
- cumulative waiting time
- why the method placed this party at its queue position
- active traits and event history

Selecting a family should show the whole party and preserve the visual connectors already used in the cabin.

## Explainability features

When a passenger stops, the inspector should state why: door spacing, passenger ahead, stowing, seat conflict, party coordination, or event behavior.

The result screen should link important delays back to the responsible passengers and events.

## UI direction

Use a side drawer on wide screens and a bottom sheet on mobile. Selection must work with pointer, keyboard, and touch. The cabin should spotlight the selected person without stopping the race.

## Acceptance criteria

- Every visible passenger can be selected
- Inspector values come from simulation state, not duplicated UI calculations
- Stop reasons are explicit
- Party membership is easy to understand
- Selection remains synchronized across rerenders
- No change to simulation outcome occurs from inspecting
