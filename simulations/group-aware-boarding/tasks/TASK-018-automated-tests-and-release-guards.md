# TASK-018: Automated Tests and Release Guards

**Status:** Idea

## Goal

Prevent regressions and accidental modification of protected release files.

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

## UI smoke tests

- page loads without console errors
- all six panels render
- run, pause, reset, and finish work
- benchmark does not affect visible race
- inspector and replay interactions work
- mobile and reduced-motion modes remain usable

## Release guards

A CI check should fail ordinary PRs that modify:

- root `simulator.html`
- `dist/simulator.html`
- root `index.html`

A deliberately marked release PR may modify approved protected paths, but the guard must never merge anything automatically. Barry remains the sole merger.

## Acceptance criteria

- Tests run on PRs
- Protected-file changes are obvious and blocked by default
- Release override is explicit and auditable
- No workflow writes directly to `main`
- Generated build and approved release artifact can be byte-compared
