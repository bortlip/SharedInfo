# Release and Development Workflow

## Protected artifacts

### `simulator.html`

The root simulator is the frozen legacy v2.4 release. It must never be edited, reformatted, regenerated, moved, or deleted.

### `dist/simulator.html`

This is the canonical released simulator served by the root redirect. It may change only after Barry explicitly approves promoting a development version.

### `index.html`

This is the release pointer. It may change only with explicit approval, normally as part of a release or release-structure PR.

## Development artifact

### `dev/simulator.html`

This is the working browser build. Normal feature work targets this file or future source files that generate it.

## Required workflow

1. Start from current `main` on a topic branch.
2. Change only development code, design documents, or task documents unless explicit release permission has been given.
3. Open a PR describing behavior, validation, and affected files.
4. Do not merge the PR. Barry reviews and merges it.
5. Continue development through additional PRs as needed.
6. When Barry explicitly approves a release, create a dedicated release PR.
7. The release PR copies the approved development artifact into `dist/simulator.html` and updates release metadata or `index.html` only when required.
8. Barry alone merges the release PR.

## Release PR checklist

- Explicit release approval exists in the conversation or issue
- `simulator.html` is absent from the diff
- `dist/simulator.html` exactly matches the approved artifact
- `index.html` changes only when explicitly approved
- Version and release notes are correct
- JavaScript syntax validation passes
- Browser smoke test passes
- Determinism and representative benchmark tests pass
- No unrelated feature or documentation changes are bundled

## Assistant rule

The assistant may create branches, commits, and PRs, but must never merge PRs in this repository. It must not modify protected artifacts without explicit permission for that exact release or structural change.
