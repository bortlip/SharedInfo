# TASK-004: Race Presentation, Replay, and Turning Points

**Status:** In progress

## Goal

Make six simultaneous simulations entertaining to watch and easy to understand as a competitive race.

## First two visual slices — done in candidate

The race presentation now includes:

- a live leaderboard above the aircraft cards
- compact method names that remain readable in narrow layouts
- current rank, seated percentage, and seated-passenger gap for every visible method
- deterministic tie breakers using passengers entered and active aisle progress
- animated lead changes and finish-position ribbons
- click-to-emphasize behavior from leaderboard rows
- a live step graph with simulated time on the horizontal axis and passengers seated on the vertical axis
- graph history for all six synchronized methods, even while some panels are hidden
- Small, Medium, and Large graph sizes that do not reset or alter the race
- no changes to simulation rules or numerical results

The Race Moments ticker was removed after review because it added visual noise without enough explanatory value. The exact ranking and graph rules are documented in `MODEL.md` and the generated model guide.

## Remaining race presentation

- richer current-bottleneck explanations inside the aircraft view, only when they clarify something visible
- optional full-field overview separate from the aircraft cards
- more deliberate finish ceremony and final standings
- post-race explanation of where the winner gained time

## Replay

Store deterministic event/state information so the user can:

- pause and step
- scrub through time
- jump to conflicts or character events
- replay the final minute
- synchronize two methods at the same simulated time

## Turning points

After completion, identify a small set of meaningful moments such as:

- largest single blockage
- burst of parallel stowing
- major seat-conflict cluster
- late event that changed the lead
- final passenger entering the aircraft

## Acceptance criteria

- Race mode never changes model results
- Replay reproduces the same final fingerprint
- Lead calculations are documented
- Users can jump to at least three event categories
- The post-race recap explains why the winner gained time
