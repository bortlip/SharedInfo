#!/usr/bin/env python3
"""Build the standalone boarding simulator from modular browser source.

Normal use:
    python tools/build_simulator.py

One-time migration used by the structure PR:
    python tools/build_simulator.py --migrate

The build has no third-party dependencies. It bundles the ES-module source into a
single inline script and stylesheet so the release candidate remains one portable
HTML file.
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import textwrap
from pathlib import Path

from build_model_page import build as build_model_page

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
JS = SRC / "js"
DIST = ROOT / "dist" / "simulator.html"
RELEASED = ROOT / "simulator.html"
INDEX = ROOT / "index.html"
INDEX_REPO_PATH = "simulations/group-aware-boarding/index.html"

MODULE_ORDER = [
    "constants.js",
    "version.js",
    "random.js",
    "scenarios.js",
    "manifest.js",
    "methods.js",
    "simulation.js",
    "format.js",
    "race.js",
    "render.js",
    "app.js",
]


def extract_inline(html: str, tag: str) -> str:
    pattern = rf"<{tag}>\s*\n?(.*?)\n?\s*</{tag}>"
    match = re.search(pattern, html, flags=re.DOTALL)
    if not match:
        raise RuntimeError(f"Could not find inline <{tag}> block")
    return match.group(1)


def between(text: str, start: str, end: str) -> str:
    start_index = text.index(start)
    end_index = text.index(end, start_index)
    return text[start_index:end_index]


def remove_ranges(text: str, ranges: list[tuple[str, str]]) -> str:
    spans: list[tuple[int, int]] = []
    for start, end in ranges:
        start_index = text.index(start)
        end_index = text.index(end, start_index)
        spans.append((start_index, end_index))
    for start_index, end_index in sorted(spans, reverse=True):
        text = text[:start_index] + text[end_index:]
    return text


def dedent(block: str) -> str:
    return textwrap.dedent(block).strip() + "\n"


def export_functions(block: str) -> str:
    return re.sub(r"(?m)^function ", "export function ", dedent(block))


def migrate() -> None:
    """Split the current released implementation into maintainable source files."""
    html = DIST.read_text(encoding="utf-8")
    css = extract_inline(html, "style")
    script = extract_inline(html, "script").strip()

    if not script.startswith("(() => {") or not script.endswith("})();"):
        raise RuntimeError("Unexpected simulator script wrapper")

    body = script[len("(() => {") : -len("})();")]
    body = body.lstrip("\n")
    body = re.sub(r'^\s*"use strict";\s*\n', "", body, count=1)

    constants = between(body, "  const ROWS = 31;", "  const $ = id =>")
    random = between(body, "  function mulberry32", "  function normalizedPartyWeights")
    weighted_size = between(body, "  function weightedSize", "  function seatInfo")
    seat_info = between(body, "  function seatInfo", "  function config")
    seed_mix = between(body, "  function seedMix", "  function makeManifest")
    manifest = between(body, "  function makeManifest", "  function internalOrder")
    methods = between(body, "  function internalOrder", "  class BoardingSim")
    simulation = between(body, "  class BoardingSim", "  function reset")
    formatting = between(body, "  function formatTime", "  function panelElements")
    rendering = between(body, "  function drawSim", "  function renderAll")
    statistics = between(body, "  function percentile", "  function renderBenchmark")

    extracted_ranges = [
        ("  const ROWS = 31;", "  const $ = id =>"),
        ("  function mulberry32", "  function normalizedPartyWeights"),
        ("  function weightedSize", "  function seatInfo"),
        ("  function seatInfo", "  function config"),
        ("  function seedMix", "  function makeManifest"),
        ("  function makeManifest", "  function internalOrder"),
        ("  function internalOrder", "  class BoardingSim"),
        ("  class BoardingSim", "  function reset"),
        ("  function formatTime", "  function panelElements"),
        ("  function drawSim", "  function renderAll"),
        ("  function percentile", "  function renderBenchmark"),
    ]
    app = dedent(remove_ranges(body, extracted_ranges))

    JS.mkdir(parents=True, exist_ok=True)
    (SRC / "styles.css").write_text(css.strip() + "\n", encoding="utf-8")

    constants_module = dedent(constants)
    constants_module = re.sub(r"(?m)^const ", "export const ", constants_module)
    constants_module = constants_module.replace("function familyColor", "export function familyColor")
    (JS / "constants.js").write_text(constants_module, encoding="utf-8")

    (JS / "random.js").write_text(export_functions(random), encoding="utf-8")

    manifest_module = (
        'import { ROWS, COLS, TOTAL, familyColor } from "./constants.js";\n'
        'import { mulberry32, shuffle, clamp } from "./random.js";\n\n'
        + dedent(weighted_size + seat_info + seed_mix + manifest).replace(
            "function makeManifest", "export function makeManifest"
        )
    )
    (JS / "manifest.js").write_text(manifest_module, encoding="utf-8")

    methods_module = (
        'import { ROWS } from "./constants.js";\n\n'
        + dedent(methods).replace("function makeQueue", "export function makeQueue")
    )
    (JS / "methods.js").write_text(methods_module, encoding="utf-8")

    simulation_module = (
        'import { SPACING } from "./constants.js";\n'
        'import { makeQueue } from "./methods.js";\n\n'
        + dedent(simulation).replace("class BoardingSim", "export class BoardingSim")
    )
    (JS / "simulation.js").write_text(simulation_module, encoding="utf-8")

    format_module = dedent(formatting + statistics)
    format_module = format_module.replace("function formatTime", "export function formatTime")
    format_module = format_module.replace("function percentile", "export function percentile")
    format_module = format_module.replace("function stats", "export function stats")
    (JS / "format.js").write_text(format_module, encoding="utf-8")

    render_module = (
        'import { ROWS, COLS, palette } from "./constants.js";\n'
        'import { clamp } from "./random.js";\n'
        'import { formatTime } from "./format.js";\n\n'
        + dedent(rendering).replace("function drawSim", "export function drawSim")
    )
    (JS / "render.js").write_text(render_module, encoding="utf-8")

    imports = "\n".join(
        [
            'import { TOTAL, METHODS, META, FIXED_DT } from "./constants.js";',
            'import { clamp } from "./random.js";',
            'import { makeManifest } from "./manifest.js";',
            'import { BoardingSim } from "./simulation.js";',
            'import { drawSim } from "./render.js";',
            'import { formatTime, stats } from "./format.js";',
        ]
    )
    (JS / "app.js").write_text(imports + "\n\n" + app, encoding="utf-8")

    source_html = re.sub(
        r"<style>\s*.*?\s*</style>",
        '<link rel="stylesheet" href="./styles.css">',
        html,
        count=1,
        flags=re.DOTALL,
    )
    source_html = re.sub(
        r"<script>\s*.*?\s*</script>",
        '<script type="module" src="./js/app.js"></script>',
        source_html,
        count=1,
        flags=re.DOTALL,
    )
    (SRC / "index.html").write_text(source_html, encoding="utf-8")

    (SRC / "README.md").write_text(
        """# Modular Simulator Source

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
""",
        encoding="utf-8",
    )

    dev = ROOT / "dev"
    if dev.exists():
        shutil.rmtree(dev)

    # The public redirect is part of the frozen release surface. Restore the exact
    # version from main rather than manufacturing a replacement.
    original_index = subprocess.check_output(
        ["git", "show", f"origin/main:{INDEX_REPO_PATH}"], text=True
    )
    INDEX.write_text(original_index, encoding="utf-8")

    build()


def strip_module_syntax(code: str) -> str:
    code = re.sub(r'(?m)^import\s+[^;]+;\s*\n?', "", code)
    code = re.sub(r"(?m)^export\s+", "", code)
    return code.strip()


def build() -> None:
    source_html = (SRC / "index.html").read_text(encoding="utf-8")
    css = (SRC / "styles.css").read_text(encoding="utf-8").rstrip()

    modules = []
    for name in MODULE_ORDER:
        modules.append(strip_module_syntax((JS / name).read_text(encoding="utf-8")))
    combined = "\n\n".join(modules)
    indented = textwrap.indent(combined, "  ")
    script = f'(() => {{\n  "use strict";\n\n{indented}\n}})();'

    output = source_html.replace(
        '<link rel="stylesheet" href="./styles.css">',
        f"<style>\n{css}\n</style>",
        1,
    )
    output = output.replace(
        '<script type="module" src="./js/app.js"></script>',
        f"<script>\n{script}\n</script>",
        1,
    )
    if output == source_html:
        raise RuntimeError("Build placeholders were not replaced")

    DIST.parent.mkdir(parents=True, exist_ok=True)
    DIST.write_text(output, encoding="utf-8")
    build_model_page()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--migrate", action="store_true")
    args = parser.parse_args()
    if args.migrate:
        migrate()
    else:
        build()


if __name__ == "__main__":
    main()
