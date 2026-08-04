# TASK-014: Calibration and Assumption Uncertainty

**Status:** Idea

## Goal

Make clear which model values are assumptions and test whether conclusions survive reasonable uncertainty.

## Parameter provenance

Every important constant should be classified as:

- measured or calibrated
- literature-inspired
- heuristic modeling choice
- convenience or visualization choice

Each should include a rationale, range, and confidence level.

## Uncertainty mode

Across benchmark trials, sample uncertain constants from documented distributions. Report how often method rankings change.

## Ablation mode

Run paired experiments with one mechanism removed:

- no families
- no seat conflicts
- no bag congestion
- equal walking speeds
- perfect compliance
- no priority boarding

Explain which mechanism produced each method's advantage.

## Calibration sources

Potential future evidence includes published studies, public operational data, controlled experiments, and manually coded boarding videos. Licensing and privacy must be considered before storing source material.

## Acceptance criteria

- Constants have documented provenance
- Uncertainty sampling is reproducible
- Ablations use matched manifests
- Results avoid claiming real-world precision unsupported by calibration
- UI distinguishes model output from measured facts
