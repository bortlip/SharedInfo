# Group-Aware Aircraft Boarding Simulator

A deterministic, group-aware aircraft boarding simulator built primarily to be interesting, playful, and easy to explore.

- [Open the released simulator](https://bortlip.github.io/SharedInfo/simulations/group-aware-boarding/)
- [Open the current development copy](https://bortlip.github.io/SharedInfo/simulations/group-aware-boarding/dev/simulator.html)
- [Read how the current model works](MODEL.md)
- [Read the product and technical design](design/)
- [Browse the improvement backlog](tasks/)

## Folder structure

```text
index.html             Released-page redirect. Change only with explicit release approval.
simulator.html         Frozen legacy v2.4 release. Never edit or delete.
dist/simulator.html    Canonical released artifact. Change only in an approved release PR.
dev/simulator.html     Non-released working copy. Normal feature work happens here.
design/                Product, UI, architecture, and release-policy documents.
tasks/                 One write-up per proposed improvement.
MODEL.md               Exact functional description of the current v2.4 model.
```

The files in `dist/` and `dev/` began as byte-identical copies of the released v2.4 simulator. The root `index.html` now points to the `dist/` copy. The original root `simulator.html` remains untouched as a frozen historical release.

## Release rule

Normal development must not modify `index.html`, `simulator.html`, or anything under `dist/`. A release happens only after explicit approval, in a dedicated PR reviewed and merged by Barry. See [Release and Development Workflow](design/RELEASE_AND_DEVELOPMENT_WORKFLOW.md).
