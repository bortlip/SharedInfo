# Pocket Prix

A playful autonomous racing terrarium where tiny drivers steer, brake, pass, skid, collide, take damage, and occasionally require a tow truck.

- [Open the released simulator](https://bortlip.github.io/SharedInfo/simulations/pocket-prix/)
- [Open the simulator directly](https://bortlip.github.io/SharedInfo/simulations/pocket-prix/simulator.html)

## Folder structure

```text
index.html             Stable redirect to the released simulator.
simulator.html         Public simulator shell and permanent shared URL.
styles.css             Visual design and responsive layout.
app-loader.js          Loads and assembles the simulation source.
src/app-source-*.txt   Ordered source fragments for the autonomous racing model.
```

The implementation is dependency-free and runs entirely in the browser. The source is divided only to keep repository writes and future edits manageable; `app-loader.js` joins the fragments and executes them as one script.

## Current model

Drivers use distinct controller personalities, a continuous outside-apex-outside racing corridor, local collision prediction, grip-limited steering and acceleration, momentum, skidding, persistent tire marks, impact damage, disabled vehicles, fires, recovery towing, spatial engine audio, slick spots, and optional scheduled chaos incidents.
