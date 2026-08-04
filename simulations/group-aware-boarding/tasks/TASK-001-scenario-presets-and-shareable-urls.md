# TASK-001: Scenario Presets and Shareable URLs

**Status:** Idea  
**Priority:** First fun-first feature

## Goal

Let users begin with recognizable flight stories instead of configuring every technical control manually, and let them share an exact scenario through the URL.

## Candidate presets

- Smooth business route
- Family vacation
- Holiday crush
- Lightly loaded hop
- Perfect laboratory conditions
- Assisted-heavy flight
- Maximum carry-ons
- Low-compliance chaos
- Barbara mode
- Custom

Each preset should have a short, playful description and a preview of the important settings it changes.

## Functional behavior

Selecting a preset populates the controls and seed. Any manual edit changes the label to `Custom` without destroying the preset definition.

The URL should encode scenario settings in a compact, versioned query string. Opening the link should reconstruct the same controls and seed before the first render. Unknown or obsolete values should fail safely to documented defaults.

## UI direction

Use large scenario cards near the top of the page. Advanced controls move into a collapsible panel. A copied-link toast should confirm that the scenario is reproducible.

## Acceptance criteria

- Every preset produces documented settings
- A copied URL reconstructs the same manifest and method results
- Manual edits switch to Custom
- The URL contains a schema version
- Invalid query values do not break the page
- Presets remain separate from released artifacts until an approved release
