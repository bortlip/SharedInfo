# Pocket Prix

A dependency-free autonomous racing terrarium. Tiny drivers choose racing lines, attack gaps, manage grip, collide, take damage, leave skid marks, and occasionally require a tow truck.

Current release: **v1.0.0**

- [Open the released simulator](https://bortlip.github.io/SharedInfo/simulations/pocket-prix/)
- [Open the modular source preview](https://bortlip.github.io/SharedInfo/simulations/pocket-prix/src/)

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
constants.js        Simulation dimensions and physical constants.
utils.js            Math, formatting, and deterministic random helpers.
catalog.js          Tracks, driver styles, names, and colors.
state.js            DOM handles and mutable simulation state.
track.js            Spline construction, sampling, and track geometry.
world.js            Cars, scenery, hazards, and reset/setup.
racecraft.js        Driver perception, racing lines, passing, and control.
physics.js          Vehicle motion, grip, collisions, damage, and skid marks.
effects.js          Particles, birds, chaos events, and recovery vehicles.
simulation.js       Fixed-step race loop, ranking, and classification.
render.js           Canvas scene construction and rendering.
ui.js               Standings, telemetry, charts, and result panels.
audio.js            Engines, tire noise, impact sounds, and audio controls.
app.js              Input wiring, guarded bootstrap, and animation loop.
```

The files are ordinary browser scripts loaded in dependency order. No framework, package manager, bundler, runtime source concatenation, or build step is required.
