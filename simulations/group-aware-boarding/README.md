# Boarding Rush

A deterministic aircraft boarding simulator built primarily to be interesting, playful, and easy to explore.

The folder name remains `group-aware-boarding` so existing repository and GitHub Pages links remain stable. The currently released v2.4 HTML still displays its original title until a future release-promotion PR is explicitly approved and merged.

- [Open the released simulator](https://bortlip.github.io/SharedInfo/simulations/group-aware-boarding/)
- [Open the unreleased Boarding Rush candidate](https://bortlip.github.io/SharedInfo/simulations/group-aware-boarding/dist/simulator.html)
- [Open the modular source preview](https://bortlip.github.io/SharedInfo/simulations/group-aware-boarding/src/)
- [Read the formatted model guide](https://bortlip.github.io/SharedInfo/simulations/group-aware-boarding/model.html)
- [Read the canonical model specification](MODEL.md)
- [Read the product and technical design](design/)
- [Browse the improvement backlog](tasks/)

## Folder structure

```text
index.html             Stable redirect to the released root simulator. Protected.
simulator.html         Official released version and permanent shared URL. Protected.
src/                   Modular, unreleased Boarding Rush source used for feature work.
src/js/version.js      Single source of truth for the visible app version.
dist/simulator.html    Generated, unreleased release candidate built from src/.
model.html             Generated formatted guide built from MODEL.md.
tools/                 Dependency-free build tooling.
design/                Product, UI, architecture, and release-process documents.
tasks/                 One write-up per proposed improvement.
MODEL.md               Canonical functional description of the current simulator model.
```

The root `index.html` and root `simulator.html` remain protected. Existing shared links continue to serve the released v2.4 simulator.

Running `python tools/build_simulator.py` bundles the modular source into `dist/simulator.html` and regenerates the formatted root `model.html` page from `MODEL.md`.

## Development and release rule

Normal feature PRs modify `src/`, supporting documentation or tests, and the generated `dist/simulator.html` candidate. They must not modify the root `index.html` or root `simulator.html`.

When Barry explicitly approves a release, a dedicated promotion PR copies the already-reviewed `dist/simulator.html` candidate over the root `simulator.html`. That PR introduces no new feature code, keeps `index.html` unchanged, and is merged only by Barry. See [Release and Development Workflow](design/RELEASE_AND_DEVELOPMENT_WORKFLOW.md).

## GitHub Pages visibility

Because this repository currently publishes from a branch source, files under the published source tree are publicly addressable after they reach that branch. The `src/` preview and `dist/` candidate are therefore public test URLs, but neither is the official released simulator.
