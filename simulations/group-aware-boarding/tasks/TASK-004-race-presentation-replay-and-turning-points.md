# TASK-004: Race Presentation, Replay, and Turning Points

**Status:** Ready

## Goal

Make six simultaneous simulations entertaining to watch and easy to understand as a competitive race.

## Recommended first visual slice

Build the race HUD before full replay:

- one live leaderboard above the aircraft cards
- current rank, seated percentage, and gap to the leader for every visible method
- animated lead-change and finish-order moments
- short event callouts for a long bag stow, a seat-conflict cluster, and a heavily blocked aisle
- clicking a leaderboard row briefly emphasizes that aircraft panel
- no simulation-rule changes and no replay storage in this first slice

This produces an immediate visual payoff while establishing event data that replay and post-race turning-point analysis can reuse.

## Race presentation

- live rank badges for all methods
- progress bars and time gaps
- lead changes
- animated finish order
- current bottleneck badge
- event ticker per method
- compact overview and optional head-to-head view

A live rank should be based on a documented progress estimate, not only elapsed time. Until a defensible estimate exists, rank can use seated count with deterministic tie breakers and be labeled provisional.

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
