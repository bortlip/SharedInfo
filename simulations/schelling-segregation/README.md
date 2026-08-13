# Schelling Segregation Lab

An interactive, dependency-free laboratory for Schelling-style residential sorting models. Start with the classic two-group vacancy model, then change the assumptions: 2–20 groups, neighborhood geometry, tolerance rules, heterogeneous agents, swapping, local search, destination choice, stopping rules, visualization, and synchronized A/B comparison.

Current release: **v1.0.0**

- [Open the released simulator](https://bortlip.github.io/SharedInfo/simulations/schelling-segregation/)
- [Open the modular source preview](https://bortlip.github.io/SharedInfo/simulations/schelling-segregation/src/)

## Folder structure

```text
index.html          Stable redirect to the released simulator.
src/index.html      Source entry point; opens the release shell that loads src directly.
src/index.html      Direct modular-source preview.
src/styles.css      Application styling.
src/js/             JavaScript organized by responsibility.
```

## JavaScript modules

```text
version.js          Single source of truth for the visible release version.
constants.js        Defaults, palettes, and preset model configurations.
utils.js            Math, deterministic random, cloning, and URL helpers.
state.js            DOM handles and mutable application state.
world.js            Agent/grid creation, initialization patterns, and editing.
neighborhood.js     Moore/Von Neumann neighborhoods and local composition.
satisfaction.js     Satisfaction rules, thresholds, and placement utility.
movement.js         Vacancy/swap search, destination policies, and relocation.
metrics.js          Satisfaction, segregation, cluster, and history metrics.
simulation.js       Reset, stepping, convergence, comparison, and stop logic.
render.js           Grid, overlays, trails, selection, and chart rendering.
ui.js               Settings, presets, group shares, metrics, and inspection.
app.js              Input wiring, interaction, guarded bootstrap, and loop.
```

The released page and modular source load the same ordinary browser scripts in dependency order. There is no framework, package manager, bundler, or build step.

The default "segregation index" is a baseline-adjusted local same-neighbor score: observed mean same-group neighbor share is compared with the share expected from the current group proportions. It is useful for within-lab comparisons, but it should not be confused with a uniquely canonical empirical segregation index.

Snapshot-simultaneous rounds let all eligible agents choose from the same frozen pre-move world. If plans conflict, they are applied in randomized order only while their original source and target still match that snapshot.
## Model note

This is a configurable toy model for exploring how local rules can produce aggregate spatial patterns. It is not a complete causal model of real residential segregation; housing policy, discrimination, wealth, lending, zoning, geography, migration, and many other mechanisms are intentionally absent unless modeled explicitly.
