# TASK-019: Method Selection and Race Layouts

**Status: In progress**

## Goal

Let a user focus the race on the boarding methods they actually care about and choose between a spacious comparison and a denser fleet view.

## Functional behavior

- All six methods begin selected.
- Each method can be independently included or excluded through accessible toggle controls.
- At least one method must remain selected.
- Selecting two methods gives them the available row side by side in Roomy view.
- Compact Fleet uses narrow cards, shorter aircraft, condensed headings, and two-column metrics so more methods fit on screen simultaneously.
- Method toggles are a view choice only: all six simulations are created together and continue advancing in sync, including hidden methods.
- Revealing a method mid-run immediately shows its current synchronized state; hiding or revealing methods never pauses or resets the race.
- Method changes clear benchmark results because the benchmark comparison field changed, but they do not alter the animation.
- Layout changes are presentational and do not reset the race.
- Benchmarks run and award wins only among the selected methods.
- Exact benchmark-repeat detection includes the selected method set.
- Shareable links preserve selected methods and the layout; older links safely default to all methods in Roomy view.

## Release safety

This task changes modular source and regenerates `dist/simulator.html`. It must not modify the released root `simulator.html` or root `index.html`.
