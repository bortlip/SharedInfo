# TASK-013: Web Worker and Modular Source

**Status:** Idea

## Goal

Keep the UI responsive during large experiments and make the codebase safe to extend.

## Web Worker

Move benchmarks and sensitivity sweeps off the main thread. The worker receives a serializable scenario snapshot and returns progress, aggregates, cancellation acknowledgement, and optional sampled traces.

The visible race must remain independent and smooth.

## Modular source

Split manifest generation, methods, simulation, events, metrics, rendering, controls, and benchmark logic into testable modules. A build step should still emit one self-contained development HTML and eventually one self-contained release HTML.

## Guardrails

- no module imports in the final standalone build
- deterministic engine independent of DOM and canvas
- generated artifact includes version metadata
- build output is reproducible

## Acceptance criteria

- A long benchmark does not freeze interaction or animation
- Benchmark can be cancelled
- Headless engine tests run without a browser
- Development artifact is generated from source
- Generated output is not copied into `dist/` without an explicitly approved release PR
