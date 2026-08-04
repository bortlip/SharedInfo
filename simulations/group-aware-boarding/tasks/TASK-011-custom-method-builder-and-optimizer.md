# TASK-011: Custom Method Builder and Optimizer

**Status:** Idea

## Goal

Let users invent boarding policies and race them against the built-in six.

## Rule builder

A custom method can combine ordered rules:

- priority tiers
- row ascending or descending
- zone size
- window, middle, aisle order
- alternating sides
- row parity
- randomization within groups
- party anchor rule: earliest, latest, average, aisle member, or designated leader

The UI should translate the rule stack into plain English before running it.

## Optimizer

A separate experimental mode may search for a fast queue for a specific manifest. It must be labeled as a manifest-specific upper-bound experiment, not a practical airline policy.

## Fun possibilities

- name a method
- save and share it
- tournament bracket
- challenge: beat WilMA with no more than three rules

## Acceptance criteria

- Custom rules compile into a deterministic queue
- Parties remain intact unless explicitly allowed
- Invalid or contradictory rules produce helpful errors
- The queue explanation shows why each unit received its rank
- Optimized queues are visually and statistically distinguished from operational methods
