# Functional Model

This document describes what the aircraft boarding simulator models, how it generates passengers and parties, how each boarding method constructs its queue, how movement and delays work, and what the reported measurements mean.

The simulator is a comparative discrete-time model. It is designed to answer questions such as "under the same manifest and assumptions, which boarding order performs better?" It is not calibrated to predict the exact boarding time of a particular airline or flight.

## 1. Aircraft and time model

The cabin has 31 rows and six seats per row:

```text
A B C   aisle   D E F
```

That gives 186 seats. Row 1 is at the front door and row 31 is at the rear.

Seat depth is represented as:

- `A` and `F`: window seats, depth 2
- `B` and `E`: middle seats, depth 1
- `C` and `D`: aisle seats, depth 0

A passenger's aisle position is measured in row units. The door is position 0 and the passenger's destination is the number of their row.

The animated simulation advances in fixed 0.10-second steps. "Finish instantly" uses 0.15-second steps, and Monte Carlo benchmarks use 0.20-second steps. Those larger steps make non-animated runs faster, but they can introduce small rounding differences relative to the animation.

The animation-speed control changes only how quickly simulated time is processed on screen. It does not change passenger behavior or model parameters.

## 2. Determinism and fair comparison

Each configuration has a numeric seed. The seed drives a deterministic pseudorandom generator used for:

- seat assignments
- family sizes and adult/child composition
- walking speeds
- carry-on possession
- bag-stowing times
- seating times
- party-entry delays
- random queue positions
- sequence-compliance decisions

For a single comparison, the simulator creates one manifest and gives that exact manifest to all six methods. Every passenger therefore has the same seat, party membership, walking speed, bag status, stow time, seating time, and compliance draw in every method. Only the queue order changes.

A benchmark creates a new seeded manifest for each trial. Within each trial, all six methods again receive the same manifest. Trial `t` uses:

```text
base seed + t * 7919
```

The benchmark captures a snapshot of the controls when it starts. It runs separate simulation objects and does not reset, pause, or alter the visible animation.

### Scenario presets and shared links

A scenario preset is a named collection of control values. Choosing one writes those values into the ordinary controls; it does not select a separate simulation engine or hidden rule set. A manual control change marks the scenario as custom.

A shared scenario link records the model settings, seed, selected method panels, and Roomy or Compact Fleet display choice. Loading the link reconstructs those values before the manifest is generated. Invalid or obsolete values fall back to supported defaults.

### Method visibility and synchronized animation

The animated comparison creates all six method simulations from the same manifest, even when only one or two method panels are visible. All six continue advancing in lockstep while the race runs.

Selecting or deselecting a method changes only which panels are rendered and which methods appear in a later benchmark. It does not pause, restart, or recreate the animated simulations. Revealing a previously hidden method therefore shows its current synchronized state.

"Finish instantly" completes all six animated method simulations. The completion message ranks only the methods currently visible.

### Passenger and seat hover explanations

Hovering a visible passenger dot or seat shows a non-blocking tooltip. Passenger tooltips are derived from that method's live simulation object and include seat, party, boarding position, traveler type, current state, walking speed, carry-on status, and base seating time. Seat tooltips distinguish unassigned, assigned-but-not-seated, actively entering, and occupied seats. Hovering never pauses or changes the simulation.

During the existing `seating` state, the renderer now interpolates the passenger laterally from the aisle toward the assigned seat. The interpolation uses the already-calculated seating duration, including any seat-conflict delay, but it is visual only: the state transition still completes at exactly the same simulated time.

Passenger records also expose optional display-name, character-role, character-status, and event-state fields. Ordinary passengers leave these fields empty. They are presentation hooks for deterministic named characters such as Barbara.

### Barbara Mode and the character-event foundation

Barbara Mode activates one deterministic named-passenger script. A character-specific pseudorandom stream selects an eligible adult individual after the ordinary manifest has been generated, so enabling or disabling Barbara does not disturb the ordinary seat, family, speed, or timing draws. Her seat and intrinsic character values are shared by all six methods.

Each method first constructs its normal queue. Barbara is then removed exactly once and reinserted at the same seed-derived late-arrival fraction of that queue. Her hover tooltip shows both the resulting boarding position and the position she would have occupied under that method before arriving late. Queue construction tests require every passenger ID to remain present exactly once.

Barbara always has a heavy carry-on. Its seeded base stow time replaces her ordinary bag time, and the difference is tracked as direct character-event delay.

Before reaching her seat, Barbara turns around at a seeded row and walks to the front lavatory. After a seeded lavatory duration she walks back to her assigned row and resumes the ordinary stow-and-seat sequence. Her turn row, travel speed, lavatory duration, and squeeze durations are intrinsic seeded values shared by every method.

The aisle remains a one-dimensional movement model rather than becoming two full lanes. When Barbara's travel path crosses another active passenger, the simulator records one squeeze interaction for that direction. Barbara shifts to one side of the aisle, the other passenger shifts to the other side, and both receive deterministic temporary speed penalties. The crossed passenger's hover details show the accumulated disruption time. Barbara may cross the same passenger once outbound and once on her return, but repeated time steps cannot count the same directional crossing twice.

The front door stops releasing new passengers while Barbara occupies the doorway area or lavatory. Her live hover details report total trip time, estimated extra delay above the forward walk she abandoned, and the number of passenger crossings. The exact number of crossings can differ by boarding method because surrounding congestion differs, while Barbara's intrinsic script remains identical.

A pulsing marker, direction arrows, a visible front-lavatory marker, short passenger-anchored speech or thought bubbles, and live hover status make each action visible where it occurs. These presentation elements do not pause the race. No event ticker or post-race recap is generated.

### Configurable cabin incidents and chatter

The advanced settings independently control `Disruptive passengers` and `Cabin chatter`.

Disruptive-passenger count is clamped to 0 through 3. A separate seeded incident stream selects eligible adult individual travelers after the ordinary manifest is complete, so incident selection does not consume or shift the random draws used for seats, families, bags, or normal timing. The same selected travelers and intrinsic incident values are shared across all methods.

The current mechanical archetypes are:

- **Chatty:** pauses twice at seeded aisle rows to finish a story. Each pause blocks the aisle, produces a visible bubble, and adds to that passenger's direct event delay.
- **Tipsy/slow:** receives a seeded walking-speed reduction, a visible lateral sway, and one seeded aisle pause to regain their bearings.

The number and timing of downstream delays can differ by method because nearby passengers and congestion differ. These travelers have distinct markers and live hover status. `Disruptive passengers: None` disables both archetypes completely.

Cabin chatter is separate and presentation-only. `Off`, `Light`, and `Lively` deterministically assign zero, five, or twelve ordinary passengers one short line each. A line appears once when its passenger crosses a seeded row. Ambient bubbles do not pause movement, alter queue order, add delay, or affect benchmark results. The small fixed population and one-line limit prevent the display from becoming a continuous wall of speech.

Crew assistance is not yet simulated. The incident framework can carry named roles, statuses, pauses, dialogue, and deterministic timing, but a later slice must add a visible crew member and interaction rather than teleporting help into the aisle.

### Live race HUD and race graph


The live race HUD ranks only the currently visible methods. Before every visible method has finished, ranking uses these deterministic comparisons in order:

1. more seated passengers
2. more passengers released through the aircraft door
3. greater summed fractional aisle progress among active passengers
4. the fixed method-list order as a final tie breaker

After methods finish, completed methods rank by their final completion time. The displayed progress percentage is simply seated passengers divided by total passengers. A gap such as "3 passengers back" is a difference in seated counts, not a prediction of how many seconds remain.

The compact leaderboard names are presentation aliases only: Random, Back → Front, Front → Back, Zones, WilMA, and Steffen. The full method names and algorithms are unchanged.

The live graph places simulated time on the horizontal axis and cumulative seated passengers on the vertical axis. It records display samples for all six synchronized simulations, including methods whose aircraft panels are currently hidden. Revealing a method later therefore reveals its earlier graph trajectory as well as its current aircraft state. The graph draws only the currently selected methods.

Small, Medium, and Large change only the graph's rendered height. Graph sampling happens during UI paints, so points may be farther apart at very high animation speeds; the line is a visual history of existing state rather than a new simulation measurement. The leaderboard, graph, lead animation, finish ribbons, and click-to-emphasize behavior do not alter queue order, timing, random draws, simulation steps, or results.

### Roomy and Compact Fleet display

Roomy and Compact Fleet are rendering choices. They change panel width, canvas display size, headings, and metric layout but do not change canvas coordinates, passenger behavior, time steps, or results.

## 3. Manifest size and seat assignment

### Load factor

The number of passengers is:

```text
round(186 * load factor)
```

The result is clamped to 1 through 186 passengers. Unassigned seats remain empty.

### Assignment order

The manifest is built in this order:

1. families
2. assisted parties
3. individual passengers

Families and assisted parties are assigned first so the simulator can find contiguous seat clusters for them. Individuals then fill randomly selected remaining seats.

This ordering can create a mild placement bias: grouped passengers get first choice of valid contiguous clusters, while individuals receive the remaining seats.

## 4. Families, adults, and children

### What a family means

A family is an atomic boarding party of 2 through 5 passengers. All members:

- are placed in one row
- occupy a contiguous run of seat letters
- remain next to one another in the boarding queue
- walk at the speed of the slowest family member

"Contiguous" is based on seat letters. Therefore clusters such as `B-C-D` or `C-D` may cross the aisle. The current model does not place one family across multiple rows or scatter its seats.

The valid family seat patterns are:

| Party size | Valid same-row patterns |
|---:|---|
| 2 | AB, BC, CD, DE, EF |
| 3 | ABC, BCD, CDE, DEF |
| 4 | ABCD, BCDE, CDEF |
| 5 | ABCDE, BCDEF |

A valid cluster is chosen randomly from all currently available clusters. If the requested family size cannot be placed, the simulator tries progressively smaller sizes down to 2.

### Family share

"Passengers in families" is a target share of the occupied passenger count, not a percentage of parties. The target is rounded to the nearest passenger and capped so that the requested assisted-party pairs can still fit.

The actual family passenger count may be slightly below the target when:

- only one target family passenger remains, because families require at least two people
- the drawn party size is reduced to fit the remaining target
- no valid contiguous cluster remains

### Party-size weights

The four party-size inputs are relative weights for sizes 2, 3, 4, and 5. They do not need to add to 100.

At run time, all positive finite weights are scaled into percentages. For example:

```text
2-person: 1
3-person: 2
4-person: 1
5-person: 0
```

becomes:

```text
25%, 50%, 25%, 0%
```

Negative, zero, nonnumeric, and nonfinite values contribute zero weight. If all four effective weights are zero, the simulator uses an equal 25% distribution.

The normalization first divides every weight by the largest weight. This avoids numeric overflow even when the user enters very large finite values.

### Adults versus children

Children are explicitly modeled, but "parent" is not a separate behavioral type. Family adults serve as the parent/adult members of the party, but the model does not simulate parenting actions individually.

Family composition is generated as follows:

| Family size | Adult count | Child count |
|---:|---:|---:|
| 2 | 1 | 1 |
| 3 | 1 adult 54% of the time; 2 adults 46% of the time | 2 or 1 |
| 4 | 2 | 2 |
| 5 | 2 | 3 |

Adults are preferentially assigned the seats closest to the aisle within the family's cluster. The remaining seats are assigned to children. This tends to put children toward the window and adults toward the aisle.

The family receives an entry delay before its first member enters the plane:

```text
1.0 + 0.65 * number of children + uniform random value from 0.0 to 1.2 seconds
```

This is a coarse representation of organizing the party at the door. The model does not separately simulate a parent folding a stroller, checking a child's boarding pass, helping with a coat, or similar sub-actions.

## 5. Assisted parties

Each assisted party contains exactly two people:

- one reduced-mobility passenger
- one ordinary adult companion

They receive a contiguous two-seat cluster in one row. The reduced-mobility passenger and companion remain adjacent in the queue and walk together at the slower member's speed.

The requested number of assisted parties is clamped to 0 through 12 and also limited by the number of occupied seats.

An assisted party receives a first-member entry delay uniformly distributed from 3.5 to 6.0 seconds.

The model does not distinguish wheelchairs, canes, visual impairment, temporary injury, or other specific assistance needs. "Reduced mobility" is one generalized passenger type.

## 6. Individual passenger types and randomized traits

Every passenger receives intrinsic traits once when the manifest is generated.

### Walking speed

Walking speed is sampled independently by passenger type:

| Passenger type | Walking speed, row units per simulated second |
|---|---:|
| Ordinary adult | 1.17 to 1.59 |
| Child | 0.82 to 1.10 |
| Reduced-mobility passenger | 0.46 to 0.62 |

For a family or assisted party, every member's effective walking speed is replaced with the slowest speed in that party. This keeps the party together rather than allowing faster members to run ahead.

Individual passengers retain their own sampled speeds.

### Carry-on probability

The carry-on-rate control is the probability that an ordinary adult has a bag requiring stowage.

Other passenger types use scaled probabilities:

| Passenger type | Probability of having a carry-on |
|---|---:|
| Ordinary adult | configured carry-on rate |
| Child | configured rate x 0.25 |
| Reduced-mobility passenger | configured rate x 0.55 |

An assisted companion is an ordinary adult and therefore uses the full configured rate.

The model gives each passenger either zero or one carry-on. It does not model personal items separately, multiple bags, bag size, checked luggage, or bag sharing within a family.

### Base bag-stowing time

Passengers do not all take the same time to stow a bag.

A passenger with a carry-on receives:

```text
4.2 + uniform(0, 7.5) + uniform(0, 2.5) seconds
```

The possible range is 4.2 to 14.2 seconds. Because this is the sum of two independent uniform draws, middle values are more common than the extreme endpoints.

A passenger without a carry-on still receives a short row-arrival pause:

```text
uniform(0.35, 0.70) seconds
```

This represents locating the row and preparing to enter the seat rather than literal bag stowage.

### Base seating time

Passengers also receive different base seating times:

| Passenger type | Base seating time |
|---|---:|
| Ordinary adult | 2.1 to 4.9 seconds |
| Child | 3.8 to 7.6 seconds |
| Reduced-mobility passenger | 7.5 to 13.0 seconds |

Seat-conflict penalties are added to these base values later.

### Individual entry delay

An individual passenger receives a door-entry delay uniformly distributed from 0.0 to 0.25 seconds.

For a family or assisted party, only the first member receives the party's entry delay. Later members remain contiguous in the queue but still enter one at a time as aisle spacing permits.

## 7. Boarding units and internal party order

The queue is built from boarding units, not directly from individual passengers.

A boarding unit is one of:

- a single passenger
- a family
- an assisted pair

A unit is never split by sequence noncompliance or by a boarding method. Once a unit's queue position is chosen, all of its members are emitted consecutively.

Within a family, deeper seats board first:

1. window
2. middle
3. aisle

Children sort before adults when two members have equal seat depth. Within assisted parties, deeper seats also board first; a reduced-mobility passenger sorts before the companion when depth is tied.

This internal ordering deliberately reduces conflicts within the party. It is part of the model, not an emergent decision made by simulated people.

## 8. Priority policies

Priority policy is applied before the selected boarding method.

### Assisted parties first

Assisted parties form the first priority tier. Families and individuals share the normal tier.

### All grouped parties first

The tiers are:

1. assisted parties
2. families
3. individuals

### No preboarding

Every unit shares one tier.

The selected boarding method orders units only within each priority tier. A lower-priority tier cannot move ahead of a higher-priority tier because of row, seat, or compliance ranking.

## 9. The six boarding methods

Each method assigns a rank to every boarding unit. Random values break ties within the relevant row, zone, or seat class.

### Random

Every boarding unit receives one random rank. Sequence compliance does not alter this method because the queue is already random.

### Strict back to front

Units are sorted by their rear-most row, from row 31 toward row 1. Units in the same row are randomized.

Because all current grouped parties occupy one row, the unit's rear-most and front-most rows are the same. The `maxRow` rule nevertheless makes the behavior explicit if multi-row parties are added later.

### Strict front to back

Units are sorted by their front-most row, from row 1 toward row 31. Units in the same row are randomized.

### Airline zones

The cabin is divided into rear-first row zones using:

```text
floor((31 - row) / 6)
```

This produces:

1. rows 26-31
2. rows 20-25
3. rows 14-19
4. rows 8-13
5. rows 2-7
6. row 1

Units are randomized within each zone.

### WilMA, group-safe

WilMA means window, middle, aisle. Seat classes receive these stages:

- window: 0
- middle: 1
- aisle: 2

A party is ranked by its earliest-stage member. Therefore a family containing a window passenger enters the window group even if it also contains middle or aisle passengers. The party remains intact, so this is a group-safe adaptation rather than pure passenger-by-passenger WilMA.

Units are randomized within each seat stage.

### Steffen, group-safe

Each passenger receives a seat rank based on:

1. window before middle before aisle
2. left side before right side
3. preferred row parity: odd rows on the left, even rows on the right
4. rear rows before front rows

A party uses the best, or earliest, rank among its members and remains intact. A small random value breaks close ties.

This is a practical group-safe variant inspired by Steffen ordering. It is not a claim that the implementation reproduces every detail of the original idealized Steffen procedure.

## 10. Sequence compliance

Sequence compliance is applied to whole boarding units within their priority tier.

Each unit has two pre-generated random values:

- a compliance draw
- a random replacement position

For an ordered method:

- if the compliance draw is below the configured compliance rate, the unit keeps its method-derived index
- otherwise, the unit receives a random continuous position within that tier

The tier is then resorted by those positions. This allows noncompliant units to move earlier or later and can indirectly shift compliant units around them.

At 100% compliance, the method's order is preserved. At 0%, ordered methods become approximately random within each priority tier. Families and assisted pairs still remain contiguous.

The Random method is unaffected by this control.

## 11. Entering and moving through the aisle

### Door release

The next passenger may enter only when the nearest active passenger is at least 0.72 row units from the door.

Once the door has enough clearance, the next passenger's entry-delay countdown runs. When it reaches zero, that passenger enters at position 0.

There is no independent gate-agent release schedule or boarding-pass scan model. Door release is controlled by the passenger-specific entry delay and aisle clearance.

### Following distance

Passengers cannot pass one another. Each walking passenger is limited by:

- their destination row
- the preceding passenger's position minus 0.72 row units

A passenger moves by at most:

```text
walking speed * time step
```

When blocked by the passenger ahead, the passenger stops at the allowed following distance.

### Reaching the row

When a passenger reaches their destination row, they enter the stowing state. They remain physically in the aisle at that row while stowing and seating. Passengers behind may queue, while passengers already farther back in the cabin may continue and perform their own stowing or seating concurrently.

## 12. Overhead-bin congestion

The simulator tracks a bag count separately for each row and side of the aircraft, such as row 12 left or row 12 right.

When a passenger with a carry-on reaches the row, their bag increments that row-side count. The first three bags on a row side receive no congestion penalty. Starting with the fourth bag, the stow time increases by:

```text
1.45 * (number of earlier bags beyond the first two)
```

Using the pre-increment bag count `load`, the code is:

```text
max(0, load - 2) * 1.45 seconds
```

Examples:

| Bag arriving on that row side | Earlier bag count | Congestion penalty |
|---:|---:|---:|
| 1st | 0 | 0.00 s |
| 2nd | 1 | 0.00 s |
| 3rd | 2 | 0.00 s |
| 4th | 3 | 1.45 s |
| 5th | 4 | 2.90 s |

Passengers without a carry-on do not increment bin load and receive no bin-congestion penalty.

This is congestion, not bin capacity. The model does not make a passenger search another row, move backward, move forward, check a bag, or fail to find space.

The animation draws a suitcase beside every active passenger who has a carry-on. During stowing, the marker moves toward that passenger's row-side overhead strip. When stowing finishes, a persistent bag record is drawn inside that strip for the rest of the run. The animation is a visualization of the existing bag state; the drawn strip is not a physical capacity scale and does not add any new delay.

## 13. Seat conflicts and seating

A seat conflict occurs when a passenger needs to reach a deeper seat but one or more already-seated passengers are between that seat and the aisle on the same side of the same row.

For example, if the aisle and middle seats are occupied when a window passenger arrives, that arrival causes two conflicts.

For each blocker:

- a blocker in the same family or assisted party adds 2.2 seconds
- a blocker from another party adds 5.4 seconds

The simulator adds one to the seat-conflict count for each blocking passenger and adds the corresponding penalty to the arriving passenger's seating time.

Only passengers already marked seated count as blockers. A passenger currently stowing or seating is represented as an aisle obstruction rather than an occupied-seat blocker.

Total seating time is:

```text
base seating time + all seat-conflict penalties
```

The displayed "Seat conflicts" value is the number of blocking-passenger events, not seconds. The simulator also internally accumulates conflict-delay seconds, although the current interface does not display that total separately.

## 14. Blocked aisle measurement

During each simulation step, the aisle is considered blocked if at least one active passenger is:

- stowing a bag or completing the row-arrival pause
- entering a seat

If any such passenger exists, the step duration is added once to "Blocked aisle."

This is the union of blocked time, not the sum across blockers. If three passengers are simultaneously stowing at different rows for one second, the metric increases by one second, not three.

A walking passenger who is merely queued behind someone does not independently add blocked-aisle time. The simulator tracks walking-delay time internally, but the current interface does not display it.

## 15. Completion and reported results

A method simulation ends when every passenger is seated. A 7,200-second safety limit prevents an accidental infinite run.

During an animated race, all six method simulations continue until all six are complete, including methods whose panels are hidden. The displayed winner is chosen from the currently visible method set.

Each visible method reports:

- total simulated time
- seated passengers
- seat-conflict count
- blocked-aisle seconds
- passengers not yet released through the door

The Monte Carlo benchmark runs only the methods selected when the benchmark starts. Its table reports:

- mean completion time
- median completion time
- 90th percentile completion time
- number of trial wins

Percentiles use linear interpolation between neighboring sorted values.

A win is assigned to the method with the smallest completion time in that trial. Exact ties are resolved by the fixed method-list order because the implementation sorts methods by time and selects the first result. The order is Random, Back to Front, Front to Back, Airline Zones, WilMA, then Steffen. Exact ties should be uncommon but are not split fractionally.

## 16. What the model does not currently include

The simulator intentionally omits several real-world effects:

- families seated across multiple rows or in scattered seats
- family members separating in the boarding queue
- individual child ages or behavior beyond the child category
- explicit parent-assistance actions during walking, stowing, or seating
- strollers, car seats, lap infants, or child-restraint installation
- multiple carry-ons, bag sizes, personal items, or shared family bags
- finite overhead-bin capacity, overflow, searching, or reverse movement
- physically scaled bag dimensions or overhead-bin volume; suitcase markers are explanatory symbols
- passengers overtaking one another
- people leaving the aisle to let others pass
- a separate jet-bridge or gate queue
- ticket scanning, document problems, crew intervention, or boarding announcements
- late arrivals after a boarding group has begun
- aircraft-specific aisle width, seat pitch, or door geometry
- connections between deplaning and boarding
- calibrated demographic or airline operational data

Those omissions matter. The simulator is most trustworthy as a controlled comparison of queueing strategies under its stated assumptions, not as a literal forecast of how many minutes a real A320 flight will require.

## 17. Compact parameter reference

| Feature | Current implementation |
|---|---|
| Cabin | 31 rows x 6 seats = 186 |
| Family size | 2-5 passengers, weighted distribution |
| Family seating | Same-row contiguous seat letters; may cross aisle |
| Family adults | 1 in size 2; 1 or 2 in size 3; 2 in sizes 4-5 |
| Child behavior | Slower walking, longer seating, lower bag probability |
| Assisted party | One reduced-mobility passenger plus one adult companion |
| Adult walk speed | 1.17-1.59 row units/s |
| Child walk speed | 0.82-1.10 row units/s |
| Reduced-mobility walk speed | 0.46-0.62 row units/s |
| Carry-on stow time | 4.2-14.2 s before congestion |
| No-bag row pause | 0.35-0.70 s |
| Adult seating | 2.1-4.9 s before conflicts |
| Child seating | 3.8-7.6 s before conflicts |
| Reduced-mobility seating | 7.5-13.0 s before conflicts |
| Same-party seat blocker | +2.2 s and +1 conflict |
| Other-party seat blocker | +5.4 s and +1 conflict |
| Aisle spacing | 0.72 row units |
| Bin congestion | +1.45 s per earlier bag beyond the first two |
| Animation step | 0.10 s |
| Instant-finish step | 0.15 s |
| Benchmark step | 0.20 s |
| Method panel selection | Visibility and benchmark field only; all six animated methods stay synchronized |
| Display modes | Roomy or Compact Fleet; presentation only |
| Visible luggage | Carry-on marker travels to a persistent row-side bin marker; no physical capacity |
