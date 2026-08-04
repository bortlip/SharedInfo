# TASK-018: Automated Tests and Release Guards

**Status:** Idea

## Goal

Prevent regressions and accidental modification of the protected public release while allowing ordinary work on the modular source and unreleased candidate.

## Engine tests

- deterministic manifest fingerprints
- method queue ordering
- party contiguity
- no duplicated or missing passengers
- seat-conflict counting
- blocked-time accounting
- sequence-compliance boundaries
- event determinism
- completion safety
- benchmark paired-manifest behavior
- module build and bundled build equivalence

## UI smoke tests

- modular source page loads without console errors
- standalone candidate loads without console errors
- all six panels render
- run, pause, reset, and finish work
- benchmark does not affect visible race
- inspector and replay interactions work when added
- mobile and reduced-motion modes remain usable

## Feature-PR guards

A CI check should fail ordinary feature PRs that modify:

- root `simulator.html`
- root `index.html`

Normal feature PRs are expected to modify `src/` and may modify generated `dist/simulator.html`.

The guard should also verify that:

- `dist/simulator.html` is reproducibly generated from `src/`
- source modules parse
- bundled JavaScript parses
- the PR does not merge automatically

## Release-promotion guard

A deliberately identified release PR may modify root `simulator.html` only after explicit approval. It must prove that the released root file is byte-identical to the approved `dist/simulator.html` candidate.

Root `index.html` remains protected unless Barry separately authorizes an index change.

## Acceptance criteria

- Tests run on PRs
- Protected root-file changes are obvious and blocked by default
- Candidate changes remain available to ordinary feature PRs
- Release override is explicit and auditable
- No workflow writes directly to `main`
- Generated candidate is reproducible
- Approved candidate and promoted root release can be byte-compared
- Barry remains the sole merger
