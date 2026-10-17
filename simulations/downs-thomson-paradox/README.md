# Downs-Thomson City Lab

A dependency-free browser traffic microsimulation for exploring the Downs-Thomson paradox. One hundred persistent commuters choose between driving and transit inside a larger simulated city. Driving time is produced by individual vehicles moving through lanes, signals, queues, alternate roads, background traffic, a mountain route, and an optional tunnel.

- [Open the released simulation](https://bortlip.github.io/SharedInfo/simulations/downs-thomson-paradox/)

## What changed from the simple model

There is no `base + congestion * drivers` travel-time curve. Road links have modeled distance and speed that are independent of their drawing size. Each driving commuter becomes a microscopic vehicle with a lane, position, speed, following headway, departure time, and measured arrival time.

The surrounding city also creates hundreds of ambient vehicle trips each morning. Those vehicles are generated from multiple origins and destinations and route through a bidirectional graph containing:

- a west-east urban arterial;
- north/south side streets and four signalized arterial intersections;
- local roads north of the mountain;
- a parallel southern surface route;
- the old mountain highway;
- downtown streets;
- and, after construction, the direct mountain tunnel.

Ambient traffic can reroute when the tunnel opens, so the tracked 100 commuters are not the only vehicles responding to the new road.

## Traffic signals

Signals no longer allow one symbolic car per direction. They model fixed-time phases using:

- configurable cycle length (default 90 seconds);
- configurable main-street green split (default 57%);
- yellow and all-red clearance intervals;
- about two seconds of startup lost time for a standing queue;
- configurable saturation flow (default 1,900 vehicles/hour/lane);
- independent lane queues and discharge clocks;
- and optional coordinated offsets intended to create a rough eastbound green wave.

Once a queue begins discharging on green, multiple vehicles can pass during that phase at the configured saturation headway.

## Lanes and car following

The default city uses a constrained one-lane-per-direction urban arterial feeding a two-lane-per-direction tunnel. Both are adjustable. Cars maintain a standstill spacing and a moving time headway, accelerate/decelerate toward road speed, stop at red lights, wait for downstream lane space, and can create queues that spill backward onto upstream links.

The displayed driving average is simply the mean of each tracked driver's arrival time minus departure time. Red-light delay and traffic/queue delay are also accumulated separately for each driver.

## Transit

Transit riders are individual commuters with their own departure and station-arrival times. They walk to the station, catch the next scheduled train, ride downtown, and walk to their destination.

The default city is calibrated around a pre-tunnel population near 40 drivers / 60 transit riders. Transit maintains its base 3.6-minute headway while at least 60 tracked commuters ride. Below that service-support level, its headway increases according to the configurable **Transit headway penalty**. This is the Downs-Thomson feedback: a road improvement can pull enough riders away that the competing transit service becomes less attractive.

## Route and mode adaptation

Route choice now learns from the simulated traffic rather than using free-flow geometry forever. Every vehicle records the time it actually spent on each directed road link. At the end of the morning, those observations update a persistent expected-time estimate for that link using an exponential learning rate.

Drivers do not all pick one deterministic shortest path. For each origin/destination pair, the router builds a bounded set of plausible alternatives and deliberately keeps distinct corridor families such as the mountain loop, southern parallel road, northern local road, surface streets, and tunnel when available. Each traveler has a persistent route-level preference measured in minutes, so near-equal routes can split traffic instead of tiny link-level perturbations cancelling over a long trip. The **Route preference spread** controls this heterogeneity.

Tracked drivers also have route inertia. A driver keeps yesterday's route unless another perceived route improves on it by more than the configurable **Route switch threshold**. This approximates boundedly rational day-to-day route choice: drivers learn from congestion, but they do not all jump to a marginally faster corridor in lockstep. The **Route learning rate** controls how quickly new observations replace older expectations. Route learning can also be disabled for comparison.

Mode choice continues to adapt separately. After each morning, tracked commuters compare the observed mean driving and transit times. If one mode has no users, the sim uses a counterfactual expected time for that unused mode from the learned road network or current transit timetable, so all-driving and all-transit states are not artificially absorbing just because the unused option has no measured trips.

The simulation declares equilibrium only when there are no scheduled mode switches and tracked driving routes remain unchanged for two consecutive mornings. This prevents a temporary mode balance from being mistaken for equilibrium while drivers are still learning around a congested intersection or newly opened road.

A useful experiment is:

1. Run the old city until both mode choice and route choice stabilize.
2. Build the tunnel without changing anybody's commute mode first.
3. Observe the immediate physical road improvement and immediate route changes.
4. Run repeated mornings while link-time estimates, routes, and commute modes co-adapt.
5. Compare the stable pre- and post-tunnel commute times.
6. Change background traffic, arterial lanes, tunnel lanes/speed, signal timing, saturation flow, signal coordination, route learning rate, route preference spread, route switch threshold, or transit feedback and see when the paradox appears or disappears.

## Remaining simplifications

This is deliberately a teaching microsimulation, not a calibrated transportation forecast. Important remaining simplifications include no pedestrians/bicycles, parking maneuvers, crashes, detailed lane-changing behavior, buses in mixed traffic, protected/permissive left-turn phases, actuated signal detection, or explicit intersection conflict geometry. Turning vehicles use the phase of their incoming approach. Route choice learns only between mornings; cars do not receive live traffic information and reroute while already traveling.

Those omissions are now explicit rather than hidden inside a congestion formula, and they provide natural directions for further iterations if they improve the lesson rather than merely adding machinery.
