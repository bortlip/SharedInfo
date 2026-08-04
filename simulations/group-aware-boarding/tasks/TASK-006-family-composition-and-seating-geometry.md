# TASK-006: Family Composition and Seating Geometry

**Status:** Idea

## Goal

Replace the current assumption that every two-person family is one adult and one child, and make family seating more socially plausible.

## Composition model

Support weighted party compositions such as:

- adult couple
- one adult plus one child
- two adults plus one child
- one adult plus two children
- two adults plus two or three children
- adult companions traveling together

Later child age bands may distinguish teenager, child, young child, and lap infant.

## Seating geometry

Prefer clusters in this order:

1. same side of one row
2. opposite sides across the aisle
3. adjacent rows
4. scattered seats, only when explicitly enabled

The animation and inspector should clearly show when a party spans the aisle or multiple rows.

## Behavior questions

- Do parties still remain atomic when seated in two rows?
- Does one adult lead each subgroup?
- Who helps a young child?
- Does cross-aisle seating increase coordination delay?

## Acceptance criteria

- Adult-only couples can be generated
- Family composition distribution is visible and reproducible
- Same-side clusters are preferred
- Cross-aisle and multi-row placements are explicitly labeled
- Party behavior remains deterministic and documented
