# TASK-017: Export, Sharing, and Reproducibility

**Status:** Idea

## Goal

Make scenarios and results easy to reproduce outside the current browser session.

## Outputs

- shareable scenario URL
- scenario JSON
- benchmark CSV
- Markdown results table
- replay/event trace JSON
- shareable image card
- saved local scenarios

## Reproducibility block

Every export should record:

- simulator and model version
- seed
- complete configuration
- method definitions
- trial count
- time-step size
- event and aircraft schema versions
- generated-at timestamp
- optional artifact checksum

## Comparison

Allow importing a previous result as a baseline and clearly warn when model versions differ.

## Acceptance criteria

- Exported configuration recreates the same manifest and results under the same version
- CSV columns are documented
- Import validates schema and values
- Version mismatch is visible
- No server or account is required for basic sharing
