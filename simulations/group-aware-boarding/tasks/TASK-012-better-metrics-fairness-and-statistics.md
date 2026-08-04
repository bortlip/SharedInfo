# TASK-012: Better Metrics, Fairness, and Statistics

**Status:** Idea

## Goal

Measure passenger experience and uncertainty, not only total completion time.

## Candidate metrics

- time from aircraft entry to seating
- total passenger-seconds waiting
- average and maximum aisle wait
- family completion time
- number of stand-up events
- seat-conflict delay seconds
- walking-delay seconds
- peak simultaneous blockers
- door throughput
- time final passenger enters versus final passenger seats
- child and assisted-traveler experience
- variance and worst-decile experience

## Benchmark statistics

- standard deviation
- confidence interval
- paired differences between selected methods
- practical ties within a chosen threshold
- probability of finishing first
- mean gap from winner
- ranking stability

Because methods share the same manifest per trial, paired differences should be preferred over unrelated average comparisons.

## Fairness view

Show whether a faster method achieves speed by imposing extreme delays on a small group. Let users compare total time with an experience or fairness score without pretending there is one objectively correct weighting.

## Acceptance criteria

- Metric definitions are visible
- Practical ties do not award an arbitrary sole winner
- Paired comparisons use matched trials
- Passenger-level metrics aggregate correctly
- Composite scores reveal their weights and can be disabled
