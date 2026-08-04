# Modular Simulator Source

This is the working, unreleased source for the boarding simulator.

- `index.html` contains the page markup.
- `styles.css` contains the presentation layer.
- `js/constants.js` contains shared cabin and display constants.
- `js/random.js` contains deterministic random and utility functions.
- `js/manifest.js` creates passengers, parties, seats, and traits.
- `js/methods.js` constructs the six boarding orders.
- `js/simulation.js` advances aisle, stowing, and seating state.
- `js/format.js` contains time and benchmark-statistic helpers.
- `js/render.js` draws one simulation.
- `js/app.js` owns controls, animation, benchmarking, and page state.

Run `python ../tools/build_simulator.py` from this folder, or run the script from any working directory, to regenerate `../dist/simulator.html` as one standalone candidate file.

The source preview is public on GitHub Pages after merge, but it is not the released simulator.
