# TASK-008: Rich Luggage and Finite Bin Capacity

**Status:** Idea

## Goal

Turn luggage into a visible spatial system rather than only a local time penalty.

## Luggage types

- no bag
- personal item only
- standard roller bag
- oversized or heavy bag
- two-item traveler
- shared family luggage

Each type affects probability, stow duration, required bin space, and possible assistance.

## Finite bins

Bins should have capacity by location. When nearby capacity is unavailable, a passenger may:

- search adjacent rows
- place the bag ahead of the assigned row
- move backward
- request assistance
- gate-check the bag

Every behavior must be visible because it changes movement topology, not merely duration.

## Fun UI

Display bin fill levels, flashing full-bin warnings, bag icons, and a brief "bin hunt" path. A post-race stat can identify the most troublesome bin.

## Risks

Reverse movement, searching, and shared bin access can dramatically complicate aisle rules. Implement bag types before full capacity, and design bidirectional movement before allowing backward searches.

## Acceptance criteria

- Bag type and capacity are explicit
- No invisible teleporting between bins
- Bin state is inspectable
- Overflow behavior is deterministic
- Existing unlimited-bin behavior remains available as a comparison mode
