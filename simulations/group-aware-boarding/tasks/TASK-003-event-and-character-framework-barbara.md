# TASK-003: Event and Character Framework — Barbara and Cabin Incidents

**Status:** Barbara trip and configurable cabin personality implemented in candidate

## Implemented

### Barbara

- deterministic late insertion, heavy carry-on, true front-lavatory trip, return travel, and squeeze penalties
- visible marker, direction changes, lavatory, speech bubbles, and detailed hover state
- shared intrinsic definition across all boarding methods

### Configurable disruptive passengers

The advanced controls allow 0 through 3 disruptive passengers. A separate seeded stream selects eligible adult individual travelers without disturbing ordinary manifest draws.

Implemented archetypes:

- **Chatty:** two seeded story pauses that visibly block the aisle
- **Tipsy/slow:** reduced walking speed, visible sway, and one seeded bearings pause

Every selected traveler has a marker, role, live status, incident progress, and direct event delay in hover details. Their identity and intrinsic behavior are shared across methods; congestion-dependent consequences may differ.

### Ambient cabin chatter

- Off: no ambient lines
- Light: five seeded passengers receive one line each
- Lively: twelve seeded passengers receive one line each

Ambient chatter is visual only. It never changes movement or results, and each selected passenger speaks at most once.

## Fairness and safety properties

- passenger IDs remain unique and complete
- named characters and incidents use separate random streams
- all mechanical effects are visible in the cabin, a bubble, or hover state
- character and incident behavior can be disabled
- no Race Moments ticker or post-race recap

## Next slice — visible crew assistance

- add a deterministic cabin-crew actor near the front door
- support a passenger requesting help with a bag or finding a seat
- animate crew travel or reach rather than teleporting assistance
- pause or yield correctly while the interaction occurs
- expose both passenger and crew status on hover
- reuse the same framework for Barbara's failed-lift beat

## Acceptance criteria

- scripts are deterministic by seed
- no passenger is duplicated or lost
- ordinary scenarios with zero disruptions preserve previous mechanical results
- ambient chatter never changes results
- shared links preserve incident and chatter settings
- no separate event ticker or post-race recap is introduced
