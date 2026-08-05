# Pocket Prix modular source

This directory contains the directly runnable source version of Pocket Prix.

Open `index.html` through a web server. The HTML loads `styles.css` and the scripts in `js/` in dependency order. Each JavaScript file owns one coherent responsibility; there are no numbered source fragments and no runtime source concatenation.

The root `simulator.html` uses these same source files, so the released page and the readable source cannot silently drift apart.
