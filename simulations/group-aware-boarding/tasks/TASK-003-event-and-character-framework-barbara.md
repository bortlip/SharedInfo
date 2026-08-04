# TASK-003: Event and Character Framework — Barbara and Cabin Incidents

**Status:** Barbara, cabin incidents, and visible crew assistance implemented in candidate

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

## Visible crew assistance — implemented

- deterministic cabin-crew actor Maya starts near the front door
- Barbara and the third disruptive archetype perform a failed overhead-bin lift
- requests are served first-come without teleporting the crew actor
- crew travel, passenger yields, assistance time, and return travel are animated
- assisted bags visibly move into their correct overhead compartment
- passenger and crew hover details explain the live interaction and accumulated delay
- intrinsic crew and assistance values are shared across methods

## Next slice — broader crew interactions

- optional seat-finding and family-coordination requests
- a second crew member for high-chaos scenarios
- bounded crew-request controls separate from disruptive-passenger count
- clearer visual signaling when multiple requests are queued

## Acceptance criteria

- scripts are deterministic by seed
- no passenger is duplicated or lost
- ordinary scenarios with zero disruptions preserve previous mechanical results
- ambient chatter never changes results
- shared links preserve incident and chatter settings
- no separate event ticker or post-race recap is introduced
