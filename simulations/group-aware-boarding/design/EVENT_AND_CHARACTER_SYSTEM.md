# Event and Character System

## Goal

Add memorable passenger behavior without destroying reproducibility or turning the model into untraceable randomness.

Events should be deterministic objects generated from the scenario seed. Every boarding method receives the same event definitions and the same affected passenger traits. Method-dependent consequences may differ because queues and aisle states differ.

## Event structure

A future event can be described by:

```text
id
name
description
seeded trigger
eligible passenger or party
state prerequisites
mechanical effects
visual effects
log messages
completion conditions
metrics emitted
```

Events should expose their exact effects to the inspector and final recap.

## Trigger types

- Simulation time
- Passenger reaches the door
- Passenger reaches a row
- Queue position becomes available
- First large aisle blockage
- Random eligible moment within a bounded window
- User-triggered event in sandbox mode

For comparative fairness, prefer triggers tied to a passenger or shared event script rather than "at 60 seconds" when methods may be in radically different states.

## Character traits versus events

A **trait** exists for the entire run: slow bag lifter, anxious traveler, frequent flyer, child, reduced mobility.

An **event** is something that happens: late arrival, restroom trip, dropped item, seat confusion, bag assistance.

A character can combine several traits and events, but the UI should show each mechanical consequence separately.

## Barbara scenario

"Barbara" is a named comic scenario inspired by the familiar passenger who seems to encounter every exception at once. She is not part of the released model yet.

Suggested staged behavior:

1. **Late arrival** — Barbara is initially absent from her normal queue position.
2. **Queue jump** — she enters later and is inserted near her assigned group or an earlier configurable position.
3. **Heavy carry-on** — her bag-stow attempt receives a large delay.
4. **Needs help** — after a short unsuccessful attempt, a nearby passenger or crew-assistance animation completes the lift.
5. **Restroom realization** — before seating, she decides she needs the restroom.
6. **Reverse movement** — she travels toward the configured restroom while others yield or remain blocked.
7. **Return trip** — she comes back to her row and finally seats.

The feature should visibly show these phases with an event badge, bag icon, direction arrow, short speech bubble, and event-log entries.

## Important modeling questions

Before implementation, decide:

- Is the restroom at the front, rear, or aircraft-dependent?
- Can passengers move in both directions past one another?
- Does Barbara leave the aisle temporarily or block it continuously?
- Who helps with the bag, and how is that helper selected?
- Does queue jumping replace her original position or create a duplicate risk?
- Should all methods receive Barbara at the same passenger-relative trigger?
- Is Barbara one rare event, a preset, or part of a general chaos slider?

## Recommended first implementation

Build a generic event timeline and visual callout system before adding reverse aisle movement. The first Barbara prototype can safely model:

- late insertion into the door queue
- a visible heavy-bag delay
- a restroom announcement that adds a bounded row pause

Then add true restroom travel only after bidirectional movement is designed and tested.

## Fairness rule

A character may produce different total delays in different methods because surrounding conditions differ. The character's intrinsic decisions, timing draws, bag difficulty, and event sequence must nevertheless come from the same seed and scenario definition in every method.
