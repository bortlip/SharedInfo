# TASK-009: Gate, Jet Bridge, and Late Arrivals

**Status:** Idea

## Goal

Extend the simulation upstream so a boarding announcement is not treated as immediate aircraft entry.

## Proposed stages

1. Gate waiting area
2. Boarding-group call
3. Passenger scan queue
4. Boarding-pass scan
5. Jet bridge
6. Aircraft door
7. Cabin aisle

## Behaviors

- passengers lining up before their group
- scan-time variation
- document or seat-assignment problems
- parties regrouping after scanning
- overlapping group calls
- late arrivals
- queue jumping or joining a companion
- jet-bridge bunching

## UI

The normal cabin view should remain uncluttered. A small gate/bridge strip or alternate story view can show upstream congestion and late characters approaching.

## Fairness

Boarding methods that are purely cabin-order policies must receive equivalent gate conditions. Airline-policy comparisons may intentionally vary group calls or scanning rules.

## Acceptance criteria

- Gate time and cabin time are reported separately
- Late arrivals are explicit events
- No passenger appears at the aircraft door without passing modeled upstream stages
- The user can disable the upstream model and recover current behavior
