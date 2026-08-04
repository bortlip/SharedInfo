# TASK-021: Visible Version and Generated Model Guide

**Status:** Done in candidate

## Goal

Make the deployed build easy to identify and give users a readable, attractive explanation of exactly what the simulator does.

## Delivered behavior

- A visible semantic version appears in the simulator header and footer.
- `src/js/version.js` is the single version source.
- A styled, responsive `model.html` page is generated from `MODEL.md`.
- The model page includes a table of contents, formatted tables and code, simulator/source links, and the same visible version.
- The normal build regenerates both the standalone simulator and the model page.
- Release documentation requires a version review and same-PR model updates whenever behavior changes.

## Release safety

This task does not modify the protected root `simulator.html` or `index.html`.
