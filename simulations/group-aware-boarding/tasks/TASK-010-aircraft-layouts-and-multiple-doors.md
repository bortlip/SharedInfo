# TASK-010: Aircraft Layouts and Multiple Doors

**Status:** Idea

## Goal

Generalize the simulator beyond one 31-row, 3-3, front-door cabin.

## Initial layouts

- short 3-3 narrow body
- current 31-row baseline
- long narrow body
- 2-2 regional jet
- front-and-rear door boarding

Wide-body and dual-aisle layouts should wait until the movement engine supports branching paths.

## Configuration

An aircraft definition should include:

- rows and seat letters
- aisle positions
- seat depth and side
- entry doors
- restroom locations
- bin capacity
- zone boundaries
- optional cabin classes or blocked rows

## UI

Use illustrated aircraft cards instead of a raw geometry editor initially. An advanced editor can follow once the schema stabilizes.

## Acceptance criteria

- Current layout reproduces baseline behavior
- At least one 2-2 layout works
- Front-and-rear entry has explicit passenger door assignment
- Queue methods document how they adapt to multiple doors
- Aircraft definitions are data, not hard-coded conditionals throughout the engine
