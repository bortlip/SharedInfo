# Architecture Direction

## Current state

The official released simulator remains one self-contained root `simulator.html` file so existing shared links remain stable.

Development is now split into modular browser source under `src/`, with a dependency-free build that emits one standalone, unreleased candidate at `dist/simulator.html`.

```text
src/
  index.html
  styles.css
  js/
    constants.js
    random.js
    manifest.js
    methods.js
    simulation.js
    format.js
    render.js
    app.js
dist/
  simulator.html
tools/
  build_simulator.py
```

This is the first modular boundary, not the final architecture. It separates markup, styling, deterministic utilities, manifest generation, queue methods, simulation state, formatting, rendering, and page orchestration without introducing a package manager or external build dependency.

## Build model

`src/index.html` is directly previewable as an ES-module page. The build script:

1. reads the source HTML and stylesheet
2. reads modules in dependency order
3. removes module import/export syntax
4. wraps the combined script in a private function scope
5. inlines the CSS and JavaScript
6. writes one portable `dist/simulator.html`

An unchanged source tree must produce byte-identical candidate output.

The root released simulator is not generated automatically. Promotion from `dist/` to the root happens only in a user-approved release PR.

## Next architectural boundary

The simulation engine still contains some page-oriented assumptions. Future work should continue separating model state from DOM and canvas concerns.

A more mature source tree may evolve toward:

```text
src/
  model/
    manifest.js
    passengers.js
    movement.js
    events.js
    metrics.js
  methods/
    random.js
    backToFront.js
    frontToBack.js
    zones.js
    wilma.js
    steffen.js
  ui/
    controls.js
    renderer.js
    inspector.js
    replay.js
    results.js
  scenarios/
  workers/
  styles/
tests/
tools/
dist/
  simulator.html
```

The current modules can be split further only when a selected feature benefits from the new boundary. We should avoid architecture tourism—moving functions around merely because folders look industrious. 🙂

## Model boundaries

The simulation engine should eventually have no dependency on canvas or DOM objects. It should emit state snapshots and events such as:

```text
passengerEntered
passengerBlocked
bagStowStarted
seatConflict
characterEventStarted
passengerSeated
simulationCompleted
```

The renderer observes those events. This separation is essential for replay, testing, headless benchmarks, alternative visualizations, and character-event explanations.

## Replay

Deterministic replay should store scenario configuration, seed, and event/state information rather than video frames. The UI can reconstruct a moment by replaying from the beginning or from periodic checkpoints.

## Benchmarking

Large benchmark and sensitivity runs should execute in a Web Worker. The worker receives immutable scenario data and returns progress, aggregate results, cancellation acknowledgement, and optional sampled traces.

## Testing priorities

- Root `index.html` and root `simulator.html` never change in feature PRs
- Source modules parse independently
- Bundled candidate parses and loads
- Build output is reproducible
- Same seed and settings produce identical manifests
- All methods receive matching passenger traits
- Parties never split unless a future scenario explicitly permits it
- Event scripts are deterministic
- Queue insertion never duplicates or loses a passenger
- Every run terminates
- Replay reaches the same final fingerprint as the original run
- A release promotion makes root `simulator.html` byte-identical to the approved candidate
