# Release and Development Workflow

## Protected released files

### `simulator.html`

The root simulator is the official released version and the permanent URL that has already been shared. It must not be edited, reformatted, regenerated, moved, or deleted during normal development.

It changes only in a dedicated promotion PR after Barry explicitly approves releasing the current candidate.

### `index.html`

The root index remains a stable redirect to the root `simulator.html`. Existing folder links and direct simulator links therefore resolve to the same released version.

It must not change without explicit permission for that exact change. A normal release should not need to modify it.

## Unreleased source and candidate

### `src/`

This is the modular working source. Normal feature work happens here.

The browser preview at `src/index.html` loads CSS and JavaScript modules directly. It is useful for development, debugging, and code review, but it is not the released simulator.

### `dist/simulator.html`

This is the generated, standalone release candidate. The dependency-free build script combines `src/index.html`, `src/styles.css`, and the JavaScript modules into one portable HTML file.

Normal feature PRs may update this file as the build result. It is public on GitHub Pages after merge, but it remains explicitly unreleased until promoted to the root simulator.

### `tools/build_simulator.py`

Run:

```bash
python simulations/group-aware-boarding/tools/build_simulator.py
```

The build must be deterministic: unchanged source must regenerate byte-identical candidate output.

## Required development workflow

1. Start from current `main` on a topic branch.
2. Modify modular source, tests, design documents, or task documents.
3. Regenerate `dist/simulator.html` when source changes.
4. Verify that root `index.html` and root `simulator.html` are absent from the diff.
5. Open a PR describing behavior, validation, and affected files.
6. Do not merge the PR. Barry reviews and merges it.
7. Continue development through additional PRs as needed. The candidate may accumulate multiple approved changes without affecting the released URL.

## Required release-promotion workflow

1. Barry explicitly approves releasing the current candidate.
2. Start a dedicated release branch from current `main`.
3. Rebuild the candidate and complete release validation.
4. Copy `dist/simulator.html` exactly over the root `simulator.html`.
5. Do not add feature changes, refactoring, cleanup, or unrelated documentation to the promotion PR.
6. Keep `index.html` unchanged unless Barry separately authorizes an index change.
7. Open the promotion PR and show that root `simulator.html` is byte-identical to the approved candidate.
8. Barry alone merges the promotion PR.

## Feature PR checklist

- Root `simulator.html` is absent from the diff
- Root `index.html` is absent from the diff
- Source modules parse successfully
- Standalone candidate JavaScript parses successfully
- Build output is reproducible
- Browser smoke test passes when behavior or UI changes
- Determinism and representative benchmark tests pass when model behavior changes
- PR is left open for Barry to merge

## Release PR checklist

- Explicit release approval exists in the conversation or issue
- PR changes the root `simulator.html` only as a promotion of the approved candidate
- Root `simulator.html` exactly matches `dist/simulator.html`
- `index.html` is unchanged unless separately authorized
- Version and release notes are correct
- JavaScript syntax validation passes
- Browser smoke test passes
- Determinism and representative benchmark tests pass
- No unrelated changes are bundled
- PR is left open for Barry to merge

## Assistant rule

The assistant may create branches, commits, and PRs, but must never merge PRs in this repository. It must never modify the root `simulator.html` or root `index.html` without explicit permission for that exact change.
