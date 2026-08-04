# Group-Aware Aircraft Boarding Simulator

A deterministic, group-aware aircraft boarding simulator built primarily to be interesting, playful, and easy to explore.

- [Open the released simulator](https://bortlip.github.io/SharedInfo/simulations/group-aware-boarding/)
- [Open the unreleased candidate](https://bortlip.github.io/SharedInfo/simulations/group-aware-boarding/dist/simulator.html)
- [Open the modular source preview](https://bortlip.github.io/SharedInfo/simulations/group-aware-boarding/src/)
- [Read how the current released model works](MODEL.md)
- [Read the product and technical design](design/)
- [Browse the improvement backlog](tasks/)

## Folder structure

```text
index.html             Stable redirect to the released root simulator. Protected.
simulator.html         Official released version and permanent shared URL. Protected.
src/                   Modular, unreleased source used for normal feature work.
dist/simulator.html    Generated, unreleased release candidate built from src/.
tools/                 Dependency-free build tooling.
design/                Product, UI, architecture, and release-process documents.
tasks/                 One write-up per proposed improvement.
MODEL.md               Exact functional description of the current released model.
```

The root `index.html` and root `simulator.html` remain exactly as they were before this structure was introduced. Existing shared links therefore continue to serve the released v2.4 simulator.

The initial modular source was extracted from that released implementation. Running `python tools/build_simulator.py` bundles the source back into one standalone `dist/simulator.html` candidate.

## Development and release rule

Normal feature PRs modify `src/`, supporting documentation or tests, and the generated `dist/simulator.html` candidate. They must not modify the root `index.html` or root `simulator.html`.

When Barry explicitly approves a release, a dedicated promotion PR copies the already-reviewed `dist/simulator.html` candidate over the root `simulator.html`. That PR introduces no new feature code, keeps `index.html` unchanged, and is merged only by Barry. See [Release and Development Workflow](design/RELEASE_AND_DEVELOPMENT_WORKFLOW.md).

## GitHub Pages visibility

Because this repository currently publishes from a branch source, files under the published source tree are publicly addressable after they reach that branch. The `src/` preview and `dist/` candidate are therefore public test URLs, but neither is the official released simulator.
