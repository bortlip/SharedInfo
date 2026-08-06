# Pocket Prix modular source

This directory contains the directly runnable source version of Pocket Prix.

Open `index.html` through a web server. The HTML loads `styles.css` and the responsibility-based scripts in `js/` in dependency order. `js/version.js` is the single source of truth for the displayed release number.

There are no numbered source fragments and no runtime source concatenation. The root `simulator.html` uses these same files, so the released page and readable source cannot silently drift apart.
