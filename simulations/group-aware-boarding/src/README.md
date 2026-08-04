# Boarding Rush Modular Source

This is the working, unreleased source for **Boarding Rush**, the aircraft boarding simulator.

- `index.html` contains the page markup.
- `styles.css` contains the presentation layer.
- `js/constants.js` contains shared cabin and display constants.
- `js/random.js` contains deterministic random and utility functions.
- `js/scenarios.js` defines presets, URL serialization, validation, and schema versioning.
- `js/manifest.js` creates passengers, parties, seats, and traits.
- `js/methods.js` constructs the six boarding orders.
- `js/simulation.js` advances aisle, stowing, and seating state.
- `js/format.js` contains time and benchmark-statistic helpers.
- `js/render.js` draws one simulation.
- `js/app.js` owns controls, scenario selection, animation, sharing, and benchmarking.

Run `python ../tools/build_simulator.py` from this folder, or run the script from any working directory, to regenerate `../dist/simulator.html` as one standalone candidate file.

The modular source page is directly previewable through GitHub Pages after it reaches the published branch. The source preview and generated `dist/` candidate are public test surfaces, not the official released simulator. The official release remains the protected root `../simulator.html`.
