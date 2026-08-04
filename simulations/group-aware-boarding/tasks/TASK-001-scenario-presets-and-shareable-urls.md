# TASK-001: Scenario Presets and Shareable URLs

**Status:** In progress  
**Priority:** First fun-first feature

## Goal

Let users begin with recognizable flight stories instead of configuring every technical control manually, and let them share an exact scenario through the URL.

This task also introduces the candidate's new product name: **Boarding Rush**. The existing folder and URL remain unchanged, and the protected released root HTML is not renamed or edited by this feature PR.

## Presets

- Smooth Business Route
- Family Vacation
- Holiday Crush
- Lightly Loaded Hop
- Perfect Laboratory Conditions
- Assisted-Heavy Flight
- Maximum Carry-ons
- Low-Compliance Chaos
- Barbara Mode — visible as a disabled teaser until the character-event system exists
- Custom

Each available preset has a short, playful description and a preview of its load, family share, bag rate, and sequence compliance.

## Functional behavior

Selecting a preset populates every scenario control, including the seed and benchmark trial count. Any manual edit changes the label to `Custom` without modifying the preset definition.

The URL encodes the complete scenario in a compact, versioned query string. Opening the link reconstructs the same controls and seed before the first manifest is generated. Unknown schema versions are ignored; missing or invalid values fall back safely to documented defaults.

Party-size weights remain unrestricted relative nonnegative values. The URL preserves values whether their total is below, equal to, or above 100, and the simulation continues to normalize them at run time.

## Seed controls

The seed remains visible in Advanced Flight Settings with a small `Randomize` action. The Monte Carlo block also shows the current base seed and provides its own `New seed` action. Both actions update the same scenario seed, reset the visible comparison, and mark the scenario as Custom.

Benchmark output and progress messages identify the base seed used for the trial series.

## UI direction

Use large scenario cards near the top of the page. Run, pause, finish, reset, and link sharing remain immediately available, while technical controls live in a collapsible Advanced Flight Settings panel.

A copied-link toast confirms that the seed is included and the scenario is reproducible.

## URL schema v1

The query includes:

- schema version
- preset hint
- load factor
- family-passenger share
- four relative party-size weights
- assisted-party count
- carry-on rate
- sequence compliance
- priority policy
- animation speed
- seed
- benchmark trial count

The preset hint is descriptive only. The UI determines whether a scenario truly matches a preset by comparing all reconstructed settings.

## Acceptance criteria

- Every enabled preset produces documented settings
- A copied URL reconstructs the same controls, manifest, and method results
- Manual edits switch to Custom
- The URL contains a schema version
- Partial, invalid, and obsolete query strings do not break the page
- Party weights below or above a total of 100 round-trip correctly
- Seed randomization is available in both Advanced Settings and the benchmark block
- The benchmark block displays its base seed
- The candidate is branded Boarding Rush without renaming the existing folder or changing protected released files
- Source and standalone candidate pass browser smoke tests
- Presets remain separate from released artifacts until an approved release

## Follow-up polish

- Page-facing text is written as product copy and never exposes candidate/release-process terminology.
- Each scenario definition has an `included` flag; set it to `false` to hide that scenario without deleting its settings or implementation.
- The editable seed field spans two control columns so its full value remains visible beside the randomize button.
- Repeating an identical benchmark shows that its deterministic results are unchanged; the comparison requires the same seed, settings, and trial count, not merely the same seed alone.
