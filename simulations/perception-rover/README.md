# Perception Rover Lab

A dependency-free browser lab for the full supervised-learning workflow: drive a simulated rover, collect camera frames, create steering labels, train a tiny neural network from scratch in JavaScript, evaluate it on held-out validation data, and deploy it as an autopilot.

Current release: **v0.1.0**

- [Open the released simulator](https://bortlip.github.io/SharedInfo/simulations/perception-rover/)
- [Open the modular source preview](https://bortlip.github.io/SharedInfo/simulations/perception-rover/src/)
- [Related lab: Neural Playground](https://bortlip.github.io/SharedInfo/simulations/neural-playground/)

## What it demonstrates

- Manual driving where each recorded camera frame is labeled by the steering action.
- A simulated forward camera downsampled to 16×12 grayscale pixels for the model input.
- A 192 → 32 → 3 neural network implemented and trained directly in JavaScript.
- Stratified train/validation splitting so students can compare memorization with performance on held-out data.
- A balanced expert-data generator with off-center and misaligned recovery examples.
- Probability-blended autopilot control driven only by model predictions from camera pixels.
- Dataset experiments around class balance, coverage, recovery states, and distribution shift.

## Suggested first experiment

1. Generate the expert dataset.
2. Train the model.
3. Reset the rover and enable autopilot.
4. Clear the dataset.
5. Record your own driving data, retrain, and compare the result.

The contrast is intentional: a model trained only on clean centered driving may validate well on similar frames yet fail as soon as its own small steering error moves it into a camera state it never saw during training.

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
constants.js        Road, camera, and neural-network constants.
utils.js            Math and array helpers.
state.js            Canvas handles, offscreen input buffer, and mutable state.
road.js             Periodic road geometry, expert controller, reset, and physics.
render.js           Top-down world, forward camera, and camera-to-model input.
dataset.js          Manual recording, labels, expert examples, and dataset reset.
model.js            Tiny fully-connected neural network and backpropagation.
training.js         Training loop, stratified split, and validation reporting.
ui.js               Dataset, prediction, telemetry, and steering UI updates.
app.js              Input wiring, guarded bootstrap, and animation loop.
```

The files are ordinary browser scripts loaded in dependency order. No framework, package manager, bundler, external ML library, or build step is required.
