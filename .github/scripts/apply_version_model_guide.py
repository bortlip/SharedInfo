from pathlib import Path

ROOT = Path("simulations/group-aware-boarding")
SRC = ROOT / "src"
JS = SRC / "js"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Could not locate {label}")
    return text.replace(old, new, 1)


# Simulator version display and model-guide links.
app_path = JS / "app.js"
app = app_path.read_text(encoding="utf-8")
app = replace_once(
    app,
    'import { TOTAL, METHODS, META, FIXED_DT } from "./constants.js";',
    'import { TOTAL, METHODS, META, FIXED_DT } from "./constants.js";\nimport { APP_VERSION } from "./version.js";',
    "version import",
)
app = replace_once(
    app,
    "function initialize(){\n  renderScenarioCards();",
    'function initialize(){\n  document.querySelectorAll("[data-app-version]").forEach(element=>{\n    element.textContent=`v${APP_VERSION}`;\n  });\n  renderScenarioCards();',
    "version initialization",
)
app_path.write_text(app, encoding="utf-8")

index_path = SRC / "index.html"
index = index_path.read_text(encoding="utf-8")
index = replace_once(
    index,
    '    <div class="badge">scenarios · shareable seeds · deterministic races</div>',
    '''    <div class="badge product-badge">
      <span>scenarios · shareable seeds · deterministic races</span>
      <a class="version-link" href="https://bortlip.github.io/SharedInfo/simulations/group-aware-boarding/model.html" title="Read the detailed model guide">
        <strong data-app-version>v—</strong>
        <span>How it works</span>
      </a>
    </div>''',
    "header badge",
)
index = replace_once(
    index,
    "      <details>\n        <summary>Method and model details</summary>",
    '''      <p class="model-guide-link"><a href="https://bortlip.github.io/SharedInfo/simulations/group-aware-boarding/model.html">📘 Read the complete model guide</a> for every assumption, formula, boarding rule, measurement, and known omission.</p>
      <details>
        <summary>Method and model details</summary>''',
    "model guide callout",
)
index = replace_once(
    index,
    '  <footer>Boarding Rush · deterministic seeds · no external libraries · <a href="https://github.com/bortlip/SharedInfo/tree/main/simulations/group-aware-boarding" style="color:#9fdfff">source on GitHub</a></footer>',
    '  <footer>Boarding Rush <span data-app-version>v—</span> · <a href="https://bortlip.github.io/SharedInfo/simulations/group-aware-boarding/model.html">how the model works</a> · deterministic seeds · no external libraries · <a href="https://github.com/bortlip/SharedInfo/tree/main/simulations/group-aware-boarding">source on GitHub</a></footer>',
    "footer",
)
index_path.write_text(index, encoding="utf-8")

styles_path = SRC / "styles.css"
styles = styles_path.read_text(encoding="utf-8")
styles = replace_once(
    styles,
    ".card{\n",
    '''.product-badge{display:grid;gap:5px;justify-items:end;white-space:normal;text-align:right}
.product-badge>span{white-space:nowrap}
.version-link{display:inline-flex;align-items:center;gap:7px;color:#dff7ff;text-decoration:none;font-size:.72rem}
.version-link strong{padding:3px 7px;border:1px solid #4e759a;border-radius:999px;background:#081625;color:#8de4ff;font-variant-numeric:tabular-nums}
.version-link:hover{color:white}
.model-guide-link{margin:12px 0 0;padding:10px 11px;border:1px solid #36516f;border-radius:11px;background:#081625;color:var(--muted);font-size:.8rem;line-height:1.45}
.model-guide-link a,footer a{color:#9fdfff}
.card{
''',
    "version styles",
)
styles = replace_once(
    styles,
    "  header{display:block}.badge{display:inline-block;margin-top:12px;white-space:normal}",
    "  header{display:block}.badge{display:inline-grid;margin-top:12px;white-space:normal}.product-badge{justify-items:start;text-align:left}.product-badge>span{white-space:normal}",
    "mobile badge",
)
styles_path.write_text(styles, encoding="utf-8")

# Build both public artifacts in one deterministic command.
build_path = ROOT / "tools" / "build_simulator.py"
build = build_path.read_text(encoding="utf-8")
build = replace_once(
    build,
    "from pathlib import Path\n",
    "from pathlib import Path\n\nfrom build_model_page import build as build_model_page\n",
    "model builder import",
)
build = replace_once(
    build,
    'MODULE_ORDER = [\n    "constants.js",',
    'MODULE_ORDER = [\n    "constants.js",\n    "version.js",',
    "version module order",
)
build = replace_once(
    build,
    '    DIST.write_text(output, encoding="utf-8")\n',
    '    DIST.write_text(output, encoding="utf-8")\n    build_model_page()\n',
    "model page build",
)
build_path.write_text(build, encoding="utf-8")

src_readme_path = SRC / "README.md"
src_readme = src_readme_path.read_text(encoding="utf-8")
src_readme = replace_once(
    src_readme,
    "- `js/constants.js` contains shared cabin and display constants.\n",
    "- `js/constants.js` contains shared cabin and display constants.\n- `js/version.js` contains the single user-visible application version.\n",
    "source version module",
)
src_readme = replace_once(
    src_readme,
    "to regenerate `../dist/simulator.html` as one standalone candidate file.",
    "to regenerate `../dist/simulator.html` and the formatted `../model.html` guide from `../MODEL.md`.",
    "source build outputs",
)
src_readme_path.write_text(src_readme, encoding="utf-8")

# MODEL.md remains the canonical behavioral specification.
model_path = ROOT / "MODEL.md"
model = model_path.read_text(encoding="utf-8")
model = replace_once(
    model,
    "The benchmark captures a snapshot of the controls when it starts. It runs separate simulation objects and does not reset, pause, or alter the visible animation.\n",
    '''The benchmark captures a snapshot of the controls when it starts. It runs separate simulation objects and does not reset, pause, or alter the visible animation.

### Scenario presets and shared links

A scenario preset is a named collection of control values. Choosing one writes those values into the ordinary controls; it does not select a separate simulation engine or hidden rule set. A manual control change marks the scenario as custom.

A shared scenario link records the model settings, seed, selected method panels, and Roomy or Compact Fleet display choice. Loading the link reconstructs those values before the manifest is generated. Invalid or obsolete values fall back to supported defaults.

### Method visibility and synchronized animation

The animated comparison creates all six method simulations from the same manifest, even when only one or two method panels are visible. All six continue advancing in lockstep while the race runs.

Selecting or deselecting a method changes only which panels are rendered and which methods appear in a later benchmark. It does not pause, restart, or recreate the animated simulations. Revealing a previously hidden method therefore shows its current synchronized state.

"Finish instantly" completes all six animated method simulations. The completion message ranks only the methods currently visible.

### Roomy and Compact Fleet display

Roomy and Compact Fleet are rendering choices. They change panel width, canvas display size, headings, and metric layout but do not change canvas coordinates, passenger behavior, time steps, or results.
''',
    "model interface behavior",
)
model = replace_once(
    model,
    "This is congestion, not bin capacity. The model does not make a passenger search another row, move backward, move forward, check a bag, or fail to find space.\n",
    '''This is congestion, not bin capacity. The model does not make a passenger search another row, move backward, move forward, check a bag, or fail to find space.

The animation draws a suitcase beside every active passenger who has a carry-on. During stowing, the marker moves toward that passenger's row-side overhead strip. When stowing finishes, a persistent bag record is drawn inside that strip for the rest of the run. The animation is a visualization of the existing bag state; the drawn strip is not a physical capacity scale and does not add any new delay.
''',
    "visible luggage text",
)
model = replace_once(
    model,
    "A simulation ends when every passenger is seated. A 7,200-second safety limit prevents an accidental infinite run.\n\nEach visible method reports:",
    '''A method simulation ends when every passenger is seated. A 7,200-second safety limit prevents an accidental infinite run.

During an animated race, all six method simulations continue until all six are complete, including methods whose panels are hidden. The displayed winner is chosen from the currently visible method set.

Each visible method reports:''',
    "completion synchronization",
)
model = replace_once(
    model,
    "The Monte Carlo table reports:\n",
    "The Monte Carlo benchmark runs only the methods selected when the benchmark starts. Its table reports:\n",
    "benchmark field",
)
model = replace_once(
    model,
    "- finite overhead-bin capacity, overflow, searching, or reverse movement\n",
    "- finite overhead-bin capacity, overflow, searching, or reverse movement\n- physically scaled bag dimensions or overhead-bin volume; suitcase markers are explanatory symbols\n",
    "luggage omission",
)
model = replace_once(
    model,
    "| Benchmark step | 0.20 s |",
    "| Benchmark step | 0.20 s |\n| Method panel selection | Visibility and benchmark field only; all six animated methods stay synchronized |\n| Display modes | Roomy or Compact Fleet; presentation only |\n| Visible luggage | Carry-on marker travels to a persistent row-side bin marker; no physical capacity |",
    "parameter additions",
)
model_path.write_text(model, encoding="utf-8")

# Repository and release documentation.
readme_path = ROOT / "README.md"
readme = readme_path.read_text(encoding="utf-8")
readme = replace_once(
    readme,
    "- [Open the modular source preview](https://bortlip.github.io/SharedInfo/simulations/group-aware-boarding/src/)\n- [Read how the current released model works](MODEL.md)\n",
    "- [Open the modular source preview](https://bortlip.github.io/SharedInfo/simulations/group-aware-boarding/src/)\n- [Read the formatted model guide](https://bortlip.github.io/SharedInfo/simulations/group-aware-boarding/model.html)\n- [Read the canonical model specification](MODEL.md)\n",
    "README model links",
)
readme = replace_once(
    readme,
    "src/                   Modular, unreleased Boarding Rush source used for feature work.\ndist/simulator.html    Generated, unreleased release candidate built from src/.\n",
    "src/                   Modular, unreleased Boarding Rush source used for feature work.\nsrc/js/version.js      Single source of truth for the visible app version.\ndist/simulator.html    Generated, unreleased release candidate built from src/.\nmodel.html             Generated formatted guide built from MODEL.md.\n",
    "README structure",
)
readme = replace_once(
    readme,
    "MODEL.md               Exact functional description of the current released model.",
    "MODEL.md               Canonical functional description of the current simulator model.",
    "README model description",
)
readme = replace_once(
    readme,
    "Running `python tools/build_simulator.py` bundles the modular source into one standalone `dist/simulator.html` candidate.",
    "Running `python tools/build_simulator.py` bundles the modular source into `dist/simulator.html` and regenerates the formatted root `model.html` page from `MODEL.md`.",
    "README build description",
)
readme_path.write_text(readme, encoding="utf-8")

workflow_path = ROOT / "design" / "RELEASE_AND_DEVELOPMENT_WORKFLOW.md"
workflow = workflow_path.read_text(encoding="utf-8")
workflow = replace_once(
    workflow,
    "The build must be deterministic: unchanged source must regenerate byte-identical candidate output.\n",
    '''The build must be deterministic: unchanged source must regenerate byte-identical candidate output.

The same command also regenerates root `model.html` from the canonical `MODEL.md` specification.

## Version and model-documentation rules

- `src/js/version.js` is the single source of truth for the version shown in the simulator and model guide.
- Every merged PR that changes user-visible simulator behavior or presentation must deliberately bump that version.
- `MODEL.md` is the canonical description of current behavior. A PR that changes model rules, measurements, configuration semantics, or explanatory visualization must update `MODEL.md` in the same PR.
- Root `model.html` is generated output and must never be hand-edited.
- The visible version and formatted model guide are product information, not release-process labels shown to users.
''',
    "version workflow rules",
)
workflow = replace_once(
    workflow,
    "- Build output is reproducible\n",
    "- Build output is reproducible for both `dist/simulator.html` and `model.html`\n- Visible application version was deliberately reviewed and bumped when appropriate\n- `MODEL.md` and generated `model.html` match any changed behavior\n",
    "feature checklist",
)
workflow_path.write_text(workflow, encoding="utf-8")

# Track the infrastructure task and make the next visual task implementation-ready.
tasks_readme_path = ROOT / "tasks" / "README.md"
tasks_readme = tasks_readme_path.read_text(encoding="utf-8")
tasks_readme = replace_once(
    tasks_readme,
    "20. [TASK-020: Visible Luggage and Overhead Bins](TASK-020-visible-luggage-and-overhead-bins.md)\n",
    "20. [TASK-020: Visible Luggage and Overhead Bins](TASK-020-visible-luggage-and-overhead-bins.md)\n21. [TASK-021: Visible Version and Generated Model Guide](TASK-021-visible-version-and-model-guide.md)\n",
    "TASK-021 entry",
)
tasks_readme_path.write_text(tasks_readme, encoding="utf-8")

(ROOT / "tasks" / "TASK-021-visible-version-and-model-guide.md").write_text(
    '''# TASK-021: Visible Version and Generated Model Guide

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
''',
    encoding="utf-8",
)

task4_path = ROOT / "tasks" / "TASK-004-race-presentation-replay-and-turning-points.md"
task4 = task4_path.read_text(encoding="utf-8")
task4 = replace_once(task4, "**Status:** Idea", "**Status:** Ready", "TASK-004 status")
task4 = replace_once(
    task4,
    "Make six simultaneous simulations entertaining to watch and easy to understand as a competitive race.\n",
    '''Make six simultaneous simulations entertaining to watch and easy to understand as a competitive race.

## Recommended first visual slice

Build the race HUD before full replay:

- one live leaderboard above the aircraft cards
- current rank, seated percentage, and gap to the leader for every visible method
- animated lead-change and finish-order moments
- short event callouts for a long bag stow, a seat-conflict cluster, and a heavily blocked aisle
- clicking a leaderboard row briefly emphasizes that aircraft panel
- no simulation-rule changes and no replay storage in this first slice

This produces an immediate visual payoff while establishing event data that replay and post-race turning-point analysis can reuse.
''',
    "TASK-004 first slice",
)
task4_path.write_text(task4, encoding="utf-8")
