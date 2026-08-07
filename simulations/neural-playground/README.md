# Neural Playground

A dependency-free interactive learning lab for watching tiny machine-learning models learn. Draw or load 2D classification problems, animate training, inspect the decision field, and trace a sample through the network as weights and activations change.

Current release: **v0.1.1**

- [Open the released simulator](https://bortlip.github.io/SharedInfo/simulations/neural-playground/)
- [Open the modular source preview](https://bortlip.github.io/SharedInfo/simulations/neural-playground/src/)

## What it demonstrates

- A classic single perceptron learning a linear decision boundary.
- XOR and circular datasets that expose the limits of a single linear classifier.
- A tiny one-hidden-layer neural network trained from scratch in JavaScript.
- Live classification regions, decision boundaries, accuracy, loss, and training history.
- A signal-flow view that animates the current sample through learned weighted connections.
- Editable training data so learners can add, inspect, or erase examples and watch the model adapt.

## Folder structure

```text
index.html          Stable redirect to the released simulator.
simulator.html      Released application shell.
src/index.html      Direct modular-source preview.
src/styles.css      Application styling.
src/js/             JavaScript organized by responsibility.
```

## JavaScript modules

```text
version.js          Single source of truth for the visible release version.
constants.js        Canvas sizes and training/display constants.
utils.js            Math, formatting, deterministic random, and color helpers.
state.js            DOM handles and mutable simulation state.
datasets.js         Deterministic linear, noisy, XOR, and circular datasets.
model.js            Perceptron and one-hidden-layer neural network implementations.
simulation.js       Reset, training, metrics, history, and signal selection.
render.js           Decision field, network flow, boundary, points, and history rendering.
ui.js               Metrics, inspector, lesson callouts, and control-state updates.
app.js              Input wiring, guarded bootstrap, and animation loop.
```

The files are ordinary browser scripts loaded in dependency order. No framework, package manager, bundler, external ML library, or build step is required.
