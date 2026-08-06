# Green Hackenbush Garden

An interactive Green Hackenbush game, exact solver, and theory explainer. Build a garden from grounded graph components and Nim heaps, play against a perfect computer, watch two perfect players, or inspect the Sprague–Grundy analysis that determines the winner.

## Open it

- [Open the Green Hackenbush site](https://bortlip.github.io/SharedInfo/simulations/green-hackenbush/)
- [Launch the simulator directly](https://bortlip.github.io/SharedInfo/simulations/green-hackenbush/simulator.html)
- [Read the complete *Last Gardener* walkthrough](https://bortlip.github.io/SharedInfo/simulations/green-hackenbush/the-last-gardener.html)
- [Read the walkthrough in Markdown](THE_LAST_GARDENER.md)
- [Browse the source folder](https://github.com/bortlip/SharedInfo/tree/main/simulations/green-hackenbush)

## Current release

**Site v1.1.0**  
**Simulator v1.0.0**  
**Puzzle guide v1.0.0**

Site version 1.1.0 adds a complete long-form solution to the original puzzle in Markdown and HTML. The directory landing page now keeps the simulator open while providing direct navigation to the walkthrough, Markdown source, and repository.

The default game reproduces *The Last Gardener*. Its four shrubs have Grundy values `4`, `1`, `0`, and `3`, whose XOR is `6`. Setting the bowl to `6` balances the complete position at XOR `0`, giving the second player the winning strategy under perfect play.

## What the simulator includes

- One-screen garden view with animated cuts, falling pieces, and highlighted computer moves
- Human vs perfect computer, perfect vs perfect, and two-human modes
- Adjustable autoplay pace
- Play and Explain views
- Detailed Sprague–Grundy, mex, Nim-equivalence, and XOR explanations
- Exact recursive solving with memoization
- Editable text definitions for custom shrubs and heaps
- Random game generation with configurable shrubs, bowls, edge counts, and cycle chance
- System, light, and dark themes
- A versioned footer linking to the GitHub source
- No external libraries or build step

## The complete puzzle guide

[`THE_LAST_GARDENER.md`](THE_LAST_GARDENER.md) and [`the-last-gardener.html`](the-last-gardener.html) cover:

- translating the supplied drawing into grounded graph components;
- why the game is finite, impartial, and normal-play;
- Grundy values and the minimum excluded value (`mex`);
- the complete move-value calculation for every shrub;
- why the Window has value `0` despite having legal moves;
- the final XOR calculation and the unique answer `n = 6`;
- the second-player zero-restoration strategy;
- the general bowl-balancing rule;
- a proof sketch of the Sprague–Grundy theorem;
- Bouton’s XOR result for Nim;
- the exact recursive graph algorithm used by the simulator;
- memoization, complexity, and common solution traps.

The HTML page loads the canonical Markdown guide and renders it as a responsive article with a table of contents, summary values, print styling, and its own System / Light / Dark selector. It uses no external libraries.

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

1. tries every legal edge cut;
2. removes all edges no longer connected to the ground;
3. recursively calculates each resulting Grundy value;
4. assigns the current state the minimum excluded value (`mex`) of those results;
5. memoizes the state so it is solved only once.

Independent component values are XORed. A total of `0` is losing for the player whose turn it is; a nonzero total has at least one move back to `0`.

The algorithm is exponential in the number of shrub edges in the worst case, so the random generator intentionally caps individual shrubs at 12 edges.

## Folder structure

```text
index.html                  Site shell with navigation and embedded simulator
simulator.html              Complete standalone interactive application
THE_LAST_GARDENER.md        Detailed source-format puzzle solution
the-last-gardener.html      Responsive rendered version of the puzzle guide
README.md                   Usage, format, model, and release notes
```

Open `simulator.html` directly for the standalone app. GitHub Pages serves the directory URL as the combined site shell, with the simulator and guide available from the same navigation bar.
