# Architecture Direction

## Current state

The released simulator is one self-contained HTML file. That is excellent for GitHub Pages deployment and sharing, but it will become increasingly difficult to maintain as characters, events, replay, inspectors, charts, and alternative aircraft are added.

## Desired source layout

A future development source tree may look like:

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
  styles/
tests/
tools/
dev/
  simulator.html
dist/
  simulator.html
```

The source may use modules or TypeScript, while the release process still emits one standalone `dist/simulator.html` file.

## Model boundaries

The simulation engine should not depend on canvas or DOM objects. It should emit state snapshots and events such as:

```text
passengerEntered
passengerBlocked
bagStowStarted
seatConflict
characterEventStarted
passengerSeated
simulationCompleted
```

The renderer observes those events. This separation is essential for replay, testing, headless benchmarks, and alternative visualizations.

## Replay

Deterministic replay should store the scenario configuration, seed, and event stream rather than video frames. The UI can reconstruct any point in the run by replaying or checkpointing simulation state.

## Benchmarking

Large benchmark and sensitivity runs should eventually execute in a Web Worker. The worker receives immutable scenario data and returns aggregate results and optional sampled traces.

## Testing priorities

- Released and development copies begin byte-identical
- Same seed and settings produce identical manifests
- All methods receive matching passenger traits
- Parties never split unless a future scenario explicitly permits it
- Event scripts are deterministic
- Queue insertion never duplicates or loses a passenger
- Every run terminates
- Replay reaches the same final fingerprint as the original run
- Release build matches the approved development artifact
