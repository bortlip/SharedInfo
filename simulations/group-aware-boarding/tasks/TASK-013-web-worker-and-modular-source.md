# TASK-013: Web Worker and Further Engine Modularization

**Status:** Partially complete  
**Completed structurally:** Initial HTML/CSS/JavaScript split and standalone candidate build

## Goal

Keep the UI responsive during large experiments and continue making the codebase safe to extend.

## Already established

The structure PR introduced:

- modular page source under `src/`
- separate manifest, method, simulation, rendering, formatting, random, constants, and application modules
- a dependency-free build script
- a directly previewable module page
- one generated standalone `dist/simulator.html` candidate
- reproducible-build validation

This initial split preserves the current implementation while giving future work real file boundaries.

## Remaining Web Worker work

Move benchmarks and sensitivity sweeps off the main thread. The worker receives a serializable scenario snapshot and returns:

- progress
- aggregate results
- cancellation acknowledgement
- errors
- optional sampled traces

The visible race must remain independent and smooth.

## Remaining engine modularization

The current `app.js` still owns substantial orchestration, and some model behavior remains coupled to page-oriented structures. Split further when selected features require it:

- scenario and configuration schema
- event engine
- metrics collection
- replay/checkpoint state
- headless benchmark runner
- DOM-independent simulation facade
- worker message protocol

## Guardrails

- no module imports in the final standalone candidate
- deterministic engine independent of DOM and canvas
- generated artifact includes version metadata
- build output is reproducible
- further splitting must serve a feature or test boundary rather than folder aesthetics

## Acceptance criteria

- A long benchmark does not freeze interaction or animation
- Benchmark can be cancelled
- Headless engine tests run without a browser
- Worker and main-thread runs produce matching results
- Development candidate is generated from source
- Root released files remain untouched until a dedicated user-approved promotion PR
