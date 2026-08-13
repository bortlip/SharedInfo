# Schelling Segregation Lab modular source

This directory contains the directly loaded source files for Schelling Segregation Lab.

`../simulator.html` is the application shell and loads `styles.css` plus the responsibility-based scripts in `js/` in dependency order. `index.html` simply opens that same shell, so the public simulator and the readable modular source cannot silently drift apart. `js/version.js` is the single source of truth for the displayed release number.

There is no framework, package manager, bundler, runtime source concatenation, or build step.
