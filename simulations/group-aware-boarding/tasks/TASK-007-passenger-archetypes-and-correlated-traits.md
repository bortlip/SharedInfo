# TASK-007: Passenger Archetypes and Correlated Traits

**Status:** Idea

## Goal

Create recognizable travelers whose behaviors make sense together instead of sampling every trait independently.

## Candidate archetypes

- Frequent flyer: quick entry, stow, and seating
- Heavy packer: likely bag, long stow time
- Leisure traveler: moderate pace, more hesitation
- Anxious traveler: occasional pauses and seat checking
- Distracted traveler: delayed response to movement
- Slow walker but efficient bag handler
- Fast walker with awkward oversized bag

Archetypes should be light-touch distributions, not rigid stereotypes.

## Model direction

Each passenger receives latent factors such as mobility, travel experience, luggage burden, and attentiveness. Observable speeds and delays are derived from those factors, creating useful correlations.

## UI

Archetypes may have subtle icons or inspector labels. The cabin should not become a carnival of unreadable symbols; only currently relevant traits need to appear during animation.

## Acceptance criteria

- Correlated traits are documented and seed-deterministic
- Archetype effects can be disabled
- Trait labels explain actual mechanics
- Statistical distributions remain bounded
- No protected or sensitive human characteristic is used as a joke or proxy for incompetence
