# Green Hackenbush Garden

An interactive Green Hackenbush game, solver, and explainer. Build a garden from grounded graph components and Nim heaps, play against a perfect computer, watch two perfect players, or inspect the Sprague-Grundy analysis that determines the winner.

- [Open the live simulator](https://bortlip.github.io/SharedInfo/simulations/green-hackenbush/)
- [Open the released HTML directly](https://bortlip.github.io/SharedInfo/simulations/green-hackenbush/simulator.html)
- [Browse the source folder](https://github.com/bortlip/SharedInfo/tree/main/simulations/green-hackenbush)

## Current release

**v1.0.0**

The default game reproduces "The Last Gardener" puzzle. Its four shrubs have Grundy values `4`, `1`, `0`, and `3`, whose XOR is `6`. Setting the bowl to `6` balances the complete position at XOR `0`, giving the second player the winning strategy under perfect play.

## Features

- One-screen garden view with animated cuts, falling pieces, and highlighted computer moves
- Human vs perfect computer, perfect vs perfect, and two-human modes
- Adjustable autoplay pace
- Play and Explain views
- Detailed Sprague-Grundy, mex, Nim-equivalence, and XOR explanations
- Exact recursive solving with memoization
- Editable text definitions for custom shrubs and heaps
- Random game generation with configurable shrubs, bowls, edge counts, and cycle chance
- System, light, and dark themes
- No external libraries or build step

## Game definition format

Each shrub is an undirected graph. `G` is the ground. Every edge touching `G` is drawn vertically down to the ground directly beneath its attached node.

```text
# The Last Gardener
shrub Oak: G-A, A-B, B-C, A-D
shrub Arch: G-A, A-B, B-G
shrub Window: G-A, A-B, B-C, C-G
shrub Tower: G-A, A-B, B-G, B-C, C-D
heap Bowl: 6
```

A move cuts one surviving shrub edge or removes any positive number of pebbles from one heap. After a shrub cut, every edge no longer connected to `G` falls away.

## How the solver works

For each shrub state, the simulator:

1. Tries every legal edge cut.
2. Removes all edges no longer connected to the ground.
3. Recursively calculates each resulting Grundy value.
4. Assigns the current state the minimum excluded value (`mex`) of those results.
5. Memoizes the state so it is solved only once.

Independent component values are XORed. A total of `0` is losing for the player whose turn it is; a nonzero total has at least one move back to `0`.

The algorithm is exponential in the number of shrub edges in the worst case, so the random generator intentionally caps individual shrubs at 12 edges.

## Folder structure

```text
index.html      Stable redirect to the released simulator.
simulator.html  Complete standalone application and permanent shared URL.
README.md       Usage, format, model, and release notes.
```

Open `simulator.html` directly in a modern browser for local use. GitHub Pages serves the same file without a build step.
