# TASK-020: Visible Luggage and Overhead Bins

**Status: In progress**

## Goal

Make carry-ons part of the visible story of the race rather than an invisible delay number.

## Functional behavior

- A passenger with a carry-on has a small suitcase marker while walking down the aisle.
- While the passenger is stowing, the suitcase moves from the passenger toward the overhead bin on the correct side of the assigned row.
- After stowing completes, the suitcase remains visible in that row-side bin for the rest of the simulation.
- Each method has its own independent overhead-bin contents because its boarding order creates a different stowing history.
- The completed-flight plaque no longer darkens the entire cabin, so seated passengers and stored luggage remain visible.
- The existing bag probability, stow-duration, and congestion calculations are unchanged.
- This is not finite-bin-capacity modeling: there is still no overflow search, gate checking, or alternate-row placement.

## Release safety

This task changes modular source and regenerates `dist/simulator.html`. It must not modify the released root `simulator.html` or root `index.html`.
