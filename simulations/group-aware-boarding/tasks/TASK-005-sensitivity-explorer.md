# TASK-005: Sensitivity Explorer

**Status:** Idea

## Goal

Show when each boarding method wins rather than only who wins under one chosen configuration.

## Experience

The user selects one variable and a range, for example:

- load factor from 50% to 100%
- family share from 0% to 70%
- carry-on rate from 0% to 100%
- sequence compliance from 0% to 100%
- assisted-party count

The simulator runs matched benchmark trials at each point and displays one line per method. Crossovers reveal where rankings change.

## Fun presentation

Describe important crossovers in plain language:

> WilMA leads under high compliance, but airline zones catches it near 55% compliance.

A "chaos threshold" badge could mark where the leading method changes.

## Technical notes

- Use common random numbers at each sweep point
- Run work in a Web Worker when TASK-013 exists
- Allow cancellation
- Preserve the visible simulation
- Export raw sweep data

## Acceptance criteria

- At least one variable can be swept across a configurable range
- Each point uses matched manifests across methods
- Progress and cancellation are visible
- Graph tooltips show mean and uncertainty
- Crossovers are summarized without claiming more precision than the trial count supports
